import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { UpdateTenantSettingsDto, AddHolidayDto, UpdateFeatureFlagDto } from './dto/update-tenant.dto';

function calculateWorkingHours(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const diff = endTotal >= startTotal ? endTotal - startTotal : endTotal + 24 * 60 - startTotal;
  return Number((diff / 60).toFixed(2));
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ── Get Tenant ────────────────────────────────────────────────

  async findOne(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        timezone: true,
        dateFormat: true,
        officeShiftName: true,
        workingWeekType: true,
        workingDays: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        weeklyOffDays: true,
        alternateSaturdayOff: true,
        saturdayPolicy: true,
        punchInStartTime: true,
        punchInEndTime: true,
        totalWorkingHours: true,
        defaultSlaHours: true,
        isActive: true,
        createdAt: true,
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            plan: { select: { name: true, tier: true, maxUsers: true, maxProjects: true } },
          },
        },
      } as any,
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  // ── Update Settings ───────────────────────────────────────────

  async updateSettings(tenantId: string, dto: UpdateTenantSettingsDto, actor: JwtPayload) {
    this.assertCompanyAdmin(actor);
    const totalWorkingHours =
      dto.totalWorkingHours ?? calculateWorkingHours(dto.workingHoursStart, dto.workingHoursEnd);

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { ...dto, totalWorkingHours } as any,
      select: {
        id: true, name: true, timezone: true, dateFormat: true,
        officeShiftName: true, workingWeekType: true,
        workingDays: true, workingHoursStart: true, workingHoursEnd: true,
        weeklyOffDays: true, alternateSaturdayOff: true, saturdayPolicy: true,
        punchInStartTime: true, punchInEndTime: true, totalWorkingHours: true,
        defaultSlaHours: true, primaryColor: true, logoUrl: true,
      } as any,
    });

    // Clear all caches for tenant (settings affect delay calculations)
    await this.redis.delByPattern(`*:${tenantId}:*`);

    return updated;
  }

  // ── Holidays ──────────────────────────────────────────────────

  async getHolidays(tenantId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    return this.prisma.holidayCalendar.findMany({
      where: { tenantId, year: currentYear },
      orderBy: { date: 'asc' },
    });
  }

  async addHoliday(tenantId: string, dto: AddHolidayDto, actor: JwtPayload) {
    this.assertCompanyAdmin(actor);
    const date = new Date(dto.date);
    return this.prisma.holidayCalendar.create({
      data: {
        tenantId,
        date,
        name: dto.name,
        year: date.getFullYear(),
      },
    });
  }

  async removeHoliday(tenantId: string, holidayId: string, actor: JwtPayload) {
    this.assertCompanyAdmin(actor);

    // Without this check, any tenant's admin could delete another
    // tenant's holiday just by guessing/enumerating its id — delete() only
    // matched on the Mongo _id, with no tenantId scoping at all.
    const holiday = await this.prisma.holidayCalendar.findFirst({
      where: { id: holidayId, tenantId },
    });
    if (!holiday) throw new NotFoundException('Holiday not found');

    await this.prisma.holidayCalendar.delete({ where: { id: holidayId } });
    return { message: 'Holiday removed' };
  }

  // ── Feature Flags ─────────────────────────────────────────────

  async getFeatureFlags(tenantId: string) {
    return this.prisma.tenantFeatureFlag.findMany({ where: { tenantId } });
  }

  async updateFeatureFlag(tenantId: string, dto: UpdateFeatureFlagDto, actor: JwtPayload) {
    this.assertCompanyAdmin(actor);
    return this.prisma.tenantFeatureFlag.upsert({
      where: { tenantId_feature: { tenantId, feature: dto.feature } },
      update: { enabled: dto.enabled },
      create: { tenantId, feature: dto.feature, enabled: dto.enabled },
    });
  }

  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    const flag = await this.prisma.tenantFeatureFlag.findUnique({
      where: { tenantId_feature: { tenantId, feature } },
    });
    return flag?.enabled ?? false;
  }

  // ── Subscription Info ─────────────────────────────────────────

  async getSubscription(tenantId: string) {
    return this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
  }

  // ── Helper ────────────────────────────────────────────────────

  private assertCompanyAdmin(actor: JwtPayload) {
    if (!['ADMIN', 'SAAS_OWNER', 'COMPANY_OWNER'].includes(actor.role)) {
      throw new ForbiddenException('Only Admin can modify tenant settings');
    }
  }
}
