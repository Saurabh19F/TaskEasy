import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClientPortalService {
  constructor(private prisma: PrismaService) {}

  async getProjectStatus(projectId: string, tenantId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      include: {
        delegationTasks: {
          select: { id: true, title: true, status: true, targetDate: true, priority: true },
          orderBy: { targetDate: 'asc' },
        },
        fmsWorkflows: {
          include: {
            steps: {
              select: { id: true, stepName: true, stepNo: true, what: true },
              orderBy: { stepNo: 'asc' },
            },
          },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async getWorkRequests(tenantId: string, clientEmail?: string) {
    const where: any = { tenantId };
    if (clientEmail) {
      const user = await this.prisma.user.findFirst({
        where: { email: clientEmail, tenantId },
        select: { id: true },
      });
      if (user) where.requestedById = user.id;
    }

    return this.prisma.workRequest.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
