import {
  Injectable,
  Optional,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { AutomationService } from '../automation/automation.service';
import { QUEUES } from '../../queue/queue.constants';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { getPeriodRange, parseFrontendDateTime, calculateDelay } from '../../common/utils/date.utils';
import { loadCompanyCalendar } from '../../common/utils/calendar.utils';
import { generateWorkRequestId, atomicNextWorkRequestId } from '../../common/utils/id-generator.utils';
import { CachePatterns } from '../../common/utils/cache-keys.utils';
import { isApproverRole } from '../../common/utils/role.utils';
import {
  CreateWorkRequestDto,
  SubmitWorkRequestDto,
  ApproveWorkRequestDto,
  ReworkWorkRequestDto,
  WorkRequestQueryDto,
} from './dto/work-request.dto';

@Injectable()
export class WorkRequestService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private hierarchy: HierarchyService,
    private automation: AutomationService,
    @InjectQueue(QUEUES.NOTIFICATION) private notificationQueue: Queue,
    @InjectQueue(QUEUES.EMAIL) private emailQueue: Queue,
    @Optional() private gateway: NotificationsGateway,
  ) {}

  async create(dto: CreateWorkRequestDto, tenantId: string, requestedById: string, requesterRole: string) {
    // Validate doer
    const doer = await this.prisma.user.findFirst({
      where: { id: dto.requestForId, tenantId, status: 'ACTIVE' },
      select: { id: true, name: true, email: true },
    });
    if (!doer) throw new BadRequestException('Doer user not found or inactive');

    const visibleIds = await this.hierarchy.getVisibleUserIds(requestedById, requesterRole, tenantId);
    if (visibleIds && !visibleIds.includes(doer.id)) {
      throw new ForbiddenException('Doer user is outside your team visibility');
    }

    // Validate project
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, tenantId, status: 'ACTIVE' },
    });
    if (!project) throw new BadRequestException('Project not found or inactive');

    // BUG-01 fix: use atomic sequence instead of count+1
    const seq = await atomicNextWorkRequestId(this.prisma, tenantId);
    const requestId = generateWorkRequestId(seq);

    // Parse in the tenant's configured timezone rather than the server
    // process's local timezone — see delegation.service.ts for why.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const deadline = parseFrontendDateTime(
      dto.deadlineDate,
      dto.deadlineTime || '18:00',
      tenant?.timezone ?? 'UTC',
    );

    const holidayOnDate = await this.prisma.holidayCalendar.findFirst({
      where: {
        tenantId,
        date: {
          gte: new Date(dto.deadlineDate + 'T00:00:00.000Z'),
          lte: new Date(dto.deadlineDate + 'T23:59:59.999Z'),
        },
      },
      select: { name: true },
    });
    if (holidayOnDate) {
      throw new BadRequestException(
        `Cannot set deadline on ${dto.deadlineDate} — it is a holiday (${holidayOnDate.name})`,
      );
    }

    const wr = await this.prisma.workRequest.create({
      data: {
        tenantId,
        requestId,
        requestedById,
        requestedForId: dto.requestForId,
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        deadlineDate: deadline,
        attachmentIds: dto.attachmentIds ?? [],
        status: 'PENDING',
      },
    });

    const requester = await this.prisma.user.findUnique({
      where: { id: requestedById },
      select: { name: true },
    });

    // Notify doer
    await this.notificationQueue.add('create-notification', {
      tenantId,
      userId: dto.requestForId,
      type: 'TASK_ASSIGNED',
      title: '📨 Work Request Assigned',
      body: `Work request "${dto.title}" has been assigned to you by ${requester?.name ?? 'the requester'}. Deadline: ${dto.deadlineDate}.`,
      refType: 'WORK_REQUEST',
      refId: wr.id,
    });

    await this.automation.triggerEvent(tenantId, 'TASK_CREATED', {
      taskId: wr.id,
      taskTitle: wr.title,
      refType: 'WORK_REQUEST',
      assigneeId: wr.requestedForId,
    });

    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return wr;
  }

  async findAll(
    tenantId: string,
    userId: string,
    role: string,
    query: WorkRequestQueryDto,
  ) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (query.view === 'mine') {
      where.requestedById = userId;
    } else if (query.view === 'for_me') {
      where.requestedForId = userId;
    } else {
      // Team/admin view with hierarchy filter
      const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
      if (visibleIds) {
        where.OR = [
          { requestedById: { in: visibleIds } },
          { requestedForId: { in: visibleIds } },
        ];
      }
    }

    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;

    if (query.period) {
      const range = getPeriodRange(query.period as any);
      if (range) {
        const { from, to } = range;
        where.createdAt = { gte: from, lte: to };
      }
    } else if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.workRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deadlineDate: 'asc' },
        include: {
          requestedBy: { select: { id: true, name: true } },
          requestFor: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
        },
      }),
      this.prisma.workRequest.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, tenantId: string, userId?: string, role?: string) {
    const wr = await this.prisma.workRequest.findFirst({
      where: { id, tenantId },
      include: {
        requestedBy: { select: { id: true, name: true } },
        requestFor: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });
    if (!wr) throw new NotFoundException('Work request not found');
    if (userId && role) {
      await this.assertCanViewWorkRequest(wr, tenantId, userId, role);
    }
    return wr;
  }

  async submit(id: string, dto: SubmitWorkRequestDto, tenantId: string, userId: string) {
    const wr = await this.findOne(id, tenantId);

    if (wr.requestedForId !== userId) {
      throw new ForbiddenException('You can only submit your own work requests');
    }
    if (!['PENDING', 'REWORK'].includes(wr.status)) {
      throw new BadRequestException(`Cannot submit with status: ${wr.status}`);
    }

    const updated = await this.prisma.workRequest.update({
      where: { id },
      data: {
        status: 'SEND_FOR_APPROVAL',
        doerRemarks: dto.doerRemarks,
        doerAttachmentIds: dto.attachmentIds ?? [],
        submittedAt: new Date(),
      },
    });

    await this.notificationQueue.add('create-notification', {
      tenantId,
      userId: wr.requestedById,
      type: 'APPROVAL_PENDING',
      title: '✅ Work Request Ready for Review',
      body: `"${wr.title}" has been submitted for your approval.`,
      refType: 'WORK_REQUEST',
      refId: id,
    });

    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return updated;
  }

  async approve(id: string, dto: ApproveWorkRequestDto, tenantId: string, approverId: string) {
    const wr = await this.findOne(id, tenantId);
    await this.assertCanReviewWorkRequest(wr, tenantId, approverId);

    if (wr.status !== 'SEND_FOR_APPROVAL') {
      throw new BadRequestException('Work request is not pending approval');
    }
    if (wr.requestedById !== approverId) {
      // Allow tenant owners/admins/managers to approve team work requests.
      const approver = await this.prisma.user.findUnique({ where: { id: approverId }, select: { role: true } });
      if (!isApproverRole(approver?.role)) {
        throw new ForbiddenException('Only the requester or admin can approve');
      }
    }

    const now = new Date();
    // LE-03 fix: use submission time, not approval time, to calculate delay.
    // A WR submitted on time but approved 3 days later must NOT be marked LATE.
    const submittedAt = (wr as any).submittedAt as Date | undefined;
    if (!submittedAt) {
      throw new BadRequestException(
        'Work request is missing a submission timestamp — cannot calculate delay accurately.',
      );
    }
    // Working-day/holiday-aware delay
    const calendar = await loadCompanyCalendar(this.prisma, tenantId, wr.deadlineDate, submittedAt);
    const { delayDays, onTimeStatus } = calculateDelay(wr.deadlineDate, submittedAt, calendar);

    const updated = await this.prisma.workRequest.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        approvedById: approverId,
        approvedAt: now,
        completedAt: now,  // schema field — was missing, broke reports "Completed Date" column
        finalRemarks: dto.remarks,
        onTimeStatus,
        delayDays,
      },
    });

    await this.notificationQueue.add('create-notification', {
      tenantId,
      userId: wr.requestedForId,
      type: 'TASK_APPROVED',
      title: '🎉 Work Request Approved',
      body: `Your work request "${wr.title}" has been approved.`,
      refType: 'WORK_REQUEST',
      refId: id,
    });

    this.gateway?.emitTaskUpdated(wr.requestedForId, {
      taskId: id,
      taskType: 'WORK_REQUEST',
      status: 'COMPLETED',
      updatedBy: approverId,
    });

    await this.automation.triggerEvent(tenantId, 'TASK_COMPLETED', {
      taskId: id,
      taskTitle: wr.title,
      refType: 'WORK_REQUEST',
      assigneeId: wr.requestedForId,
      delayDays,
    });

    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return updated;
  }

  async rework(id: string, dto: ReworkWorkRequestDto, tenantId: string, reviewerId: string) {
    const wr = await this.findOne(id, tenantId);
    await this.assertCanReviewWorkRequest(wr, tenantId, reviewerId);

    if (wr.status !== 'SEND_FOR_APPROVAL') {
      throw new BadRequestException('Work request is not pending approval');
    }

    const updated = await this.prisma.workRequest.update({
      where: { id },
      data: {
        status: 'REWORK',
        reworkRemark: dto.reworkRemark,
        reworkCount: { increment: 1 },
        submittedAt: null,
        approvedAt: null,
        completedAt: null,  // BUG-12 fix: clear completedAt so reports don't count this as done
      },
      });

    await this.notificationQueue.add('create-notification', {
      tenantId,
      userId: wr.requestedForId,
      type: 'REWORK_REQUESTED',
      title: '🔄 Work Request Rework Required',
      body: `"${wr.title}" needs rework: ${dto.reworkRemark}`,
      refType: 'WORK_REQUEST',
      refId: id,
    });

    this.gateway?.emitTaskUpdated(wr.requestedForId, {
      taskId: id,
      taskType: 'WORK_REQUEST',
      status: 'REWORK',
      updatedBy: reviewerId,
    });

    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    await this.redis.delByPattern(CachePatterns.mis(tenantId));
    return updated;
  }

  async getPendingApprovalCount(tenantId: string, userId: string): Promise<number> {
    return this.prisma.workRequest.count({
      where: {
        tenantId,
        requestedById: userId,
        status: 'SEND_FOR_APPROVAL',
      },
    });
  }

  async exportAll(tenantId: string) {
    const requests = await this.prisma.workRequest.findMany({
      where: { tenantId },
      select: {
        requestFor: { select: { email: true } },
        project: { select: { name: true } },
        title: true,
        description: true,
        deadlineDate: true,
        deadlineTime: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    return requests.map((r) => ({
      RequestFor: r.requestFor?.email ?? '',
      Project: r.project?.name ?? '',
      Title: r.title ?? '',
      Description: r.description,
      DeadlineDate: r.deadlineDate ? new Date(r.deadlineDate).toISOString().split('T')[0] : '',
      DeadlineTime: r.deadlineTime ?? '',
    }));
  }

  async importBulk(rows: any[], tenantId: string, importedById: string) {
    const emails = [...new Set(rows.map((r) => (r.RequestFor ?? '').toString().trim().toLowerCase()).filter(Boolean))];
    const projectNames = [...new Set(rows.map((r) => (r.Project ?? '').toString().trim()).filter(Boolean))];

    const [users, projects] = await Promise.all([
      this.prisma.user.findMany({ where: { tenantId, email: { in: emails }, status: 'ACTIVE' }, select: { id: true, email: true } }),
      projectNames.length
        ? this.prisma.project.findMany({ where: { tenantId, name: { in: projectNames } }, select: { id: true, name: true } })
        : Promise.resolve([] as { id: string; name: string }[]),
    ]);

    const userMap = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
    const projectMap = new Map(projects.map((p) => [p.name.toLowerCase(), p.id]));

    let created = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const email = (row.RequestFor ?? '').toString().trim().toLowerCase();
      const title = (row.Title ?? '').toString().trim();
      const description = (row.Description ?? '').toString().trim();
      const deadlineDate = (row.DeadlineDate ?? '').toString().trim();

      if (!email || !title) {
        errors.push('Row skipped: RequestFor and Title are required');
        continue;
      }

      const userId = userMap.get(email);
      if (!userId) { errors.push(`User not found: ${row.RequestFor}`); continue; }

      const projectName = (row.Project ?? '').toString().trim();
      const projectId = projectName ? projectMap.get(projectName.toLowerCase()) : undefined;
      if (projectName && !projectId) { errors.push(`Project not found: ${projectName}`); continue; }

      try {
        const { atomicNextWorkRequestId, generateWorkRequestId } = await import('../../common/utils/id-generator.utils');
        const seq = await atomicNextWorkRequestId(this.prisma, tenantId);
        const requestId = generateWorkRequestId(seq);

        await this.prisma.workRequest.create({
          data: {
            tenantId,
            requestId,
            title,
            description: description || title,
            requestedById: importedById,
            requestedForId: userId,
            projectId: projectId ?? undefined,
            deadlineDate: deadlineDate ? new Date(deadlineDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            deadlineTime: row.DeadlineTime?.toString().trim() || undefined,
            status: 'PENDING' as any,
          },
        });
        created++;
      } catch (e) {
        errors.push(`Row error: ${(e as Error).message}`);
      }
    }

    return { created, errors };
  }

  private async assertCanViewWorkRequest(wr: any, tenantId: string, userId: string, role: string) {
    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    if (!visibleIds) return;

    const canView = wr.requestedById === userId
      || wr.requestedForId === userId
      || visibleIds.includes(wr.requestedById)
      || visibleIds.includes(wr.requestedForId);

    if (!canView) {
      throw new ForbiddenException('You do not have access to this work request');
    }
  }

  private async assertCanReviewWorkRequest(wr: any, tenantId: string, reviewerId: string) {
    const reviewer = await this.prisma.user.findFirst({
      where: { id: reviewerId, tenantId, status: 'ACTIVE' },
      select: { role: true },
    });
    if (!reviewer) throw new ForbiddenException('Reviewer not found or inactive');

    const visibleIds = await this.hierarchy.getVisibleUserIds(reviewerId, reviewer.role, tenantId);
    if (!visibleIds) return;

    const canReview = wr.requestedById === reviewerId
      || visibleIds.includes(wr.requestedById)
      || visibleIds.includes(wr.requestedForId);

    if (!canReview) {
      throw new ForbiddenException('You can only review work requests created by you or visible to your team');
    }
  }
}
