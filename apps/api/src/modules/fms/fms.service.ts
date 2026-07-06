import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { AutomationService } from '../automation/automation.service';
import { QUEUES } from '../../queue/queue.constants';
import { CachePatterns } from '../../common/utils/cache-keys.utils';
import { calculateDelay, skipToNextWorkingDay } from '../../common/utils/date.utils';
import { loadCompanyCalendar } from '../../common/utils/calendar.utils';
import { isApproverRole } from '../../common/utils/role.utils';
import {
  generateFmsWorkflowId,
  generateFmsTaskId,
  atomicNextFmsWorkflowId,
  atomicNextFmsTaskId,
} from '../../common/utils/id-generator.utils';
import {
  CreateFmsWorkflowDto,
  CreateFmsStepDto,
  CompleteFmsStepDto,
  FmsQueryDto,
  CreateAndStartWorkflowDto,
} from './dto/fms.dto';

@Injectable()
export class FmsService {
  private readonly logger = new Logger(FmsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private hierarchy: HierarchyService,
    private automation: AutomationService,
    @InjectQueue(QUEUES.NOTIFICATION) private notificationQueue: Queue,
  ) {}

  // ─── Workflows ─────────────────────────────────────────────────────────────

  async createWorkflow(dto: CreateFmsWorkflowDto, tenantId: string, createdBy: string) {
    try {
      // BUG-01 fix: atomic sequence; GAP-07 fix: use shared utility for consistent WF-YYYY-NNN format
      const seq = await atomicNextFmsWorkflowId(this.prisma, tenantId);
      const workflowId = generateFmsWorkflowId(seq);

      return await this.prisma.fmsWorkflow.create({
        data: {
          tenantId,
          workflowId,
          name: dto.name,
          description: dto.description ?? '',
          projectId: dto.projectId ?? undefined,
          createdBy,
          status: 'DRAFT',
          tags: [],
        },
      });
    } catch (err: any) {
      this.logger.error('createWorkflow failed', err?.message, err?.stack);
      throw new InternalServerErrorException(err?.message ?? 'Failed to create workflow');
    }
  }

  async createAndStart(dto: CreateAndStartWorkflowDto, tenantId: string, actorId: string, actorRole: string) {
    try {
      const seq = await atomicNextFmsWorkflowId(this.prisma, tenantId);
      const workflowId = generateFmsWorkflowId(seq);

      const workflow = await this.prisma.fmsWorkflow.create({
        data: {
          tenantId,
          workflowId,
          name: dto.name,
          description: dto.description ?? '',
          projectId: dto.projectId ?? undefined,
          createdBy: actorId,
          status: 'PUBLISHED',
          tags: [],
        },
      });

      const steps = dto.steps ?? [];
      const today = new Date();
      let cumulativeDays = 0;
      const taskResults: any[] = [];

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { timezone: true, workingDays: true },
      });
      const tz = tenant?.timezone ?? 'UTC';
      const workingDays = tenant?.workingDays?.length ? tenant.workingDays : [1, 2, 3, 4, 5, 6];
      const maxFuture = new Date(today);
      maxFuture.setFullYear(maxFuture.getFullYear() + 1);
      const holidays = await this.prisma.holidayCalendar.findMany({
        where: { tenantId, date: { gte: today, lte: maxFuture } },
        select: { date: true },
      });
      const holidayDates = holidays.map((h) => h.date);

      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const tatDays = Math.max(1, Math.ceil((Number(s.tatHours) || 24) / 24));
        cumulativeDays += tatDays;
        const rawDate = new Date(today);
        rawDate.setDate(today.getDate() + cumulativeDays);
        const plannedDate = skipToNextWorkingDay(rawDate, workingDays, holidayDates, tz);

        if (!s.assignedToId) continue;

        const assignee = await this.prisma.user.findFirst({
          where: { id: s.assignedToId, tenantId, status: 'ACTIVE' },
          select: { id: true, name: true },
        });
        if (!assignee) continue;

        const taskSeq = await atomicNextFmsTaskId(this.prisma, tenantId);
        const fmsTaskId = generateFmsTaskId(taskSeq);

        const task = await this.prisma.fmsTask.create({
          data: {
            tenantId,
            workflowId: workflow.id,
            fmsTaskId,
            personId: s.assignedToId,
            stepNo: i + 1,
            stepName: s.title,
            what: s.description || s.title,
            fmsName: workflow.name,
            plannedDate,
            status: 'PENDING',
            attachmentIds: [],
          },
        });
        taskResults.push(task);

        await this.notificationQueue.add('create-notification', {
          tenantId,
          userId: s.assignedToId,
          type: 'FMS_STEP_ASSIGNED',
          title: '🔄 FMS Step Assigned',
          body: `FMS step "${s.title}" in workflow "${workflow.name}" has been assigned to you. Planned date: ${plannedDate.toISOString().slice(0, 10)}.`,
          refType: 'FMS_TASK',
          refId: task.id,
        });
      }

      await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
      await this.redis.delByPattern(CachePatterns.mis(tenantId));

      return { workflow, tasksCreated: taskResults.length, total: steps.length };
    } catch (err: any) {
      this.logger.error('createAndStart failed', err?.message, err?.stack);
      throw new InternalServerErrorException(err?.message ?? 'Failed to create workflow');
    }
  }

  async findWorkflows(tenantId: string) {
    return this.prisma.fmsWorkflow.findMany({
      where: { tenantId },
      include: {
        steps: { select: { id: true, stepNo: true, stepName: true } },
        _count: { select: { steps: true, fmsTasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── FmsTask (execution records, called "steps" in the API) ─────────────────

  async addStep(dto: CreateFmsStepDto, tenantId: string, actorId: string, actorRole: string) {
    const workflow = await this.prisma.fmsWorkflow.findFirst({
      where: { id: dto.workflowId, tenantId },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');

    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assignedToId, tenantId, status: 'ACTIVE' },
      select: { id: true, name: true, email: true },
    });
    if (!assignee) throw new BadRequestException('Assignee not found or inactive');

    const visibleIds = await this.hierarchy.getVisibleUserIds(actorId, actorRole, tenantId);
    if (visibleIds && !visibleIds.includes(assignee.id)) {
      throw new ForbiddenException('Assignee is outside your team visibility');
    }

    // BUG-01 fix: atomic sequence; consistent FMS-YYYY-NNNN format via utility
    const taskSeq = await atomicNextFmsTaskId(this.prisma, tenantId);
    const fmsTaskId = generateFmsTaskId(taskSeq);

    const task = await this.prisma.fmsTask.create({
      data: {
        tenantId,
        workflowId: dto.workflowId,
        fmsTaskId,
        personId: dto.assignedToId,
        stepNo: dto.stepNo,
        stepName: dto.title,
        what: dto.description ?? dto.title,
        fmsName: workflow.name,
        formLink: dto.formLink,
        plannedDate: new Date(dto.plannedDate),
        status: 'PENDING',
      },
    });

    // BUG-11 fix: PUBLISHED = "this workflow template is live and accepting tasks".
    // The "all steps completed" state was previously also stored as PUBLISHED,
    // which conflated two unrelated concepts and made it impossible to tell
    // whether a workflow was active-but-not-done or actually finished.
    // Now: DRAFT → PUBLISHED (admin activates) → COMPLETED (all steps done).
    // If a new step is added to a COMPLETED workflow it reverts to PUBLISHED
    // (the template is still active, just not fully done yet).
    if (workflow.status === 'COMPLETED') {
      await this.prisma.fmsWorkflow.update({
        where: { id: workflow.id },
        data: { status: 'PUBLISHED' },
      });
    }

    await this.notificationQueue.add('create-notification', {
      tenantId,
      userId: dto.assignedToId,
      type: 'FMS_STEP_ASSIGNED',
      title: '🔄 FMS Step Assigned',
      body: `FMS step "${dto.title}" in workflow "${workflow.name}" has been assigned to you. Planned date: ${dto.plannedDate}.`,
      refType: 'FMS_TASK',
      refId: task.id,
    });

    await this.automation.triggerEvent(tenantId, 'TASK_CREATED', {
      taskId: task.id,
      taskTitle: task.stepName,
      refType: 'FMS_TASK',
      assigneeId: dto.assignedToId,
    });

    // LE-11 fix: new FMS step changes dashboard counts — clear both caches
    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));

    return task;
  }

  async findSteps(tenantId: string, userId: string, role: string, query: FmsQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);

    const isCompleted = query.view?.includes('completed');
    const isTeam = query.view?.includes('team');

    const where: any = { tenantId };

    if (isTeam && visibleIds) {
      where.personId = { in: visibleIds };
    } else if (!isTeam) {
      where.personId = userId;
    }

    if (isCompleted) {
      where.status = 'COMPLETED';
    } else {
      where.status = { not: 'COMPLETED' };
    }

    if (query.workflowId) where.workflowId = query.workflowId;

    const [tasks, total] = await Promise.all([
      this.prisma.fmsTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ plannedDate: 'asc' }, { stepNo: 'asc' }],
        include: {
          workflow: { select: { id: true, name: true } },
        },
      }),
      this.prisma.fmsTask.count({ where }),
    ]);

    // FmsTask.personId has no Prisma relation (plain ObjectId field), so the
    // assignee has to be resolved with a separate batched lookup.
    const personIds = [...new Set(tasks.map((t) => t.personId))];
    const assignees = personIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: personIds } },
          select: { id: true, name: true },
        })
      : [];
    const assigneeById = new Map(assignees.map((u) => [u.id, u]));

    const data = tasks.map((task) => ({
      ...task,
      // Frontend (FmsStep) expects `title`, `workflow`, and `assignedTo` —
      // map the raw Prisma fields (stepName/personId) onto that shape.
      title: task.stepName,
      assignedTo: assigneeById.get(task.personId) ?? { id: task.personId, name: 'Unknown' },
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async completeStep(id: string, dto: CompleteFmsStepDto, tenantId: string, userId: string) {
    const task = await this.prisma.fmsTask.findFirst({ where: { id, tenantId } });
    if (!task) throw new NotFoundException('FMS task not found');

    if (task.personId !== userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!isApproverRole(user?.role)) {
        throw new ForbiddenException('You can only complete your own FMS tasks');
      }
      const visibleIds = await this.hierarchy.getVisibleUserIds(userId, user.role, tenantId);
      if (visibleIds && !visibleIds.includes(task.personId)) {
        throw new ForbiddenException('You can only complete FMS tasks visible to your team');
      }
    }

    if (task.status === 'COMPLETED') throw new BadRequestException('Task already completed');

    const now = new Date();
    // Working-day/holiday-aware delay — see delegation.service.ts#approve for why
    // raw calendar-day math overcounts delay across weekends/holidays.
    const calendar = await loadCompanyCalendar(this.prisma, tenantId, task.plannedDate, now);
    const { delayDays, onTimeStatus } = calculateDelay(task.plannedDate, now, calendar);

    const updated = await this.prisma.fmsTask.update({
      where: { id },
      data: {
        actualDate: now,
        status: 'COMPLETED',
        completedAt: now,
        remarks: dto.remarks,
        onTimeStatus,
        delayDays,
      },
    });

    await this.checkWorkflowCompletion(task.workflowId, tenantId);

    await this.automation.triggerEvent(tenantId, 'FMS_STEP_COMPLETED', {
      taskId: task.id,
      taskTitle: task.stepName,
      refType: 'FMS_TASK',
      assigneeId: task.personId,
      delayDays,
    });

    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return updated;
  }

  private async checkWorkflowCompletion(workflowId: string, tenantId: string) {
    const pendingCount = await this.prisma.fmsTask.count({
      where: { workflowId, tenantId, status: { not: 'COMPLETED' } },
    });

    if (pendingCount === 0) {
      // BUG-11 fix: use COMPLETED (not PUBLISHED) to mark all-steps-done.
      // PUBLISHED already means "this workflow template is active" — reusing
      // it for completion made the two states indistinguishable.
      await this.prisma.fmsWorkflow.update({
        where: { id: workflowId },
        data: { status: 'COMPLETED' },
      });
    }
  }

  async getPendingCount(tenantId: string, userId: string): Promise<number> {
    return this.prisma.fmsTask.count({
      where: { tenantId, personId: userId, status: { not: 'COMPLETED' } },
    });
  }

  async getAnalytics(tenantId: string, userId: string, role: string) {
    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    const baseWhere: any = { tenantId };
    if (visibleIds) baseWhere.personId = { in: visibleIds };

    const [total, completed, late, onTime, workflows] = await Promise.all([
      this.prisma.fmsTask.count({ where: baseWhere }),
      this.prisma.fmsTask.count({ where: { ...baseWhere, status: 'COMPLETED' } }),
      // `status` is only ever set to PENDING/COMPLETED by completeStep() — lateness
      // is recorded on `onTimeStatus` instead, so that's what must be 
      // the planned date, not just ones that were completed late.
      this.prisma.fmsTask.count({
        where: {
          ...baseWhere,
          OR: [
            { onTimeStatus: 'LATE' },
            { status: { not: 'COMPLETED' }, plannedDate: { lt: new Date() } },
          ],
        },
      }),
      this.prisma.fmsTask.count({ where: { ...baseWhere, onTimeStatus: 'ON_TIME' } }),
      this.prisma.fmsWorkflow.findMany({
        where: { tenantId },
        select: { id: true, name: true, status: true },
      }),
    ]);

    return { total, completed, late, onTime, pending: total - completed, workflows };
  }
}
