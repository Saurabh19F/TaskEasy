import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ParsedRow } from '../../interfaces/import.interfaces';
import { atomicNextDelegationId, generateDelegationId } from '../../../../common/utils/id-generator.utils';

@Injectable()
export class DelegationImporter {
  constructor(private readonly prisma: PrismaService) {}

  async importRow(row: ParsedRow, tenantId: string, uploadedById: string): Promise<string> {
    const d = row.normalizedData!;
    const seq = await atomicNextDelegationId(this.prisma, tenantId);
    const taskId = generateDelegationId(seq);

    const task = await this.prisma.delegationTask.create({
      data: {
        tenantId,
        taskId,
        title: String(d['title']),
        delegatedById: uploadedById,
        delegatedToId: String(d['delegateToId']),
        priority: String(d['priority']) as never,
        targetDate: new Date(String(d['targetDate'])),
        description: d['description'] ? String(d['description']) : undefined,
        projectId: d['projectId'] ? String(d['projectId']) : undefined,
        tags: d['tags']
          ? String(d['tags']).split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        status: 'PENDING',
      },
      select: { id: true },
    });

    return task.id;
  }
}
