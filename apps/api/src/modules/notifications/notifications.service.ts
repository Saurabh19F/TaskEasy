import { Injectable, Optional, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { QUEUES } from '../../queue/queue.constants';
import { IntegrationsService } from '../integrations/integrations.service';
import { NotificationsGateway, WsNotificationPayload } from './notifications.gateway';
import { NotificationType } from '@prisma/client';

export interface CreateNotificationDto {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  refId?: string;
  refType?: string;
  triggeredBy?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
    private integrations: IntegrationsService,
    @InjectQueue(QUEUES.EMAIL) private emailQueue: Queue,
    @InjectQueue(QUEUES.WHATSAPP) private whatsappQueue: Queue,
    @Optional() private gateway: NotificationsGateway,
  ) {}

  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: dto.tenantId,
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        refId: dto.refId,
        refType: dto.refType,
        triggeredBy: dto.triggeredBy,
        isRead: false,
      },
    });

    await this.redis.del(`notifications:count:${dto.tenantId}:${dto.userId}`);

    if (this.gateway) {
      const wsPayload: WsNotificationPayload = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        refId: notification.refId ?? undefined,
        refType: notification.refType ?? undefined,
        createdAt: notification.createdAt,
      };
      this.gateway.emitNotification(dto.userId, wsPayload);
    }

    await this.sendExternalChannels(notification.id, dto);
    void this.syncCalendarFromNotification(dto).catch((error) => {
      this.logger.warn(`Calendar sync skipped: ${error.message}`);
    });

    return notification;
  }

  async createMany(dtos: CreateNotificationDto[]) {
    return Promise.all(dtos.map((dto) => this.create(dto)));
  }

  async findAll(tenantId: string, userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { tenantId, userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: { tenantId, userId } }),
      this.prisma.notification.count({ where: { tenantId, userId, isRead: false } }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), unreadCount },
    };
  }

  async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    const cacheKey = `notifications:count:${tenantId}:${userId}`;
    const cached = await this.redis.get<number>(cacheKey);
    if (cached !== null) return cached;

    const count = await this.prisma.notification.count({
      where: { tenantId, userId, isRead: false },
    });
    await this.redis.set(cacheKey, count, 60);
    return count;
  }

  async markRead(id: string, tenantId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, tenantId, userId },
      data: { isRead: true, readAt: new Date() },
    });
    await this.redis.del(`notifications:count:${tenantId}:${userId}`);
    return result;
  }

  async markAllRead(tenantId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    await this.redis.del(`notifications:count:${tenantId}:${userId}`);
    return { message: 'All notifications marked as read' };
  }

  private async sendExternalChannels(notificationId: string, dto: CreateNotificationDto) {
    const [recipient, setting] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: { id: true, name: true, email: true, phone: true },
      }),
      this.prisma.notificationSetting.findUnique({
        where: {
          userId_type: {
            userId: dto.userId,
            type: dto.type,
          },
        },
        select: { email: true, whatsapp: true, muted: true },
      }),
    ]);

    if (!recipient) return;

    const defaults = { email: true, whatsapp: false, muted: false };
    const preferences = setting ?? defaults;
    if (preferences.muted) return;

    const notificationUrl = `${this.config.get<string>('FRONTEND_URL', 'http://localhost:3000')}/notifications`;
    const taskUrl = this.buildTaskUrl(dto.refType, dto.refId) ?? notificationUrl;

    if (preferences.email && recipient.email) {
      await this.emailQueue.add('send-email', {
        to: recipient.email,
        subject: dto.title,
        template: 'notification',
        tenantId: dto.tenantId,
        data: {
          recipientName: recipient.name,
          title: dto.title,
          body: dto.body,
          notificationUrl,
          taskUrl,
          refType: dto.refType,
          refId: dto.refId,
        },
      });
    }

    if (preferences.whatsapp && recipient.phone) {
      await this.whatsappQueue.add('send-whatsapp', {
        to: recipient.phone,
        template: 'notification',
        data: { recipientName: recipient.name, title: dto.title, body: dto.body, notificationUrl, taskUrl },
        notificationId,
        tenantId: dto.tenantId,
        userId: dto.userId,
      });
    }
  }

  private buildTaskUrl(refType?: string, refId?: string) {
    if (!refType || !refId) return null;

    const baseUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const map: Record<string, string> = {
      DELEGATION: `/delegation?id=${refId}`,
      WORK_REQUEST: `/work-requests?id=${refId}`,
      CHECKLIST: `/checklist?id=${refId}`,
      FMS: `/fms?id=${refId}`,
      FMS_TASK: `/fms?id=${refId}`,
    };

    const path = map[refType];
    return path ? `${baseUrl}${path}` : null;
  }

  private async syncCalendarFromNotification(dto: CreateNotificationDto) {
    if (!dto.refType || !dto.refId) return;
    const entityTypeMap: Record<string, 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS'> = {
      DELEGATION: 'DELEGATION', WORK_REQUEST: 'WORK_REQUEST', CHECKLIST: 'CHECKLIST',
      FMS: 'FMS', FMS_TASK: 'FMS',
    };
    const entityType = entityTypeMap[dto.refType];
    if (!entityType) return;
    await this.integrations.syncEntityToGoogleCalendar(dto.tenantId, entityType, dto.refId);
  }
}
