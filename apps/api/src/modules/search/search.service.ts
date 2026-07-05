import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { isApproverRole } from '../../common/utils/role.utils';

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private hierarchy: HierarchyService,
  ) {}

  async globalSearch(
    query: string,
    tenantId: string,
    userId: string,
    role: string,
  ) {
    if (!query || query.trim().length < 2) {
      return { tasks: [], requests: [], projects: [], users: [] };
    }

    const q = query.trim();
    const contains = { contains: q, mode: 'insensitive' as const };
    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    const userScope = visibleIds ? { in: visibleIds } : undefined;

    const [tasks, requests, projects, users] = await Promise.all([
      this.prisma.delegationTask.findMany({
        where: { tenantId, title: contains, ...(userScope ? { delegatedToId: userScope } : {}) },
        select: { id: true, taskId: true, title: true, status: true, priority: true },
        take: 5,
      }),
      this.prisma.workRequest.findMany({
        where: {
          tenantId,
          title: contains,
          ...(userScope
            ? { OR: [{ requestedById: userScope }, { requestedForId: userScope }] }
            : {}),
        },
        select: { id: true, requestId: true, title: true, status: true },
        take: 5,
      }),
      this.prisma.project.findMany({
        where: { tenantId, name: contains },
        select: { id: true, name: true, status: true, color: true },
        take: 5,
      }),
      isApproverRole(role)
        ? this.prisma.user.findMany({
            where: {
              tenantId,
              ...(userScope ? { id: userScope } : {}),
              OR: [{ name: contains }, { email: contains }],
            },
            select: { id: true, name: true, email: true, role: true },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    return { tasks, requests, projects, users };
  }
}
