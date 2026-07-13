import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async listPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async getMySubscription(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    const userCount = await this.prisma.user.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    const fmsCount = await this.prisma.fmsWorkflow.count({
      where: { tenantId },
    });

    return {
      subscription,
      usage: { users: userCount, fmsWorkflows: fmsCount },
    };
  }

  async changePlan(tenantId: string, planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (!plan.isActive) throw new BadRequestException('Plan is no longer available');

    const userCount = await this.prisma.user.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (userCount > plan.maxUsers) {
      throw new BadRequestException(
        `You have ${userCount} active users but this plan allows only ${plan.maxUsers}. Remove users first.`,
      );
    }

    const fmsCount = await this.prisma.fmsWorkflow.count({
      where: { tenantId },
    });
    if (fmsCount > plan.maxFmsWorkflows) {
      throw new BadRequestException(
        `You have ${fmsCount} FMS workflows but this plan allows only ${plan.maxFmsWorkflows}. Remove workflows first.`,
      );
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.subscription.upsert({
      where: { tenantId },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        planSnapshot: plan as any,
      },
      create: {
        tenantId,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        autoRenew: true,
        planSnapshot: plan as any,
      },
      include: { plan: true },
    });

    return subscription;
  }
}
