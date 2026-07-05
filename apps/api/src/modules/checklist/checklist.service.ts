import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { AutomationService } from '../automation/automation.service';
import { QUEUES } from '../../queue/queue.constants';
import { generateChecklistMasterId, atomicNextChecklistMasterId } from '../../common/utils/id-generator.utils';
import { CachePatterns } from '../../common/utils/cache-keys.utils';
import { getPeriodRange, calculateDelay } from '../../common/utils/date.utils';
import { loadCompanyCalendar } from '../../common/utils/calendar.utils';
import {
  CreateChecklistMasterDto,
  CompleteChecklistTaskDto,
  BulkCompleteChecklistDto,
  ApproveChecklistTaskDto,
  ReworkChecklistTaskDto,
  ChecklistQueryDto,
} from './dto/checklist.dto';

const DEFAULT_START_TIME = '09:00';

@Injectable()
export class ChecklistService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private hierarchy: HierarchyService,
    private automation: AutomationService,
    @InjectQueue(QUEUES.CHECKLIST) private checklistQueue: Queue,
    @InjectQueue(QUEUES.NOTIFICATION) private notificationQueue: Queue,
  ) {}

  // ─── Master CRUD ──────────────────────────────────────────────────────────

  async createMaster(dto: CreateChecklistMasterDto, tenantId: string, createdBy: string, creatorRole: string) {
    // Validate assignees
    const users = await this.prisma.user.findMany({
      where: { id: { in: dto.assignedToIds }, tenantId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });
    if (users.length !== dto.assignedToIds.length) {
      throw new BadRequestException('One or more assignees not found or inactive');
    }

    const visibleIds = await this.hierarchy.getVisibleUserIds(createdBy, creatorRole, tenantId);
    if (visibleIds) {
      const outOfScope = users.filter((user) => !visibleIds.includes(user.id));
      if (outOfScope.length > 0) {
        throw new ForbiddenException('One or more assignees are outside your team visibility');
      }
    }

    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, tenantId, status: 'ACTIVE' },
    });
    if (!project) throw new BadRequestException('Project not found or inactive');

    // Create one master per assignee — BUG-01 fix: atomic sequence per master
    const masters = await Promise.all(
      users.map(async (user) => {
        const seq = await atomicNextChecklistMasterId(this.prisma, tenantId);
        const master = await this.prisma.checklistMaster.create({
          data: {
            tenantId,
            masterId: generateChecklistMasterId(seq),
            assignedToId: user.id,
            createdBy,
            projectId: dto.projectId,
            title: dto.title,
            description: dto.description,
            frequency: dto.frequency,
            startDate: new Date(dto.startDate),
            startTime: dto.startTime ?? DEFAULT_START_TIME,
            endDate: dto.endDate ? new Date(dto.endDate) : null,
            attachmentRequired: dto.attachmentRequired ?? false,
            isActive: true,
          },
        });

        // Queue task generation
        await this.checklistQueue.add('generate-tasks', {
          masterId: master.id,
          tenantId,
        });

        return master;
      }),
    );

    // Fire TASK_CREATED once per assignee here at the master level, not once per
    // generated task instance — generate-tasks (checklist.processor.ts) can bulk
    // -create up to a year of occurrences from a single recurring master, and
    // flooding automation rules with hundreds of events for one admin action
    // wouldn't match what "a task was created" means to someone building a rule.
    for (const master of masters) {
      await this.automation.triggerEvent(tenantId, 'TASK_CREATED', {
        taskId: master.id,
        taskTitle: master.title,
        refType: 'CHECKLIST',
        assigneeId: master.assignedToId,
      });
    }

    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return masters.length === 1 ? masters[0] : masters;
  }

  async findMasters(tenantId: string, userId: string, role: string) {
    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    const where: any = { tenantId };
    if (visibleIds) where.assignedToId = { in: visibleIds };

    return this.prisma.checklistMaster.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggleMaster(id: string, tenantId: string) {
    const master = await this.prisma.checklistMaster.findFirst({ where: { id, tenantId } });
    if (!master) throw new NotFoundException('Checklist master not found');

    const updated = await this.prisma.checklistMaster.update({
      where: { id },
      data: { isActive: !master.isActive },
    });

    // LE-12 fix: toggling a master changes active checklist counts on the dashboard
    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    return updated;
  }

  // ─── Task queries ─────────────────────────────────────────────────────────

  async findTasks(tenantId: string, userId: string, role: string, query: ChecklistQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    const where: any = { tenantId };
    if (query.status) {
      const statuses = query.status.split(',').map((s) => s.trim()).filter(Boolean);
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (query.projectId) where.projectId = query.projectId;
    // Same fix as DelegationService.findAll: honour assignedToId even when
    // the admin has a hierarchy group (previously the !visibleIds guard
    // silently dropped the per-user filter for admins).
    if (query.assignedToMe) {
      where.assignedToId = userId;
    } else if (query.assignedToId) {
      where.assignedToId = query.assignedToId;
    } else if (visibleIds) {
      where.assignedToId = { in: visibleIds };
    }

    if (query.period) {
      const range = getPeriodRange(query.period as any);
      if (range) {
        const { from, to } = range;
        where.plannedDate = { gte: from, lte: to };
      }
    } else if (query.dateFrom || query.dateTo) {
      where.plannedDate = {};
      if (query.dateFrom) where.plannedDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.plannedDate.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.checklistTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ plannedDate: 'asc' }],
        include: {
          assignedTo: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          master: { select: { id: true, frequency: true, attachmentRequired: true } },
        },
      }),
      this.prisma.checklistTask.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findMyPendingTasks(tenantId: string, userId: string) {
    return this.prisma.checklistTask.findMany({
      where: {
        tenantId,
        assignedToId: userId,
        status: { in: ['PENDING', 'LATE', 'REWORK', 'SEND_FOR_APPROVAL'] },
      },
      orderBy: [{ plannedDate: 'asc' }],
      include: {
        project: { select: { id: true, name: true } },
        master: { select: { frequency: true, attachmentRequired: true, createdBy: true } },
      },
    });
  }

  // ─── Complete ─────────────────────────────────────────────────────────────

  async completeTask(
    id: string,
    dto: CompleteChecklistTaskDto,
    tenantId: string,
    userId: string,
  ) {
    const task = await this.prisma.checklistTask.findFirst({ where: { id, tenantId } });
    if (!task) throw new NotFoundException('Checklist task not found');

    if (task.assignedToId !== userId) {
      throw new ForbiddenException('You can only complete your own checklist tasks');
    }
    if (task.status === 'COMPLETED' || task.status === 'SEND_FOR_APPROVAL') {
      throw new BadRequestException(
        task.status === 'COMPLETED' ? 'Task already completed' : 'Task is already pending approval',
      );
    }

    if (task.attachmentRequired && (!dto.attachmentIds || dto.attachmentIds.length === 0)) {
      throw new BadRequestException('Attachment is required for this checklist task');
    }

    const now = new Date();

    // DATA-01 fix: use calendar-aware working-day delay instead of raw
    // millisecond math.  Raw math overcounts delay across weekends/holidays
    // (e.g. a task due Friday 6pm completed Monday 10am shows ~3 days late
    // instead of 0).  The calendar data is loaded from the tenant's holiday
    // config just like delegation.service.ts#approve does.
    const calendar = await loadCompanyCalendar(this.prisma, task.tenantId, task.plannedDate, now);
    const { delayDays, onTimeStatus } = calculateDelay(task.plannedDate, now, calendar);

    const updated = await this.prisma.checklistTask.update({
      where: { id },
      data: {
        status: 'SEND_FOR_APPROVAL',
        actualDate: now,
        completedAt: now,
        completedById: userId,
        remarks: dto.remarks,
        attachmentIds: dto.attachmentIds ?? [],
        onTimeStatus,
        delayDays,
      },
    });

    const master = await this.prisma.checklistMaster.findFirst({
      where: { id: task.masterId, tenantId },
      select: { createdBy: true },
    });
    if (!master) {
      throw new NotFoundException('Checklist master not found');
    }

    await this.notificationQueue.add('create-notification', {
      tenantId,
      userId: master.createdBy,
      type: 'APPROVAL_PENDING',
      title: 'Checklist Ready for Review',
      body: `"${task.title}" has been submitted for approval.`,
      refType: 'CHECKLIST',
      refId: id,
    });

    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return updated;
  }

  async approveTask(
    id: string,
    dto: ApproveChecklistTaskDto,
    tenantId: string,
    reviewerId: string,
  ) {
    const task = await this.prisma.checklistTask.findFirst({
      where: { id, tenantId },
      include: {
        master: { select: { createdBy: true } },
      },
    });
    if (!task) throw new NotFoundException('Checklist task not found');

    await this.assertCanReviewTask(task, tenantId, reviewerId);

    if (task.status !== 'SEND_FOR_APPROVAL') {
      throw new BadRequestException('Checklist task is not pending approval');
    }
    if (!task.actualDate) {
      throw new BadRequestException('Checklist task is missing a submission timestamp');
    }

    const calendar = await loadCompanyCalendar(this.prisma, task.tenantId, task.plannedDate, task.actualDate);
    const { delayDays, onTimeStatus } = calculateDelay(task.plannedDate, task.actualDate, calendar);

    const nextRemarks = dto.remarks?.trim()
      ? `${task.remarks ?? ''}${task.remarks ? '\n\n' : ''}Approved: ${dto.remarks.trim()}`
      : task.remarks;

    const updated = await this.prisma.checklistTask.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        remarks: nextRemarks,
        delayDays,
        onTimeStatus,
      },
    });

    await this.notificationQueue.add('create-notification', {
      tenantId,
      userId: task.assignedToId,
      type: 'TASK_APPROVED',
      title: 'Checklist Approved',
      body: `Your checklist task "${task.title}" has been approved.`,
      refType: 'CHECKLIST',
      refId: id,
    });

    await this.automation.triggerEvent(tenantId, 'TASK_COMPLETED', {
      taskId: id,
      taskTitle: task.title,
      refType: 'CHECKLIST',
      assigneeId: task.assignedToId,
      delayDays,
    });

    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return updated;
  }

  async reworkTask(
    id: string,
    dto: ReworkChecklistTaskDto,
    tenantId: string,
    reviewerId: string,
  ) {
    const task = await this.prisma.checklistTask.findFirst({
      where: { id, tenantId },
      include: {
        master: { select: { createdBy: true } },
      },
    });
    if (!task) throw new NotFoundException('Checklist task not found');

    await this.assertCanReviewTask(task, tenantId, reviewerId);

    if (task.status !== 'SEND_FOR_APPROVAL') {
      throw new BadRequestException('Checklist task is not pending approval');
    }

    const existingRemarks = task.remarks ?? '';
    const reworkNote = `Rework Required: ${dto.reworkRemark}`;

    const updated = await this.prisma.checklistTask.update({
      where: { id },
      data: {
        status: 'REWORK',
        remarks: existingRemarks ? `${existingRemarks}\n\n${reworkNote}` : reworkNote,
        actualDate: null,
        completedAt: null,
        completedById: null,
        delayDays: null,
        onTimeStatus: null,
      },
    });

    await this.notificationQueue.add('create-notification', {
      tenantId,
      userId: task.assignedToId,
      type: 'REWORK_REQUESTED',
      title: 'Checklist Rework Required',
      body: `"${task.title}" needs rework: ${dto.reworkRemark}`,
      refType: 'CHECKLIST',
      refId: id,
    });

    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return updated;
  }

  async bulkComplete(dto: BulkCompleteChecklistDto, tenantId: string, userId: string) {
    const tasks = await this.prisma.checklistTask.findMany({
      where: { id: { in: dto.taskIds }, tenantId, assignedToId: userId },
    });

    if (tasks.length !== dto.taskIds.length) {
      throw new BadRequestException('One or more tasks not found or not assigned to you');
    }

    const blocked = tasks.filter(
      (t) => t.attachmentRequired && (!dto.attachmentIds || dto.attachmentIds.length === 0),
    );
    if (blocked.length > 0) {
      throw new BadRequestException(
        `${blocked.length} task(s) require an attachment — upload proof before bulk submitting: ${blocked.map((t) => t.taskId).join(', ')}`,
      );
    }

    const now = new Date();
    const pending = tasks.filter((t) => ['PENDING', 'LATE', 'REWORK'].includes(t.status));

    await Promise.all(
      pending.map(async (task) => {
        // DATA-01 fix: calendar-aware delay, consistent with completeTask() above
        const calendar = await loadCompanyCalendar(this.prisma, task.tenantId, task.plannedDate, now);
        const { delayDays, onTimeStatus } = calculateDelay(task.plannedDate, now, calendar);

        await this.prisma.checklistTask.update({
          where: { id: task.id },
          data: {
            status: 'SEND_FOR_APPROVAL',
            actualDate: now,
            completedAt: now,
            completedById: userId,
            remarks: dto.remarks,
            attachmentIds: dto.attachmentIds ?? [],
            onTimeStatus,
            delayDays,
          },
        });
        const master = await this.prisma.checklistMaster.findFirst({
          where: { id: task.masterId, tenantId },
          select: { createdBy: true },
        });
        if (master) {
          await this.notificationQueue.add('create-notification', {
            tenantId,
            userId: master.createdBy,
            type: 'APPROVAL_PENDING',
            title: 'Checklist Ready for Review',
            body: `"${task.title}" has been submitted for approval.`,
            refType: 'CHECKLIST',
            refId: task.id,
          });
        }
      }),
    );

    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return { completed: pending.length, message: 'Tasks submitted for approval' };
  }

  async getPendingCount(tenantId: string, userId: string): Promise<number> {
    return this.prisma.checklistTask.count({
      where: { tenantId, assignedToId: userId, status: { in: ['PENDING', 'LATE', 'REWORK'] } },
    });
  }

  async getPendingApprovalCount(tenantId: string, reviewerId: string): Promise<number> {
    return this.prisma.checklistTask.count({
      where: {
        tenantId,
        status: 'SEND_FOR_APPROVAL',
        master: { is: { createdBy: reviewerId } },
      },
    });
  }

  async exportAll(tenantId: string) {
    const masters = await (this.prisma.checklistMaster as any).findMany({
      where: { tenantId },
      select: {
        assignedTo: { select: { email: true } },
        project: { select: { name: true } },
        title: true,
        frequency: true,
        startDate: true,
        startTime: true,
        attachmentRequired: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    return masters.map((m: any) => ({
      AssignedTo: m.assignedTo?.email ?? '',
      Project: m.project?.name ?? '',
      Title: m.title,
      Frequency: m.frequency,
      StartDate: m.startDate ? new Date(m.startDate).toISOString().split('T')[0] : '',
      StartTime: m.startTime ?? '',
      AttachmentRequired: m.attachmentRequired ? 'YES' : 'NO',
    }));
  }

  async importBulk(rows: any[], tenantId: string, importedById: string) {
    const emails = [...new Set(rows.map((r) => (r.AssignedTo ?? '').toString().trim().toLowerCase()).filter(Boolean))];
    const projectNames = [...new Set(rows.map((r) => (r.Project ?? '').toString().trim()).filter(Boolean))];

    const [users, projects] = await Promise.all([
      this.prisma.user.findMany({ where: { tenantId, email: { in: emails }, status: 'ACTIVE' }, select: { id: true, email: true } }),
      projectNames.length
        ? this.prisma.project.findMany({ where: { tenantId, name: { in: projectNames } }, select: { id: true, name: true } })
        : Promise.resolve([] as { id: string; name: string }[]),
    ]);

    const userMap = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
    const projectMap = new Map(projects.map((p) => [p.name.toLowerCase(), p.id]));

    let created = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const email = (row.AssignedTo ?? '').toString().trim().toLowerCase();
      const title = (row.Title ?? '').toString().trim();
      const startDate = (row.StartDate ?? '').toString().trim();
      const frequency = (row.Frequency ?? 'DAILY').toString().trim().toUpperCase();

      if (!email || !title || !startDate) {
        errors.push('Row skipped: AssignedTo, Title, and StartDate are required');
        continue;
      }

      const userId = userMap.get(email);
      if (!userId) { errors.push(`User not found: ${row.AssignedTo}`); continue; }

      const projectName = (row.Project ?? '').toString().trim();
      const projectId = projectName ? projectMap.get(projectName.toLowerCase()) : undefined;
      if (projectName && !projectId) { errors.push(`Project not found: ${projectName}`); continue; }

      try {
        const { atomicNextChecklistMasterId: nextMasterId, generateChecklistMasterId: genMasterId } = await import('../../common/utils/id-generator.utils');
        const seq = await nextMasterId(this.prisma, tenantId);
        const masterId = genMasterId(seq);

        await (this.prisma.checklistMaster as any).create({
          data: {
            tenantId,
            masterId,
            title,
            assignedToId: userId,
            projectId: projectId ?? undefined,
            frequency,
            startDate: new Date(startDate),
            startTime: row.StartTime?.toString().trim() || DEFAULT_START_TIME,
            attachmentRequired: (row.AttachmentRequired ?? '').toString().toUpperCase() === 'YES',
            tags: [],
            createdBy: importedById,
          },
        });
        created++;
      } catch (e) {
        errors.push(`Row error: ${(e as Error).message}`);
      }
    }

    return { created, errors };
  }

  private async assertCanReviewTask(task: { assignedToId: string; master: { createdBy: string } | null }, tenantId: string, reviewerId: string) {
    const reviewer = await this.prisma.user.findFirst({
      where: { id: reviewerId, tenantId, status: 'ACTIVE' },
      select: { role: true },
    });
    if (!reviewer) throw new ForbiddenException('Reviewer not found or inactive');

    const visibleIds = await this.hierarchy.getVisibleUserIds(reviewerId, reviewer.role, tenantId);
    if (!visibleIds) return;

    const canReview = task.master?.createdBy === reviewerId || visibleIds.includes(task.assignedToId);
    if (!canReview) {
      throw new ForbiddenException('You can only review checklist tasks assigned by you or visible to your team');
    }
  }
}
