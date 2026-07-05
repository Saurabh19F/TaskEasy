import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AutomationService } from '../../modules/automation/automation.service';
import { CachePatterns } from '../../common/utils/cache-keys.utils';
import { QUEUES } from '../queue.constants';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

interface SlaCheckJob {
  tenantId?: string;
}

function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

const WORKLOAD_HIGH_THRESHOLD = 20;
const PROJECT_HEALTH_LOW_THRESHOLD = 50;
const APPROVAL_STALE_HOURS = 48;
const DEDUP_TTL_SECONDS = 26 * 60 * 60;

const PUNCH_TRACKED_ROLES = ['MANAGER', 'EMPLOYEE', 'VIEWER'];
const PUNCH_GRACE_MS = 15 * 60 * 1000;
const PUNCH_FIRE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours — keep checking all day; dedup guard prevents re-firing

@Processor(QUEUES.ESCALATION)
export class EscalationProcessor {
  private readonly logger = new Logger(EscalationProcessor.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private automation: AutomationService,
    @InjectQueue(QUEUES.NOTIFICATION) private notificationQueue: Queue,
    @InjectQueue(QUEUES.EMAIL) private emailQueue: Queue,
    @InjectQueue(QUEUES.FMS) private fmsQueue: Queue,
  ) {}

  @Process('check-sla')
  async handleSlaCheck(job: Job<SlaCheckJob>) {
    this.logger.log('Running SLA check...');
    const now = new Date();

    const overdueTasks = await this.prisma.delegationTask.findMany({
      where: {
        ...(job.data.tenantId ? { tenantId: job.data.tenantId } : {}),
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        targetDate: { lt: now },
      },
      include: { tenant: { select: { name: true } } },
      take: 500,
    });

    this.logger.log(`Found ${overdueTasks.length} overdue delegation tasks`);

    for (const task of overdueTasks) {
      const delayDays = Math.ceil(
        (now.getTime() - task.targetDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (delayDays === 1) {
        await this.notificationQueue.add('create-notification', {
          tenantId: task.tenantId,
          userId: task.delegatedToId,
          type: 'TASK_OVERDUE',
          title: '⚠️ Task Overdue',
          body: `Your task "${task.title}" is 1 day overdue. Please complete it immediately.`,
          refType: 'DELEGATION',
          refId: task.id,
        });

        await this.automation.triggerEvent(task.tenantId, 'TASK_OVERDUE', {
          taskId: task.id,
          taskTitle: task.title,
          refType: 'DELEGATION',
          assigneeId: task.delegatedToId,
          delayDays,
        });
      }

      if (delayDays >= 2) {
        const hierarchy = await this.prisma.hierarchy.findFirst({
          where: { tenantId: task.tenantId, memberIds: { has: task.delegatedToId } },
        });

        if (hierarchy) {
          await this.notificationQueue.add('create-notification', {
            tenantId: task.tenantId,
            userId: hierarchy.adminId,
            type: 'TASK_OVERDUE',
            title: '🚨 Team Task Overdue',
            body: `Task "${task.title}" is ${delayDays} day(s) overdue. Action required.`,
            refType: 'DELEGATION',
            refId: task.id,
          });
        }

        await this.fireOncePerDay(task.tenantId, 'SLA_BREACHED', task.id, {
          taskId: task.id,
          taskTitle: task.title,
          refType: 'DELEGATION',
          assigneeId: task.delegatedToId,
          delayDays,
        });
      }
    }

    await this.checkOverdueWorkRequests(job.data.tenantId);
    await this.checkOverdueChecklistTasks(job.data.tenantId);
    await this.checkOverdueFmsTasks(job.data.tenantId);
    await this.checkUserWorkload(job.data.tenantId);
    await this.checkProjectHealth(job.data.tenantId);
    await this.checkStaleApprovals(job.data.tenantId);

    this.logger.log('SLA check completed');
  }

  private async checkOverdueWorkRequests(tenantId?: string) {
    const now = new Date();
    const overdueWorkRequests = await this.prisma.workRequest.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: { in: ['PENDING', 'REWORK'] },
        deadlineDate: { lt: now },
      },
      take: 500,
    });

    if (overdueWorkRequests.length === 0) return;
    this.logger.log(`Found ${overdueWorkRequests.length} overdue work requests`);

    for (const request of overdueWorkRequests) {
      const delayDays = Math.ceil((now.getTime() - request.deadlineDate.getTime()) / 86400000);

      if (delayDays === 1) {
        await this.notificationQueue.add('create-notification', {
          tenantId: request.tenantId,
          userId: request.requestedForId,
          type: 'TASK_OVERDUE',
          title: '⚠️ Work Request Overdue',
          body: `Your work request "${request.title}" is 1 day overdue. Please complete it immediately.`,
          refType: 'WORK_REQUEST',
          refId: request.id,
        });

        await this.automation.triggerEvent(request.tenantId, 'TASK_OVERDUE', {
          taskId: request.id,
          taskTitle: request.title,
          refType: 'WORK_REQUEST',
          assigneeId: request.requestedForId,
          delayDays,
        });
      }

      if (delayDays >= 2) {
        const hierarchy = await this.prisma.hierarchy.findFirst({
          where: { tenantId: request.tenantId, memberIds: { has: request.requestedForId } },
        });

        if (hierarchy) {
          await this.notificationQueue.add('create-notification', {
            tenantId: request.tenantId,
            userId: hierarchy.adminId,
            type: 'TASK_OVERDUE',
            title: '🚨 Team Work Request Overdue',
            body: `Work request "${request.title}" is ${delayDays} day(s) overdue. Action required.`,
            refType: 'WORK_REQUEST',
            refId: request.id,
          });
        }

        await this.fireOncePerDay(request.tenantId, 'SLA_BREACHED', request.id, {
          taskId: request.id,
          taskTitle: request.title,
          refType: 'WORK_REQUEST',
          assigneeId: request.requestedForId,
          delayDays,
        });
      }
    }
  }

  private async checkOverdueChecklistTasks(tenantId?: string) {
    const now = new Date();
    const overdueChecklistTasks = await this.prisma.checklistTask.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: { in: ['PENDING', 'LATE'] },
        plannedDate: { lt: now },
      },
      take: 500,
    });

    if (overdueChecklistTasks.length === 0) return;
    this.logger.log(`Found ${overdueChecklistTasks.length} overdue checklist tasks`);

    for (const task of overdueChecklistTasks) {
      const delayDays = Math.ceil((now.getTime() - task.plannedDate.getTime()) / 86400000);

      if (delayDays === 1) {
        await this.notificationQueue.add('create-notification', {
          tenantId: task.tenantId,
          userId: task.assignedToId,
          type: 'TASK_OVERDUE',
          title: '⚠️ Checklist Task Overdue',
          body: `Your checklist task "${task.title}" is 1 day overdue. Please complete it immediately.`,
          refType: 'CHECKLIST',
          refId: task.id,
        });

        await this.automation.triggerEvent(task.tenantId, 'CHECKLIST_MISSED', {
          taskId: task.id,
          taskTitle: task.title,
          refType: 'CHECKLIST',
          assigneeId: task.assignedToId,
          delayDays,
        });
      }

      if (delayDays >= 2) {
        const hierarchy = await this.prisma.hierarchy.findFirst({
          where: { tenantId: task.tenantId, memberIds: { has: task.assignedToId } },
        });

        if (hierarchy) {
          await this.notificationQueue.add('create-notification', {
            tenantId: task.tenantId,
            userId: hierarchy.adminId,
            type: 'TASK_OVERDUE',
            title: '🚨 Team Checklist Overdue',
            body: `Checklist task "${task.title}" is ${delayDays} day(s) overdue. Action required.`,
            refType: 'CHECKLIST',
            refId: task.id,
          });
        }

        await this.fireOncePerDay(task.tenantId, 'SLA_BREACHED', task.id, {
          taskId: task.id,
          taskTitle: task.title,
          refType: 'CHECKLIST',
          assigneeId: task.assignedToId,
          delayDays,
        });
      }
    }
  }

  private async checkOverdueFmsTasks(tenantId?: string) {
    const now = new Date();

    const overdueFmsTasks = await this.prisma.fmsTask.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: { not: 'COMPLETED' },
        plannedDate: { lt: now },
      },
      include: { workflow: { select: { id: true, name: true } } },
      take: 500,
    });

    if (overdueFmsTasks.length === 0) return;
    this.logger.log(`Found ${overdueFmsTasks.length} overdue FMS tasks`);

    const personIds = [...new Set(overdueFmsTasks.map((t) => t.personId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: personIds } },
      select: { id: true, email: true },
    });
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    for (const task of overdueFmsTasks) {
      const delayDays = Math.ceil((now.getTime() - task.plannedDate.getTime()) / 86400000);

      if (delayDays === 1) {
        await this.fmsQueue.add('escalate-step', {
          stepId: task.id,
          workflowId: task.workflowId,
          tenantId: task.tenantId,
          assignedToId: task.personId,
          assignedToEmail: emailById.get(task.personId),
          title: task.stepName,
          plannedDate: task.plannedDate.toISOString(),
          delayDays,
        });

        await this.automation.triggerEvent(task.tenantId, 'TASK_OVERDUE', {
          taskId: task.id,
          taskTitle: task.stepName,
          refType: 'FMS_TASK',
          assigneeId: task.personId,
          delayDays,
        });
      }

      if (delayDays >= 2) {
        const hierarchy = await this.prisma.hierarchy.findFirst({
          where: { tenantId: task.tenantId, memberIds: { has: task.personId } },
        });

        if (hierarchy) {
          await this.notificationQueue.add('create-notification', {
            tenantId: task.tenantId,
            userId: hierarchy.adminId,
            type: 'TASK_OVERDUE',
            title: '🚨 Team FMS Task Overdue',
            body: `FMS step "${task.stepName}" (${task.workflow?.name ?? 'workflow'}) is ${delayDays} day(s) overdue. Action required.`,
            refType: 'FMS_TASK',
            refId: task.id,
          });
        }

        await this.fireOncePerDay(task.tenantId, 'SLA_BREACHED', task.id, {
          taskId: task.id,
          taskTitle: task.stepName,
          refType: 'FMS_TASK',
          assigneeId: task.personId,
          delayDays,
        });
      }
    }
  }

  private async fireOncePerDay(
    tenantId: string,
    trigger: string,
    entityId: string,
    context: Record<string, any>,
  ) {
    const dateKey = new Date().toISOString().slice(0, 10);
    const key = `automation:fired:${trigger}:${tenantId}:${entityId}:${dateKey}`;
    if (await this.redis.exists(key)) return;
    await this.redis.set(key, '1', DEDUP_TTL_SECONDS);
    await this.automation.triggerEvent(tenantId, trigger, context);
  }

  private async checkUserWorkload(tenantId?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: 'ACTIVE',
        role: { in: ['EMPLOYEE', 'TEAM_LEAD', 'MANAGER'] },
      },
      select: { id: true, tenantId: true, name: true },
    });

    for (const user of users) {
      const [delegationPending, checklistPending, wrPending, fmsPending] = await Promise.all([
        this.prisma.delegationTask.count({
          where: { tenantId: user.tenantId, delegatedToId: user.id, status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK'] } },
        }),
        this.prisma.checklistTask.count({
          where: { tenantId: user.tenantId, assignedToId: user.id, status: { in: ['PENDING', 'LATE'] } },
        }),
        this.prisma.workRequest.count({
          where: { tenantId: user.tenantId, requestedForId: user.id, status: { in: ['PENDING', 'REWORK'] } },
        }),
        this.prisma.fmsTask.count({
          where: { tenantId: user.tenantId, personId: user.id, status: { not: 'COMPLETED' } },
        }),
      ]);

      const totalPending = delegationPending + checklistPending + wrPending + fmsPending;
      if (totalPending >= WORKLOAD_HIGH_THRESHOLD) {
        await this.fireOncePerDay(user.tenantId, 'USER_WORKLOAD_HIGH', user.id, {
          taskId: user.id,
          taskTitle: `${user.name}'s workload`,
          refType: 'USER',
          assigneeId: user.id,
          pendingCount: totalPending,
        });
      }
    }
  }

  private async checkProjectHealth(tenantId?: string) {
    const projects = await this.prisma.project.findMany({
      where: { ...(tenantId ? { tenantId } : {}), status: 'ACTIVE' },
      select: { id: true, tenantId: true, name: true },
    });

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    for (const project of projects) {
      // BUG-08 fix: include all 3 trackable modules (Delegation, Work Request,
      // Checklist) in the health score.  Previously only delegation tasks were
      // counted, so a project with 0 delegations but many overdue checklists
      // would appear 100% healthy.  FMS tasks don't carry a projectId so they
      // are not included here.
      const [delegTasks, wrTasks, clTasks] = await Promise.all([
        this.prisma.delegationTask.findMany({
          where: { tenantId: project.tenantId, projectId: project.id, createdAt: { gte: since } },
          select: { status: true, onTimeStatus: true, targetDate: true },
        }),
        this.prisma.workRequest.findMany({
          where: { tenantId: project.tenantId, projectId: project.id, createdAt: { gte: since } },
          select: { status: true, onTimeStatus: true, deadlineDate: true },
        }),
        this.prisma.checklistTask.findMany({
          where: { tenantId: project.tenantId, projectId: project.id, plannedDate: { gte: since } },
          select: { status: true, onTimeStatus: true, plannedDate: true },
        }),
      ]);

      // Normalise each module into a common shape for health calc
      const allTasks = [
        ...delegTasks.map((t) => ({
          status: t.status, onTimeStatus: t.onTimeStatus, dueDate: t.targetDate,
        })),
        ...wrTasks.map((t) => ({
          status: t.status, onTimeStatus: t.onTimeStatus, dueDate: t.deadlineDate,
        })),
        ...clTasks.map((t) => ({
          status: t.status as string, onTimeStatus: t.onTimeStatus, dueDate: t.plannedDate,
        })),
      ];

      if (allTasks.length === 0) continue;

      const completed = allTasks.filter((t) => t.status === 'COMPLETED').length;
      const completedLate = allTasks.filter((t) => t.status === 'COMPLETED' && t.onTimeStatus === 'LATE').length;
      const pendingOverdue = allTasks.filter((t) => t.status !== 'COMPLETED' && t.dueDate < now).length;

      const completionRate = Math.round((completed / allTasks.length) * 100);
      const overdueRate = Math.round(((completedLate + pendingOverdue) / allTasks.length) * 100);
      const health = completionRate - overdueRate;

      if (health < PROJECT_HEALTH_LOW_THRESHOLD) {
        await this.fireOncePerDay(project.tenantId, 'PROJECT_HEALTH_LOW', project.id, {
          taskId: project.id,
          taskTitle: project.name,
          refType: 'PROJECT',
          healthScore: health,
        });
      }
    }
  }

  private async checkStaleApprovals(tenantId?: string) {
    const staleBefore = new Date(Date.now() - APPROVAL_STALE_HOURS * 60 * 60 * 1000);
    const tenantFilter = tenantId ? { tenantId } : {};

    const [staleDelegations, staleWorkRequests, staleChecklists] = await Promise.all([
      this.prisma.delegationTask.findMany({
        where: { ...tenantFilter, status: 'SEND_FOR_APPROVAL', submittedAt: { lt: staleBefore } },
        select: { id: true, tenantId: true, title: true, delegatedById: true },
      }),
      this.prisma.workRequest.findMany({
        where: { ...tenantFilter, status: 'SEND_FOR_APPROVAL', submittedAt: { lt: staleBefore } },
        select: { id: true, tenantId: true, title: true, requestedById: true },
      }),
      // Check stale checklist approvals — checklist tasks use updatedAt as a
      // proxy for submission time since they don't have a submittedAt field.
      this.prisma.checklistTask.findMany({
        where: { ...tenantFilter, status: 'SEND_FOR_APPROVAL', updatedAt: { lt: staleBefore } },
        include: { master: { select: { createdBy: true } } },
      }),
    ]);

    for (const item of staleDelegations) {
      await this.fireOncePerDay(item.tenantId, 'APPROVAL_PENDING_TOO_LONG', item.id, {
        taskId: item.id,
        taskTitle: item.title,
        refType: 'DELEGATION',
        recipientId: item.delegatedById,
      });
    }

    for (const item of staleWorkRequests) {
      await this.fireOncePerDay(item.tenantId, 'APPROVAL_PENDING_TOO_LONG', item.id, {
        taskId: item.id,
        taskTitle: item.title,
        refType: 'WORK_REQUEST',
        recipientId: item.requestedById,
      });
    }

    // Notify checklist approvers (master creator) for stale checklist approvals
    for (const item of staleChecklists as any[]) {
      const approverId = item.master?.createdBy ?? item.assignedToId;
      await this.notificationQueue.add('create-notification', {
        tenantId: item.tenantId,
        userId: approverId,
        type: 'CHECKLIST_APPROVAL_STALE',
        title: '⏰ Checklist Approval Pending',
        body: `Checklist task "${item.title}" has been pending approval for more than ${APPROVAL_STALE_HOURS} hours`,
        refType: 'CHECKLIST',
        refId: item.id,
      });

      await this.fireOncePerDay(item.tenantId, 'APPROVAL_PENDING_TOO_LONG', item.id, {
        taskId: item.id,
        taskTitle: item.title,
        refType: 'CHECKLIST',
        recipientId: approverId,
      });
    }
  }

  @Process('daily-summary')
  async handleDailySummary(job: Job) {
    this.logger.log('Generating daily summaries...');

    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const tenant of tenants) {
      const users = await this.prisma.user.findMany({
        where: { tenantId: tenant.id, status: 'ACTIVE' },
        select: { id: true, email: true, name: true, role: true },
      });

      const todayStart = startOfDayLocal(new Date());
      const todayEnd = endOfDayLocal(new Date());
      const now = new Date();

      for (const user of users) {
        // BUG-07 fix: include all 4 modules in daily digest, not just delegation.
        // Previously pendingApprovals was hardcoded to 0 and WR/Checklist/FMS
        // were never included, so the email digest was severely misleading.
        const [
          delegPending, delegDueToday, delegOverdue,
          wrPending, wrDueToday, wrOverdue,
          clPending, clDueToday, clOverdue,
          fmsPending, fmsDueToday, fmsOverdue,
          pendingApprovalsDeleg, pendingApprovalsWr,
        ] = await Promise.all([
          // Delegation
          this.prisma.delegationTask.count({
            where: { tenantId: tenant.id, delegatedToId: user.id, status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK'] } },
          }),
          this.prisma.delegationTask.count({
            where: {
              tenantId: tenant.id, delegatedToId: user.id,
              status: { in: ['PENDING', 'IN_PROGRESS'] },
              targetDate: { gte: todayStart, lte: todayEnd },
            },
          }),
          this.prisma.delegationTask.count({
            where: {
              tenantId: tenant.id, delegatedToId: user.id,
              status: { in: ['PENDING', 'IN_PROGRESS'] },
              targetDate: { lt: todayStart },
            },
          }),
          // Work Request
          this.prisma.workRequest.count({
            where: { tenantId: tenant.id, requestedForId: user.id, status: { in: ['PENDING', 'REWORK'] } },
          }),
          this.prisma.workRequest.count({
            where: {
              tenantId: tenant.id, requestedForId: user.id,
              status: { in: ['PENDING', 'REWORK'] },
              deadlineDate: { gte: todayStart, lte: todayEnd },
            },
          }),
          this.prisma.workRequest.count({
            where: {
              tenantId: tenant.id, requestedForId: user.id,
              status: { in: ['PENDING', 'REWORK'] },
              deadlineDate: { lt: todayStart },
            },
          }),
          // Checklist
          this.prisma.checklistTask.count({
            where: { tenantId: tenant.id, assignedToId: user.id, status: { in: ['PENDING', 'LATE'] } },
          }),
          this.prisma.checklistTask.count({
            where: {
              tenantId: tenant.id, assignedToId: user.id,
              status: 'PENDING',
              plannedDate: { gte: todayStart, lte: todayEnd },
            },
          }),
          this.prisma.checklistTask.count({
            where: { tenantId: tenant.id, assignedToId: user.id, status: 'LATE' },
          }),
          // FMS
          this.prisma.fmsTask.count({
            where: { tenantId: tenant.id, personId: user.id, status: { not: 'COMPLETED' } },
          }),
          this.prisma.fmsTask.count({
            where: {
              tenantId: tenant.id, personId: user.id,
              status: { not: 'COMPLETED' },
              plannedDate: { gte: todayStart, lte: todayEnd },
            },
          }),
          this.prisma.fmsTask.count({
            where: {
              tenantId: tenant.id, personId: user.id,
              status: { not: 'COMPLETED' },
              plannedDate: { lt: todayStart },
            },
          }),
          // Pending approvals (for admin/manager roles)
          this.prisma.delegationTask.count({
            where: { tenantId: tenant.id, delegatedById: user.id, status: 'SEND_FOR_APPROVAL' },
          }),
          this.prisma.workRequest.count({
            where: { tenantId: tenant.id, requestedById: user.id, status: 'SEND_FOR_APPROVAL' },
          }),
        ]);

        const pendingTasks = delegPending + wrPending + clPending + fmsPending;
        const dueToday = delegDueToday + wrDueToday + clDueToday + fmsDueToday;
        const overdue = delegOverdue + wrOverdue + clOverdue + fmsOverdue;
        const pendingApprovals = pendingApprovalsDeleg + pendingApprovalsWr;

        if (pendingTasks > 0 || pendingApprovals > 0) {
          await this.emailQueue.add('send-email', {
            to: user.email,
            subject: '\ud83d\udccb Your Daily TaskEasy Summary',
            template: 'daily-digest',
            data: {
              name: user.name,
              pendingTasks,
              dueToday,
              overdue,
              pendingApprovals,
              breakdown: {
                delegation: { pending: delegPending, dueToday: delegDueToday, overdue: delegOverdue },
                workRequest: { pending: wrPending, dueToday: wrDueToday, overdue: wrOverdue },
                checklist: { pending: clPending, dueToday: clDueToday, overdue: clOverdue },
                fms: { pending: fmsPending, dueToday: fmsDueToday, overdue: fmsOverdue },
              },
            },
          });
        }
      }
    }

    this.logger.log('Daily summaries sent');
  }

  @Process('check-punch-in')
  async handleCheckPunchIn(job: Job<{ tenantId?: string }>) {
    const now = new Date();
    const today = startOfDayLocal(now);

    const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const todayDayName = DAY_NAMES[now.getDay()];

    const users = await this.prisma.user.findMany({
      where: {
        ...(job.data?.tenantId ? { tenantId: job.data.tenantId } : {}),
        status: 'ACTIVE',
        role: { in: PUNCH_TRACKED_ROLES as any },
        punchInTime: { not: null },
      },
      select: { id: true, tenantId: true, name: true, punchInTime: true, buddyId: true, weeklyOff: true },
    });

    for (const user of users) {
      if (!user.punchInTime) continue;

      // Skip users on their weekly off day — they are not expected to be online
      if ((user.weeklyOff ?? []).includes(todayDayName)) continue;
      const [h, m] = user.punchInTime.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) continue;

      const punchDeadline = new Date(today);
      punchDeadline.setHours(h, m, 0, 0);
      const graceDeadline = new Date(punchDeadline.getTime() + PUNCH_GRACE_MS);

      if (now < graceDeadline || now.getTime() - graceDeadline.getTime() > PUNCH_FIRE_WINDOW_MS) {
        continue;
      }

      const loggedInToday = await this.prisma.loginHistory.findFirst({
        where: { userId: user.id, success: true, createdAt: { gte: today } },
      });
      if (loggedInToday) continue;

      const alreadyAlerted = await this.prisma.notification.findFirst({
        where: {
          tenantId: user.tenantId,
          type: 'PUNCH_IN_MISSED' as any,
          refId: user.id,
          createdAt: { gte: today },
        },
      });
      if (alreadyAlerted) continue;

      await this.handleMissedPunchIn(user);
    }
  }

  private async handleMissedPunchIn(user: {
    id: string;
    tenantId: string;
    name: string;
    buddyId: string | null;
  }) {
    this.logger.warn(`${user.name} (${user.id}) has not punched in within the grace period`);

    const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const todayDayName = DAY_NAMES[new Date().getDay()];

    const buddy = user.buddyId
      ? await this.prisma.user.findUnique({
          where: { id: user.buddyId },
          select: { id: true, name: true, weeklyOff: true },
        })
      : null;

    const buddyOnWeeklyOff = buddy ? (buddy.weeklyOff ?? []).includes(todayDayName) : false;

    const adminBody = buddy && !buddyOnWeeklyOff
      ? `${user.name} has not logged in within 15 minutes of their punch-in time. Their work has been reassigned to ${buddy.name}.`
      : buddy && buddyOnWeeklyOff
        ? `${user.name} has not logged in within 15 minutes of their punch-in time. Buddy (${buddy.name}) is on weekly off — tasks NOT reassigned.`
        : `${user.name} has not logged in within 15 minutes of their punch-in time. No buddy configured.`;

    const hierarchy = await this.prisma.hierarchy.findFirst({
      where: { tenantId: user.tenantId, memberIds: { has: user.id } },
    });

    const adminIds = hierarchy?.adminId
      ? [hierarchy.adminId]
      : (
          await this.prisma.user.findMany({
            where: { tenantId: user.tenantId, role: { in: ['COMPANY_OWNER', 'ADMIN', 'MANAGER'] }, status: 'ACTIVE' },
            select: { id: true },
          })
        ).map((a) => a.id);

    await Promise.all(
      adminIds.map((adminId) =>
        this.notificationQueue.add('create-notification', {
          tenantId: user.tenantId,
          userId: adminId,
          type: 'PUNCH_IN_MISSED',
          title: '\u26a0\ufe0f Team member not available',
          body: adminBody,
          refType: 'USER',
          refId: user.id,
        }),
      ),
    );

    if (user.buddyId && !buddyOnWeeklyOff) {
      await this.reassignWorkToBuddy(user.id, user.buddyId, user.tenantId);
    } else if (user.buddyId && buddyOnWeeklyOff) {
      this.logger.warn(`Buddy ${buddy?.name} is on weekly off — skipping task reassignment for ${user.name}`);
    }
  }

  private async reassignWorkToBuddy(absentUserId: string, buddyId: string, tenantId: string) {
    const todayEnd = endOfDayLocal(new Date());
    const now = new Date();

    const [delegationResult, checklistResult, wrResult, fmsResult] = await Promise.all([
      this.prisma.delegationTask.updateMany({
        where: {
          tenantId,
          delegatedToId: absentUserId,
          status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK'] },
          targetDate: { lte: todayEnd },
        },
        data: { delegatedToId: buddyId },
      }),
      this.prisma.checklistTask.updateMany({
        where: {
          tenantId,
          assignedToId: absentUserId,
          status: { in: ['PENDING', 'LATE'] },
          plannedDate: { lte: todayEnd },
        },
        data: { assignedToId: buddyId },
      }),
      this.prisma.workRequest.updateMany({
        where: {
          tenantId,
          requestedForId: absentUserId,
          status: { in: ['PENDING', 'REWORK'] },
          deadlineDate: { lte: todayEnd },
        },
        data: { requestedForId: buddyId },
      }),
      this.prisma.fmsTask.updateMany({
        where: {
          tenantId,
          personId: absentUserId,
          status: { not: 'COMPLETED' },
          plannedDate: { lte: todayEnd },
        },
        data: { personId: buddyId },
      }),
    ]);

    const total = delegationResult.count + checklistResult.count + wrResult.count + fmsResult.count;
    this.logger.log(`Reassigned ${total} task(s) from ${absentUserId} to buddy ${buddyId}`);

    if (total > 0) {
      try {
        await this.prisma.auditLog.create({
          data: {
            tenantId,
            actorId: buddyId,
            action: 'REASSIGN',
            module: 'DELEGATION',
            refId: absentUserId,
            refType: 'USER',
            description: `[SYSTEM] Buddy auto-reassignment: ${total} task(s) moved from absent user to buddy.`,
            newValue: {
              reason: 'PUNCH_IN_MISSED',
              absentUserId,
              buddyId,
              reassignedAt: now.toISOString(),
              counts: {
                delegation: delegationResult.count,
                checklist: checklistResult.count,
                workRequest: wrResult.count,
                fms: fmsResult.count,
                total,
              },
            },
          },
        });
      } catch (auditErr) {
        this.logger.error(`Failed to write buddy-reassignment audit log: ${auditErr?.message}`);
      }

      await this.notificationQueue.add('create-notification', {
        tenantId,
        userId: absentUserId,
        type: 'TASK_REASSIGNED_TO_BUDDY',
        title: '\ud83d\udce2 Your tasks were covered while you were away',
        body: `${total} task(s) due today were temporarily reassigned to your buddy.`,
        refType: 'USER',
        refId: buddyId,
      });

      await this.notificationQueue.add('create-notification', {
        tenantId,
        userId: buddyId,
        type: 'TASK_REASSIGNED_TO_BUDDY',
        title: '\ud83d\udccb Backup coverage assigned to you',
        body: `${total} task(s) due today have been reassigned to you because your buddy hasn't checked in.`,
        refType: 'USER',
        refId: absentUserId,
      });

      // MI-09 fix: use structured patterns — the wildcard '*:tenantId:*' is too broad
      // and could accidentally clear rate-limiter/session keys that also contain the tenantId
      await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
      await this.redis.delByPattern(CachePatterns.mis(tenantId));
    }

    return total;
  }
}
