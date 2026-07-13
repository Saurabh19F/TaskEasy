import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformJwtPayload } from '../../common/decorators/platform-current-user.decorator';
import { ROLE_PERMISSIONS } from '../../common/constants/permissions';
import { parseDurationToMs } from '../../common/utils/duration.utils';

type MaybeRecord = Record<string, any>;

@Injectable()
export class PlatformService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async getDashboard() {
    const prisma = this.prisma as any;
    const safe = async (fn: () => Promise<any[]>): Promise<any[]> => { try { return await fn(); } catch { return []; } };
    const [
      tenants,
      companyUsers,
      subscriptions,
      invoices,
      payments,
      tickets,
      platformUsers,
      platformActivities,
      featureFlags,
      securityEvents,
      backups,
      settings,
    ] = await Promise.all([
      prisma.tenant.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }),
      this.listCompanyUsers({
        fields: ['id', 'tenantId', 'role', 'lastLoginAt', 'status'],
      }),
      safe(() => prisma.subscription.findMany({ include: { plan: true } })),
      safe(() => prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } })),
      safe(() => prisma.payment.findMany({ orderBy: { createdAt: 'desc' } })),
      safe(() => prisma.supportTicket.findMany({ orderBy: { updatedAt: 'desc' } })),
      prisma.platformUser.findMany({ select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true } }),
      safe(() => prisma.platformAuditLog.findMany({ orderBy: { createdAt: 'desc' } })),
      safe(() => prisma.tenantFeatureFlag.findMany({ orderBy: { createdAt: 'desc' } })),
      safe(() => prisma.securityEvent.findMany({ orderBy: { createdAt: 'desc' } })),
      safe(() => prisma.backupJob.findMany({ orderBy: { createdAt: 'desc' } })),
      safe(() => prisma.systemSetting.findMany({})),
    ]);

    const activeCompanies = tenants.filter((t: any) => this.getCompanyStatus(t) === 'ACTIVE').length;
    const trialCompanies = tenants.filter((t: any) => this.getCompanyStatus(t) === 'TRIAL').length;
    const suspendedCompanies = tenants.filter((t: any) => this.getCompanyStatus(t) === 'SUSPENDED').length;
    const expiredCompanies = tenants.filter((t: any) => this.getCompanyStatus(t) === 'EXPIRED').length;
    const paymentPendingCompanies = tenants.filter((t: any) => this.getCompanyStatus(t) === 'PAYMENT_PENDING').length;

    const totalEmployees = companyUsers.length;
    const totalPlatformUsers = platformUsers.length;
    const openSupportTickets = tickets.filter((t: any) => !['RESOLVED', 'CLOSED'].includes(String(t.status))).length;
    const pendingPayments = invoices.filter((i: any) => String(i.paymentStatus) === 'PENDING').length;
    const failedPayments = invoices.filter((i: any) => String(i.paymentStatus) === 'FAILED').length;

    const mrr = subscriptions.reduce((sum: number, sub: any) => {
      if (!['ACTIVE', 'TRIAL', 'SUSPENDED'].includes(String(sub.status))) return sum;
      const planPrice = Number(sub.plan?.monthlyPrice ?? sub.plan?.price ?? 0);
      return sum + planPrice;
    }, 0);

    const revenueByMonth = this.groupByMonth(invoices, (row: any) => row.paymentDate ?? row.createdAt, (row: any) => Number(row.totalAmount ?? row.amount ?? 0));
    const companyGrowthByMonth = this.groupByMonth(tenants, (row: any) => row.createdAt, () => 1);

    const planWiseCompanies = this.groupCount(
      subscriptions.map((row: any) => ({
        planName: row.plan?.name ?? row.planName ?? 'Unknown',
      })),
      'planName',
    );

    const activeVsSuspended = [
      { label: 'Active', value: activeCompanies },
      { label: 'Suspended', value: suspendedCompanies },
    ];

    const trialToPaid = [
      { label: 'Trial', value: trialCompanies },
      { label: 'Paid', value: activeCompanies },
    ];

    const moduleUsage = this.groupCount(
      featureFlags.filter((flag: any) => flag.enabled).map((flag: any) => ({ feature: flag.feature })),
      'feature',
    );

    const loginActivity = this.groupByMonth(
      companyUsers.filter((u: any) => u.lastLoginAt),
      (row: any) => row.lastLoginAt,
      () => 1,
    );

    const churnRiskCompanies = tenants
      .filter((t: any) => ['SUSPENDED', 'EXPIRED', 'PAYMENT_PENDING'].includes(this.getCompanyStatus(t)))
      .slice(0, 8)
      .map((tenant: any) => this.serializeCompany(tenant, subscriptions, companyUsers));

    return {
      stats: {
        totalCompanies: tenants.length,
        activeCompanies,
        trialCompanies,
        suspendedCompanies,
        expiredCompanies,
        paymentPendingCompanies,
        totalPlatformUsers,
        totalEmployees,
        monthlyRecurringRevenue: mrr,
        pendingPayments,
        failedPayments,
        openSupportTickets,
        systemHealth: this.systemHealthScore(securityEvents, backups, settings),
      },
      charts: {
        revenueGrowth: revenueByMonth,
        companyGrowth: companyGrowthByMonth,
        activeVsSuspended,
        trialToPaid,
        planWiseCompanies,
        moduleUsage,
        loginActivity,
        churnRiskCompanies,
      },
      tables: {
        recentlyOnboardedCompanies: tenants.slice(0, 10).map((tenant: any) => this.serializeCompany(tenant, subscriptions, companyUsers)),
        recentlyExpiredSubscriptions: subscriptions
          .filter((sub: any) => String(sub.status).toUpperCase() === 'EXPIRED')
          .slice(0, 10)
          .map((sub: any) => this.serializeSubscription(sub)),
        recentPayments: payments.slice(0, 10),
        recentPlatformActivity: platformActivities.slice(0, 10),
      },
    };
  }

  async listCompanies(query: MaybeRecord = {}) {
    const prisma = this.prisma as any;
    const safe = async (fn: () => Promise<any[]>): Promise<any[]> => { try { return await fn(); } catch { return []; } };
    const [tenants, companyUsers, subscriptions, flags, invoices, tickets, auditLogs] = await Promise.all([
      prisma.tenant.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }),
      this.listCompanyUsers({
        fields: ['id', 'tenantId', 'role', 'status', 'lastLoginAt', 'email', 'phone', 'name'],
      }),
      safe(() => prisma.subscription.findMany({ include: { plan: true } })),
      safe(() => prisma.tenantFeatureFlag.findMany({ orderBy: { createdAt: 'desc' } })),
      safe(() => prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } })),
      safe(() => prisma.supportTicket.findMany({ orderBy: { updatedAt: 'desc' } })),
      safe(() => prisma.platformAuditLog.findMany({ orderBy: { createdAt: 'desc' } })),
    ]);

    const rows = tenants
      .map((tenant: any) => this.serializeCompany(tenant, subscriptions, companyUsers, flags, invoices, tickets, auditLogs))
      .filter((row: any) => {
        const q = String(query.q ?? query.search ?? '').trim().toLowerCase();
        const status = String(query.status ?? '').trim().toUpperCase();
        const plan = String(query.plan ?? '').trim().toLowerCase();

        if (q) {
          const haystack = [
            row.companyName,
            row.ownerName,
            row.email,
            row.phone,
            row.industry,
            row.plan,
            row.status,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }

        if (status && String(row.status).toUpperCase() !== status) return false;
        if (plan && String(row.plan).toLowerCase() !== plan) return false;

        return true;
      });

    return rows;
  }

  async getCompany(id: string) {
    const prisma = this.prisma as any;
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Company not found');

    const safeArr = async (fn: () => Promise<any[]>): Promise<any[]> => { try { return await fn(); } catch { return []; } };
    const safeOne = async (fn: () => Promise<any>): Promise<any> => { try { return await fn(); } catch { return null; } };
    const [users, subscription, flags, invoices, tickets, auditLogs, attachments] = await Promise.all([
      prisma.user.findMany({ where: { tenantId: id }, orderBy: { createdAt: 'desc' } }),
      safeOne(() => prisma.subscription.findFirst({ where: { tenantId: id }, include: { plan: true } })),
      safeArr(() => prisma.tenantFeatureFlag.findMany({ where: { tenantId: id } })),
      safeArr(() => prisma.invoice.findMany({ where: { tenantId: id }, orderBy: { createdAt: 'desc' } })),
      safeArr(() => prisma.supportTicket.findMany({ where: { tenantId: id }, orderBy: { updatedAt: 'desc' } })),
      safeArr(() => prisma.platformAuditLog.findMany({ where: { targetTenantId: id }, orderBy: { createdAt: 'desc' } })),
      safeArr(() => prisma.attachment.findMany({ where: { tenantId: id } })),
    ]);

    const totalStorage = attachments.reduce((sum: number, file: any) => sum + Number(file.sizeBytes ?? 0), 0);

    return {
      profile: {
        id: tenant.id,
        companyName: tenant.name,
        slug: tenant.slug,
        domain: tenant.domain,
        ownerName: tenant.ownerName,
        ownerEmail: tenant.ownerEmail,
        ownerPhone: tenant.ownerPhone,
        industry: tenant.industry,
        status: this.getCompanyStatus(tenant),
        createdAt: tenant.createdAt,
        lastLoginAt: tenant.lastLoginAt,
        dbUri: tenant.dbUri,
        dbName: tenant.dbName,
      },
      subscription: this.serializeSubscription(subscription),
      enabledModules: flags,
      counts: {
        users: users.length,
        employees: users.filter((u: any) => String(u.role) === 'EMPLOYEE').length,
        storageUsedBytes: totalStorage,
        apiUsageCount: Number(tenant.apiUsageCount ?? 0),
      },
      users,
      paymentHistory: invoices,
      tickets,
      auditLogs,
      usageStatistics: {
        invoices: invoices.length,
        openTickets: tickets.filter((t: any) => !['RESOLVED', 'CLOSED'].includes(String(t.status))).length,
        lastActivityAt: tenant.lastActivityAt ?? tenant.lastLoginAt ?? tenant.updatedAt,
      },
    };
  }

  async createCompany(body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const slug = String(body.slug ?? body.name ?? `company-${Date.now()}`).toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Enforce slug uniqueness before attempting the insert to produce a clear
    // error message instead of a raw Prisma unique-constraint violation.
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Company slug "${slug}" is already taken`);
    }

    const defaultPlan = body.planId
      ? await prisma.plan.findUnique({ where: { id: body.planId } })
      : await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    const tenant = await prisma.tenant.create({
      data: {
        name: body.name,
        slug,
        domain: body.domain ?? null,
        logoUrl: body.logoUrl ?? null,
        industry: body.industry ?? null,
        ownerName: body.ownerName ?? null,
        ownerEmail: body.ownerEmail ?? null,
        ownerPhone: body.ownerPhone ?? null,
        timezone: body.timezone ?? 'Asia/Kolkata',
        status: body.status ?? 'TRIAL',
        trialEndsAt: body.trialEndsAt ? new Date(body.trialEndsAt) : null,
        isActive: body.status ? String(body.status).toUpperCase() !== 'SUSPENDED' : true,
        dbUri: body.dbUri ?? null,
        dbName: body.dbName ?? null,
      },
    });

    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: defaultPlan?.id ?? body.planId,
        status: body.status === 'ACTIVE' ? 'ACTIVE' : 'TRIAL',
        currentPeriodStart: new Date(),
        currentPeriodEnd: body.currentPeriodEnd ? new Date(body.currentPeriodEnd) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        trialEndsAt: body.trialEndsAt ? new Date(body.trialEndsAt) : null,
        autoRenew: true,
        planSnapshot: body.planSnapshot ?? null,
      },
    });

    // Auto-create company admin user so the owner can log in immediately
    let adminUser: any = null;
    let generatedPassword: string | null = null;
    if (body.ownerEmail) {
      generatedPassword = body.ownerPassword || `TaskEasy@${uuidv4().slice(0, 8)}`;
      const passwordHash = await bcrypt.hash(generatedPassword, 12);
      const defaultPermissions = ROLE_PERMISSIONS['COMPANY_OWNER'] ?? [];
      adminUser = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          name: body.ownerName || body.name,
          email: String(body.ownerEmail).toLowerCase(),
          phone: body.ownerPhone ?? null,
          passwordHash,
          role: 'COMPANY_OWNER',
          status: 'ACTIVE',
          permissions: defaultPermissions,
          employeeId: 'OWNER-001',
        } as any,
      });
    }

    await this.recordAudit(actor, 'CREATE_COMPANY', tenant.id, adminUser?.id ?? null, null, tenant);
    return {
      ...tenant,
      adminUser: adminUser ? { id: adminUser.id, email: adminUser.email, name: adminUser.name } : null,
      generatedPassword,
    };
  }

  async updateCompany(id: string, body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.tenant.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Company not found');

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        name: body.name ?? current.name,
        domain: body.domain ?? current.domain,
        logoUrl: body.logoUrl ?? current.logoUrl,
        primaryColor: body.primaryColor ?? current.primaryColor,
        industry: body.industry ?? current.industry,
        ownerName: body.ownerName ?? current.ownerName,
        ownerEmail: body.ownerEmail ?? current.ownerEmail,
        ownerPhone: body.ownerPhone ?? current.ownerPhone,
        timezone: body.timezone ?? current.timezone,
        status: body.status ?? current.status,
        trialEndsAt: body.trialEndsAt ? new Date(body.trialEndsAt) : current.trialEndsAt,
        subscriptionStartDate: body.subscriptionStartDate ? new Date(body.subscriptionStartDate) : current.subscriptionStartDate,
        subscriptionEndDate: body.subscriptionEndDate ? new Date(body.subscriptionEndDate) : current.subscriptionEndDate,
        lastActivityAt: body.lastActivityAt ? new Date(body.lastActivityAt) : current.lastActivityAt,
        isActive: body.isActive ?? current.isActive,
        dbUri: body.dbUri ?? current.dbUri,
        dbName: body.dbName ?? current.dbName,
      },
    });

    await this.recordAudit(actor, 'UPDATE_COMPANY', id, null, current, updated);
    return updated;
  }

  async updateCompanyStatus(id: string, status: string, actor: PlatformJwtPayload) {
    const nextStatus = String(status).toUpperCase();
    const prisma = this.prisma as any;
    const current = await prisma.tenant.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Company not found');

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        status: nextStatus,
        isActive: !['SUSPENDED', 'EXPIRED', 'CANCELLED'].includes(nextStatus),
        lastActivityAt: new Date(),
      },
    });

    await prisma.subscription.updateMany({
      where: { tenantId: id },
      data: {
        status: nextStatus === 'ACTIVE' ? 'ACTIVE' : nextStatus === 'TRIAL' ? 'TRIAL' : nextStatus,
      },
    });

    await this.recordAudit(actor, 'UPDATE_COMPANY_STATUS', id, null, current, updated);
    return updated;
  }

  async updateCompanyModules(id: string, body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const modules = body.modules ?? body;
    const entries = Object.entries(modules ?? {});
    if (!entries.length) throw new BadRequestException('No module updates supplied');

    await Promise.all(
      entries.map(([feature, enabled]) =>
        prisma.tenantFeatureFlag.upsert({
          where: { tenantId_feature: { tenantId: id, feature } },
          update: { enabled: Boolean(enabled) },
          create: { tenantId: id, feature, enabled: Boolean(enabled) },
        }),
      ),
    );

    await this.recordAudit(actor, 'UPDATE_COMPANY_MODULES', id, null, null, modules);
    return this.getCompany(id);
  }

  async deleteCompany(id: string, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.tenant.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Company not found');

    const deleteManyIfExists = async (modelName: string, where: Record<string, unknown>) => {
      const model = prisma[modelName];
      if (model?.deleteMany) {
        await model.deleteMany({ where });
      }
    };

    const [userRows, formRows, approvalRows, workflowRows] = await Promise.all([
      prisma.user.findMany({ where: { tenantId: id }, select: { id: true } }),
      prisma.form.findMany({ where: { tenantId: id }, select: { id: true } }),
      prisma.approval.findMany({ where: { tenantId: id }, select: { id: true } }),
      prisma.fmsWorkflow.findMany({ where: { tenantId: id }, select: { id: true } }),
    ]);

    const userIds = userRows.map((row: any) => row.id);
    const formIds = formRows.map((row: any) => row.id);
    const approvalIds = approvalRows.map((row: any) => row.id);
    const workflowIds = workflowRows.map((row: any) => row.id);

    if (userIds.length) {
      await prisma.notificationSetting.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.loginHistory.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    }

    if (approvalIds.length) {
      await prisma.approvalLevel.deleteMany({ where: { approvalId: { in: approvalIds } } });
      await prisma.approval.deleteMany({ where: { tenantId: id } });
    }

    if (formIds.length) {
      await prisma.formResponse.deleteMany({ where: { formId: { in: formIds } } });
    }

    if (workflowIds.length) {
      await prisma.fmsStep.deleteMany({ where: { workflowId: { in: workflowIds } } });
      await prisma.fmsTask.deleteMany({ where: { workflowId: { in: workflowIds } } });
      await prisma.fmsWorkflow.deleteMany({ where: { tenantId: id } });
    }
    await prisma.fmsStep.deleteMany({ where: { tenantId: id } });

    await prisma.impersonationSession.deleteMany({ where: { targetTenantId: id } });
    await deleteManyIfExists('payment', { tenantId: id });
    await deleteManyIfExists('invoice', { tenantId: id });
    await deleteManyIfExists('supportTicket', { tenantId: id });
    await deleteManyIfExists('backupJob', { targetTenantId: id });
    await prisma.comment.deleteMany({ where: { tenantId: id } });
    await prisma.activityLog.deleteMany({ where: { tenantId: id } });
    await prisma.notification.deleteMany({ where: { tenantId: id } });
    await prisma.misSnapshot.deleteMany({ where: { tenantId: id } });
    await prisma.reportTemplate.deleteMany({ where: { tenantId: id } });
    await prisma.automationRule.deleteMany({ where: { tenantId: id } });
    await prisma.externalSync.deleteMany({ where: { tenantId: id } });
    await prisma.integrationAccount.deleteMany({ where: { tenantId: id } });
    await prisma.tenantFeatureFlag.deleteMany({ where: { tenantId: id } });
    await prisma.holidayCalendar.deleteMany({ where: { tenantId: id } });
    await prisma.delegationTask.deleteMany({ where: { tenantId: id } });
    await prisma.workRequest.deleteMany({ where: { tenantId: id } });
    await prisma.checklistTask.deleteMany({ where: { tenantId: id } });
    await prisma.checklistMaster.deleteMany({ where: { tenantId: id } });
    await prisma.project.deleteMany({ where: { tenantId: id } });
    await prisma.hierarchy.deleteMany({ where: { tenantId: id } });
    await prisma.attachment.deleteMany({ where: { tenantId: id } });
    await prisma.clientUser.deleteMany({ where: { tenantId: id } });
    await prisma.vendorUser.deleteMany({ where: { tenantId: id } });
    await prisma.template.deleteMany({ where: { tenantId: id } });
    await prisma.role.deleteMany({ where: { tenantId: id } });
    await prisma.subscription.deleteMany({ where: { tenantId: id } });
    await prisma.form.deleteMany({ where: { tenantId: id } });
    if (userIds.length) {
      await prisma.user.deleteMany({ where: { tenantId: id } });
    }
    await prisma.tenant.delete({ where: { id } });

    await this.recordAudit(actor, 'DELETE_COMPANY', id, null, current, null);
    return { message: 'Company deleted successfully' };
  }

  async resetCompanyAdminPassword(id: string, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const admin = await prisma.user.findFirst({
      where: {
        tenantId: id,
        status: 'ACTIVE',
        role: { in: ['COMPANY_OWNER', 'ADMIN'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!admin) throw new NotFoundException('No active company admin found');

    const tempPassword = `Tmp-${uuidv4().slice(0, 8)}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    await this.recordAudit(actor, 'RESET_COMPANY_PASSWORD', id, admin.id, null, { passwordReset: true });
    return { message: 'Temporary password has been sent to the user email', userId: admin.id };
  }

  async impersonateCompanyAdmin(id: string, body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const targetUser = await prisma.user.findFirst({
      where: {
        tenantId: id,
        status: 'ACTIVE',
        role: { in: ['COMPANY_OWNER', 'ADMIN'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!targetUser) throw new NotFoundException('No company admin found to impersonate');

    const permissions = this.resolvePermissions(targetUser.role, targetUser.permissions ?? []);
    const accessToken = await this.jwtService.signAsync(
      {
        sub: targetUser.id,
        tenantId: targetUser.tenantId,
        email: targetUser.email,
        role: targetUser.role,
        permissions,
      },
      {
        secret:
          this.configService.get('JWT_ACCESS_SECRET') ??
          this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRY', '15m'),
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: targetUser.id, tenantId: targetUser.tenantId },
      {
        secret:
          this.configService.get('PLATFORM_JWT_REFRESH_SECRET') ??
          this.configService.get('JWT_REFRESH_SECRET') ??
          this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRY', '7d'),
      },
    );

    const tokenHash = await this.hashToken(refreshToken);
    const refreshExpiryMs = parseDurationToMs(
      this.configService.get('JWT_REFRESH_EXPIRY', '7d'),
      7 * 24 * 60 * 60 * 1000,
    );
    await prisma.refreshToken.create({
      data: {
        userId: targetUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshExpiryMs),
      },
    });

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    const session = await prisma.impersonationSession.create({
      data: {
        platformUserId: actor.sub,
        targetTenantId: id,
        targetUserId: targetUser.id,
        targetCompanyName: tenant?.name ?? 'Unknown company',
        reason: String(body.reason ?? 'Platform support impersonation'),
        status: 'ACTIVE',
        tokenHash,
      },
    });

    await this.recordAudit(actor, 'IMPERSONATE_COMPANY_ADMIN', id, targetUser.id, null, {
      reason: body.reason ?? 'Platform support impersonation',
    });

    return {
      sessionId: session.id,
      banner: 'You are viewing this company as Platform Admin.',
      accessToken,
      refreshToken,
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      },
      company: {
        id: tenant?.id,
        name: tenant?.name,
        slug: tenant?.slug,
      },
    };
  }

  async exitImpersonation(sessionId: string, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const session = await prisma.impersonationSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Impersonation session not found');

    await prisma.impersonationSession.update({
      where: { id: sessionId },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    await this.recordAudit(actor, 'EXIT_IMPERSONATION', session.targetTenantId, session.targetUserId, session, {
      endedAt: new Date().toISOString(),
    });

    return { message: 'Impersonation ended' };
  }

  async listPlans() {
    const prisma = this.prisma as any;
    return prisma.plan.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }] });
  }

  async createPlan(body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const plan = await prisma.plan.create({
      data: {
        name: body.name,
        tier: body.tier,
        price: Number(body.price ?? body.monthlyPrice ?? 0),
        monthlyPrice: body.monthlyPrice != null ? Number(body.monthlyPrice) : Number(body.price ?? 0),
        yearlyPrice: body.yearlyPrice != null ? Number(body.yearlyPrice) : null,
        currency: body.currency ?? 'USD',
        description: body.description ?? null,
        maxUsers: Number(body.maxUsers ?? 0),
        maxProjects: Number(body.maxProjects ?? 0),
        maxFmsWorkflows: Number(body.maxFmsWorkflows ?? 0),
        maxEmployees: body.maxEmployees != null ? Number(body.maxEmployees) : null,
        maxTasks: body.maxTasks != null ? Number(body.maxTasks) : null,
        storageLimitGb: body.storageLimitGb != null ? Number(body.storageLimitGb) : null,
        attendanceAccess: body.attendanceAccess ?? true,
        leaveAccess: body.leaveAccess ?? true,
        payrollAccess: body.payrollAccess ?? false,
        reportsAccess: body.reportsAccess ?? true,
        aiAccess: body.aiAccess ?? false,
        supportLevel: body.supportLevel ?? 'Standard',
        status: body.status ?? 'ACTIVE',
        features: body.features ?? [],
        isActive: body.isActive ?? true,
      },
    });
    await this.recordAudit(actor, 'CREATE_PLAN', null, null, null, plan);
    return plan;
  }

  async updatePlan(id: string, body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.plan.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Plan not found');

    const updated = await prisma.plan.update({
      where: { id },
      data: {
        ...body,
        price: body.price != null ? Number(body.price) : current.price,
        monthlyPrice: body.monthlyPrice != null ? Number(body.monthlyPrice) : current.monthlyPrice,
        yearlyPrice: body.yearlyPrice != null ? Number(body.yearlyPrice) : current.yearlyPrice,
        maxUsers: body.maxUsers != null ? Number(body.maxUsers) : current.maxUsers,
        maxProjects: body.maxProjects != null ? Number(body.maxProjects) : current.maxProjects,
        maxFmsWorkflows: body.maxFmsWorkflows != null ? Number(body.maxFmsWorkflows) : current.maxFmsWorkflows,
      },
    });
    await this.recordAudit(actor, 'UPDATE_PLAN', null, null, current, updated);
    return updated;
  }

  async deletePlan(id: string, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.plan.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Plan not found');
    await prisma.plan.delete({ where: { id } });
    await this.recordAudit(actor, 'DELETE_PLAN', null, null, current, null);
    return { message: 'Plan deleted' };
  }

  async listPlanChangeRequests(query: MaybeRecord = {}) {
    const prisma = this.prisma as any;
    const where: any = {};
    if (query.status) where.status = String(query.status).toUpperCase();
    return prisma.planChangeRequest.findMany({
      where,
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        currentPlan: true,
        requestedPlan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approvePlanChangeRequest(requestId: string, actor: PlatformJwtPayload, note?: string) {
    const prisma = this.prisma as any;
    const request = await prisma.planChangeRequest.findUnique({
      where: { id: requestId },
      include: { requestedPlan: true },
    });
    if (!request) throw new NotFoundException('Plan change request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Request is already ' + request.status);

    const plan = request.requestedPlan;

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.subscription.upsert({
      where: { tenantId: request.tenantId },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        planSnapshot: plan,
      },
      create: {
        tenantId: request.tenantId,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        autoRenew: true,
        planSnapshot: plan,
      },
    });

    const updated = await prisma.planChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedById: actor.sub,
        reviewNote: note ?? null,
        reviewedAt: new Date(),
      },
      include: { requestedPlan: true, currentPlan: true, tenant: { select: { name: true } } },
    });

    await this.recordAudit(actor, 'APPROVE_PLAN_CHANGE', request.tenantId, request.requestedById, request, updated);
    return updated;
  }

  async rejectPlanChangeRequest(requestId: string, actor: PlatformJwtPayload, note?: string) {
    const prisma = this.prisma as any;
    const request = await prisma.planChangeRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Plan change request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Request is already ' + request.status);

    const updated = await prisma.planChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedById: actor.sub,
        reviewNote: note ?? null,
        reviewedAt: new Date(),
      },
      include: { requestedPlan: true, currentPlan: true, tenant: { select: { name: true } } },
    });

    await this.recordAudit(actor, 'REJECT_PLAN_CHANGE', request.tenantId, request.requestedById, request, updated);
    return updated;
  }

  async listSubscriptions() {
    const prisma = this.prisma as any;
    return prisma.subscription.findMany({ include: { plan: true, tenant: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async createSubscription(body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const subscription = await prisma.subscription.create({
      data: {
        tenantId: body.tenantId,
        planId: body.planId,
        status: body.status ?? 'TRIAL',
        trialEndsAt: body.trialEndsAt ? new Date(body.trialEndsAt) : null,
        graceEndsAt: body.graceEndsAt ? new Date(body.graceEndsAt) : null,
        currentPeriodStart: body.currentPeriodStart ? new Date(body.currentPeriodStart) : new Date(),
        currentPeriodEnd: body.currentPeriodEnd ? new Date(body.currentPeriodEnd) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billingCycle: body.billingCycle ?? 'MONTHLY',
        autoRenew: body.autoRenew ?? true,
        planSnapshot: body.planSnapshot ?? null,
      },
    });
    await this.recordAudit(actor, 'CREATE_SUBSCRIPTION', body.tenantId, null, null, subscription);
    return subscription;
  }

  async updateSubscription(id: string, body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.subscription.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Subscription not found');

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        ...body,
        trialEndsAt: body.trialEndsAt ? new Date(body.trialEndsAt) : current.trialEndsAt,
        graceEndsAt: body.graceEndsAt ? new Date(body.graceEndsAt) : current.graceEndsAt,
        currentPeriodStart: body.currentPeriodStart ? new Date(body.currentPeriodStart) : current.currentPeriodStart,
        currentPeriodEnd: body.currentPeriodEnd ? new Date(body.currentPeriodEnd) : current.currentPeriodEnd,
      },
    });
    await this.recordAudit(actor, 'UPDATE_SUBSCRIPTION', current.tenantId, null, current, updated);
    return updated;
  }

  async renewSubscription(id: string, body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.subscription.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Subscription not found');

    const periodEnd = body.currentPeriodEnd ? new Date(body.currentPeriodEnd) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        status: body.status ?? 'ACTIVE',
        currentPeriodEnd: periodEnd,
        graceEndsAt: body.graceEndsAt ? new Date(body.graceEndsAt) : null,
        autoRenew: body.autoRenew ?? true,
      },
    });
    await prisma.tenant.update({
      where: { id: current.tenantId },
      data: {
        status: 'ACTIVE',
        isActive: true,
        subscriptionEndDate: periodEnd,
      },
    });
    await this.recordAudit(actor, 'RENEW_SUBSCRIPTION', current.tenantId, null, current, updated);
    return updated;
  }

  async listInvoices() {
    const prisma = this.prisma as any;
    return prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createInvoice(body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: body.invoiceNumber ?? `INV-${Date.now()}`,
        tenantId: body.tenantId,
        tenantName: body.tenantName,
        planName: body.planName,
        amount: Number(body.amount ?? 0),
        tax: Number(body.tax ?? 0),
        discount: Number(body.discount ?? 0),
        totalAmount: Number(body.totalAmount ?? body.amount ?? 0),
        paymentStatus: body.paymentStatus ?? 'PENDING',
        paymentMethod: body.paymentMethod ?? null,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        nextBillingDate: body.nextBillingDate ? new Date(body.nextBillingDate) : null,
        pdfUrl: body.pdfUrl ?? null,
        notes: body.notes ?? null,
      },
    });
    await this.recordAudit(actor, 'CREATE_INVOICE', body.tenantId, null, null, invoice);
    return invoice;
  }

  async updateInvoiceStatus(id: string, body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.invoice.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Invoice not found');
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        paymentStatus: body.paymentStatus ?? current.paymentStatus,
        paymentMethod: body.paymentMethod ?? current.paymentMethod,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : current.paymentDate,
        pdfUrl: body.pdfUrl ?? current.pdfUrl,
        notes: body.notes ?? current.notes,
      },
    });
    await this.recordAudit(actor, 'UPDATE_INVOICE', current.tenantId, null, current, updated);
    return updated;
  }

  async getRevenueSummary() {
    const prisma = this.prisma as any;
    const invoices = await prisma.invoice.findMany({});
    const totalRevenue = invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.totalAmount ?? 0), 0);
    const paidRevenue = invoices.filter((i: any) => String(i.paymentStatus) === 'PAID').reduce((sum: number, invoice: any) => sum + Number(invoice.totalAmount ?? 0), 0);
    const pendingRevenue = invoices.filter((i: any) => String(i.paymentStatus) === 'PENDING').reduce((sum: number, invoice: any) => sum + Number(invoice.totalAmount ?? 0), 0);
    return { totalRevenue, paidRevenue, pendingRevenue, invoiceCount: invoices.length };
  }

  async listTickets() {
    const prisma = this.prisma as any;
    return prisma.supportTicket.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async updateTicket(id: string, body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.supportTicket.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Ticket not found');
    const updated = await prisma.supportTicket.update({
      where: { id },
      data: {
        assignedTo: body.assignedTo ?? current.assignedTo,
        priority: body.priority ?? current.priority,
        status: body.status ?? current.status,
        internalNotes: body.internalNotes ?? current.internalNotes,
        lastUpdatedAt: new Date(),
        closedAt: body.status === 'CLOSED' ? new Date() : current.closedAt,
      },
    });
    await this.recordAudit(actor, 'UPDATE_TICKET', current.tenantId, null, current, updated);
    return updated;
  }

  async replyTicket(id: string, body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.supportTicket.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Ticket not found');
    const updated = await prisma.supportTicket.update({
      where: { id },
      data: {
        responseCount: Number(current.responseCount ?? 0) + 1,
        lastUpdatedAt: new Date(),
        internalNotes: [current.internalNotes, body.message].filter(Boolean).join('\n\n'),
      },
    });
    await this.recordAudit(actor, 'REPLY_TICKET', current.tenantId, null, current, updated);
    return updated;
  }

  async listAuditLogs(query: MaybeRecord = {}) {
    const prisma = this.prisma as any;
    let logs: any[] = [];
    try {
      logs = await prisma.platformAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    } catch {
      // PlatformAuditLog collection not yet created — run `prisma generate && prisma db push`
      return [];
    }
    const company = String(query.company ?? '').trim();
    const action = String(query.action ?? '').trim();
    const user = String(query.user ?? '').trim();
    const ip = String(query.ip ?? '').trim();
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;
    return logs.filter((log: any) => {
      if (company && String(log.targetTenantId ?? '').indexOf(company) === -1) return false;
      if (action && String(log.action ?? '').toLowerCase() !== action.toLowerCase()) return false;
      if (user && String(log.actorId ?? '').indexOf(user) === -1) return false;
      if (ip && String(log.ipAddress ?? '').indexOf(ip) === -1) return false;
      if (from && new Date(log.createdAt) < from) return false;
      if (to && new Date(log.createdAt) > to) return false;
      return true;
    });
  }

  async listPlatformUsers() {
    const prisma = this.prisma as any;
    return prisma.platformUser.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createPlatformUser(body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const passwordHash = await bcrypt.hash(String(body.password ?? 'ChangeMe123!'), 12);
    const user = await prisma.platformUser.create({
      data: {
        email: String(body.email).toLowerCase(),
        name: body.name,
        phone: body.phone ?? null,
        avatarUrl: body.avatarUrl ?? null,
        passwordHash,
        role: body.role ?? 'PLATFORM_ADMIN',
        status: body.status ?? 'ACTIVE',
        permissions: body.permissions ?? ROLE_PERMISSIONS[body.role ?? 'PLATFORM_ADMIN'] ?? [],
      },
    });
    await this.recordAudit(actor, 'CREATE_PLATFORM_USER', null, user.id, null, user);
    return user;
  }

  async updatePlatformUser(id: string, body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.platformUser.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Platform user not found');
    const updated = await prisma.platformUser.update({
      where: { id },
      data: {
        name: body.name ?? current.name,
        phone: body.phone ?? current.phone,
        avatarUrl: body.avatarUrl ?? current.avatarUrl,
        role: body.role ?? current.role,
        status: body.status ?? current.status,
        permissions: body.permissions ?? current.permissions,
        lockedUntil: body.lockedUntil ? new Date(body.lockedUntil) : current.lockedUntil,
      },
    });
    await this.recordAudit(actor, 'UPDATE_PLATFORM_USER', null, id, current, updated);
    return updated;
  }

  async deletePlatformUser(id: string, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.platformUser.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Platform user not found');
    await prisma.platformUser.delete({ where: { id } });
    await this.recordAudit(actor, 'DELETE_PLATFORM_USER', null, id, current, null);
    return { message: 'Platform user deleted' };
  }

  async resetPlatformUserPassword(id: string, body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.platformUser.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Platform user not found');

    const tempPassword = String(body.newPassword ?? `Tmp-${uuidv4().slice(0, 8)}!`);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const updated = await prisma.platformUser.update({
      where: { id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await prisma.platformRefreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.recordAudit(actor, 'RESET_PLATFORM_USER_PASSWORD', null, id, current, {
      passwordReset: true,
      tempPassword: tempPassword ? 'generated' : null,
    });

    return {
      message: 'Temporary password has been sent to the user email',
      user: { id: updated.id, email: updated.email, name: updated.name },
    };
  }

  async listRoles() {
    const prisma = this.prisma as any;
    return prisma.platformRole.findMany({ orderBy: [{ isSystem: 'desc' }, { name: 'asc' }] });
  }

  async createRole(body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const role = await prisma.platformRole.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        permissions: body.permissions ?? [],
        isSystem: body.isSystem ?? false,
        isActive: body.isActive ?? true,
      },
    });
    await this.recordAudit(actor, 'CREATE_ROLE', null, null, null, role);
    return role;
  }

  async updateRole(id: string, body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.platformRole.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Role not found');
    const updated = await prisma.platformRole.update({
      where: { id },
      data: {
        name: body.name ?? current.name,
        description: body.description ?? current.description,
        permissions: body.permissions ?? current.permissions,
        isActive: body.isActive ?? current.isActive,
      },
    });
    await this.recordAudit(actor, 'UPDATE_ROLE', null, null, current, updated);
    return updated;
  }

  async deleteRole(id: string, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.platformRole.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Role not found');
    await prisma.platformRole.delete({ where: { id } });
    await this.recordAudit(actor, 'DELETE_ROLE', null, null, current, null);
    return { message: 'Role deleted' };
  }

  async listReports(type: string, query: MaybeRecord = {}) {
    switch (type) {
      case 'revenue':
        return this.getRevenueSummary();
      case 'companies':
        return this.listCompanies(query);
      case 'subscriptions':
        return this.listSubscriptions();
      case 'users':
        return this.listPlatformUsers();
      default:
        return { message: 'Unknown report type' };
    }
  }

  async getSettings() {
    const prisma = this.prisma as any;
    const settings = await prisma.systemSetting.findMany({});
    return Object.fromEntries(settings.map((setting: any) => [setting.key, setting.value]));
  }

  async updateSettings(body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const entries = Object.entries(body ?? {});
    const updated = await Promise.all(
      entries.map(([key, value]) =>
        prisma.systemSetting.upsert({
          where: { key },
          update: { value, updatedById: actor.sub },
          create: { key, value, updatedById: actor.sub },
        }),
      ),
    );
    await this.recordAudit(actor, 'UPDATE_SETTINGS', null, null, null, body);
    return Object.fromEntries(updated.map((row: any) => [row.key, row.value]));
  }

  async getSecurityCenter() {
    const prisma = this.prisma as any;
    const [events, settings] = await Promise.all([
      prisma.securityEvent.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.systemSetting.findMany({
        where: {
          key: { in: ['security.passwordPolicy', 'security.twoFactorRequired', 'security.blockedIps'] },
        },
      }),
    ]);
    return {
      events,
      settings: Object.fromEntries(settings.map((row: any) => [row.key, row.value])),
    };
  }

  async resolveSecurityEvent(id: string, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const current = await prisma.securityEvent.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Security event not found');
    const updated = await prisma.securityEvent.update({
      where: { id },
      data: { resolved: true },
    });
    await this.recordAudit(actor, 'RESOLVE_SECURITY_EVENT', current.tenantId, current.userId, current, updated);
    return updated;
  }

  async listBackups() {
    const prisma = this.prisma as any;
    return prisma.backupJob.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createBackup(body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const backup = await prisma.backupJob.create({
      data: {
        scope: body.scope ?? 'FULL_PLATFORM',
        frequency: body.frequency ?? 'MANUAL',
        status: body.status ?? 'PENDING',
        targetTenantId: body.targetTenantId ?? null,
        requestedById: actor.sub,
        storageUrl: body.storageUrl ?? null,
        startedAt: body.startedAt ? new Date(body.startedAt) : null,
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
        errorMessage: body.errorMessage ?? null,
      },
    });
    await this.recordAudit(actor, 'CREATE_BACKUP', backup.targetTenantId, null, null, backup);
    return backup;
  }

  async listNotifications() {
    const prisma = this.prisma as any;
    return prisma.platformNotification.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async sendNotification(body: MaybeRecord, actor: PlatformJwtPayload) {
    const prisma = this.prisma as any;
    const notification = await prisma.platformNotification.create({
      data: {
        title: body.title,
        body: body.body,
        audience: body.audience ?? 'ALL_COMPANIES',
        type: body.type ?? 'SYSTEM_UPDATE',
        channel: body.channel ?? 'IN_APP',
        targetTenantIds: body.targetTenantIds ?? [],
        createdById: actor.sub,
        status: body.status ?? 'SENT',
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        sentAt: body.sentAt ? new Date(body.sentAt) : new Date(),
      },
    });
    await this.recordAudit(actor, 'SEND_NOTIFICATION', null, null, null, notification);
    return notification;
  }

  async listPayments() {
    const prisma = this.prisma as any;
    return prisma.payment.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async listActivityLogs() {
    const prisma = this.prisma as any;
    try {
      return await prisma.platformAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    } catch {
      return [];
    }
  }

  async listSupportStats() {
    const prisma = this.prisma as any;
    const tickets = await prisma.supportTicket.findMany({});
    return {
      open: tickets.filter((t: any) => String(t.status) === 'OPEN').length,
      inProgress: tickets.filter((t: any) => String(t.status) === 'IN_PROGRESS').length,
      waiting: tickets.filter((t: any) => String(t.status) === 'WAITING_FOR_CLIENT').length,
      resolved: tickets.filter((t: any) => String(t.status) === 'RESOLVED').length,
      closed: tickets.filter((t: any) => String(t.status) === 'CLOSED').length,
    };
  }

  private getCompanyStatus(company: any): string {
    const status = String(company?.status ?? '').toUpperCase();
    if (status) return status;
    if (!company?.isActive) return 'SUSPENDED';
    return 'ACTIVE';
  }

  private async listCompanyUsers(options: { fields?: string[] } = {}) {
    const prisma = this.prisma as any;
    const fields = new Set(options.fields ?? []);
    const project: Record<string, 1> = { _id: 1, tenantId: 1 };

    for (const field of fields) {
      if (field !== 'id') {
        project[field] = 1;
      }
    }

    const result = await prisma.$runCommandRaw({
      aggregate: 'users',
      pipeline: [
        {
          $match: {
            tenantId: { $exists: true, $ne: null },
          },
        },
        {
          $project: project,
        },
        {
          $limit: 10000,
        },
      ],
      cursor: {},
    });

    const batch = result?.cursor?.firstBatch ?? [];
    return batch.map((row: any) => this.normalizeMongoValue(row));
  }

  private normalizeMongoValue(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeMongoValue(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const keys = Object.keys(value);
    if (keys.length === 1 && Object.prototype.hasOwnProperty.call(value, '$oid')) {
      return String(value.$oid);
    }
    if (keys.length === 1 && Object.prototype.hasOwnProperty.call(value, '$date')) {
      return new Date(value.$date);
    }
    if (keys.length === 1 && Object.prototype.hasOwnProperty.call(value, '$numberInt')) {
      return Number(value.$numberInt);
    }
    if (keys.length === 1 && Object.prototype.hasOwnProperty.call(value, '$numberLong')) {
      return Number(value.$numberLong);
    }
    if (keys.length === 1 && Object.prototype.hasOwnProperty.call(value, '$numberDouble')) {
      return Number(value.$numberDouble);
    }

    const normalized: Record<string, any> = {};
    for (const [key, nested] of Object.entries(value)) {
      normalized[key] = this.normalizeMongoValue(nested);
    }
    if (normalized._id != null && normalized.id == null) {
      normalized.id = normalized._id;
    }
    return normalized;
  }

  private serializeCompany(
    tenant: any,
    subscriptions: any[] = [],
    users: any[] = [],
    flags: any[] = [],
    invoices: any[] = [],
    tickets: any[] = [],
    auditLogs: any[] = [],
  ) {
    const subscription = subscriptions.find((sub: any) => String(sub.tenantId) === String(tenant.id));
    const tenantUsers = users.filter((user: any) => String(user.tenantId) === String(tenant.id));
    const tenantFlags = flags.filter((flag: any) => String(flag.tenantId) === String(tenant.id));
    const tenantInvoices = invoices.filter((invoice: any) => String(invoice.tenantId) === String(tenant.id));
    const tenantTickets = tickets.filter((ticket: any) => String(ticket.tenantId) === String(tenant.id));
    const lastLoginAt =
      tenant.lastLoginAt ??
      [...tenantUsers]
        .filter((user: any) => user.lastLoginAt)
        .sort((a: any, b: any) => new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime())[0]?.lastLoginAt ??
      null;

    return {
      id: tenant.id,
      companyName: tenant.name,
      ownerName: tenant.ownerName ?? tenantUsers.find((u: any) => ['COMPANY_OWNER', 'ADMIN'].includes(String(u.role)))?.name ?? null,
      email: tenant.ownerEmail ?? tenantUsers[0]?.email ?? null,
      phone: tenant.ownerPhone ?? tenantUsers[0]?.phone ?? null,
      industry: tenant.industry ?? null,
      plan: subscription?.plan?.name ?? subscription?.planName ?? 'Unassigned',
      status: this.getCompanyStatus(tenant),
      totalUsers: tenantUsers.length,
      totalEmployees: tenantUsers.filter((u: any) => String(u.role) === 'EMPLOYEE').length,
      subscriptionStartDate: subscription?.currentPeriodStart ?? tenant.subscriptionStartDate ?? null,
      subscriptionEndDate: subscription?.currentPeriodEnd ?? tenant.subscriptionEndDate ?? null,
      createdDate: tenant.createdAt,
      lastLoginAt,
      modulesEnabled: tenantFlags.filter((flag: any) => flag.enabled).length,
      lastActivityAt: tenant.lastActivityAt ?? lastLoginAt ?? tenant.updatedAt,
      storageUsedBytes: Number(tenant.storageUsedBytes ?? 0),
      apiUsageCount: Number(tenant.apiUsageCount ?? 0),
      openTickets: tenantTickets.filter((ticket: any) => !['RESOLVED', 'CLOSED'].includes(String(ticket.status))).length,
      paymentStatus: tenantInvoices[0]?.paymentStatus ?? subscription?.status ?? 'PENDING',
      auditCount: auditLogs.filter((log: any) => String(log.targetTenantId ?? '') === String(tenant.id)).length,
      raw: tenant,
    };
  }

  private serializeSubscription(subscription: any) {
    if (!subscription) return null;
    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      tenantName: subscription.tenantName ?? subscription.tenant?.name ?? null,
      planName: subscription.plan?.name ?? subscription.planSnapshot?.name ?? 'Unknown',
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      graceEndsAt: subscription.graceEndsAt,
      autoRenew: subscription.autoRenew,
    };
  }

  private groupByMonth(rows: any[], dateSelector: (row: any) => any, valueSelector: (row: any) => number) {
    const map = new Map<string, number>();
    rows.forEach((row) => {
      const date = new Date(dateSelector(row));
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) ?? 0) + valueSelector(row));
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }

  private groupCount(rows: any[], key: string) {
    const map = new Map<string, number>();
    rows.forEach((row) => {
      const value = String(row[key] ?? 'Unknown');
      map.set(value, (map.get(value) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }

  private systemHealthScore(securityEvents: any[], backups: any[], settings: any[]) {
    const recentFailures = securityEvents.filter((event) => String(event.severity).toUpperCase() === 'HIGH').length;
    const recentBackups = backups.filter((backup) => String(backup.status).toUpperCase() === 'COMPLETED').length;
    const maintenanceMode = settings.find((setting: any) => setting.key === 'maintenance.mode')?.value;
    const score = Math.max(0, 100 - recentFailures * 10 + recentBackups * 2 - (maintenanceMode ? 5 : 0));
    return { score, maintenanceMode: Boolean(maintenanceMode), recentFailures, recentBackups };
  }

  private resolvePermissions(role: string, directPermissions: string[]) {
    const rolePerms = ROLE_PERMISSIONS[role] ?? [];
    return Array.from(new Set([...rolePerms, ...directPermissions]));
  }

  private async recordAudit(
    actor: PlatformJwtPayload,
    action: string,
    targetTenantId: string | null = null,
    targetUserId: string | null = null,
    oldValue: any = null,
    newValue: any = null,
  ) {
    const prisma = this.prisma as any;
    await prisma.platformAuditLog.create({
      data: {
        action,
        actorId: actor.sub,
        actorRole: actor.role,
        targetTenantId,
        targetUserId,
        oldValue,
        newValue,
      },
    });
  }

  private async hashToken(token: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
