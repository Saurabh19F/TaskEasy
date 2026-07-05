import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ParsedRow } from '../../interfaces/import.interfaces';
import { atomicNextWorkRequestId, generateWorkRequestId } from '../../../../common/utils/id-generator.utils';

@Injectable()
export class WorkRequestImporter {
  constructor(private readonly prisma: PrismaService) {}

  async importRow(row: ParsedRow, tenantId: string, uploadedById: string): Promise<string> {
    const d = row.normalizedData!;
    const seq = await atomicNextWorkRequestId(this.prisma, tenantId);
    const requestId = generateWorkRequestId(seq);

    const wr = await this.prisma.workRequest.create({
      data: {
        tenantId,
        requestId,
        title: String(d['title']),
        requestedById: uploadedById,
        requestedForId: String(d['requestedForId']),
        priority: String(d['priority']) as never,
        deadlineDate: d['deadlineDate'] ? new Date(String(d['deadlineDate'])) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        description: d['description'] ? String(d['description']) : String(d['title']),
        approvalRequired: String(d['approvalRequired'] ?? 'NO').toUpperCase() === 'YES',
        status: 'PENDING' as never,
      },
      select: { id: true },
    });

    return wr.id;
  }
}
