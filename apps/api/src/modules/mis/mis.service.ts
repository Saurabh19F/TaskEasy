import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { MisCalculatorService, MisCardResult } from './mis-calculator.service';
import { QUEUES } from '../../queue/queue.constants';
import { CacheKeys, CachePatterns } from '../../common/utils/cache-keys.utils';
import { getPeriodRange } from '../../common/utils/date.utils';
import { MisQueryDto, SaveWeeklyTargetDto } from './dto/mis.dto';

const MIS_TTL = 300; // 5 min

export interface UserMisCard extends MisCardResult {
  lastWeekTarget?: number;
}

@Injectable()
export class MisService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private hierarchy: HierarchyService,
    private misCalculator: MisCalculatorService,
    @InjectQueue(QUEUES.MIS) private misQueue: Queue,
  ) {}

  async getMis(tenantId: string, userId: string, role: string, query: MisQueryDto) {
    const cacheKey = CacheKeys.mis(tenantId, userId, query);
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);

    let userIdFilter: any = {};
    if (query.userId) {
      if (visibleIds && !visibleIds.includes(query.userId)) {
        throw new ForbiddenException('User is outside your team visibility');
      }
      userIdFilter = { id: query.userId };
    } else if (visibleIds) {
      userIdFilter = { id: { in: visibleIds } };
    }

    const users = await this.prisma.user.findMany({
      where: { tenantId, status: 'ACTIVE', ...userIdFilter },
      select: { id: true, name: true, email: true, role: true },
    });

    let from: Date;
    let to: Date;
    if (query.period) {
      const range = getPeriodRange(query.period as any);
      if (range) {
        ({ from, to } = range);
      } else {
        from = query.dateFrom ? new Date(query.dateFrom) : new Date(new Date().setDate(1));
        to = query.dateTo ? new Date(query.dateTo) : new Date();
      }
    } else {
      from = query.dateFrom ? new Date(query.dateFrom) : new Date(new Date().setDate(1));
      to = query.dateTo ? new Date(query.dateTo) : new Date();
    }

    const cards: UserMisCard[] = await Promise.all(
      users.map((user) => this.buildUserCard(user, tenantId, from, to, query.projectId)),
    );

    const totalEmployees = cards.length;
    const avgNotDone = cards.reduce((s, c) => {
      const pct = c.metrics.total > 0 ? (c.metrics.pending / c.metrics.total) * 100 : 0;
      return s + pct;
    }, 0) / (totalEmployees || 1);
    const avgDelayed = cards.reduce((s, c) => {
      const pct = c.metrics.completed > 0 ? (c.metrics.late / c.metrics.completed) * 100 : 0;
      return s + pct;
    }, 0) / (totalEmployees || 1);

    // Count pending checklist tasks across all visible users in the period.
    // Previously hardcoded to 0 -- the "Avg. Checklist Pending" summary card
    // always showed 0 regardless of actual data.
    const userIds = users.map((u) => u.id);
    const totalChecklistPending = userIds.length
      ? await this.prisma.checklistTask.count({
          where: {
            tenantId,
            assignedToId: { in: userIds },
            status: { in: ['PENDING', 'LATE', 'REWORK', 'SEND_FOR_APPROVAL'] },
            plannedDate: { gte: from, lte: to },
          },
        })
      : 0;
    const avgChecklistPending = totalChecklistPending / (totalEmployees || 1);

    const result = {
      summary: {
        totalEmployees,
        avgWorkNotDone: Math.round(avgNotDone * 10) / 10,
        avgWorkDelayed: Math.round(avgDelayed * 10) / 10,
        avgChecklistPending: Math.round(avgChecklistPending * 10) / 10,
      },
      cards,
      period: { from, to },
    };

    await this.redis.set(cacheKey, result, MIS_TTL);
    return result;
  }

  private async buildUserCard(
    user: { id: string; name: string; email: string; role: string },
    tenantId: string,
    from: Date,
    to: Date,
    projectId?: string,
  ): Promise<UserMisCard> {
    const result = await this.misCalculator.calculateForUser(user.id, tenantId, from, to, projectId);

    const latestSnapshot = await this.prisma.misSnapshot.findFirst({
      where: { tenantId, userId: user.id },
      orderBy: { periodStart: 'desc' },
      select: { targetScore: true },
    });

    return {
      ...result,
      grade: result.grade as UserMisCard['grade'],
      lastWeekTarget: latestSnapshot?.targetScore ?? undefined,
    };
  }

  async saveWeeklyTarget(dto: SaveWeeklyTargetDto, tenantId: string) {
    const { from, to } = getPeriodRange('THIS_WEEK')!;
    const result = await this.misCalculator.calculateForUser(dto.userId, tenantId, from, to);

    await this.prisma.misSnapshot.upsert({
      where: {
        tenantId_userId_periodType_periodStart: {
          tenantId, userId: dto.userId, periodType: 'WEEKLY', periodStart: from,
        },
      },
      update: {
        totalTasks: result.metrics.total,
        completed: result.metrics.completed,
        pending: result.metrics.pending,
        late: result.metrics.late,
        onTime: result.metrics.onTime,
        delayDaysTotal: result.metrics.delayDays,
        reworkCount: result.metrics.reworkCount,
        productivityScore: result.score,
        grade: result.grade as any,
        targetScore: dto.targetScore,
      },
      create: {
        tenantId,
        userId: dto.userId,
        periodType: 'WEEKLY',
        periodStart: from,
        periodEnd: to,
        totalTasks: result.metrics.total,
        completed: result.metrics.completed,
        pending: result.metrics.pending,
        late: result.metrics.late,
        onTime: result.metrics.onTime,
        delayDaysTotal: result.metrics.delayDays,
        reworkCount: result.metrics.reworkCount,
        productivityScore: result.score,
        grade: result.grade as any,
        targetScore: dto.targetScore,
      },
    });

    await this.misQueue.add('weekly-snapshot', { tenantId });
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return { message: 'Weekly target saved and snapshot updated' };
  }

  async getDetailedData(
    tenantId: string,
    requesterId: string,
    requesterRole: string,
    targetUserId: string,
    category: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS',
    from: Date,
    to: Date,
  ) {
    if (targetUserId !== requesterId) {
      const visibleIds = await this.hierarchy.getVisibleUserIds(requesterId, requesterRole, tenantId);
      if (visibleIds && !visibleIds.includes(targetUserId)) {
        throw new ForbiddenException('User is outside your team visibility');
      }
    }
    switch (category) {
      case 'DELEGATION':
        return this.prisma.delegationTask.findMany({
          where: { tenantId, delegatedToId: targetUserId, targetDate: { gte: from, lte: to } },
          include: { project: { select: { name: true } } },
          orderBy: { targetDate: 'asc' },
        });
      case 'WORK_REQUEST':
        return this.prisma.workRequest.findMany({
          where: { tenantId, requestedForId: targetUserId, deadlineDate: { gte: from, lte: to } },
          include: { project: { select: { name: true } } },
          orderBy: { deadlineDate: 'asc' },
        });
      case 'CHECKLIST':
        return this.prisma.checklistTask.findMany({
          where: { tenantId, assignedToId: targetUserId, plannedDate: { gte: from, lte: to } },
          include: { project: { select: { name: true } } },
          orderBy: { plannedDate: 'asc' },
        });
      case 'FMS':
        return this.prisma.fmsTask.findMany({
          where: { tenantId, personId: targetUserId, plannedDate: { gte: from, lte: to } },
          orderBy: { plannedDate: 'asc' },
        });
    }
  }

  async getMisHistory(tenantId: string, requesterId: string, requesterRole: string, targetUserId: string) {
    if (targetUserId !== requesterId) {
      const visibleIds = await this.hierarchy.getVisibleUserIds(requesterId, requesterRole, tenantId);
      if (visibleIds && !visibleIds.includes(targetUserId)) {
        throw new ForbiddenException('User is outside your team visibility');
      }
    }
    return this.prisma.misSnapshot.findMany({
      where: { tenantId, userId: targetUserId },
      orderBy: { periodStart: 'desc' },
      take: 12,
    });
  }

  async getKraMaster(tenantId: string, userId: string, role: string, projectId?: string) {
    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);

    return this.prisma.checklistMaster.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(visibleIds ? { assignedToId: { in: visibleIds } } : {}),
        ...(projectId ? { projectId } : {}),
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        project: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveTenantSnapshot(tenantId: string, userId: string, role: string) {
    const { from, to } = getPeriodRange('THIS_WEEK')!;
    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        ...(visibleIds ? { id: { in: visibleIds } } : {}),
      },
      select: { id: true },
    });

    await Promise.all(
      users.map(async (u) => {
        const result = await this.misCalculator.calculateForUser(u.id, tenantId, from, to);
        return this.prisma.misSnapshot.upsert({
          where: {
            tenantId_userId_periodType_periodStart: {
              tenantId, userId: u.id, periodType: 'WEEKLY', periodStart: from,
            },
          },
          update: {
            totalTasks: result.metrics.total,
            completed: result.metrics.completed,
            pending: result.metrics.pending,
            late: result.metrics.late,
            onTime: result.metrics.onTime,
            delayDaysTotal: result.metrics.delayDays,
            reworkCount: result.metrics.reworkCount,
            productivityScore: result.score,
            grade: result.grade as any,
          },
          create: {
            tenantId,
            userId: u.id,
            periodType: 'WEEKLY',
            periodStart: from,
            periodEnd: to,
            totalTasks: result.metrics.total,
            completed: result.metrics.completed,
            pending: result.metrics.pending,
            late: result.metrics.late,
            onTime: result.metrics.onTime,
            delayDaysTotal: result.metrics.delayDays,
            reworkCount: result.metrics.reworkCount,
            productivityScore: result.score,
            grade: result.grade as any,
          },
        });
      }),
    );

    await this.misQueue.add('weekly-snapshot', { tenantId });
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return { message: `Snapshot saved for ${users.length} employee(s)` };
  }
}
