import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

export interface TaskRiskPrediction {
  taskId: string;
  type: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS';
  title: string;
  assigneeId: string;
  assigneeName: string;
  deadline: Date | null;
  riskScore: number;          // 0-100 (100 = certain delay)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
}

export interface WorkloadPrediction {
  userId: string;
  name: string;
  pendingCount: number;
  dueThisWeek: number;
  reworkRate: number;         // 0-1
  burnoutRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  predictedCompletionRate: number; // 0-1
}

export interface ProjectRiskPrediction {
  projectId: string;
  projectName: string;
  totalTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  avgDelayDays: number;
  healthScore: number;        // 0-100
  riskLevel: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  recommendations: string[];
}

@Injectable()
export class PredictiveService {
  private readonly logger = new Logger(PredictiveService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ── Task Delay Predictions ────────────────────────────────────────────────

  async predictTaskDelays(actor: JwtPayload): Promise<TaskRiskPrediction[]> {
    const cacheKey = `predictive:tasks:${actor.tenantId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { tenantId } = actor;
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch active tasks due within 7 days
    const delegations = await this.prisma.delegationTask.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        targetDate: { lte: weekAhead },
      },
      include: {
        delegatedTo: { select: { id: true, name: true } },
      },
    });

    const predictions: TaskRiskPrediction[] = [];

    for (const d of delegations) {
      const [pendingCount, reworkCount, lateCount] = await Promise.all([
        this.prisma.delegationTask.count({
          where: { tenantId, delegatedToId: d.delegatedToId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        }),
        this.prisma.delegationTask.count({
          where: { tenantId, delegatedToId: d.delegatedToId, status: 'REWORK' },
        }),
        this.prisma.delegationTask.count({
          where: { tenantId, delegatedToId: d.delegatedToId, onTimeStatus: 'LATE' },
        }),
      ]);

      const reasons: string[] = [];
      let risk = 0;

      const daysLeft = d.targetDate
        ? Math.ceil((new Date(d.targetDate).getTime() - now.getTime()) / 86400000)
        : 30;

      if (daysLeft <= 0) { risk += 40; reasons.push('Already past deadline'); }
      else if (daysLeft === 1) { risk += 25; reasons.push('Due tomorrow'); }
      else if (daysLeft <= 3) { risk += 15; reasons.push(`Due in ${daysLeft} days`); }

      if (pendingCount > 15) { risk += 20; reasons.push(`Assignee has ${pendingCount} pending tasks`); }
      else if (pendingCount > 8) { risk += 10; reasons.push(`Assignee has ${pendingCount} pending tasks`); }

      if (reworkCount > 3) { risk += 15; reasons.push(`${reworkCount} previous reworks`); }
      else if (reworkCount > 0) { risk += 8; reasons.push(`${reworkCount} previous rework`); }

      if (lateCount > 5) { risk += 15; reasons.push(`${lateCount} late completions in history`); }
      else if (lateCount > 0) { risk += 7; reasons.push(`${lateCount} late completion(s) in history`); }

      if (d.priority === 'CRITICAL') { risk += 10; reasons.push('Critical priority — high visibility'); }

      risk = Math.min(100, risk);

      predictions.push({
        taskId: d.id,
        type: 'DELEGATION',
        title: String(d.title ?? d.description ?? '').slice(0, 80),
        assigneeId: d.delegatedToId,
        assigneeName: d.delegatedTo.name,
        deadline: d.targetDate,
        riskScore: risk,
        riskLevel: risk >= 70 ? 'CRITICAL' : risk >= 50 ? 'HIGH' : risk >= 25 ? 'MEDIUM' : 'LOW',
        reasons,
      });
    }

    // Sort by risk descending
    const sorted = predictions.sort((a, b) => b.riskScore - a.riskScore);
    await this.redis.set(cacheKey, JSON.stringify(sorted), 300); // 5-min cache
    return sorted;
  }

  // ── Workload / Burnout Predictions ────────────────────────────────────────

  async predictWorkload(actor: JwtPayload): Promise<WorkloadPrediction[]> {
    const cacheKey = `predictive:workload:${actor.tenantId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { tenantId } = actor;
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: { tenantId, status: 'ACTIVE', role: { in: ['EMPLOYEE', 'TEAM_LEAD', 'MANAGER'] } },
      select: { id: true, name: true },
    });

    const predictions: WorkloadPrediction[] = await Promise.all(
      users.map(async (u) => {
        const [pending, dueThisWeek, completedMonth, reworkMonth, lateMonth] = await Promise.all([
          this.prisma.delegationTask.count({
            where: { tenantId, delegatedToId: u.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
          }),
          this.prisma.delegationTask.count({
            where: {
              tenantId,
              delegatedToId: u.id,
              status: { in: ['PENDING', 'IN_PROGRESS'] },
              targetDate: { lte: weekEnd },
            },
          }),
          this.prisma.delegationTask.count({
            where: { tenantId, delegatedToId: u.id, status: 'COMPLETED', updatedAt: { gte: monthAgo } },
          }),
          this.prisma.delegationTask.count({
            where: { tenantId, delegatedToId: u.id, status: 'REWORK', updatedAt: { gte: monthAgo } },
          }),
          this.prisma.delegationTask.count({
            where: { tenantId, delegatedToId: u.id, onTimeStatus: 'LATE', updatedAt: { gte: monthAgo } },
          }),
        ]);

        const total = completedMonth + reworkMonth;
        const reworkRate = total > 0 ? reworkMonth / total : 0;
        const predictedCompletionRate = total > 0
          ? Math.max(0, 1 - (lateMonth + reworkMonth) / total)
          : 1;

        const burnoutRisk: WorkloadPrediction['burnoutRisk'] =
          pending > 20 ? 'HIGH'
          : pending > 10 ? 'MEDIUM'
          : 'LOW';

        return { userId: u.id, name: u.name, pendingCount: pending, dueThisWeek, reworkRate, burnoutRisk, predictedCompletionRate };
      })
    );

    const sorted = predictions.sort((a, b) => b.pendingCount - a.pendingCount);
    await this.redis.set(cacheKey, JSON.stringify(sorted), 300);
    return sorted;
  }

  // ── Project Health Predictions ─────────────────────────────────────────────

  async predictProjectHealth(actor: JwtPayload): Promise<ProjectRiskPrediction[]> {
    const cacheKey = `predictive:projects:${actor.tenantId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { tenantId } = actor;
    const now = new Date();

    const projects = await this.prisma.project.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    const predictions: ProjectRiskPrediction[] = await Promise.all(
      projects.map(async (p) => {
        const [total, pending, overdue, lateCompleted] = await Promise.all([
          this.prisma.delegationTask.count({ where: { tenantId, projectId: p.id } }),
          this.prisma.delegationTask.count({
            where: { tenantId, projectId: p.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
          }),
          this.prisma.delegationTask.count({
            where: {
              tenantId,
              projectId: p.id,
              status: { in: ['PENDING', 'IN_PROGRESS'] },
              targetDate: { lt: now },
            },
          }),
          this.prisma.delegationTask.aggregate({
            where: { tenantId, projectId: p.id, status: 'COMPLETED', delayDays: { gt: 0 } },
            _avg: { delayDays: true },
          }),
        ]);

        const avgDelayDays = lateCompleted._avg.delayDays ?? 0;
        const completionRate = total > 0 ? (total - pending) / total : 1;
        const overdueRate = total > 0 ? overdue / total : 0;

        const healthScore = Math.max(0, Math.round(
          completionRate * 50
          - overdueRate * 30
          - Math.min(avgDelayDays, 10) * 2
        ));

        const riskLevel: ProjectRiskPrediction['riskLevel'] =
          healthScore < 30 ? 'CRITICAL' : healthScore < 60 ? 'AT_RISK' : 'HEALTHY';

        const recommendations: string[] = [];
        if (overdueRate > 0.3) recommendations.push('High overdue rate — reassign or extend deadlines');
        if (avgDelayDays > 3) recommendations.push(`Average delay is ${avgDelayDays.toFixed(1)} days — review SLA settings`);
        if (pending > total * 0.5) recommendations.push('More than half of tasks are still pending');
        if (recommendations.length === 0) recommendations.push('Project is on track');

        return { projectId: p.id, projectName: p.name, totalTasks: total, pendingTasks: pending, overdueTasks: overdue, avgDelayDays, healthScore, riskLevel, recommendations };
      })
    );

    const sorted = predictions.sort((a, b) => a.healthScore - b.healthScore);
    await this.redis.set(cacheKey, JSON.stringify(sorted), 300);
    return sorted;
  }
}
