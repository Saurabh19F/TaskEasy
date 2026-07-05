import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES } from '../queue.constants';

export interface SendWhatsAppJob {
  to: string;
  template: 'notification' | 'task-assigned' | 'task-approved' | 'task-rework' | 'reminder';
  data: Record<string, any>;
  notificationId?: string;
  tenantId?: string;
  userId?: string;
}

@Processor(QUEUES.WHATSAPP)
export class WhatsAppProcessor {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('send-whatsapp')
  async handleSendWhatsApp(job: Job<SendWhatsAppJob>) {
    const { to, template, data, tenantId } = job.data;
    const text = this.renderTemplate(template, data);
    const config = await this.resolveWhatsAppConfig(tenantId);

    if (!config.accessToken || !config.phoneNumberId) {
      this.logger.warn(`WhatsApp config missing, skipping message to ${to}`);
      return;
    }

    const response = await fetch(
      `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: this.normalizePhoneNumber(to),
          type: 'text',
          text: { body: text },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`WhatsApp API failed (${response.status}): ${body}`);
    }

    this.logger.log(`WhatsApp message sent: ${template} → ${to}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`WhatsApp job ${job.id} failed: ${err.message}`, err.stack);
  }

  private async resolveWhatsAppConfig(tenantId?: string) {
    const account = tenantId
      ? await this.prisma.integrationAccount.findFirst({
          where: {
            tenantId,
            provider: 'WHATSAPP',
            isEnabled: true,
          },
          orderBy: { updatedAt: 'desc' },
        })
      : null;

    const config = (account?.config ?? {}) as Record<string, any>;
    return {
      accessToken: this.pickValue(config.accessToken, this.configService.get<string>('WHATSAPP_ACCESS_TOKEN')),
      phoneNumberId: this.pickValue(config.phoneNumberId, this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID')),
      graphApiVersion: this.pickValue(config.graphApiVersion, this.configService.get<string>('WHATSAPP_GRAPH_API_VERSION', 'v20.0')),
    };
  }

  private renderTemplate(template: SendWhatsAppJob['template'], data: Record<string, any>): string {
    switch (template) {
      case 'task-assigned':
        return [
          'TaskEasy: New task assigned',
          `Task: ${data.taskTitle}`,
          `Due: ${data.dueDate ?? 'N/A'}`,
          `Priority: ${data.priority ?? 'N/A'}`,
          data.taskUrl ? `Open: ${data.taskUrl}` : '',
        ].filter(Boolean).join('\n');
      case 'task-approved':
        return [
          'TaskEasy: Task approved',
          `Task: ${data.taskTitle}`,
          data.remarks ? `Remarks: ${data.remarks}` : '',
        ].filter(Boolean).join('\n');
      case 'task-rework':
        return [
          'TaskEasy: Rework requested',
          `Task: ${data.taskTitle}`,
          `Reason: ${data.remarks ?? data.reworkRemark ?? 'Please review.'}`,
        ].filter(Boolean).join('\n');
      case 'reminder':
      case 'notification':
      default:
        return [
          data.title ? `TaskEasy: ${data.title}` : 'TaskEasy Notification',
          data.body ?? '',
          data.taskUrl ? `Open: ${data.taskUrl}` : data.notificationUrl ? `Open: ${data.notificationUrl}` : '',
        ].filter(Boolean).join('\n');
    }
  }

  private normalizePhoneNumber(phone: string): string {
    return phone.replace(/[^\d]/g, '');
  }

  private pickValue<T>(value: T | '' | null | undefined, fallback: T) {
    return value === '' || value === undefined || value === null ? fallback : value;
  }
}
