import {
  Injectable,
  Optional,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { AutomationService } from '../automation/automation.service';
import { QUEUES } from '../../queue/queue.constants';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { getPeriodRange, parseFrontendDateTime, calculateDelay, isHolidayDate } from '../../common/utils/date.utils';
import { loadCompanyCalendar } from '../../common/utils/calendar.utils';
import { generateDelegationId, atomicNextDelegationId } from '../../common/utils/id-generator.utils';
import { CachePatterns } from '../../common/utils/cache-keys.utils';
import {
  CreateDelegationTaskDto,
  CreateDelegationBulkDto,
  SubmitDelegationDto,
  ApproveDelegationDto,
  ReworkDelegationDto,
  DelegationQueryDto,
} from './dto/delegation.dto';

@Injectable()
export class DelegationService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private configService: ConfigService,
    private hierarchy: HierarchyService,
    private automation: AutomationService,
    @InjectQueue(QUEUES.EMAIL) private emailQueue: Queue,
    @InjectQueue(QUEUES.NOTIFICATION) private notificationQueue: Queue,
    @Optional() private gateway: NotificationsGateway,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Creates one DelegationTask per doer in delegatedToIds.
   * Admin/Manager only.
   */
  async create(
    dto: CreateDelegationTaskDto,
    tenantId: string,
    delegatedById: string,
    delegatedByRole: string,
  ) {
    // Validate doers belong to tenant and are active
    const doers = await this.prisma.user.findMany({
      where: { id: { in: dto.delegatedToIds }, tenantId, status: 'ACTIVE' },
      select: { id: true, name: true, email: true },
    });
    if (doers.length !== dto.delegatedToIds.length) {
      throw new BadRequestException('One or more assignees not found or inactive');
    }

    const visibleIds = await this.hierarchy.getVisibleUserIds(delegatedById, delegatedByRole, tenantId);
    if (visibleIds) {
      const outOfScope = doers.filter((doer) => !visibleIds.includes(doer.id));
      if (outOfScope.length > 0) {
        throw new ForbiddenException('One or more assignees are outside your team visibility');
      }
    }

    // Validate project
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, tenantId, status: 'ACTIVE' },
    });
    if (!project) throw new BadRequestException('Project not found or inactive');

    // Get delegator info for emails
    const delegator = await this.prisma.user.findUnique({
      where: { id: delegatedById },
      select: { name: true },
    });

    // Parse the frontend's YYYY-MM-DD + HH:mm in the tenant's configured
    // timezone, not the server process's local timezone — `new Date(\`${d}T${t}:00\`)`
    // would silently misinterpret the intended due time whenever the server
    // doesn't happen to run in the same timezone as the company (e.g. a UTC
    // server with an Asia/Kolkata tenant would be off by 5.5 hours).
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const tz = tenant?.timezone ?? 'UTC';
    const targetDate = parseFrontendDateTime(
      dto.targetDate,
      dto.targetTime || '18:00',
      tz,
    );

    const holidayOnDate = await this.prisma.holidayCalendar.findFirst({
      where: {
        tenantId,
        date: {
          gte: new Date(dto.targetDate + 'T00:00:00.000Z'),
          lte: new Date(dto.targetDate + 'T23:59:59.999Z'),
        },
      },
      select: { name: true },
    });
    if (holidayOnDate) {
      throw new BadRequestException(
        `Cannot assign work on ${dto.targetDate} — it is a holiday (${holidayOnDate.name})`,
      );
    }

    // Create one task per doer — each gets its own atomic sequence number
    // (BUG-01 fix: previously used count+idx which is not atomic under concurrency)
    const tasks = await Promise.all(
      doers.map(async (doer) => {
        const seq = await atomicNextDelegationId(this.prisma, tenantId);
        const taskId = generateDelegationId(seq);
        return this.prisma.delegationTask.create({
          data: {
            tenantId,
            taskId,
            delegatedById,
            delegatedToId: doer.id,
            projectId: dto.projectId,
            title: dto.title,
            description: dto.description,
            targetDate,
            priority: dto.priority ?? 'MEDIUM',
            attachmentIds: dto.attachmentIds ?? [],
            status: 'PENDING',
          },
        });
      }),
    );

    // Notify each doer
    for (const doer of doers) {
      const task = tasks.find((t) => t.delegatedToId === doer.id);
      await this.emailQueue.add('send-email', {
        to: doer.email,
        subject: `📋 Delegation Assigned: ${dto.title}`,
        template: 'task-assigned',
        data: {
          assigneeName: doer.name,
          taskTitle: dto.title,
          priority: dto.priority,
          dueDate: dto.targetDate,
          assignedBy: delegator?.name ?? 'Admin',
          taskUrl: task
            ? `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/delegation?id=${task.id}`
            : `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/delegation`,
        },
      });

      await this.notificationQueue.add('create-notification', {
        tenantId,
        userId: doer.id,
        type: 'TASK_ASSIGNED',
        title: '📋 Delegation Assigned',
        body: `Delegation "${dto.title}" has been assigned to you by ${delegator?.name ?? 'the admin'}. Due: ${dto.targetDate}.`,
        refType: 'DELEGATION',
        refId: task?.id,
      });
    }

    // Fire TASK_CREATED for any active automation rule watching this trigger.
    // One event per created task, so a rule's context always carries a single
    // unambiguous assignee — matches the granularity TASK_OVERDUE/TASK_COMPLETED
    // already use elsewhere.
    for (const task of tasks) {
      await this.automation.triggerEvent(tenantId, 'TASK_CREATED', {
        taskId: task.id,
        taskTitle: task.title,
        refType: 'DELEGATION',
        assigneeId: task.delegatedToId,
      });
    }

    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return tasks.length === 1 ? tasks[0] : tasks;
  }

  async bulkCreate(
    dto: CreateDelegationBulkDto,
    tenantId: string,
    delegatedById: string,
    delegatedByRole: string,
  ) {
    if (dto.tasks.length === 0) {
      throw new BadRequestException('Add at least one task before submitting');
    }

    const created: any[] = [];
    for (const task of dto.tasks) {
      const result = await this.create(
        {
          delegatedToIds: dto.delegatedToIds,
          projectId: dto.projectId,
          title: task.title,
          description: task.description,
          targetDate: task.targetDate,
          targetTime: task.targetTime,
          priority: task.priority,
          attachmentIds: task.attachmentIds,
        },
        tenantId,
        delegatedById,
        delegatedByRole,
      );

      created.push(...(Array.isArray(result) ? result : [result]));
    }

    return created;
  }

  // ─── Query ────────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    userId: string,
    role: string,
    query: DelegationQueryDto,
  ) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 500);
    const skip = (page - 1) * limit;

    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);

    const where: any = { tenantId };
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    // Apply assignedToId filter first (most specific), then fall back to
    // the hierarchy visibility set.  Previously `!visibleIds` meant the
    // per-user filter was silently dropped for any admin who had a hierarchy
    // group, so the "Filter by Employee" dropdown on the team view did nothing.
    if (query.assignedToId) {
      where.delegatedToId = query.assignedToId;
    } else if (visibleIds) {
      where.delegatedToId = { in: visibleIds };
    }

    // Date filter
    if (query.period) {
      const range = getPeriodRange(query.period as any);
      if (range) {
        const { from, to } = range;
        where.createdAt = { gte: from, lte: to };
      }
    } else if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const orderBy: any = (() => {
      switch (query.sortBy) {
        case 'CREATED_AT':
          return [{ createdAt: sortDir }, { targetDate: 'asc' }];
        case 'PROJECT':
          return [{ project: { name: sortDir } }, { targetDate: 'asc' }];
        case 'ASSIGNEE':
          return [{ delegatedTo: { name: sortDir } }, { targetDate: 'asc' }];
        case 'STATUS':
          return [{ status: sortDir }, { targetDate: 'asc' }];
        case 'DUE_DATE':
        default:
          return [{ targetDate: sortDir }, { priority: 'desc' }];
      }
    })();

    const [data, total] = await Promise.all([
      this.prisma.delegationTask.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          delegatedBy: { select: { id: true, name: true } },
          delegatedTo: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true, color: true } },
        },
      }),
      this.prisma.delegationTask.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findMyPending(tenantId: string, userId: string) {
    // BUG-05 fix: include SEND_FOR_APPROVAL so employees can track tasks
    // they submitted — previously those disappeared from the My Pending list
    // the moment they clicked Done.
    return this.prisma.delegationTask.findMany({
      where: {
        tenantId,
        delegatedToId: userId,
        status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK', 'SEND_FOR_APPROVAL'] },
      },
      orderBy: [{ priority: 'desc' }, { targetDate: 'asc' }],
      include: {
        delegatedBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, color: true } },
      },
    });
  }

  async findOne(id: string, tenantId: string, userId?: string, role?: string) {
    const task = await this.prisma.delegationTask.findFirst({
      where: { id, tenantId },
      include: {
        delegatedBy: { select: { id: true, name: true, email: true } },
        delegatedTo: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, color: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (userId && role) {
      await this.assertCanViewTask(task, tenantId, userId, role);
    }
    return task;
  }

  // ─── Employee submits done ─────────────────────────────────────────────────

  async submitForApproval(
    id: string,
    dto: SubmitDelegationDto,
    tenantId: string,
    userId: string,
  ) {
    const task = await this.findOne(id, tenantId);

    if (task.delegatedToId !== userId) {
      throw new ForbiddenException('You can only submit your own tasks');
    }
    if (!['PENDING', 'IN_PROGRESS', 'REWORK'].includes(task.status)) {
      throw new BadRequestException(`Cannot submit task with status: ${task.status}`);
    }

    const updated = await this.prisma.delegationTask.update({
      where: { id },
      data: {
        status: 'SEND_FOR_APPROVAL',
        doerRemarks: dto.doerRemarks,
        doerAttachmentIds: dto.attachmentIds ?? [],
        submittedAt: new Date(),
      },
    });

    // Notify approver (delegatedBy / admin)
    await this.notificationQueue.add('create-notification', {
      tenantId,
      userId: task.delegatedById,
      type: 'APPROVAL_PENDING',
      title: '✅ Task Ready for Approval',
      body: `"${task.title}" has been submitted for your review.`,
      refType: 'DELEGATION',
      refId: id,
    });

    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return updated;
  }

  // ─── Admin approves ───────────────────────────────────────────────────────

  async approve(
    id: string,
    dto: ApproveDelegationDto,
    tenantId: string,
    approverId: string,
  ) {
    const task = await this.findOne(id, tenantId);
    await this.assertCanReviewTask(task, tenantId, approverId);

    if (task.status !== 'SEND_FOR_APPROVAL') {
      throw new BadRequestException('Task is not pending approval');
    }

    const now = new Date();
    // LE-01 fix: use the actual submission timestamp, not approval time.
    // A task submitted on time but approved 3 days later must NOT be marked LATE.
    // If submittedAt is missing (legacy data), throw rather than silently using now.
    const submittedAt = (task as any).submittedAt as Date | undefined;
    if (!submittedAt) {
      throw new BadRequestException(
        'Task is missing a submission timestamp — cannot calculate delay accurately. Please contact support.',
      );
    }
    // Working-day/holiday-aware delay — a task due Friday 6pm and submitted
    // Monday 10am should not count as 3 days late (weekend is non-working time).
    const calendar = await loadCompanyCalendar(this.prisma, tenantId, task.targetDate, submittedAt);
    const { delayDays, onTimeStatus } = calculateDelay(task.targetDate, submittedAt, calendar);

    const updated = await this.prisma.delegationTask.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        approvedById: approverId,
        approvedAt: now,
        finalRemarks: dto.remarks,
        rating: dto.rating,
        delayDays,
        onTimeStatus,
        actualDate: now,
      },
    });

    // Notify doer
    await this.notificationQueue.add('create-notification', {
      tenantId,
      userId: task.delegatedToId,
      type: 'TASK_APPROVED',
      title: '🎉 Task Approved',
      body: `Your task "${task.title}" has been approved!`,
      refType: 'DELEGATION',
      refId: id,
    });

    this.gateway?.emitTaskUpdated(task.delegatedToId, {
      taskId: id,
      taskType: 'DELEGATION',
      status: 'COMPLETED',
      updatedBy: approverId,
    });

    await this.automation.triggerEvent(tenantId, 'TASK_COMPLETED', {
      taskId: id,
      taskTitle: task.title,
      refType: 'DELEGATION',
      assigneeId: task.delegatedToId,
      delayDays,
    });

    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return updated;
  }

  // ─── Admin sends rework ───────────────────────────────────────────────────

  async rework(
    id: string,
    dto: ReworkDelegationDto,
    tenantId: string,
    reviewerId: string,
  ) {
    const task = await this.findOne(id, tenantId);
    await this.assertCanReviewTask(task, tenantId, reviewerId);

    if (task.status !== 'SEND_FOR_APPROVAL') {
      throw new BadRequestException('Task is not pending approval');
    }

    const updated = await this.prisma.delegationTask.update({
      where: { id },
      data: {
        status: 'REWORK',
        reworkRemark: dto.reworkRemark,
        reworkCount: { increment: 1 },
        submittedAt: null,
      },
    });

    await this.notificationQueue.add('create-notification', {
      tenantId,
      userId: task.delegatedToId,
      type: 'REWORK_REQUESTED',
      title: '🔄 Task Sent for Rework',
      body: `"${task.title}" needs rework: ${dto.reworkRemark}`,
      refType: 'DELEGATION',
      refId: id,
    });

    this.gateway?.emitTaskUpdated(task.delegatedToId, {
      taskId: id,
      taskType: 'DELEGATION',
      status: 'REWORK',
      updatedBy: reviewerId,
    });

    // LE-10 fix: rework changes both dashboard counts (pending ↑) and MIS — clear both
    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return updated;
  }

  async getPendingApprovalCount(tenantId: string, approverId: string): Promise<number> {
    return this.prisma.delegationTask.count({
      where: { tenantId, delegatedById: approverId, status: 'SEND_FOR_APPROVAL' },
    });
  }

  async getMyPendingCount(tenantId: string, userId: string): Promise<number> {
    return this.prisma.delegationTask.count({
      where: { tenantId, delegatedToId: userId, status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK', 'SEND_FOR_APPROVAL'] } },
    });
  }

  async exportAll(tenantId: string) {
    const tasks = await this.prisma.delegationTask.findMany({
      where: { tenantId },
      select: {
        delegatedTo: { select: { email: true } },
        project: { select: { name: true } },
        title: true,
        description: true,
        targetDate: true,
        targetTime: true,
        priority: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    return tasks.map((t) => ({
      AssignedTo: t.delegatedTo?.email ?? '',
      Project: t.project?.name ?? '',
      Title: t.title,
      Description: t.description ?? '',
      TargetDate: t.targetDate ? new Date(t.targetDate).toISOString().split('T')[0] : '',
      TargetTime: t.targetTime ?? '',
      Priority: t.priority,
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
      const targetDate = (row.TargetDate ?? '').toString().trim();

      if (!email || !title || !targetDate) {
        errors.push('Row skipped: AssignedTo, Title, and TargetDate are required');
        continue;
      }

      const userId = userMap.get(email);
      if (!userId) { errors.push(`User not found: ${row.AssignedTo}`); continue; }

      const projectName = (row.Project ?? '').toString().trim();
      const projectId = projectName ? projectMap.get(projectName.toLowerCase()) : undefined;
      if (projectName && !projectId) { errors.push(`Project not found: ${projectName}`); continue; }

      try {
        const { atomicNextDelegationId, generateDelegationId } = await import('../../common/utils/id-generator.utils');
        const seq = await atomicNextDelegationId(this.prisma, tenantId);
        const taskId = generateDelegationId(seq);

        await this.prisma.delegationTask.create({
          data: {
            tenantId,
            taskId,
            title,
            description: (row.Description ?? '').toString().trim() || undefined,
            delegatedById: importedById,
            delegatedToId: userId,
            projectId: projectId ?? undefined,
            priority: (row.Priority ?? 'MEDIUM').toString().toUpperCase() as any,
            targetDate: new Date(targetDate),
            targetTime: row.TargetTime?.toString().trim() || undefined,
            status: 'PENDING',
          },
        });
        created++;
      } catch (e) {
        errors.push(`Row error: ${(e as Error).message}`);
      }
    }

    return { created, errors };
  }

  private async assertCanViewTask(task: any, tenantId: string, userId: string, role: string) {
    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    if (!visibleIds) return;

    const canView = task.delegatedToId === userId
      || task.delegatedById === userId
      || visibleIds.includes(task.delegatedToId);

    if (!canView) {
      throw new ForbiddenException('You do not have access to this task');
    }
  }

  private async assertCanReviewTask(task: any, tenantId: string, reviewerId: string) {
    const reviewer = await this.prisma.user.findFirst({
      where: { id: reviewerId, tenantId, status: 'ACTIVE' },
      select: { role: true },
    });
    if (!reviewer) throw new ForbiddenException('Reviewer not found or inactive');

    const visibleIds = await this.hierarchy.getVisibleUserIds(reviewerId, reviewer.role, tenantId);
    if (!visibleIds) return;

    const canReview = task.delegatedById === reviewerId || visibleIds.includes(task.delegatedToId);
    if (!canReview) {
      throw new ForbiddenException('You can only review tasks assigned by you or visible to your team');
    }
  }
}
