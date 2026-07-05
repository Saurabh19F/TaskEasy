import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.fmsWorkflow.findMany({
      where: { tenantId },
      include: {
        steps: { orderBy: { stepNo: 'asc' } },
        _count: { select: { steps: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const workflow = await this.prisma.fmsWorkflow.findFirst({
      where: { id, tenantId },
      include: { steps: { orderBy: { stepNo: 'asc' } } },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async create(dto: CreateWorkflowDto, tenantId: string, createdBy: string) {
    const count = await this.prisma.fmsWorkflow.count({ where: { tenantId } });
    const workflowId = `WF-${String(count + 1).padStart(3, '0')}`;

    return this.prisma.fmsWorkflow.create({
      data: {
        tenantId,
        workflowId,
        name: dto.name,
        description: dto.description,
        projectId: dto.projectId,
        createdBy,
        status: 'DRAFT',
        steps: {
          create: dto.steps.map((s) => ({
            tenantId,
            stepName: s.title,
            stepNo: s.stepNo,
            assignedUserId: s.assigneeId,
            what: s.description ?? s.title,
            formLink: s.formLink,
          })),
        },
      },
      include: { steps: { orderBy: { stepNo: 'asc' } } },
    });
  }

  async toggleStatus(id: string, tenantId: string) {
    const workflow = await this.findOne(id, tenantId);
    const next = workflow.status === 'PUBLISHED' ? 'PAUSED' : 'PUBLISHED';
    return this.prisma.fmsWorkflow.update({ where: { id }, data: { status: next } });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.fmsWorkflow.delete({ where: { id } });
    return { message: 'Workflow deleted' };
  }
}
