import { PrismaService } from '../../prisma/prisma.service';
import { CompanyCalendar } from './date.utils';

/**
 * Loads a tenant's working-day calendar (timezone, working days, working
 * hours, and holidays in the relevant date range) so that delay
 * calculations can exclude weekends and holidays instead of counting raw
 * calendar days.
 *
 * Only holidays between `rangeStart` and `rangeEnd` are fetched — pass the
 * planned date and "now" (or actual completion date) for a delay
 * calculation; there is no need to load a tenant's entire holiday history.
 */
export async function loadCompanyCalendar(
  prisma: PrismaService,
  tenantId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CompanyCalendar> {
  const [tenant, holidays] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        timezone: true,
        workingDays: true,
        workingHoursStart: true,
        workingHoursEnd: true,
      },
    }),
    prisma.holidayCalendar.findMany({
      where: {
        tenantId,
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { date: true },
    }),
  ]);

  return {
    timezone: tenant?.timezone ?? 'UTC',
    workingDays: tenant?.workingDays?.length ? tenant.workingDays : [1, 2, 3, 4, 5, 6],
    workingHoursStart: tenant?.workingHoursStart ?? '09:00',
    workingHoursEnd: tenant?.workingHoursEnd ?? '18:00',
    holidays: holidays.map((h) => h.date),
  };
}
