import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CacheKeys, CachePatterns } from '../../common/utils/cache-keys.utils';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ROLE_PERMISSIONS } from '../../common/constants/permissions';
import { ROLE_RANK } from '../../common/constants/roles';
import { validatePasswordStrength } from '../../common/utils/password.utils';
import { isTeamManagerRole, isTenantWideRole, normalizeCompanyRole } from '../../common/utils/role.utils';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  AdminResetPasswordDto,
  ListUsersQueryDto,
} from './dto/create-user.dto';

const BCRYPT_ROUNDS = 12;

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  gender: true,
  dateOfBirth: true,
  avatarUrl: true,
  department: true,
  designation: true,
  address: true,
  city: true,
  state: true,
  country: true,
  pinCode: true,
  joiningDate: true,
  employmentType: true,
  workMode: true,
  workLocation: true,
  employeeStatus: true,
  employeeId: true,
  tenantId: true,
  managerId: true,
  punchInTime: true,
  buddyId: true,
  officeDays: true,
  weeklyOff: true,
  buddy: { select: { id: true, name: true, email: true } },
  createdAt: true,
  lastLoginAt: true,
  twoFactorEnabled: true,
  // Never expose passwordHash
} as const;

function parseDateOnly(value?: string): Date | undefined {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
}

function normalizeOptionalString(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ── Create User ───────────────────────────────────────────────

  async create(dto: CreateUserDto, actorUser: JwtPayload) {
    const { tenantId } = actorUser;
    const employeeIdInput = normalizeOptionalString(dto.employeeId);
    const managerId = normalizeOptionalString(dto.managerId);
    const buddyId = normalizeOptionalString(dto.buddyId);
    const employeeId = employeeIdInput || await this.generateEmployeeId(tenantId);

    // Check email uniqueness within tenant
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException(`Email '${dto.email}' is already registered`);
    }

    // Check employeeId uniqueness if provided
    if (employeeIdInput) {
      const existingEmp = await this.prisma.user.findFirst({
        where: { tenantId, employeeId: employeeIdInput },
      });
      if (existingEmp) {
        throw new ConflictException(`Employee ID '${dto.employeeId}' already in use`);
      }
    }

    // Validate manager exists in same tenant
    if (managerId) {
      const manager = await this.prisma.user.findFirst({
        where: { id: managerId, tenantId },
      });
      if (!manager) throw new BadRequestException('Manager not found in this tenant');
    }

    if (buddyId) {
      const buddy = await this.prisma.user.findFirst({
        where: { id: buddyId, tenantId },
      });
      if (!buddy) throw new BadRequestException('Buddy not found in this tenant');
    }

    this.assertCanAssignRole(actorUser.role, dto.role || 'EMPLOYEE');

    validatePasswordStrength(dto.password);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Resolve default permissions for role
    const defaultPermissions = ROLE_PERMISSIONS[dto.role || 'EMPLOYEE'] || [];

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        avatarUrl: dto.avatarUrl,
        passwordHash,
        role: (dto.role || 'EMPLOYEE') as any,
        employeeId,
        gender: dto.gender,
        dateOfBirth: parseDateOnly(dto.dateOfBirth),
        department: dto.department,
        designation: dto.designation,
        joiningDate: parseDateOnly(dto.joiningDate),
        employmentType: dto.employmentType,
        workMode: dto.workMode,
        workLocation: dto.workLocation,
        employeeStatus: dto.employeeStatus,
        managerId,
        punchInTime: dto.punchInTime,
        buddyId,
        officeDays: dto.officeDays ?? ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        weeklyOff: dto.weeklyOff ?? ['SUN'],
        permissions: defaultPermissions,
        createdBy: actorUser.sub,
      } as any,
      select: USER_SELECT,
    });

    // Add to actor's hierarchy group so the new user is immediately visible in reports/lists
    if (isTeamManagerRole(normalizeCompanyRole(actorUser.role))) {
      const group = await this.prisma.hierarchy.findFirst({
        where: { tenantId, adminId: actorUser.sub },
        select: { id: true },
      });
      if (group) {
        await this.prisma.hierarchy.update({
          where: { id: group.id },
          data: { memberIds: { push: user.id } },
        });
        await this.redis.del(`hierarchy:${tenantId}:${actorUser.sub}`);
      }
    }

    await this.redis.delByPattern(CachePatterns.activeUsers(tenantId));

    this.logger.log(`User created: ${user.email} (${user.role}) in tenant ${tenantId}`);
    return user;
  }

  // ── List Users ───────────────────────────────────────────────

  async findAll(query: ListUsersQueryDto, actorUser: JwtPayload) {
    const { tenantId, role } = actorUser;
    const { page = 1, limit = 20, search, role: filterRole, status, department } = query;
    const skip = (page - 1) * limit;

    // Admins can see only hierarchy-mapped users
    // Admin sees all
    const visibleUserIds = await this.getVisibleUserIds(actorUser);

    const where: any = {
      tenantId,
      ...(visibleUserIds ? { id: { in: visibleUserIds } } : {}),
      ...(filterRole ? { role: filterRole } : {}),
      ...(status ? { status } : {}),
      ...(department ? { department: { contains: department, mode: 'insensitive' } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { employeeId: { contains: search, mode: 'insensitive' } },
              { department: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        skip,
        take: Number(limit),
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── Get Single User ──────────────────────────────────────────

  async findOne(id: string, actorUser: JwtPayload) {
    await this.assertCanAccessUser(id, actorUser);

    const user = await this.prisma.user.findFirst({
      where: { id, tenantId: actorUser.tenantId },
      select: {
        ...USER_SELECT,
        manager: { select: { id: true, name: true, email: true } },
        permissions: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  // ── Update User ───────────────────────────────────────────────

  async update(id: string, dto: UpdateUserDto, actorUser: JwtPayload) {
    await this.assertUserExists(id, actorUser.tenantId);
    await this.assertCanAccessUser(id, actorUser);
    this.assertCanManageUser(id, actorUser);

    const managerId = normalizeOptionalString(dto.managerId);
    const buddyId = normalizeOptionalString(dto.buddyId);
    const avatarUrl = normalizeOptionalString(dto.avatarUrl);
    const employeeIdInput = normalizeOptionalString(dto.employeeId);

    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: {
          tenantId: actorUser.tenantId,
          email: dto.email.toLowerCase(),
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException(`Email '${dto.email}' is already registered`);
      }
    }

    if (employeeIdInput) {
      const existingEmp = await this.prisma.user.findFirst({
        where: {
          tenantId: actorUser.tenantId,
          employeeId: employeeIdInput,
          NOT: { id },
        },
      });
      if (existingEmp) {
        throw new ConflictException(`Employee ID '${dto.employeeId}' already in use`);
      }
    }

    if (managerId) {
      const manager = await this.prisma.user.findFirst({
        where: { id: managerId, tenantId: actorUser.tenantId },
      });
      if (!manager) throw new BadRequestException('Manager not found');
    }

    if (buddyId) {
      if (buddyId === id) {
        throw new BadRequestException('A user cannot be their own buddy');
      }
      const buddy = await this.prisma.user.findFirst({
        where: { id: buddyId, tenantId: actorUser.tenantId },
      });
      if (!buddy) throw new BadRequestException('Buddy not found in this tenant');
    }

    const data: any = {
      ...dto,
      email: dto.email?.toLowerCase(),
      employeeId: employeeIdInput,
      managerId,
      buddyId,
      avatarUrl,
      dateOfBirth: parseDateOnly(dto.dateOfBirth),
      joiningDate: parseDateOnly(dto.joiningDate),
    };

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });

    await this.invalidateUserCache(id, actorUser.tenantId);
    return updated;
  }

  // ── Change Status ─────────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateUserStatusDto, actorUser: JwtPayload) {
    await this.assertUserExists(id, actorUser.tenantId);
    await this.assertCanAccessUser(id, actorUser);
    this.assertCanManageUser(id, actorUser);

    // Cannot deactivate yourself
    if (id === actorUser.sub && dto.status === 'INACTIVE') {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status as any },
      select: USER_SELECT,
    });

    await this.invalidateUserCache(id, actorUser.tenantId);
    return updated;
  }

  // ── Admin Reset Password ──────────────────────────────────────

  async adminResetPassword(id: string, dto: AdminResetPasswordDto, actorUser: JwtPayload) {
    await this.assertUserExists(id, actorUser.tenantId);
    await this.assertCanAccessUser(id, actorUser);
    this.assertCanManageUser(id, actorUser);

    validatePasswordStrength(dto.newPassword);
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    // Revoke all sessions for that user
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password reset successfully' };
  }

  // ── Change Role ───────────────────────────────────────────────

  async updateRole(id: string, newRole: string, actorUser: JwtPayload) {
    await this.assertUserExists(id, actorUser.tenantId);
    await this.assertCanAccessUser(id, actorUser);

    this.assertCanAssignRole(actorUser.role, newRole);

    const defaultPermissions = ROLE_PERMISSIONS[newRole] || [];

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: newRole as any, permissions: defaultPermissions },
      select: USER_SELECT,
    });

    await this.invalidateUserCache(id, actorUser.tenantId);
    return updated;
  }

  // ── Delete/Archive User ───────────────────────────────────────

  async remove(id: string, actorUser: JwtPayload) {
    await this.assertUserExists(id, actorUser.tenantId);
    await this.assertCanAccessUser(id, actorUser);

    if (id === actorUser.sub) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    // Remove this user from hierarchy group memberIds arrays (before
    // the transaction so we can read current state safely).
    const groupsWithMember = await this.prisma.hierarchy.findMany({
      where: { tenantId: actorUser.tenantId, memberIds: { has: id } },
      select: { id: true, memberIds: true },
    });

    // Collect approval IDs where this user is submitter so we can
    // cascade-delete their ApprovalLevel children.
    const userApprovals = await this.prisma.approval.findMany({
      where: { tenantId: actorUser.tenantId, submittedBy: id },
      select: { id: true },
    });
    const approvalIds = userApprovals.map((a) => a.id);

    // Find projects that include this user in memberIds
    const projectsWithMember = await this.prisma.project.findMany({
      where: { tenantId: actorUser.tenantId, memberIds: { has: id } },
      select: { id: true, memberIds: true },
    });

    // Clean up all related records before hard-deleting the user.
    // Every relation with onDelete: NoAction must be deleted or unlinked.
    await this.prisma.$transaction([
      // Auth & session data
      this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
      this.prisma.loginHistory.deleteMany({ where: { userId: id } }),
      this.prisma.notificationSetting.deleteMany({ where: { userId: id } }),
      this.prisma.notification.deleteMany({ where: { userId: id } }),

      // Delegation & work-request tasks
      this.prisma.delegationTask.deleteMany({ where: { OR: [{ delegatedById: id }, { delegatedToId: id }] } }),
      this.prisma.workRequest.deleteMany({ where: { OR: [{ requestedById: id }, { requestedForId: id }] } }),

      // Checklists
      this.prisma.checklistTask.deleteMany({ where: { assignedToId: id } }),
      this.prisma.checklistMaster.deleteMany({ where: { assignedToId: id } }),

      // FMS
      this.prisma.fmsTask.deleteMany({ where: { personId: id } }),
      this.prisma.fmsStep.updateMany({ where: { assignedUserId: id }, data: { assignedUserId: null } }),

      // Approvals — delete levels first, then parent approvals
      this.prisma.approvalLevel.deleteMany({ where: { OR: [{ approverId: id }, { delegatedTo: id }] } }),
      ...(approvalIds.length > 0
        ? [
            this.prisma.approvalLevel.deleteMany({ where: { approvalId: { in: approvalIds } } }),
            this.prisma.approval.deleteMany({ where: { id: { in: approvalIds } } }),
          ]
        : []),

      // Comments & activity
      this.prisma.comment.deleteMany({ where: { authorId: id } }),
      this.prisma.activityLog.deleteMany({ where: { actorId: id } }),

      // Audit logs
      this.prisma.auditLog.deleteMany({ where: { actorId: id } }),

      // MIS snapshots
      this.prisma.misSnapshot.deleteMany({ where: { userId: id } }),

      // Attachments
      this.prisma.attachment.deleteMany({ where: { uploadedById: id } }),

      // Forms
      this.prisma.formResponse.deleteMany({ where: { submittedBy: id } }),

      // Reports & automation
      this.prisma.reportTemplate.deleteMany({ where: { createdBy: id } }),
      this.prisma.automationRule.deleteMany({ where: { createdBy: id } }),

      // Bulk import
      this.prisma.bulkImportBatch.deleteMany({ where: { uploadedById: id } }),

      // Hierarchy: delete groups this user admins
      this.prisma.hierarchy.deleteMany({ where: { adminId: id } }),

      // Remove user from hierarchy group memberIds arrays
      ...groupsWithMember.map((group) =>
        this.prisma.hierarchy.update({
          where: { id: group.id },
          data: { memberIds: group.memberIds.filter((m) => m !== id) },
        }),
      ),

      // Remove user from project memberIds arrays & unlink as project manager
      ...projectsWithMember.map((proj) =>
        this.prisma.project.update({
          where: { id: proj.id },
          data: { memberIds: proj.memberIds.filter((m) => m !== id) },
        }),
      ),
      this.prisma.project.updateMany({ where: { managerId: id }, data: { managerId: null } }),

      // Unlink FMS workflows created/published by this user
      this.prisma.fmsWorkflow.updateMany({ where: { createdBy: id }, data: { createdBy: actorUser.sub } }),
      this.prisma.fmsWorkflow.updateMany({ where: { publishedBy: id }, data: { publishedBy: null } }),

      // Unlink other users referencing this user as manager/buddy
      this.prisma.user.updateMany({ where: { managerId: id }, data: { managerId: null } }),
      this.prisma.user.updateMany({ where: { buddyId: id }, data: { buddyId: null } }),

      // Delete the user
      this.prisma.user.delete({ where: { id } }),
    ]);

    await this.invalidateUserCache(id, actorUser.tenantId);
    return { message: 'User deleted successfully' };
  }

  // ── Get Active Users (Dropdown) ───────────────────────────────

  async exportAll(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { name: true, email: true, phone: true, role: true, gender: true, dateOfBirth: true, department: true, designation: true, joiningDate: true, employmentType: true },
      orderBy: { name: 'asc' },
    });
    return users.map((u) => ({
      Name: u.name,
      Email: u.email,
      Phone: u.phone ?? '',
      Role: u.role,
      Gender: u.gender ?? '',
      DateOfBirth: u.dateOfBirth ? new Date(u.dateOfBirth).toISOString().split('T')[0] : '',
      Department: u.department ?? '',
      Designation: u.designation ?? '',
      JoiningDate: u.joiningDate ? new Date(u.joiningDate).toISOString().split('T')[0] : '',
      EmploymentType: u.employmentType ?? '',
    }));
  }

  async getActiveUsers(actorUser: JwtPayload) {
    const cacheKey = CacheKeys.activeUsers(actorUser.tenantId, actorUser.sub, actorUser.role);
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const normalized = normalizeCompanyRole(actorUser.role);
    const seeAll = isTenantWideRole(normalized) || normalized === 'ADMIN' || normalized === 'MANAGER';
    const visibleIds = seeAll ? null : await this.getVisibleUserIds(actorUser);

    const users = await this.prisma.user.findMany({
      where: {
        tenantId: actorUser.tenantId,
        status: 'ACTIVE',
        ...(visibleIds ? { id: { in: visibleIds } } : {}),
      },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, department: true },
      orderBy: { name: 'asc' },
    });

    await this.redis.set(cacheKey, users, 1800); // 30 min
    return users;
  }

  // ── Activity Log ──────────────────────────────────────────────

  async getActivity(userId: string, actorUser: JwtPayload) {
    await this.assertUserExists(userId, actorUser.tenantId);
    await this.assertCanAccessUser(userId, actorUser);

    return this.prisma.auditLog.findMany({
      where: { tenantId: actorUser.tenantId, actorId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ── Bulk Import ───────────────────────────────────────────────

  async bulkImport(records: CreateUserDto[], actorUser: JwtPayload) {
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const record of records) {
      try {
        await this.create(record, actorUser);
        results.created++;
      } catch (err) {
        results.skipped++;
        results.errors.push(`${record.email}: ${err.message}`);
      }
    }

    return results;
  }

  // ── Private Helpers ───────────────────────────────────────────

  private async assertUserExists(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async assertCanAccessUser(targetUserId: string, actor: JwtPayload) {
    const visibleIds = await this.getVisibleUserIds(actor);
    if (visibleIds && !visibleIds.includes(targetUserId)) {
      throw new ForbiddenException('You do not have access to this user');
    }
  }

  private assertCanManageUser(targetUserId: string, actor: JwtPayload) {
    // Employees cannot manage other users
    if (['EMPLOYEE', 'VIEWER', 'CLIENT', 'VENDOR'].includes(actor.role)) {
      if (actor.sub !== targetUserId) {
        throw new ForbiddenException('Insufficient permissions to manage this user');
      }
    }
  }

  /**
   * Blocks an actor from creating or promoting a user to a role ranked above
   * (more privileged than) their own. SAAS_OWNER/COMPANY_OWNER are exempt.
   * Legacy company super-admin values normalize to ADMIN, so they no longer
   * get their own privilege tier.
   */
  private assertCanAssignRole(actorRole: string, targetRole: string) {
    const normalizedActorRole = normalizeCompanyRole(actorRole);
    const normalizedTargetRole = normalizeCompanyRole(targetRole);

    if (['SAAS_OWNER', 'COMPANY_OWNER'].includes(normalizedActorRole)) return;

    const actorRank = ROLE_RANK[normalizedActorRole] ?? Number.MAX_SAFE_INTEGER;
    const targetRank = ROLE_RANK[normalizedTargetRole] ?? Number.MAX_SAFE_INTEGER;

    if (targetRank < actorRank) {
      throw new ForbiddenException(
        `Insufficient privileges to assign role '${targetRole}'`,
      );
    }
  }

  /**
   * Returns array of user IDs visible to the actor based on hierarchy.
   * Returns null if actor can see all tenant users.
   */
  // ── Smart Assignment ──────────────────────────────────────────

  async suggestAssignee(actor: JwtPayload): Promise<any[]> {
    const { tenantId } = actor;
    const visibleIds = await this.getVisibleUserIds(actor);

    const where: any = {
      tenantId,
      status: 'ACTIVE',
      role: { in: ['EMPLOYEE', 'TEAM_LEAD', 'MANAGER'] },
    };
    if (visibleIds) where.id = { in: visibleIds };

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, designation: true, avatarUrl: true },
    });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const scored = await Promise.all(
      users.map(async (u) => {
        // Pending task count (workload)
        const [pendingCount, completedCount, reworkCount, lateCount] = await Promise.all([
          this.prisma.delegationTask.count({
            where: { tenantId, delegatedToId: u.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
          }),
          this.prisma.delegationTask.count({
            where: { tenantId, delegatedToId: u.id, status: 'COMPLETED', updatedAt: { gte: weekAgo } },
          }),
          this.prisma.delegationTask.count({
            where: { tenantId, delegatedToId: u.id, status: 'REWORK', updatedAt: { gte: weekAgo } },
          }),
          this.prisma.delegationTask.count({
            where: { tenantId, delegatedToId: u.id, onTimeStatus: 'LATE', updatedAt: { gte: weekAgo } },
          }),
        ]);

        const totalRecent = completedCount + reworkCount + lateCount;
        const onTimeRate = totalRecent > 0
          ? ((totalRecent - lateCount - reworkCount) / totalRecent) * 100
          : 100;

        // Score: higher = better candidate
        // Penalise for workload and rework; reward for on-time history
        const score =
          100
          - pendingCount * 5          // each pending task costs 5pts
          - reworkCount * 3           // each rework costs 3pts
          - lateCount * 2             // each late completion costs 2pts
          + (onTimeRate - 50) * 0.3;  // on-time bonus/penalty centred on 50%

        return {
          ...u,
          pendingCount,
          completedCount,
          reworkCount,
          lateCount,
          onTimeRate: Math.round(onTimeRate),
          score: Math.max(0, Math.round(score)),
        };
      }),
    );

    // Sort best first; cap at 10 suggestions
    return scored.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  private async getVisibleUserIds(actor: JwtPayload): Promise<string[] | null> {
    const normalizedRole = normalizeCompanyRole(actor.role);

    // ADMIN, COMPANY_OWNER, SAAS_OWNER all manage the full tenant user list
    if (isTenantWideRole(normalizedRole) || normalizedRole === 'ADMIN') return null;

    if (isTeamManagerRole(normalizedRole)) {
      const hierarchy = await this.prisma.hierarchy.findFirst({
        where: { tenantId: actor.tenantId, adminId: actor.sub },
        select: { memberIds: true },
      });
      if (!hierarchy) return null; // Manager with no hierarchy: show all rather than just self
      return [...hierarchy.memberIds, actor.sub];
    }

    // All other roles see only themselves
    return [actor.sub];
  }

  private async invalidateUserCache(userId: string, tenantId: string) {
    await Promise.all([
      this.redis.del(CacheKeys.userProfile(userId)),
      this.redis.delByPattern(CachePatterns.activeUsers(tenantId)),
      this.redis.delByPattern(CachePatterns.dashboard(tenantId)),
    ]);
  }

  async importBulk(
    rows: { Name: string; Email: string; Phone?: string; Password?: string; Role?: string; Gender?: string; DateOfBirth?: string; Department?: string; Designation?: string; JoiningDate?: string; EmploymentType?: string }[],
    actor: JwtPayload,
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    const DEFAULT_PASSWORD = 'Welcome@1234';
    const DEFAULT_GENDER   = 'PREFER_NOT_TO_SAY';
    const DEFAULT_DOB      = '2000-01-01';

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const newUserIds: string[] = [];

    for (const row of rows) {
      const email = (row.Email ?? '').toString().trim().toLowerCase();
      const name  = (row.Name  ?? '').toString().trim();

      if (!email || !name) {
        skipped++;
        errors.push(`Row skipped — missing Name or Email: ${JSON.stringify(row)}`);
        continue;
      }

      const existing = await this.prisma.user.findFirst({
        where: { tenantId: actor.tenantId, email },
      });
      if (existing) {
        skipped++;
        errors.push(`Skipped — email already exists: ${email}`);
        continue;
      }

      const rawRole  = (row.Role ?? 'EMPLOYEE').toString().trim().toUpperCase();
      const validRole = ['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(rawRole) ? rawRole : 'EMPLOYEE';

      const VALID_GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
      const VALID_EMP_TYPES = ['FULL_TIME', 'PART_TIME', 'INTERN', 'CONTRACT', 'FREELANCER', 'PROBATION'];
      const rawGender = (row.Gender ?? '').toString().trim().toUpperCase();
      const gender = VALID_GENDERS.includes(rawGender) ? rawGender : DEFAULT_GENDER;
      const rawDob = (row.DateOfBirth ?? DEFAULT_DOB).toString().trim();
      const rawJoining = (row.JoiningDate ?? '').toString().trim();
      const rawEmpType = (row.EmploymentType ?? '').toString().trim().toUpperCase();
      const employmentType = VALID_EMP_TYPES.includes(rawEmpType) ? rawEmpType : undefined;
      const passwordToUse = (row.Password ?? '').toString().trim() || DEFAULT_PASSWORD;

      try {
        const passwordHash  = await bcrypt.hash(passwordToUse, BCRYPT_ROUNDS);
        const employeeId    = await this.generateEmployeeId(actor.tenantId);
        const defaultPerms  = ROLE_PERMISSIONS[validRole] ?? ROLE_PERMISSIONS['EMPLOYEE'];

        const newUser = await this.prisma.user.create({
          data: {
            tenantId:       actor.tenantId,
            name,
            email,
            phone:          (row.Phone        ?? '').toString().trim() || undefined,
            department:     (row.Department   ?? '').toString().trim() || undefined,
            designation:    (row.Designation  ?? '').toString().trim() || undefined,
            passwordHash,
            role:           validRole as any,
            employeeId,
            gender,
            dateOfBirth:    new Date(rawDob),
            joiningDate:    rawJoining ? new Date(rawJoining) : undefined,
            employmentType: employmentType || undefined,
            status:         'ACTIVE',
            permissions:    defaultPerms,
          },
          select: { id: true },
        });
        newUserIds.push(newUser.id);
        created++;
      } catch (e) {
        skipped++;
        errors.push(`Failed to create ${email}: ${(e as Error).message}`);
      }
    }

    if (created > 0) {
      // Add new users to the actor's hierarchy group so they appear in reports/lists
      if (isTeamManagerRole(normalizeCompanyRole(actor.role))) {
        const group = await this.prisma.hierarchy.findFirst({
          where: { tenantId: actor.tenantId, adminId: actor.sub },
          select: { id: true },
        });
        if (group) {
          await this.prisma.hierarchy.update({
            where: { id: group.id },
            data: { memberIds: { push: newUserIds } },
          });
          await this.redis.del(`hierarchy:${actor.tenantId}:${actor.sub}`);
        }
      }

      await Promise.all([
        this.redis.delByPattern(CachePatterns.activeUsers(actor.tenantId)),
        this.redis.delByPattern(CachePatterns.dashboard(actor.tenantId)),
      ]);
    }

    return { created, skipped, errors };
  }

  private async generateEmployeeId(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `EMP-${year}-`;
    const existingIds = await this.prisma.user.findMany({
      where: { tenantId, employeeId: { startsWith: prefix } },
      select: { employeeId: true },
      orderBy: { employeeId: 'desc' as const },
      take: 100,
    });

    const highestSequence = existingIds.reduce((max, row) => {
      const suffix = row.employeeId?.replace(prefix, '') ?? '';
      const parsed = Number.parseInt(suffix, 10);
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, 0);

    let candidate = `${prefix}${String(highestSequence + 1).padStart(4, '0')}`;
    let attempts = 0;
    while (attempts < 20) {
      const existing = await this.prisma.user.findFirst({
        where: { tenantId, employeeId: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
      attempts += 1;
      candidate = `${prefix}${String(highestSequence + 1 + attempts).padStart(4, '0')}`;
    }

    return `EMP-${year}-${Date.now().toString().slice(-6)}`;
  }
}
