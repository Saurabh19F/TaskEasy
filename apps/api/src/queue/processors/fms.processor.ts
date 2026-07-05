import { Process, Processor, InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { QUEUES } from '../queue.constants';

@Processor(QUEUES.FMS)
export class FmsProcessor {
  private readonly logger = new Logger(FmsProcessor.name);

  constructor(
    @InjectQueue(QUEUES.NOTIFICATION) private notificationQueue: Queue,
    @InjectQueue(QUEUES.EMAIL) private emailQueue: Queue,
  ) {}

  /** Triggered (by escalation.processor's SLA check) when an FMS step becomes overdue */
  @Process('escalate-step')
  async handleStepEscalation(job: Job<{
    stepId: string;
    workflowId: string;
    tenantId: string;
    assignedToId: string;
    assignedToEmail?: string;
    title: string;
    plannedDate: string;
    delayDays: number;
  }>) {
    const { stepId, workflowId, tenantId, assignedToId, assignedToEmail, title, delayDays } = job.data;
    this.logger.log(`Escalating overdue FMS step: ${title} (${delayDays}d late)`);

    await this.notificationQueue.add('create-notification', {
      tenantId,
      userId: assignedToId,
      type: 'TASK_OVERDUE',
      title: '⚠️ FMS Step Overdue',
      body: `FMS step "${title}" is ${delayDays} day(s) overdue. Please complete it.`,
      refType: 'FMS_TASK',
      refId: stepId,
    });

    if (assignedToEmail) {
      await this.emailQueue.add('send-email', {
        to: assignedToEmail,
        subject: '⚠️ FMS Step Overdue',
        template: 'sla-breach',
        data: { taskTitle: title, assigneeName: assignedToEmail, delayDays },
      });
    }

    this.logger.log(`Escalation notification queued for FMS step ${stepId} (workflow ${workflowId})`);
  }

  /** Generate new FMS steps from a workflow template */
  @Process('generate-steps')
  async handleGenerateSteps(job: Job<{
    workflowId: string;
    tenantId: string;
  }>) {
    this.logger.log(`Generating steps for workflow: ${job.data.workflowId}`);
  }
}
