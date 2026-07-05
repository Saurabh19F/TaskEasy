import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface LogAuditDto {
  tenantId: string;
  actorId: string;
  action: string;
  module: string;
  refId?: string;
  refType?: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(dto: LogAuditDto): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: dto.tenantId,
        actorId: dto.actorId,
        action: dto.action as any,
        module: dto.module as any,
        refId: dto.refId,
        refType: dto.refType,
        oldValue: dto.oldValue ? JSON.stringify(dto.oldValue) : undefined,
        newValue: dto.newValue ? JSON.stringify(dto.newValue) : undefined,
        description: dto.description ?? `${dto.action} on ${dto.module}`,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      },
    });
  }

  async findAll(
    tenantId: string,
    query: {
      actorId?: string;
      module?: string;
      action?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (query.actorId) where.actorId = query.actorId;
    if (query.module) where.module = query.module;
    // `action` is an enum column (CREATE/UPDATE/DELETE/...) — exact match only,
    // `contains` isn't valid against an enum filter.
    if (query.action) where.action = query.action;
    // Free-text search box on the Audit Logs page — there was previously no
    // way to search at all; the frontend sent a `search` param the backend
    // silently ignored.
    if (query.search) {
      where.description = { contains: query.search, mode: 'insensitive' };
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
