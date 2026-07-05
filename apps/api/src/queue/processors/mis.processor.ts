import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MisCalculatorService } from '../../modules/mis/mis-calculator.service';
import { getPeriodRange } from '../../common/utils/date.utils';
import { QUEUES } from '../queue.constants';

interface WeeklySnapshotJob {
  tenantId?: string;
  periodType: 'WEEKLY' | 'MONTHLY';
}

@Processor(QUEUES.MIS)
export class MisProcessor {
  private readonly logger = new Logger(MisProcessor.name);

  constructor(
    private prisma: PrismaService,
    private misCalculator: MisCalculatorService,
  ) {}

  /**
   * Weekly MIS snapshot job.
   * Calculates performance for all users and stores in MIS history.
   */
  @Process('weekly-snapshot')
  async handleWeeklySnapshot(job: Job<WeeklySnapshotJob>) {
    const { periodType = 'WEEKLY', tenantId } = job.data;
    this.logger.log(`Running ${periodType} MIS snapshot...`);

    // Get period range
    const { from, to } = getPeriodRange(periodType === 'WEEKLY' ? 'THIS_WEEK' : 'THIS_MONTH')!;

    const tenants = tenantId
      ? [{ id: tenantId }]
      : await this.prisma.tenant.findMany({ where: { isActive: true }, select: { id: true } });

    for (const tenant of tenants) {
      const users = await this.prisma.user.findMany({
        where: { tenantId: tenant.id, status: 'ACTIVE' },
        select: { id: true },
      });

      for (const user of users) {
        await this.calculateAndStoreSnapshot(tenant.id, user.id, periodType, from, to);
      }
    }

    this.logger.log(`${periodType} MIS snapshots completed`);
  }

  private async calculateAndStoreSnapshot(
    tenantId: string,
    userId: string,
    periodType: string,
    from: Date,
    to: Date,
  ) {
    // Same calculator the live MIS endpoint uses (Delegation + Work Request +
    // Checklist + FMS, same scoring formula) — keeps the stored history
    // consistent with what the dashboard shows for the same period.
    const result = await this.misCalculator.calculateForUser(userId, tenantId, from, to);

    await this.prisma.misSnapshot.upsert({
      where: {
        tenantId_userId_periodType_periodStart: {
          tenantId, userId, periodType, periodStart: from,
        },
      },
      // Deliberately does not touch `targetScore` — that's set independently
      // via MisService.saveWeeklyTarget() and must survive this recompute.
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
        tenantId, userId, periodType, periodStart: from, periodEnd: to,
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
  }
}
