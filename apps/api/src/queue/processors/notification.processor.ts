import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { QUEUES } from '../queue.constants';
import { NotificationsService, CreateNotificationDto } from '../../modules/notifications/notifications.service';

export interface CreateNotificationJob {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  refType?: string;
  refId?: string;
  triggeredBy?: string;
}

@Processor(QUEUES.NOTIFICATION)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private notificationsService: NotificationsService) {}

  @Process('create-notification')
  async handleCreateNotification(job: Job<CreateNotificationJob>) {
    const { tenantId, userId, type, title, body, refType, refId, triggeredBy } = job.data;

    await this.notificationsService.create({
      tenantId,
      userId,
      type: type as CreateNotificationDto['type'],
      title,
      body,
      refType,
      refId,
      triggeredBy,
    });

    this.logger.debug(`Notification delivered to user ${userId}: ${type}`);
  }

  @Process('bulk-notify')
  async handleBulkNotify(job: Job<{ notifications: CreateNotificationJob[] }>) {
    const { notifications } = job.data;
    await this.notificationsService.createMany(
      notifications.map((n) => ({
        tenantId: n.tenantId,
        userId: n.userId,
        type: n.type as CreateNotificationDto['type'],
        title: n.title,
        body: n.body,
        refType: n.refType,
        refId: n.refId,
        triggeredBy: n.triggeredBy,
      })),
    );
    this.logger.log(`Bulk notifications delivered: ${notifications.length}`);
  }
}
