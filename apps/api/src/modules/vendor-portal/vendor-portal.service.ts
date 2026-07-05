import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VendorPortalService {
  constructor(private prisma: PrismaService) {}

  async getAssignedTasks(vendorEmail: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: vendorEmail, tenantId },
      select: { id: true, name: true, email: true },
    });
    if (!user) throw new NotFoundException('Vendor user not found');

    const [tasks, fmsSteps] = await Promise.all([
      this.prisma.delegationTask.findMany({
        where: { tenantId, delegatedToId: user.id, status: { not: 'COMPLETED' } },
        select: { id: true, title: true, targetDate: true, status: true, priority: true, projectId: true },
        orderBy: { targetDate: 'asc' },
      }),
      this.prisma.fmsTask.findMany({
        where: { tenantId, personId: user.id, status: 'PENDING' },
        orderBy: { plannedDate: 'asc' },
      }),
    ]);

    return { vendor: user, tasks, fmsSteps };
  }

  async submitTask(taskId: string, tenantId: string, remarks: string) {
    return this.prisma.delegationTask.updateMany({
      where: { id: taskId, tenantId },
      data: {
        status: 'SEND_FOR_APPROVAL',
        doerRemarks: remarks,
        submittedAt: new Date(),
      },
    });
  }
}
