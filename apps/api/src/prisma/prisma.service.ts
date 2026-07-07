import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
    await this.dropStaleIndexes();
  }

  private async dropStaleIndexes() {
    const staleIndexes: Record<string, string[]> = {
      users: ['userId_1'],
    };

    for (const [collection, indexNames] of Object.entries(staleIndexes)) {
      for (const indexName of indexNames) {
        try {
          await this.$runCommandRaw({ dropIndexes: collection, index: indexName });
          this.logger.log(`Dropped stale index "${indexName}" from ${collection}`);
        } catch (err: any) {
          if (err.message?.includes('index not found') || err.code === 27) continue;
          this.logger.warn(`Failed to drop index "${indexName}" from ${collection}: ${err.message}`);
        }
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Utility: clean up test data in test environments
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase is only allowed in test environment');
    }
    const db = this as any;
    // Order matters due to references
    await db.auditLog.deleteMany();
    await db.platformMetricSnapshot.deleteMany();
    await db.platformAuditLog.deleteMany();
    await db.platformNotification.deleteMany();
    await db.securityEvent.deleteMany();
    await db.backupJob.deleteMany();
    await db.systemSetting.deleteMany();
    await db.impersonationSession.deleteMany();
    await db.payment.deleteMany();
    await db.invoice.deleteMany();
    await db.supportTicket.deleteMany();
    await db.platformLoginHistory.deleteMany();
    await db.platformRefreshToken.deleteMany();
    await db.platformPermission.deleteMany();
    await db.platformRole.deleteMany();
    await db.platformUser.deleteMany();
    await db.notification.deleteMany();
    await db.activityLog.deleteMany();
    await db.comment.deleteMany();
    await db.approval.deleteMany();
    await db.delegationTask.deleteMany();
    await db.workRequest.deleteMany();
    await db.checklistTask.deleteMany();
    await db.checklistMaster.deleteMany();
    await db.fmsTask.deleteMany();
    await db.fmsStep.deleteMany();
    await db.fmsWorkflow.deleteMany();
    await db.project.deleteMany();
    await db.hierarchy.deleteMany();
    await db.loginHistory.deleteMany();
    await db.refreshToken.deleteMany();
    await db.user.deleteMany();
    await db.subscription.deleteMany();
    await db.tenant.deleteMany();
  }
}
