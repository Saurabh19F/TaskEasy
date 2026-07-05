import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calculateMisScore, scoreToGrade } from '../../common/utils/mis.utils';

interface CategoryRaw {
  total: number;
  completed: number;
  pending: number;
  late: number;          // all tasks with onTimeStatus=LATE (used for display)
  completedLate: number; // completed tasks that were LATE — "tasksDelayed" in KPI formulas
  onTime: number;
  delayDays: number;          // total delay days (all tasks)
  completedDelayDays: number; // delay days only for completed-late tasks (KPI 3 numerator)
  reworkCount: number;
}

interface CategoryKPIs {
  completedAsPerPlan: number;
  completedOnTime: number;
  noDelay: number;
}

export interface CategoryPublicRaw {
  total: number;
  completed: number;
  pending: number;
  onTime: number;
  late: number;
  delayDays: number;
}

interface SummaryRow {
  total: number;
  pending: number;
  score: number;
  grade: string;
  hrs: number;
}

export interface MisCardResult {
  userId: string;
  name: string;
  email: string;
  role: string;
  metrics: {
    total: number;
    completed: number;
    pending: number;
    late: number;
    onTime: number;
    reworkCount: number;
    onTimePercent: number;
    delayDays: number;
  };
  score: number;
  grade: string;
  activeTasksCount: number;
  cardSummary: {
    total: SummaryRow;
    checklist: SummaryRow;
    task: SummaryRow;
  };
  categoryMetrics: {
    del: CategoryKPIs;
    wor: CategoryKPIs;
    che: CategoryKPIs;
    fms: CategoryKPIs;
  };
  categoryRaw: {
    del: CategoryPublicRaw;
    wor: CategoryPublicRaw;
    che: CategoryPublicRaw;
    fms: CategoryPublicRaw;
  };
}

@Injectable()
export class MisCalculatorService {
  constructor(private prisma: PrismaService) {}

  async calculateForUser(
    userId: string,
    tenantId: string,
    from: Date,
    to: Date,
    projectId?: string,
  ): Promise<MisCardResult> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) throw new Error(`User ${userId} not found`);

    const dateFilter = { gte: from, lte: to };

    const [delegation, workRequest, checklist, fmsTasks] = await Promise.all([
      this.prisma.delegationTask.findMany({
        where: {
          tenantId, delegatedToId: userId, targetDate: dateFilter,
          ...(projectId ? { projectId } : {}),
        },
        select: { status: true, onTimeStatus: true, reworkCount: true, delayDays: true },
      }),
      this.prisma.workRequest.findMany({
        where: {
          tenantId, requestedForId: userId, deadlineDate: dateFilter,
          ...(projectId ? { projectId } : {}),
        },
        select: { status: true, onTimeStatus: true, reworkCount: true, delayDays: true },
      }),
      // Checklist/FMS are filtered by plannedDate, not createdAt — matching
      // MisService.getDetailedData()'s drill-down query. They're recurring/
      // planned-work models, so "this week's performance" means tasks due
      // this week, not rows that happened to be inserted this week (a daily
      // generator job creates next-period rows ahead of time, which would
      // otherwise put a task in the wrong period's count).
      this.prisma.checklistTask.findMany({
        where: {
          tenantId, assignedToId: userId, plannedDate: dateFilter,
          ...(projectId ? { projectId } : {}),
        },
        select: { status: true, onTimeStatus: true, delayDays: true },
      }),
      // FmsTask has no projectId of its own (only its parent FmsWorkflow does),
      // so a project filter can't be applied here without an extra join —
      // FMS tasks are included regardless of the projectId filter.
      this.prisma.fmsTask.findMany({
        where: { tenantId, personId: userId, plannedDate: dateFilter },
        select: { status: true, onTimeStatus: true, delayDays: true },
      }),
    ]);

    // Keep each category separate so we can compute per-category breakdowns.
    const delRaw  = this.rawFromTasks(delegation.map((d) => ({ ...d, reworkCount: d.reworkCount ?? 0 })));
    const worRaw  = this.rawFromTasks(workRequest.map((d) => ({ ...d, reworkCount: d.reworkCount ?? 0 })));
    const cheRaw  = this.rawFromTasks(checklist.map((d) => ({ ...d, reworkCount: 0 })));
    const fmsRaw  = this.rawFromTasks(fmsTasks.map((d) => ({ ...d, reworkCount: 0 })));

    // Combined totals (same logic as before)
    const total        = delRaw.total + worRaw.total + cheRaw.total + fmsRaw.total;
    const completed    = delRaw.completed + worRaw.completed + cheRaw.completed + fmsRaw.completed;
    // LE-05 fix: pending = all non-completed so total === completed + pending always
    const pending      = total - completed;
    const late              = delRaw.late + worRaw.late + cheRaw.late + fmsRaw.late;
    const completedLate     = delRaw.completedLate + worRaw.completedLate + cheRaw.completedLate + fmsRaw.completedLate;
    const onTime            = delRaw.onTime + worRaw.onTime + cheRaw.onTime + fmsRaw.onTime;
    const reworkCount       = delRaw.reworkCount + worRaw.reworkCount;
    const delayDays         = delRaw.delayDays + worRaw.delayDays + cheRaw.delayDays + fmsRaw.delayDays;
    const completedDelayDays = delRaw.completedDelayDays + worRaw.completedDelayDays + cheRaw.completedDelayDays + fmsRaw.completedDelayDays;
    const onTimePercent = completed > 0 ? Math.round((onTime / completed) * 100) : 0;

    // BUG-10 fix: score is null when total=0 — frontend shows N/A not D
    const score = calculateMisScore({ total, completed, late, onTime, reworkCount, delayDays });
    const grade = scoreToGrade(score);

    // "task" row in the card = delegation only (delegation tasks are the primary "Task" module)
    const taskRaw = delRaw;

    // activeTasksCount = pending delegation + pending work requests (not checklist/fms)
    const activeTasksCount = delRaw.pending + worRaw.pending;

    return {
      userId,
      name: user.name,
      email: user.email,
      role: user.role,
      metrics: { total, completed, pending, late, onTime, reworkCount, onTimePercent, delayDays },
      score,
      grade,
      activeTasksCount,
      cardSummary: {
        total:     this.summaryFromRaw({ total, completed, pending, late, completedLate, onTime, reworkCount, delayDays, completedDelayDays }),
        checklist: this.summaryFromRaw(cheRaw),
        task:      this.summaryFromRaw(taskRaw),
      },
      categoryMetrics: {
        del: this.kpisFromRaw(delRaw),
        wor: this.kpisFromRaw(worRaw),
        che: this.kpisFromRaw(cheRaw),
        fms: this.kpisFromRaw(fmsRaw),
      },
      categoryRaw: {
        del: this.toPublicRaw(delRaw),
        wor: this.toPublicRaw(worRaw),
        che: this.toPublicRaw(cheRaw),
        fms: this.toPublicRaw(fmsRaw),
      },
    };
  }

  private rawFromTasks(
    tasks: { status: string; onTimeStatus: string | null; delayDays: number | null; reworkCount: number }[],
  ): CategoryRaw {
    const total       = tasks.length;
    const completed   = tasks.filter((t) => t.status === 'COMPLETED').length;
    const pending     = total - completed;
    const late        = tasks.filter((t) => t.onTimeStatus === 'LATE').length;
    const onTime      = tasks.filter((t) => t.onTimeStatus === 'ON_TIME').length;
    const delayDays   = tasks.reduce((s, t) => s + (t.delayDays ?? 0), 0);
    const reworkCount = tasks.reduce((s, t) => s + (t.reworkCount ?? 0), 0);

    // KPI 2 & 3 need only COMPLETED tasks that are late ("tasksDelayed" in the formulas)
    const completedLateTasks = tasks.filter(
      (t) => t.status === 'COMPLETED' && t.onTimeStatus === 'LATE',
    );
    const completedLate      = completedLateTasks.length;
    const completedDelayDays = completedLateTasks.reduce((s, t) => s + (t.delayDays ?? 0), 0);

    return { total, completed, pending, late, completedLate, onTime, delayDays, completedDelayDays, reworkCount };
  }

  private kpisFromRaw(r: CategoryRaw): CategoryKPIs {
    return {
      // KPI 1: -((pending * 100) / total)
      completedAsPerPlan: r.total > 0         ? -Math.round((r.pending * 100) / r.total)                : 0,
      // KPI 2: -((tasksDelayed * 100) / done)  — tasksDelayed = completed & LATE
      completedOnTime:    r.completed > 0     ? -Math.round((r.completedLate * 100) / r.completed)      : 0,
      // KPI 3: -(totalDelayDays / tasksDelayed) — real working-day delay, not +1
      noDelay:            r.completedLate > 0 ? -Math.round(r.completedDelayDays / r.completedLate)     : 0,
    };
  }

  private toPublicRaw(r: CategoryRaw): CategoryPublicRaw {
    return {
      total: r.total, completed: r.completed, pending: r.pending,
      onTime: r.onTime, late: r.late, delayDays: r.delayDays,
    };
  }

  private summaryFromRaw(r: CategoryRaw): SummaryRow {
    const score = calculateMisScore(r);
    return {
      total:   r.total,
      pending: r.pending,
      score:   score ?? 0,
      grade:   scoreToGrade(score),
      hrs:     0,
    };
  }

  async calculateForTenant(
    tenantId: string,
    from: Date,
    to: Date,
    userIds?: string[],
  ): Promise<MisCardResult[]> {
    const where: any = { tenantId, status: 'ACTIVE' };
    if (userIds?.length) where.id = { in: userIds };

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    return Promise.all(users.map((u) => this.calculateForUser(u.id, tenantId, from, to)));
  }
}
