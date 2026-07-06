import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';

@Injectable()
export class CalendarService {
  constructor(
    private prisma: PrismaService,
    private hierarchy: HierarchyService,
  ) {}

  async getEvents(
    tenantId: string,
    userId: string,
    role: string,
    from: Date,
    to: Date,
  ) {
    // null => SAAS_OWNER (sees everyone). Otherwise scope to the
    // caller's hierarchy team (Admin/Manager) or themselves (Employee) —
    // previously any Admin/Manager saw every event in the whole tenant
    // regardless of which team they actually manage.
    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);

    const [delegation, workRequests, checklist, fmsTasks, holidays] = await Promise.all([
      this.prisma.delegationTask.findMany({
        where: {
          tenantId,
          ...(visibleIds ? { delegatedToId: { in: visibleIds } } : {}),
          targetDate: { gte: from, lte: to },
        },
        select: {
          id: true, title: true, targetDate: true, status: true, priority: true,
          delegatedToId: true,
        },
      }),
      this.prisma.workRequest.findMany({
        where: {
          tenantId,
          ...(visibleIds ? { requestedForId: { in: visibleIds } } : {}),
          deadlineDate: { gte: from, lte: to },
        },
        select: {
          id: true, requestId: true, description: true, deadlineDate: true, status: true,
          requestedForId: true,
        },
      }),
      this.prisma.checklistTask.findMany({
        where: {
          tenantId,
          ...(visibleIds ? { assignedToId: { in: visibleIds } } : {}),
          plannedDate: { gte: from, lte: to },
        },
        select: {
          id: true, title: true, plannedDate: true, status: true, frequency: true,
          assignedToId: true,
        },
      }),
      this.prisma.fmsTask.findMany({
        where: {
          tenantId,
          ...(visibleIds ? { personId: { in: visibleIds } } : {}),
          plannedDate: { gte: from, lte: to },
        },
        select: {
          id: true, stepName: true, plannedDate: true, status: true,
          personId: true, fmsName: true,
        },
      }),
      this.prisma.holidayCalendar.findMany({
        where: {
          tenantId,
          date: { gte: from, lte: to },
        },
        select: { id: true, name: true, date: true },
      }),
    ]);

    return {
      delegation: delegation.map((t) => ({ ...t, type: 'DELEGATION', date: t.targetDate })),
      workRequests: workRequests.map((t) => ({
        ...t,
        title: t.requestId,
        type: 'WORK_REQUEST',
        date: t.deadlineDate,
      })),
      checklist: checklist.map((t) => ({ ...t, type: 'CHECKLIST', date: t.plannedDate })),
      fms: fmsTasks.map((t) => ({
        ...t,
        title: t.stepName,
        type: 'FMS',
        date: t.plannedDate,
      })),
      holidays: holidays.map((h) => ({
        id: h.id,
        title: h.name,
        date: h.date,
        type: 'HOLIDAY' as const,
      })),
    };
  }
}
