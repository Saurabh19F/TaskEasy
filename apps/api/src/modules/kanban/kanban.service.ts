import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { isApproverRole } from '../../common/utils/role.utils';
import { CachePatterns } from '../../common/utils/cache-keys.utils';

const KANBAN_COLUMNS = ['PENDING', 'IN_PROGRESS', 'SEND_FOR_APPROVAL', 'REWORK', 'COMPLETED'] as const;

// Kanban drag-and-drop only ever performs these self-service, no-side-effect
// transitions for the task's own assignee. Anything that requires mandatory
// remarks, an approver's judgment, or scoring side effects (submit, approve,
// rework, complete) MUST go through DelegationService's own endpoints —
// those already collect the required remarks, check who's allowed to act,
// fire notifications, and update onTimeStatus/delayDays/MIS caches. Letting
// Kanban shortcut around that was exactly the "approval bypass" risk this
// project's own notes flagged as a top-priority fix elsewhere.
const ALLOWED_MOVES: Record<string, string[]> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['PENDING'],
  SEND_FOR_APPROVAL: [],
  REWORK: [],
  COMPLETED: [],
};

@Injectable()
export class KanbanService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private hierarchy: HierarchyService,
  ) {}

  async getBoard(tenantId: string, userId: string, role: string, projectId?: string) {
    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);

    const where: any = { tenantId };
    // null => SAAS_OWNER, sees everyone in the tenant.
    // Otherwise scope to the caller's hierarchy team (Admin/Manager) or
    // just themselves (Employee) — matches every other module's visibility
    // rule. Previously any Admin/Manager saw the WHOLE tenant's board,
    // including tasks outside their assigned team.
    if (visibleIds) where.delegatedToId = { in: visibleIds };
    if (projectId) where.projectId = projectId;

    const tasks = await this.prisma.delegationTask.findMany({
      where,
      include: {
        delegatedTo: { select: { id: true, name: true } },
        delegatedBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ priority: 'desc' }, { targetDate: 'asc' }],
    });

    // Group by status column
    const board = Object.fromEntries(
      KANBAN_COLUMNS.map((col) => [col, tasks.filter((t) => t.status === col)]),
    );

    return { board, columns: KANBAN_COLUMNS };
  }

  async moveCard(
    taskId: string,
    toStatus: string,
    tenantId: string,
    userId: string,
    role: string,
  ) {
    const task = await this.prisma.delegationTask.findFirst({ where: { id: taskId, tenantId } });
    if (!task) throw new NotFoundException('Task not found');

    const isAdmin = isApproverRole(role);
    if (!isAdmin && task.delegatedToId !== userId) {
      throw new ForbiddenException('You can only move your own tasks');
    }

    const allowedTargets = ALLOWED_MOVES[task.status] ?? [];
    if (!allowedTargets.includes(toStatus)) {
      throw new BadRequestException(
        `Can't move a task from ${task.status} to ${toStatus} on the Kanban board. ` +
        `Use the Delegation "Done" button to submit for approval, or the Approve/Review ` +
        `screen to approve/rework/complete it.`,
      );
    }

    const updated = await this.prisma.delegationTask.update({
      where: { id: taskId },
      data: { status: toStatus as any },
    });

    // BE-04 fix: dashboard counts key off task status; invalidate after moves.
    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));

    return updated;
  }
}
