import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { isTenantWideRole } from '../../common/utils/role.utils';

export interface ApprovalItem {
  id: string;
  type: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST';
  taskId?: string;
  title: string;
  status: string;
  submittedBy: { id: string; name: string };
  submittedAt: Date | null;
  doerRemarks: string | null;
  doerAttachmentIds: string[];
  targetDate: Date;
  reworkCount: number;
  priority?: string;
  projectName?: string;
}

@Injectable()
export class ApprovalService {
  constructor(
    private prisma: PrismaService,
    private hierarchy: HierarchyService,
  ) {}

  /**
   * Returns combined approval queue: Delegation + Work Request + Checklist items
   * filtered by visible team.
   *
   * tab='new'    => items with status SEND_FOR_APPROVAL (awaiting review)
   * tab='rework' => items with status REWORK (sent back, awaiting resubmission)
   *
   * Previously 'tab' was accepted as a parameter but completely ignored --
   * both tabs always queried SEND_FOR_APPROVAL, so the "Rework Submissions"
   * tab always showed an empty list. Fixed: the status filter is now driven by 'tab'.
   */
  async getApprovalQueue(tenantId: string, userId: string, role: string, tab: 'new' | 'rework' = 'new') {
    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    const tenantWide = isTenantWideRole(role);

    const statusFilter = tab === 'rework' ? 'REWORK' : 'SEND_FOR_APPROVAL';

    const delegationWhere: any = { tenantId, status: statusFilter };
    if (visibleIds) delegationWhere.delegatedToId = { in: visibleIds };

    const wrWhere: any = { tenantId, status: statusFilter };
    if (tenantWide) {
      // no additional scope
    } else {
      wrWhere.requestedById = userId;
    }

    const checklistWhere: any = { tenantId, status: statusFilter };
    if (tenantWide) {
      // tenant owners can review all checklist submissions
    } else {
      checklistWhere.master = { is: { createdBy: userId } };
    }

    const [delegations, workRequests, checklists] = await Promise.all([
      this.prisma.delegationTask.findMany({
        where: delegationWhere,
        include: {
          delegatedTo: { select: { id: true, name: true } },
          project: { select: { name: true } },
        },
        orderBy: { submittedAt: 'asc' },
      }),
      this.prisma.workRequest.findMany({
        where: wrWhere,
        include: {
          requestFor: { select: { id: true, name: true } },
          project: { select: { name: true } },
        },
        orderBy: { submittedAt: 'asc' },
      }),
      this.prisma.checklistTask.findMany({
        where: checklistWhere,
        include: {
          assignedTo: { select: { id: true, name: true } },
          project: { select: { name: true } },
          master: { select: { createdBy: true } },
        },
        orderBy: { actualDate: 'asc' },
      }),
    ]);

    const items: ApprovalItem[] = [
      ...delegations.map((d) => ({
        id: d.id,
        type: 'DELEGATION' as const,
        taskId: d.taskId,
        title: d.title,
        status: d.status,
        submittedBy: d.delegatedTo,
        submittedAt: d.submittedAt,
        doerRemarks: d.doerRemarks,
        doerAttachmentIds: d.doerAttachmentIds,
        targetDate: d.targetDate,
        reworkCount: d.reworkCount,
        priority: d.priority,
        projectName: d.project?.name,
      })),
      ...workRequests.map((w) => ({
        id: w.id,
        type: 'WORK_REQUEST' as const,
        taskId: w.requestId,
        title: w.title,
        status: w.status,
        submittedBy: w.requestFor,
        submittedAt: w.submittedAt,
        doerRemarks: w.doerRemarks,
        doerAttachmentIds: w.doerAttachmentIds,
        targetDate: w.deadlineDate,
        reworkCount: w.reworkCount,
        projectName: w.project?.name,
      })),
      ...checklists.map((c) => ({
        id: c.id,
        type: 'CHECKLIST' as const,
        taskId: c.taskId,
        title: c.title,
        status: c.status,
        submittedBy: c.assignedTo,
        submittedAt: c.actualDate,
        doerRemarks: c.remarks,
        doerAttachmentIds: c.attachmentIds,
        targetDate: c.plannedDate,
        reworkCount: 0,
        projectName: c.project?.name,
      })),
    ];

    items.sort((a, b) => {
      if (!a.submittedAt) return 1;
      if (!b.submittedAt) return -1;
      return a.submittedAt.getTime() - b.submittedAt.getTime();
    });

    return { data: items, total: items.length };
  }

  /**
   * BUG-06 fix: getReworkHistory() was a duplicate of getApprovalQueue(tab='rework')
   * that returned data in a different shape, causing the "Rework Submissions" tab
   * to be backed by inconsistent logic depending on which endpoint the controller called.
   *
   * @deprecated Use getApprovalQueue(tenantId, userId, role, 'rework') instead.
   * This stub is kept so existing callers don't crash while the controller is
   * updated to call getApprovalQueue directly.
   */
  async getReworkHistory(tenantId: string, userId: string, role: string) {
    const result = await this.getApprovalQueue(tenantId, userId, role, 'rework');
    return {
      delegations: result.data.filter((i) => i.type === 'DELEGATION'),
      workRequests: result.data.filter((i) => i.type === 'WORK_REQUEST'),
      checklists: result.data.filter((i) => i.type === 'CHECKLIST'),
      total: result.total,
    };
  }

  async getPendingApprovalCount(tenantId: string, userId: string, role: string): Promise<number> {
    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    const tenantWide = isTenantWideRole(role);

    const wrWhere: any = { tenantId, status: 'SEND_FOR_APPROVAL' };
    if (tenantWide) {
      // no additional scope
    } else {
      wrWhere.requestedById = userId;
    }

    const [delegationCount, wrCount, checklistCount] = await Promise.all([
      this.prisma.delegationTask.count({
        where: {
          tenantId,
          status: 'SEND_FOR_APPROVAL',
          ...(visibleIds ? { delegatedToId: { in: visibleIds } } : {}),
        },
      }),
      this.prisma.workRequest.count({ where: wrWhere }),
      this.prisma.checklistTask.count({
        where: {
          tenantId,
          status: 'SEND_FOR_APPROVAL',
          ...(tenantWide ? {} : { master: { is: { createdBy: userId } } }),
        },
      }),
    ]);

    return delegationCount + wrCount + checklistCount;
  }

  async getMySubmissions(tenantId: string, userId: string) {
    const [delegations, workRequests, checklists] = await Promise.all([
      this.prisma.delegationTask.findMany({
        where: { tenantId, delegatedToId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        include: { project: { select: { name: true } } },
      }),
      this.prisma.workRequest.findMany({
        where: { tenantId, requestedForId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        include: { project: { select: { name: true } } },
      }),
      this.prisma.checklistTask.findMany({
        where: { tenantId, assignedToId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        include: { project: { select: { name: true } } },
      }),
    ]);

    return { delegations, workRequests, checklists };
  }
}
