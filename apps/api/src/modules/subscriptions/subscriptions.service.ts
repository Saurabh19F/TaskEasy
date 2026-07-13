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

    const pendingRequest = await this.prisma.planChangeRequest.findFirst({
      where: { tenantId, status: 'PENDING' },
      include: { requestedPlan: true, currentPlan: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      subscription,
      usage: { users: userCount, fmsWorkflows: fmsCount },
      pendingRequest,
    };
  }

  async requestPlanChange(
    tenantId: string,
    userId: string,
    requestedPlanId: string,
    reason?: string,
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { id: requestedPlanId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (!plan.isActive) throw new BadRequestException('Plan is no longer available');

    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });
    if (!subscription) throw new BadRequestException('No active subscription found');

    if (subscription.planId === requestedPlanId) {
      throw new BadRequestException('You are already on this plan');
    }

    const existing = await this.prisma.planChangeRequest.findFirst({
      where: { tenantId, status: 'PENDING' },
    });
    if (existing) {
      throw new BadRequestException(
        'You already have a pending plan change request. Please wait for it to be reviewed.',
      );
    }

    return this.prisma.planChangeRequest.create({
      data: {
        tenantId,
        requestedById: userId,
        currentPlanId: subscription.planId,
        requestedPlanId,
        reason,
      },
      include: { requestedPlan: true, currentPlan: true },
    });
  }

  async cancelRequest(tenantId: string, requestId: string) {
    const request = await this.prisma.planChangeRequest.findFirst({
      where: { id: requestId, tenantId, status: 'PENDING' },
    });
    if (!request) throw new NotFoundException('Pending request not found');

    return this.prisma.planChangeRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED', reviewedAt: new Date() },
    });
  }

  async listMyRequests(tenantId: string) {
    return this.prisma.planChangeRequest.findMany({
      where: { tenantId },
      include: { requestedPlan: true, currentPlan: true, requestedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
