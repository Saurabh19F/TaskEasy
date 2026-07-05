import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CreateHierarchyGroupDto, UpdateHierarchyGroupDto } from './dto/hierarchy.dto';
import { isTeamManagerRole, isTenantWideRole, normalizeCompanyRole } from '../../common/utils/role.utils';

const HIERARCHY_CACHE_KEY = (tenantId: string, adminId: string) =>
  `hierarchy:${tenantId}:${adminId}`;
const HIERARCHY_CACHE_TTL = 1800; // 30 min

@Injectable()
export class HierarchyService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async createGroup(dto: CreateHierarchyGroupDto, tenantId: string, createdBy: string) {
    // Validate admin user exists and belongs to tenant
    const admin = await this.prisma.user.findFirst({
      where: { id: dto.adminId, tenantId, status: 'ACTIVE' },
    });
    if (!admin) throw new BadRequestException('Admin user not found in this tenant');

    // Validate members exist in tenant
    const members = await this.prisma.user.findMany({
      where: { id: { in: dto.memberIds }, tenantId },
      select: { id: true },
    });
    if (members.length !== dto.memberIds.length) {
      throw new BadRequestException('One or more member IDs are invalid');
    }

    const group = await this.prisma.hierarchy.create({
      data: {
        tenantId,
        groupName: dto.groupName,
        adminId: dto.adminId,
        memberIds: dto.memberIds,
        description: dto.description,
        createdBy,
      },
    });

    await this.redis.del(HIERARCHY_CACHE_KEY(tenantId, dto.adminId));
    return group;
  }

  async findAll(tenantId: string) {
    return this.prisma.hierarchy.findMany({
      where: { tenantId },
      include: {
        admin: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { groupName: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const group = await this.prisma.hierarchy.findFirst({
      where: { id, tenantId },
      include: {
        admin: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (!group) throw new NotFoundException('Hierarchy group not found');
    return group;
  }

  async updateGroup(id: string, dto: UpdateHierarchyGroupDto, tenantId: string) {
    const group = await this.findOne(id, tenantId);

    if (dto.adminId && dto.adminId !== group.adminId) {
      const admin = await this.prisma.user.findFirst({
        where: { id: dto.adminId, tenantId, status: 'ACTIVE' },
      });
      if (!admin) throw new BadRequestException('Admin user not found');
    }

    const updated = await this.prisma.hierarchy.update({
      where: { id },
      data: dto,
    });

    // Invalidate both old and new admin caches
    await this.redis.del(HIERARCHY_CACHE_KEY(tenantId, group.adminId));
    if (dto.adminId) {
      await this.redis.del(HIERARCHY_CACHE_KEY(tenantId, dto.adminId));
    }
    return updated;
  }

  async removeGroup(id: string, tenantId: string) {
    const group = await this.findOne(id, tenantId);
    await this.prisma.hierarchy.delete({ where: { id } });
    await this.redis.del(HIERARCHY_CACHE_KEY(tenantId, group.adminId));
    return { message: 'Hierarchy group deleted' };
  }

  /**
   * Returns IDs of users an admin/manager can see.
   * SAAS_OWNER/COMPANY_OWNER → null (no filter, truly tenant-wide)
   * ADMIN/MANAGER with a hierarchy group → [adminId, ...memberIds]
   * ADMIN/MANAGER with no group → null (don't lock them out)
   * EMPLOYEE/others → [userId] (own data only)
   */
  async getVisibleUserIds(
    userId: string,
    role: string,
    tenantId: string,
  ): Promise<string[] | null> {
    const normalizedRole = normalizeCompanyRole(role);

    // Platform/company owners and ADMINs always see entire tenant
    if (isTenantWideRole(normalizedRole) || normalizedRole === 'ADMIN') return null;

    // MANAGER: scope to their hierarchy group when one exists
    if (isTeamManagerRole(normalizedRole)) {
      const cacheKey = HIERARCHY_CACHE_KEY(tenantId, userId);
      const cached = await this.redis.get<string[]>(cacheKey);
      if (cached) return cached;

      const group = await this.prisma.hierarchy.findFirst({
        where: { tenantId, adminId: userId },
        select: { memberIds: true },
      });

      // No hierarchy group configured → see all users in tenant
      if (!group) return null;

      const ids = [userId, ...group.memberIds];
      await this.redis.set(cacheKey, ids, HIERARCHY_CACHE_TTL);
      return ids;
    }

    // EMPLOYEE, VIEWER, etc.
    return [userId];
  }

  /**
   * Find the admin/manager for a given employee.
   * Used by escalation logic.
   */
  async getAdminForUser(userId: string, tenantId: string): Promise<string | null> {
    const group = await this.prisma.hierarchy.findFirst({
      where: { tenantId, memberIds: { has: userId } },
      select: { adminId: true },
    });
    return group?.adminId ?? null;
  }

  /**
   * Return all member IDs under an admin across all groups.
   */
  async getMemberIds(adminId: string, tenantId: string): Promise<string[]> {
    const groups = await this.prisma.hierarchy.findMany({
      where: { tenantId, adminId },
      select: { memberIds: true },
    });
    const allIds = new Set<string>();
    groups.forEach((g) => g.memberIds.forEach((id) => allIds.add(id)));
    return [...allIds];
  }
}
