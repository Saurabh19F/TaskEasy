import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { MisCalculatorService } from '../mis/mis-calculator.service';
import { getPeriodRange } from '../../common/utils/date.utils';
import { ReportQueryDto } from './dto/reports.dto';
import { isTenantWideRole, isTeamManagerRole, normalizeCompanyRole } from '../../common/utils/role.utils';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private hierarchy: HierarchyService,
    private misCalculator: MisCalculatorService,
  ) {}

  private buildDateFilter(query: ReportQueryDto): any {
    if (query.period) {
      const range = getPeriodRange(query.period as any);
      if (range) {
        const { from, to } = range;
        return { gte: from, lte: to };
      }
    }
    if (query.dateFrom || query.dateTo) {
      const filter: any = {};
      if (query.dateFrom) filter.gte = new Date(query.dateFrom);
      if (query.dateTo) filter.lte = new Date(query.dateTo);
      return filter;
    }
    return undefined;
  }

  async getDelegationReport(tenantId: string, userId: string, role: string, query: ReportQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    const dateFilter = this.buildDateFilter(query);

    const where: any = { tenantId };
    if (visibleIds) where.delegatedToId = { in: visibleIds };
    if (query.userId) {
      if (visibleIds && !visibleIds.includes(query.userId)) {
        throw new ForbiddenException('User is outside your visibility scope');
      }
      where.delegatedToId = query.userId;
    }
    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;
    if (dateFilter) where.createdAt = dateFilter;
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.delegationTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          delegatedBy: { select: { id: true, name: true } },
          delegatedTo: { select: { id: true, name: true } },
          project: { select: { name: true } },
        },
      }),
      this.prisma.delegationTask.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getWorkRequestReport(tenantId: string, userId: string, role: string, query: ReportQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    const dateFilter = this.buildDateFilter(query);

    const where: any = { tenantId };
    if (visibleIds) where.OR = [
      { requestedById: { in: visibleIds } },
      { requestedForId: { in: visibleIds } },
    ];
    if (query.userId) {
      if (visibleIds && !visibleIds.includes(query.userId)) {
        throw new ForbiddenException('User is outside your visibility scope');
      }
      where.requestedForId = query.userId;
    }
    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;
    if (dateFilter) where.createdAt = dateFilter;

    const [data, total] = await Promise.all([
      this.prisma.workRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: { select: { id: true, name: true } },
          requestFor: { select: { id: true, name: true } },
          project: { select: { name: true } },
        },
      }),
      this.prisma.workRequest.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getChecklistReport(tenantId: string, userId: string, role: string, query: ReportQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    const dateFilter = this.buildDateFilter(query);

    const where: any = { tenantId };
    if (visibleIds) where.assignedToId = { in: visibleIds };
    if (query.userId) {
      if (visibleIds && !visibleIds.includes(query.userId)) {
        throw new ForbiddenException('User is outside your visibility scope');
      }
      where.assignedToId = query.userId;
    }
    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;
    if (dateFilter) where.plannedDate = dateFilter;

    const [data, total] = await Promise.all([
      this.prisma.checklistTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: { plannedDate: 'desc' },
        include: {
          assignedTo: { select: { id: true, name: true } },
          project: { select: { name: true } },
        },
      }),
      this.prisma.checklistTask.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getProjectReport(tenantId: string, query: ReportQueryDto) {
    const projects = await this.prisma.project.findMany({
      where: { tenantId, ...(query.status ? { status: query.status as any } : {}) },
      orderBy: { name: 'asc' },
    });

    const projectStats = await Promise.all(
      projects.map(async (p) => {
        const [totalTasks, completedTasks, lateTasks] = await Promise.all([
          this.prisma.delegationTask.count({ where: { tenantId, projectId: p.id } }),
          this.prisma.delegationTask.count({ where: { tenantId, projectId: p.id, status: 'COMPLETED' } }),
          this.prisma.delegationTask.count({ where: { tenantId, projectId: p.id, onTimeStatus: 'LATE' } }),
        ]);

        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const delayRate = totalTasks > 0 ? Math.round((lateTasks / totalTasks) * 100) : 0;

        return {
          ...p,
          totalTasks,
          completed: completedTasks,
          pending: totalTasks - completedTasks,
          delayed: lateTasks,
          completionRate,
          delayRate,
          healthScore: Math.max(0, completionRate - delayRate),
        };
      }),
    );

    return { data: projectStats, total: projectStats.length };
  }

  async getPerformanceReport(tenantId: string, userId: string, role: string, query: ReportQueryDto) {
    const normalizedRole = normalizeCompanyRole(role);
    // Performance reporting is analytics — ADMIN/MANAGER see the whole tenant,
    // not just their hierarchy group. Only plain employees are restricted to
    // their own record. Hierarchy scoping stays in place for operational
    // endpoints (delegation, work-requests, etc.) where it matters.
    const reportVisibleIds =
      isTenantWideRole(normalizedRole) || isTeamManagerRole(normalizedRole)
        ? null
        : [userId];

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        ...(query.userId ? { id: query.userId } : {}),
        ...(reportVisibleIds ? { id: { in: reportVisibleIds } } : {}),
      },
      select: { id: true, name: true, email: true, role: true },
    });

    // Default range mirrors buildDateFilter()'s old behaviour when no
    // period/date filter is supplied (this method never falls back to
    // "no filter" — it always needs a from/to to hand to the calculator).
    let from: Date;
    let to: Date;
    const periodRange = query.period ? getPeriodRange(query.period as any) : null;
    if (periodRange) {
      ({ from, to } = periodRange);
    } else if (query.dateFrom || query.dateTo) {
      from = query.dateFrom ? new Date(query.dateFrom) : new Date(0);
      to = query.dateTo ? new Date(query.dateTo) : new Date();
    } else {
      from = new Date(0);
      to = new Date();
    }

    // Same calculator MIS uses (Delegation + Work Request + Checklist + FMS,
    // same scoring formula) — this report used to be delegation-only with
    // its own independent, inconsistent score formula, so "Performance
    // Report" and the MIS dashboard could show two different scores for the
    // same person over the same period.
    const rows = await Promise.all(
      users.map(async (u) => {
        const result = await this.misCalculator.calculateForUser(u.id, tenantId, from, to, query.projectId);
        const total = result.metrics.total;
        return {
          ...u,
          totalTasks: total,
          completed: result.metrics.completed,
          pending: result.metrics.pending,
          late: result.metrics.late,
          reworkCount: result.metrics.reworkCount,
          onTimePercent: result.metrics.onTimePercent,
          avgDelay: total > 0 ? Math.round((result.metrics.delayDays / total) * 10) / 10 : 0,
          score: result.score,
          grade: result.grade,
        };
      }),
    );

    // Sort by score desc
    rows.sort((a, b) => b.score - a.score);
    return { data: rows, total: rows.length };
  }
}
