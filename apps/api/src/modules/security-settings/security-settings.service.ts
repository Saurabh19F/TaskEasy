import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSecuritySettingsDto } from './dto/update-security-settings.dto';

@Injectable()
export class SecuritySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    let settings = await this.prisma.securitySettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      settings = await this.prisma.securitySettings.create({
        data: { tenantId },
      });
    }

    return settings;
  }

  async update(tenantId: string, dto: UpdateSecuritySettingsDto) {
    return this.prisma.securitySettings.upsert({
      where: { tenantId },
      update: dto,
      create: { tenantId, ...dto },
    });
  }

  async isIpAllowed(tenantId: string, ip: string): Promise<boolean> {
    const settings = await this.prisma.securitySettings.findUnique({
      where: { tenantId },
      select: { ipWhitelistEnabled: true, whitelistedIps: true },
    });

    if (!settings || !settings.ipWhitelistEnabled) return true;
    if (settings.whitelistedIps.length === 0) return true;

    return settings.whitelistedIps.some((entry) => {
      if (entry.includes('/')) {
        return this.ipInCidr(ip, entry);
      }
      return ip === entry;
    });
  }

  private ipInCidr(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1) >>> 0;
    const ipNum = this.ipToNum(ip);
    const rangeNum = this.ipToNum(range);
    return (ipNum & mask) === (rangeNum & mask);
  }

  private ipToNum(ip: string): number {
    return ip
      .split('.')
      .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }
}
