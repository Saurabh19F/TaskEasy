import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ParsedRow } from '../../interfaces/import.interfaces';
import { atomicNextFmsWorkflowId, generateFmsWorkflowId } from '../../../../common/utils/id-generator.utils';

@Injectable()
export class FmsImporter {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Groups rows by workflowName. Creates one FmsWorkflow per group,
   * each row becomes one FmsStep. dependsOnSteps is parsed from
   * comma-separated step numbers.
   */
  async importRows(
    rows: ParsedRow[],
    tenantId: string,
    uploadedById: string,
  ): Promise<{ rowId: string; recordId: string }[]> {
    const groups = new Map<string, ParsedRow[]>();
    for (const row of rows) {
      const key = String(row.normalizedData!['workflowName'] || row.rawData['workflowName']).trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const results: { rowId: string; recordId: string }[] = [];

    for (const [workflowName, groupRows] of groups) {
      const firstRow = groupRows[0];
      const fd = firstRow.normalizedData!;

      const seq = await atomicNextFmsWorkflowId(this.prisma, tenantId);
      const workflowId = generateFmsWorkflowId(seq);

      const steps = groupRows.map((row) => {
        const d = row.normalizedData!;
        const dependsRaw = String(d['dependsOnSteps'] || '').trim();
        const dependsOnStepNos = dependsRaw
          ? dependsRaw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
          : [];

        return {
          tenantId,
          stepNo: Number(d['stepNo']),
          stepName: String(d['stepName']),
          what: String(d['what']),
          how: d['how'] ? String(d['how']) : undefined,
          when: d['when'] ? String(d['when']) : undefined,
          assignedUserId: d['assignedToId'] ? String(d['assignedToId']) : undefined,
          slaHours: d['slaHours'] ? Number(d['slaHours']) : undefined,
          approvalRequired: String(d['approvalRequired'] ?? 'NO').toUpperCase() === 'YES',
          dependsOnStepNos,
        };
      });

      const workflow = await (this.prisma.fmsWorkflow as any).create({
        data: {
          tenantId,
          workflowId,
          name: workflowName,
          category: fd['category'] ? String(fd['category']) : undefined,
          description: fd['description'] ? String(fd['description']) : undefined,
          createdBy: uploadedById,
          status: 'DRAFT',
          tags: [],
          steps: { create: steps },
        },
        select: { id: true },
      });

      for (const row of groupRows) {
        results.push({ rowId: row.rowNumber.toString(), recordId: workflow.id });
      }
    }

    return results;
  }
}
