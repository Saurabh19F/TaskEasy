import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ParsedRow } from '../../interfaces/import.interfaces';
import {
  atomicNextChecklistMasterId,
  generateChecklistMasterId,
  atomicNextChecklistTaskId,
  generateChecklistTaskId,
} from '../../../../common/utils/id-generator.utils';

@Injectable()
export class ChecklistImporter {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Groups rows by masterTitle and creates one ChecklistMaster per group,
   * then creates ChecklistTask rows. Each task within the same master gets
   * its plannedDate offset by 1 hour per row index to satisfy the
   * @@unique([masterId, plannedDate]) constraint.
   */
  async importRows(
    rows: ParsedRow[],
    tenantId: string,
    uploadedById: string,
  ): Promise<{ rowId: string; recordId: string }[]> {
    const groups = new Map<string, ParsedRow[]>();
    for (const row of rows) {
      const key = String(row.normalizedData!['masterTitle'] || row.rawData['masterTitle']).trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const results: { rowId: string; recordId: string }[] = [];

    for (const [masterTitle, groupRows] of groups) {
      const firstRow = groupRows[0];
      const d = firstRow.normalizedData!;

      const masterSeq = await atomicNextChecklistMasterId(this.prisma, tenantId);
      const masterId = generateChecklistMasterId(masterSeq);

      const master = await (this.prisma.checklistMaster as any).create({
        data: {
          tenantId,
          masterId,
          title: masterTitle,
          assignedToId: String(d['assignedToId']),
          frequency: String(d['frequency']),
          startDate: new Date(String(d['startDate'])),
          startTime: '08:00',
          tags: [],
          createdBy: uploadedById,
        },
        select: { id: true, masterId: true },
      });

      for (let i = 0; i < groupRows.length; i++) {
        const row = groupRows[i];
        const rd = row.normalizedData!;

        const taskSeq = await atomicNextChecklistTaskId(this.prisma, tenantId);
        const taskId = generateChecklistTaskId(taskSeq);

        const baseDate = new Date(String(rd['startDate']));
        // offset by index hours to avoid @@unique([masterId, plannedDate]) collision
        baseDate.setHours(baseDate.getHours() + i);

        const task = await (this.prisma.checklistTask as any).create({
          data: {
            tenantId,
            taskId,
            masterId: master.id,
            title: String(rd['taskTitle'] || rd['title']),
            description: rd['taskDescription'] ? String(rd['taskDescription']) : undefined,
            assignedToId: String(rd['assignedToId']),
            frequency: String(rd['frequency']),
            plannedDate: baseDate,
            plannedTime: `${String(baseDate.getHours()).padStart(2, '0')}:00`,
            status: 'PENDING',
          },
          select: { id: true },
        });

        results.push({ rowId: row.rowNumber.toString(), recordId: task.id });
      }
    }

    return results;
  }
}
