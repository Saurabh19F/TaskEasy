import { Process, Processor, InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES } from '../queue.constants';

interface Condition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
}

interface ExecuteRuleJob {
  ruleId: string;
  /** Conditions forwarded from the rule — evaluated before any action is taken. */
  conditions: Condition[];
  action: string;
  actionConfig: Record<string, any>;
  // Trigger-specific context — populated by whatever called triggerEvent().
  // Common fields: taskId, taskTitle, refType, assigneeId, delayDays.
  context: Record<string, any>;
  tenantId: string;
}

@Processor(QUEUES.AUTOMATION)
export class AutomationProcessor {
  private readonly logger = new Logger(AutomationProcessor.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue(QUEUES.NOTIFICATION) private notificationQueue: Queue,
    @InjectQueue(QUEUES.EMAIL) private emailQueue: Queue,
  ) {}

  @Process('execute-rule')
  async handleExecuteRule(job: Job<ExecuteRuleJob>) {
    const { ruleId, conditions, action, actionConfig, context, tenantId } = job.data;

    // Evaluate conditions before doing anything — ALL must pass (AND semantics).
    // Previously conditions were never checked, so every active rule with a
    // matching trigger fired regardless of what the user configured.
    if (conditions?.length) {
      const pass = this.evaluateConditions(conditions, context);
      if (!pass) {
        this.logger.debug(`Rule ${ruleId} skipped — conditions not met`);
        return;
      }
    }

    this.logger.log(`Executing automation rule ${ruleId} action: ${action}`);

    switch (action) {
      case 'NOTIFY_USER':
        if (context.assigneeId) {
          await this.notify(tenantId, context.assigneeId, actionConfig, context);
        } else {
          this.logger.warn('NOTIFY_USER automation fired with no assigneeId in context — skipped');
        }
        break;

      case 'NOTIFY_MANAGER': {
        const managerId = await this.findManagerId(tenantId, context.assigneeId);
        if (managerId) {
          await this.notify(tenantId, managerId, actionConfig, context);
        } else {
          this.logger.warn(`NOTIFY_MANAGER automation: no manager found for user ${context.assigneeId}`);
        }
        break;
      }

      case 'NOTIFY_ADMIN': {
        const admins = await this.prisma.user.findMany({
          where: { tenantId, role: { in: ['COMPANY_OWNER', 'ADMIN', 'MANAGER'] }, status: 'ACTIVE' },
          select: { id: true },
        });
        await Promise.all(admins.map((a) => this.notify(tenantId, a.id, actionConfig, context)));
        break;
      }

      case 'SEND_EMAIL': {
        const to = actionConfig?.to ?? (await this.resolveEmail(context.assigneeId));
        if (to) {
          await this.emailQueue.add('send-email', {
            to,
            subject: actionConfig?.subject ?? `Automation alert: ${context.taskTitle ?? 'Task'}`,
            template: 'sla-breach',
            data: {
              taskTitle: context.taskTitle ?? 'Untitled task',
              assigneeName: context.assigneeName ?? '',
              delayDays: context.delayDays ?? 0,
            },
          });
        } else {
          this.logger.warn('SEND_EMAIL automation fired with no resolvable recipient — skipped');
        }
        break;
      }

      // These require resolving a specific task across 4 different tables
      // (Delegation/WorkRequest/Checklist/FMS) and there's no established
      // convention yet for which one a given rule applies to — rather than
      // guess and silently do the wrong thing, these stay logged-only until
      // that's designed.
      case 'ESCALATE':
      case 'CREATE_TASK':
      case 'CHANGE_STATUS':
      case 'MARK_CRITICAL':
      case 'ASSIGN_TO':
      case 'ADD_COMMENT':
        this.logger.warn(`Automation action "${action}" is not yet implemented — rule ${job.data.ruleId} had no effect`);
        break;

      default:
        this.logger.warn(`Unknown automation action: ${action}`);
    }

    // Update execution stats — the schema tracks runCount and lastRunAt for
    // the admin UI to show "last fired" info, but nothing was writing them.
    await this.prisma.automationRule.update({
      where: { id: ruleId },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    }).catch(() => {
      // Non-fatal — rule may have been deleted between trigger and execution
    });
  }

  private async notify(
    tenantId: string,
    userId: string,
    actionConfig: Record<string, any>,
    context: Record<string, any>,
  ) {
    await this.notificationQueue.add('create-notification', {
      tenantId,
      userId,
      type: 'TASK_OVERDUE',
      title: actionConfig?.title ?? '⚙️ Automation Alert',
      body: actionConfig?.body ?? `"${context.taskTitle ?? 'A task'}" triggered an automation rule.`,
      refType: context.refType,
      refId: context.taskId,
    });
  }

  private async findManagerId(tenantId: string, userId?: string): Promise<string | null> {
    if (!userId) return null;
    const hierarchy = await this.prisma.hierarchy.findFirst({
      where: { tenantId, memberIds: { has: userId } },
      select: { adminId: true },
    });
    return hierarchy?.adminId ?? null;
  }

  private async resolveEmail(userId?: string): Promise<string | null> {
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    return user?.email ?? null;
  }

  /**
   * Evaluates a condition array against the trigger context using AND logic —
   * all conditions must pass for the rule to fire.
   *
   * Supported operators: eq, ne, gt, gte, lt, lte, in, contains.
   * Unknown operators pass through (treated as true) to avoid silently
   * blocking a rule because the UI introduced a new operator the processor
   * doesn't know yet.
   */
  private evaluateConditions(conditions: Condition[], context: Record<string, any>): boolean {
    return conditions.every((cond) => {
      const { field, operator, value } = cond;
      const actual = context[field];
      // Field not present in context → condition cannot be satisfied
      if (actual === undefined || actual === null) return false;

      switch (operator) {
        case 'eq':       return actual == value;  // loose so '3' == 3 works
        case 'ne':       return actual != value;
        case 'gt':       return Number(actual) > Number(value);
        case 'gte':      return Number(actual) >= Number(value);
        case 'lt':       return Number(actual) < Number(value);
        case 'lte':      return Number(actual) <= Number(value);
        case 'in':       return Array.isArray(value) && value.includes(actual);
        case 'contains': return String(actual).toLowerCase().includes(String(value).toLowerCase());
        default:         return true; // unknown operator — pass through
      }
    });
  }
}
