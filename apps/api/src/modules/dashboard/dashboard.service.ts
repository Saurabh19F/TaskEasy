import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { CacheKeys } from '../../common/utils/cache-keys.utils';
import { getPeriodRange } from '../../common/utils/date.utils';
import { subDays, startOfDay, endOfDay, format, isSameDay } from 'date-fns';

interface DashboardFilters {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  projectId?: string;
}

const DASHBOARD_TTL = 300; // 5 min

interface ModuleMetrics {
  total: number;
  done: number;
  pending: number;
  delayed: number;
}

interface TrendPoint {
  label: string;
  completed: number;
  pending: number;
  delayed: number;
}

export interface ProjectWiseStatusEntry {
  projectId: string;
  projectName: string;
  completion: number;
  delegation:  { pending: number; done: number };
  workRequest: { pending: number; done: number };
  checklist:   { pending: number; done: number };
}

export interface FmsWiseStatusEntry {
  fmsId: string;
  fmsName: string;
  pending: number;
  done: number;
  total: number;
}

export interface PersonalPriorityTaskEntry {
  id: string;
  title: string;
  type: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS';
  dueDate: Date | null;
  isCompleted: boolean;
}

export interface DashboardData {
  delegation: ModuleMetrics;
  workRequest: ModuleMetrics;
  checklist: ModuleMetrics;
  fms: ModuleMetrics;
  criticalTasks: any[];
  approvalPending: number;
  trend: TrendPoint[];
  projectWiseStatus: ProjectWiseStatusEntry[];
  fmsWiseStatus: FmsWiseStatusEntry[];
  personalPriority: PersonalPriorityTaskEntry[];
  lastUpdated: string;
}

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private hierarchy: HierarchyService,
  ) {}

  async getDashboard(
    tenantId: string,
    userId: string,
    role: string,
    view: 'team' | 'my' = 'team',
    filters: DashboardFilters = {},
  ): Promise<DashboardData> {
    const cacheKey = CacheKeys.dashboard(tenantId, userId, role, { view, ...filters });
    const cached = await this.redis.get<DashboardData>(cacheKey);
    if (cached) return cached;

    const now = new Date();

    // ── User filter ──────────────────────────────────────────────────────────
    let userFilter: string[] | null;
    if (filters.userId) {
      userFilter = [filters.userId];
    } else if (view === 'my') {
      userFilter = [userId];
    } else {
      userFilter = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    }
    const idFilter = userFilter ? { in: userFilter } : undefined;

    // ── Date range filter ────────────────────────────────────────────────────
    let dateRange: { gte: Date; lte: Date } | undefined;
    if (filters.period && filters.period !== 'ALL') {
      const range = getPeriodRange(filters.period);
      if (range) dateRange = { gte: range.from, lte: range.to };
    } else if (filters.dateFrom || filters.dateTo) {
      dateRange = {
        gte: filters.dateFrom ? new Date(filters.dateFrom) : new Date('2000-01-01'),
        lte: filters.dateTo  ? new Date(filters.dateTo)   : new Date(),
      };
    }

    // ── Project filter ───────────────────────────────────────────────────────
    const projectFilter = filters.projectId ? { projectId: filters.projectId } : {};

    // Shorthand helpers for per-module base where clauses
    const delBase = { tenantId, ...projectFilter, ...(idFilter ? { delegatedToId: idFilter } : {}), ...(dateRange ? { targetDate: dateRange } : {}) };
    const wrBase  = { tenantId, ...projectFilter, ...(idFilter ? { requestedForId: idFilter } : {}), ...(dateRange ? { deadlineDate: dateRange } : {}) };
    const clBase  = { tenantId, ...projectFilter, ...(idFilter ? { assignedToId: idFilter } : {}), ...(dateRange ? { plannedDate: dateRange } : {}) };
    const fmsBase = { tenantId, ...(idFilter ? { personId: idFilter } : {}), ...(dateRange ? { plannedDate: dateRange } : {}) };

    const [
      delTotal, delDone, delDelayed,
      wrTotal, wrDone, wrDelayed,
      clTotal, clDone, clDelayed,
      fmsTotal, fmsDone, fmsDelayed,
      approvalCount,
      criticalTasks,
    ] = await Promise.all([
      // Delegation
      this.prisma.delegationTask.count({ where: delBase }),
      this.prisma.delegationTask.count({ where: { ...delBase, status: 'COMPLETED' } }),
      this.prisma.delegationTask.count({ where: { ...delBase, status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK'] }, targetDate: { lt: now } } }),
      // Work Requests
      this.prisma.workRequest.count({ where: wrBase }),
      this.prisma.workRequest.count({ where: { ...wrBase, status: 'COMPLETED' } }),
      this.prisma.workRequest.count({ where: { ...wrBase, status: { in: ['PENDING', 'REWORK'] }, deadlineDate: { lt: now } } }),
      // Checklist
      this.prisma.checklistTask.count({ where: clBase }),
      this.prisma.checklistTask.count({ where: { ...clBase, status: 'COMPLETED' } }),
      this.prisma.checklistTask.count({ where: { ...clBase, OR: [{ status: 'LATE' }, { onTimeStatus: 'LATE' }] } }),
      // FMS
      this.prisma.fmsTask.count({ where: fmsBase }),
      this.prisma.fmsTask.count({ where: { ...fmsBase, status: 'COMPLETED' } }),
      this.prisma.fmsTask.count({ where: { ...fmsBase, status: { not: 'COMPLETED' }, plannedDate: { lt: now } } }),
      // Approval count — BUG-04 fix: count tasks awaiting the current user's
      // review (delegatedById = approver), not tasks submitted by doers
      // (delegatedToId). Also add WR approvals for completeness.
      Promise.all([
        this.prisma.delegationTask.count({ where: { tenantId, status: 'SEND_FOR_APPROVAL', delegatedById: userId } }),
        this.prisma.workRequest.count({ where: { tenantId, status: 'SEND_FOR_APPROVAL', requestedById: userId } }),
        this.prisma.checklistTask.count({
          where: {
            tenantId,
            status: 'SEND_FOR_APPROVAL',
            master: { is: { createdBy: userId } },
          },
        }),
      ]).then(([d, w, c]) => d + w + c),
      // Critical/overdue tasks (top 10, all 4 modules).
      // Previously only overdue DelegationTasks appeared; WRs, Checklists,
      // and FMS tasks were invisible in the critical panel.
      Promise.all([
        this.prisma.delegationTask.findMany({
          where: { ...delBase, status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK'] }, targetDate: { lt: now } },
          take: 10, orderBy: { targetDate: 'asc' },
          select: {
            id: true, title: true, targetDate: true, status: true, priority: true, projectId: true,
            delegatedTo: { select: { id: true, name: true } },
          },
        }),
        this.prisma.workRequest.findMany({
          where: { ...wrBase, status: { in: ['PENDING', 'REWORK'] }, deadlineDate: { lt: now } },
          take: 10, orderBy: { deadlineDate: 'asc' },
          select: {
            id: true, title: true, description: true, deadlineDate: true, status: true, projectId: true,
            requestFor: { select: { id: true, name: true } },
          },
        }),
        this.prisma.checklistTask.findMany({
          where: { ...clBase, plannedDate: { lt: now }, status: { in: ['PENDING', 'LATE', 'REWORK', 'SEND_FOR_APPROVAL'] } },
          take: 10, orderBy: { plannedDate: 'asc' },
          select: {
            id: true, title: true, plannedDate: true, status: true, projectId: true,
            assignedTo: { select: { id: true, name: true } },
          },
        }),
        this.prisma.fmsTask.findMany({
          where: { ...fmsBase, status: { not: 'COMPLETED' }, plannedDate: { lt: now } },
          take: 10, orderBy: { plannedDate: 'asc' },
          select: {
            id: true, stepName: true, plannedDate: true, status: true,
            person: { select: { id: true, name: true } },
          },
        }),
      ]).then(([delCrit, wrCrit, clCrit, fmsCrit]) => ([
        ...delCrit.map((t) => ({ ...t, module: 'DELEGATION' as const, title: t.title, dueDate: t.targetDate, assignedUser: t.delegatedTo })),
        ...wrCrit.map((t) => ({ ...t, module: 'WORK_REQUEST' as const, title: t.title ?? t.description, dueDate: t.deadlineDate, assignedUser: t.requestFor })),
        ...clCrit.map((t) => ({ ...t, module: 'CHECKLIST' as const, dueDate: t.plannedDate, assignedUser: t.assignedTo })),
        ...fmsCrit.map((t) => ({ ...t, module: 'FMS' as const, title: t.stepName, dueDate: t.plannedDate, assignedUser: (t as any).person })),
      ] as any[]).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()).slice(0, 10)),
    ]);

    const [trend, { projectWiseStatus, fmsWiseStatus, personalPriority }] = await Promise.all([
      this.buildTrend(tenantId, idFilter, 7),
      this.buildEnhancedStats(tenantId, userId, idFilter),
    ]);

    const result: DashboardData = {
      delegation:  { total: delTotal,  done: delDone,  pending: delTotal - delDone,  delayed: delDelayed },
      workRequest: { total: wrTotal,   done: wrDone,   pending: wrTotal - wrDone,   delayed: wrDelayed },
      checklist:   { total: clTotal,   done: clDone,   pending: clTotal - clDone,   delayed: clDelayed },
      fms:         { total: fmsTotal,  done: fmsDone,  pending: fmsTotal - fmsDone, delayed: fmsDelayed },
      criticalTasks,
      approvalPending: approvalCount,
      trend,
      projectWiseStatus,
      fmsWiseStatus,
      personalPriority,
      lastUpdated: now.toISOString(),
    };

    await this.redis.set(cacheKey, result, DASHBOARD_TTL);
    return result;
  }

  /**
   * GAP-04 FIX: Builds a per-day completion trend for the last N days.
   *
   * Previously fired ~98 DB queries (7 days × 14 queries each) — one
   * count() per metric per day. Now fires exactly 8 queries total: one
   * broad findMany per module covering the full N-day window. Results are
   * bucketed by day in memory using isSameDay(), which is O(rows × days)
   * but entirely in-process and orders of magnitude faster than 98 round
   * trips to MongoDB.
   */
  private async buildTrend(
    tenantId: string,
    idFilter: { in: string[] } | undefined,
    days: number,
  ): Promise<TrendPoint[]> {
    const now = new Date();
    const windowStart = startOfDay(subDays(now, days - 1));
    const windowEnd = endOfDay(now);

    const daySlots = Array.from({ length: days }, (_, i) => {
      const d = subDays(now, days - 1 - i);
      return { day: d, label: format(d, 'EEE') };
    });

    // 8 queries total for the full window — one broad fetch per metric per module
    const [delCompleted, wrCompleted, clCompleted, fmsCompleted,
           delDelayed, wrDelayed, clDelayed, fmsDelayed] = await Promise.all([
      this.prisma.delegationTask.findMany({
        where: { tenantId, status: 'COMPLETED', approvedAt: { gte: windowStart, lte: windowEnd }, ...(idFilter ? { delegatedToId: idFilter } : {}) },
        select: { approvedAt: true },
      }),
      this.prisma.workRequest.findMany({
        where: { tenantId, status: 'COMPLETED', approvedAt: { gte: windowStart, lte: windowEnd }, ...(idFilter ? { requestedForId: idFilter } : {}) },
        select: { approvedAt: true },
      }),
      this.prisma.checklistTask.findMany({
        where: { tenantId, status: 'COMPLETED', actualDate: { gte: windowStart, lte: windowEnd }, ...(idFilter ? { assignedToId: idFilter } : {}) },
        select: { actualDate: true },
      }),
      this.prisma.fmsTask.findMany({
        where: { tenantId, status: 'COMPLETED', actualDate: { gte: windowStart, lte: windowEnd }, ...(idFilter ? { personId: idFilter } : {}) },
        select: { actualDate: true },
      }),
      this.prisma.delegationTask.findMany({
        where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK'] }, targetDate: { gte: windowStart, lte: windowEnd }, ...(idFilter ? { delegatedToId: idFilter } : {}) },
        select: { targetDate: true },
      }),
      this.prisma.workRequest.findMany({
        where: { tenantId, status: { in: ['PENDING', 'REWORK'] }, deadlineDate: { gte: windowStart, lte: windowEnd }, ...(idFilter ? { requestedForId: idFilter } : {}) },
        select: { deadlineDate: true },
      }),
      this.prisma.checklistTask.findMany({
        where: {
          tenantId,
          plannedDate: { gte: windowStart, lte: windowEnd },
          ...(idFilter ? { assignedToId: idFilter } : {}),
          OR: [
            { status: 'LATE' },
            { onTimeStatus: 'LATE' },
          ],
        },
        select: { plannedDate: true },
      }),
      this.prisma.fmsTask.findMany({
        where: { tenantId, status: { not: 'COMPLETED' }, plannedDate: { gte: windowStart, lte: windowEnd }, ...(idFilter ? { personId: idFilter } : {}) },
        select: { plannedDate: true },
      }),
    ]);

    // Bucket in memory — O(rows × days), all in-process
    return daySlots.map(({ day, label }) => ({
      label,
      completed:
        delCompleted.filter((r) => r.approvedAt && isSameDay(r.approvedAt, day)).length +
        wrCompleted.filter((r) => r.approvedAt && isSameDay(r.approvedAt, day)).length +
        clCompleted.filter((r) => r.actualDate && isSameDay(r.actualDate, day)).length +
        fmsCompleted.filter((r) => r.actualDate && isSameDay(r.actualDate, day)).length,
      pending: 0, // pending is a point-in-time snapshot; historical per-day pending not meaningful
      delayed:
        delDelayed.filter((r) => r.targetDate && isSameDay(r.targetDate, day)).length +
        wrDelayed.filter((r) => r.deadlineDate && isSameDay(r.deadlineDate, day)).length +
        clDelayed.filter((r) => r.plannedDate && isSameDay(r.plannedDate, day)).length +
        fmsDelayed.filter((r) => r.plannedDate && isSameDay(r.plannedDate, day)).length,
    }));
  }

  private async buildEnhancedStats(
    tenantId: string,
    userId: string,
    idFilter: { in: string[] } | undefined,
  ): Promise<{
    projectWiseStatus: ProjectWiseStatusEntry[];
    fmsWiseStatus: FmsWiseStatusEntry[];
    personalPriority: PersonalPriorityTaskEntry[];
  }> {
    const [
      delTasks, wrTasks, clTasks, projects,
      fmsWorkflows, fmsTasks,
      myDel, myWr, myCl, myFms,
    ] = await Promise.all([
      // Project-wise: delegation tasks with projectId
      this.prisma.delegationTask.findMany({
        where: { tenantId, projectId: { not: null }, ...(idFilter ? { delegatedToId: idFilter } : {}) },
        select: { projectId: true, status: true },
      }),
      // Project-wise: work requests with projectId
      this.prisma.workRequest.findMany({
        where: { tenantId, projectId: { not: null }, ...(idFilter ? { requestedForId: idFilter } : {}) },
        select: { projectId: true, status: true },
      }),
      // Project-wise: checklist tasks with projectId
      this.prisma.checklistTask.findMany({
        where: { tenantId, projectId: { not: null }, ...(idFilter ? { assignedToId: idFilter } : {}) },
        select: { projectId: true, status: true },
      }),
      // All tenant projects for name lookup
      this.prisma.project.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      }),
      // FMS workflows for name lookup
      this.prisma.fmsWorkflow.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      }),
      // FMS tasks grouped by workflow
      this.prisma.fmsTask.findMany({
        where: { tenantId, ...(idFilter ? { personId: idFilter } : {}) },
        select: { workflowId: true, status: true },
      }),
      // Personal priority: user's own pending delegation tasks
      this.prisma.delegationTask.findMany({
        where: { tenantId, delegatedToId: userId, status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK'] } },
        orderBy: [{ priority: 'desc' }, { targetDate: 'asc' }],
        take: 5,
        select: { id: true, title: true, targetDate: true },
      }),
      // Personal priority: user's own pending work requests
      this.prisma.workRequest.findMany({
        where: { tenantId, requestedForId: userId, status: { in: ['PENDING', 'REWORK'] } },
        orderBy: { deadlineDate: 'asc' },
        take: 5,
        select: { id: true, title: true, description: true, deadlineDate: true },
      }),
      // Personal priority: user's own pending checklist tasks
      this.prisma.checklistTask.findMany({
        where: { tenantId, assignedToId: userId, status: { in: ['PENDING', 'LATE', 'REWORK'] } },
        orderBy: { plannedDate: 'asc' },
        take: 5,
        select: { id: true, title: true, plannedDate: true },
      }),
      // Personal priority: user's own pending FMS tasks
      this.prisma.fmsTask.findMany({
        where: { tenantId, personId: userId, status: { not: 'COMPLETED' } },
        orderBy: { plannedDate: 'asc' },
        take: 5,
        select: { id: true, stepName: true, plannedDate: true },
      }),
    ]);

    // ── Project-wise status ──────────────────────────────────────────────────
    const projectNameMap = new Map(projects.map((p) => [p.id, p.name]));
    const pMap = new Map<string, { delPending: number; delDone: number; wrPending: number; wrDone: number; clPending: number; clDone: number }>();

    const ensureProject = (id: string) => {
      if (!pMap.has(id)) pMap.set(id, { delPending: 0, delDone: 0, wrPending: 0, wrDone: 0, clPending: 0, clDone: 0 });
      return pMap.get(id)!;
    };

    for (const t of delTasks) {
      if (!t.projectId) continue;
      const e = ensureProject(t.projectId);
      if (t.status === 'COMPLETED') e.delDone++; else e.delPending++;
    }
    for (const t of wrTasks) {
      if (!t.projectId) continue;
      const e = ensureProject(t.projectId);
      if (t.status === 'COMPLETED') e.wrDone++; else e.wrPending++;
    }
    for (const t of clTasks) {
      if (!t.projectId) continue;
      const e = ensureProject(t.projectId);
      if (t.status === 'COMPLETED') e.clDone++; else e.clPending++;
    }

    const projectWiseStatus: ProjectWiseStatusEntry[] = Array.from(pMap.entries())
      .filter(([id]) => projectNameMap.has(id))
      .map(([id, c]) => {
        const total = c.delPending + c.delDone + c.wrPending + c.wrDone + c.clPending + c.clDone;
        const done  = c.delDone + c.wrDone + c.clDone;
        return {
          projectId:   id,
          projectName: projectNameMap.get(id)!,
          delegation:  { pending: c.delPending, done: c.delDone },
          workRequest: { pending: c.wrPending,  done: c.wrDone  },
          checklist:   { pending: c.clPending,  done: c.clDone  },
          completion:  total > 0 ? (done / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.completion - a.completion);

    // ── FMS-wise status ──────────────────────────────────────────────────────
    const fmsNameMap = new Map(fmsWorkflows.map((w) => [w.id, w.name]));
    const fMap = new Map<string, { pending: number; done: number; total: number }>();

    for (const t of fmsTasks) {
      if (!fMap.has(t.workflowId)) fMap.set(t.workflowId, { pending: 0, done: 0, total: 0 });
      const e = fMap.get(t.workflowId)!;
      e.total++;
      if (t.status === 'COMPLETED') e.done++; else e.pending++;
    }

    const fmsWiseStatus: FmsWiseStatusEntry[] = Array.from(fMap.entries())
      .filter(([id]) => fmsNameMap.has(id))
      .map(([id, counts]) => ({
        fmsId:   id,
        fmsName: fmsNameMap.get(id)!,
        ...counts,
      }));

    // ── Personal priority ────────────────────────────────────────────────────
    const personalPriority: PersonalPriorityTaskEntry[] = [
      ...myDel.map((t) => ({ id: t.id, title: t.title,                        type: 'DELEGATION'   as const, dueDate: t.targetDate,  isCompleted: false })),
      ...myWr.map((t)  => ({ id: t.id, title: t.title ?? t.description ?? '—', type: 'WORK_REQUEST' as const, dueDate: t.deadlineDate, isCompleted: false })),
      ...myCl.map((t)  => ({ id: t.id, title: t.title,                        type: 'CHECKLIST'    as const, dueDate: t.plannedDate,  isCompleted: false })),
      ...myFms.map((t) => ({ id: t.id, title: t.stepName,                     type: 'FMS'          as const, dueDate: t.plannedDate,  isCompleted: false })),
    ]
      .sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return da - db;
      })
      .slice(0, 8);

    return { projectWiseStatus, fmsWiseStatus, personalPriority };
  }

  async getDrilldown(
    tenantId: string,
    userId: string,
    role: string,
    module: 'delegation' | 'workRequest' | 'checklist' | 'fms',
    status: 'total' | 'done' | 'pending' | 'delayed',
    view: 'team' | 'my' = 'team',
  ) {
    const now = new Date();
    let userFilter: string[] | null;
    if (view === 'my') {
      userFilter = [userId];
    } else {
      userFilter = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    }
    const idFilter = userFilter ? { in: userFilter } : undefined;

    if (module === 'delegation') {
      const statusWhere =
        status === 'done'    ? { status: 'COMPLETED' as const } :
        status === 'pending' ? { status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK', 'SEND_FOR_APPROVAL'] as any } } :
        status === 'delayed' ? { status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK'] as any }, targetDate: { lt: now } } :
        {};
      const rows = await this.prisma.delegationTask.findMany({
        where: { tenantId, ...(idFilter ? { delegatedToId: idFilter } : {}), ...statusWhere },
        orderBy: { targetDate: 'asc' },
        take: 100,
        select: {
          id: true, title: true, status: true, priority: true, targetDate: true,
          delegatedTo: { select: { id: true, name: true } },
          delegatedBy: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id, title: r.title, status: r.status, priority: r.priority,
        dueDate: r.targetDate, assignedTo: r.delegatedTo?.name ?? '—',
        assignedBy: r.delegatedBy?.name ?? '—', project: r.project?.name ?? '—',
        module: 'DELEGATION',
      }));
    }

    if (module === 'workRequest') {
      const statusWhere =
        status === 'done'    ? { status: 'COMPLETED' as const } :
        status === 'pending' ? { status: { in: ['PENDING', 'REWORK', 'SEND_FOR_APPROVAL'] as any } } :
        status === 'delayed' ? { status: { in: ['PENDING', 'REWORK'] as any }, deadlineDate: { lt: now } } :
        {};
      const rows = await this.prisma.workRequest.findMany({
        where: { tenantId, ...(idFilter ? { requestedForId: idFilter } : {}), ...statusWhere },
        orderBy: { deadlineDate: 'asc' },
        take: 100,
        select: {
          id: true, title: true, description: true, status: true, deadlineDate: true,
          requestFor: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id, title: r.title ?? r.description ?? '—', status: r.status,
        dueDate: r.deadlineDate, assignedTo: r.requestFor?.name ?? '—',
        assignedBy: r.requestedBy?.name ?? '—', project: r.project?.name ?? '—',
        module: 'WORK_REQUEST',
      }));
    }

    if (module === 'checklist') {
      const baseWhere = { tenantId, ...(idFilter ? { assignedToId: idFilter } : {}) };
      const rows = await this.prisma.checklistTask.findMany({
        where: status === 'done'
          ? { ...baseWhere, status: 'COMPLETED' }
          : status === 'pending'
          ? { ...baseWhere, status: { in: ['PENDING', 'REWORK', 'SEND_FOR_APPROVAL'] as any } }
          : status === 'delayed'
          ? { ...baseWhere, OR: [{ status: 'LATE' }, { onTimeStatus: 'LATE' }] }
          : baseWhere,
        orderBy: { plannedDate: 'asc' },
        take: 100,
        select: {
          id: true, title: true, status: true, plannedDate: true,
          assignedTo: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id, title: r.title, status: r.status,
        dueDate: r.plannedDate, assignedTo: r.assignedTo?.name ?? '—',
        project: r.project?.name ?? '—',
        module: 'CHECKLIST',
      }));
    }

    // fms
    const statusWhere =
      status === 'done'    ? { status: 'COMPLETED' as const } :
      status === 'pending' ? { status: { not: 'COMPLETED' as any } } :
      status === 'delayed' ? { status: { not: 'COMPLETED' as any }, plannedDate: { lt: now } } :
      {};
    const rows = await this.prisma.fmsTask.findMany({
      where: { tenantId, ...(idFilter ? { personId: idFilter } : {}), ...statusWhere },
      orderBy: { plannedDate: 'asc' },
      take: 100,
      select: {
        id: true, stepName: true, status: true, plannedDate: true,
        person: { select: { id: true, name: true } },
        workflow: { select: { id: true, name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id, title: r.stepName ?? '—', status: r.status,
      dueDate: r.plannedDate, assignedTo: (r as any).person?.name ?? '—',
      project: (r as any).workflow?.name ?? '—',
      module: 'FMS',
    }));
  }

  async getNotificationCounts(tenantId: string, userId: string, role: string) {
    const [delegationPending, wrPending, checklistPending, fmsPending, delegationApprovals, wrApprovals, checklistApprovals] =
      await Promise.all([
        this.prisma.delegationTask.count({ where: { tenantId, delegatedToId: userId, status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK'] } } }),
        this.prisma.workRequest.count({ where: { tenantId, requestedForId: userId, status: { in: ['PENDING', 'REWORK'] } } }),
        this.prisma.checklistTask.count({ where: { tenantId, assignedToId: userId, status: { in: ['PENDING', 'LATE', 'REWORK'] } } }),
        this.prisma.fmsTask.count({ where: { tenantId, personId: userId, status: { not: 'COMPLETED' } } }),
        this.prisma.delegationTask.count({ where: { tenantId, delegatedById: userId, status: 'SEND_FOR_APPROVAL' } }),
        this.prisma.workRequest.count({ where: { tenantId, requestedById: userId, status: 'SEND_FOR_APPROVAL' } }),
        this.prisma.checklistTask.count({ where: { tenantId, assignedToId: userId, status: 'SEND_FOR_APPROVAL' } }),
      ]);

    const approvalPending = delegationApprovals + wrApprovals + checklistApprovals;

    return {
      delegation: delegationPending,
      workRequest: wrPending,
      checklist: checklistPending,
      fms: fmsPending,
      approval: approvalPending,
      total: delegationPending + wrPending + checklistPending + fmsPending + approvalPending,
    };
  }
}
