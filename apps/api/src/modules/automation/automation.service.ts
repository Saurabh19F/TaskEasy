import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES } from '../../queue/queue.constants';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';

@Injectable()
export class AutomationService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(QUEUES.AUTOMATION) private automationQueue: Queue,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.automationRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException('Automation rule not found');
    return rule;
  }

  async create(dto: CreateAutomationRuleDto, tenantId: string, createdBy: string) {
    return this.prisma.automationRule.create({
      data: {
        tenantId,
        createdBy,
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger,
        conditions: (dto.conditions ?? []) as any,
        action: dto.action,
        actionConfig: (dto.actionConfig ?? {}) as any,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: Partial<CreateAutomationRuleDto>, tenantId: string) {
    await this.findOne(id, tenantId);
    // Strip any tenantId or id that might be injected in the DTO to prevent
    // cross-tenant data poisoning via the update payload.
    const { tenantId: _, id: __, ...safeFields } = dto as any;
    return this.prisma.automationRule.update({ where: { id }, data: safeFields });
  }

  async toggleActive(id: string, tenantId: string) {
    const rule = await this.findOne(id, tenantId);
    return this.prisma.automationRule.update({
      where: { id },
      data: { isActive: !rule.isActive },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.automationRule.delete({ where: { id } });
    return { message: 'Rule deleted' };
  }

  async triggerEvent(
    tenantId: string,
    trigger: string,
    context: Record<string, any>,
  ): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: { tenantId, trigger: trigger as any, isActive: true },
    });

    for (const rule of rules) {
      await this.automationQueue.add('execute-rule', {
        ruleId: rule.id,
        // Conditions are forwarded so the processor can evaluate them against
        // the trigger context before taking any action — without this the
        // processor had no access to the rule's conditions and fired every
        // active matching rule unconditionally, ignoring all user-set filters.
        conditions: (rule.conditions as any[]) ?? [],
        action: rule.action,
        actionConfig: rule.actionConfig,
        context,
        tenantId,
      });
    }
  }
}
