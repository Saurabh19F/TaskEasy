import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import {
  atomicNextFmsTaskId,
  atomicNextFmsWorkflowId,
  generateFmsTaskId,
  generateFmsWorkflowId,
} from '../../common/utils/id-generator.utils';

interface FmsImportRow {
  workflowName: string;
  stepTitle: string;
  stepNo: number;
  assigneeEmail: string;
  plannedDate: string;
  what?: string;
  how?: string;
  formLink?: string;
}

@Injectable()
export class FmsImportService {
  private readonly logger = new Logger(FmsImportService.name);

  constructor(
    private prisma: PrismaService,
    private hierarchy: HierarchyService,
  ) {}

  async importFromJson(
    rows: FmsImportRow[],
    tenantId: string,
    createdBy: string,
    createdByRole: string,
  ): Promise<{ created: number; errors: string[] }> {
    const errors: string[] = [];
    let created = 0;

    const visibleIds = await this.hierarchy.getVisibleUserIds(createdBy, createdByRole, tenantId);

    const byWorkflow = rows.reduce<Record<string, FmsImportRow[]>>((acc, r) => {
      (acc[r.workflowName] ??= []).push(r);
      return acc;
    }, {});

    for (const [workflowName, steps] of Object.entries(byWorkflow)) {
      try {
        const emails = [...new Set(steps.map((s) => s.assigneeEmail))];
        const users = await this.prisma.user.findMany({
          where: { email: { in: emails }, tenantId, status: 'ACTIVE' },
          select: { id: true, email: true },
        });
        const emailToId = Object.fromEntries(users.map((u) => [u.email, u.id]));

        // Find-or-create workflow (no tenantId_name unique index in schema)
        let workflow = await this.prisma.fmsWorkflow.findFirst({
          where: { tenantId, name: workflowName },
        });
        if (!workflow) {
          const workflowId = generateFmsWorkflowId(await atomicNextFmsWorkflowId(this.prisma, tenantId));
          workflow = await this.prisma.fmsWorkflow.create({
            data: { tenantId, workflowId, name: workflowName, createdBy, status: 'DRAFT' },
          });
        }

        for (const step of steps) {
          const assignedUserId = emailToId[step.assigneeEmail];
          if (!assignedUserId) {
            errors.push(`User not found: ${step.assigneeEmail}`);
            continue;
          }
          if (visibleIds && !visibleIds.includes(assignedUserId)) {
            errors.push(`Assignee outside your team visibility: ${step.assigneeEmail}`);
            continue;
          }

          const plannedDate = new Date(step.plannedDate);
          if (!step.plannedDate || isNaN(plannedDate.getTime())) {
            errors.push(`Row "${step.stepTitle}": missing or invalid plannedDate`);
            continue;
          }

          const fmsTaskId = generateFmsTaskId(await atomicNextFmsTaskId(this.prisma, tenantId));

          // Write a real FmsTask (execution record) — NOT FmsStep (the workflow
          // template/blueprint table). FmsStep has no plannedDate/status/fmsTaskId
          // and is invisible to findSteps()/completeStep()/getAnalytics(), so rows
          // imported there used to vanish into a dead table the UI never reads.
          // This mirrors the shape addStep() creates in fms.service.ts.
          await this.prisma.fmsTask.create({
            data: {
              tenantId,
              fmsTaskId,
              workflowId: workflow.id,
              fmsName: workflowName,
              personId: assignedUserId,
              stepNo: step.stepNo,
              stepName: step.stepTitle,
              what: step.what ?? '',
              how: step.how ?? null,
              formLink: step.formLink ?? null,
              plannedDate,
              status: 'PENDING',
            },
          });
          created++;
        }
      } catch (err) {
          errors.push(`Workflow "${workflowName}": ${err.message}`);
      }
    }

    this.logger.log(`FMS import: ${created} tasks created, ${errors.length} errors`);
    return { created, errors };
  }
}
