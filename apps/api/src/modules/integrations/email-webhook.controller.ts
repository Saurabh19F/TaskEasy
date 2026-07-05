import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES } from '../../queue/queue.constants';

/**
 * Email-to-Task inbound webhook (SendGrid / Mailgun / Postmark Inbound Parse).
 *
 * POST /webhooks/email
 *
 * Expected body (normalized — works with SendGrid Inbound Parse multipart-to-JSON):
 * {
 *   from:    "Akash Shah <akash@company.com>",
 *   to:      "tasks@yourdomain.com",
 *   subject: "Follow up payment with client XYZ by Friday",
 *   text:    "Please ensure...",
 *   html:    "<p>Please ensure...</p>",
 * }
 *
 * The controller:
 * 1. Verifies a shared secret header (X-Webhook-Secret).
 * 2. Extracts the sender's email address.
 * 3. Looks up the user by email (must be active in any tenant).
 * 4. Enqueues an AI job to parse subject + body into a task draft.
 */
@Public()
@ApiTags('webhooks')
@Controller('webhooks/email')
export class EmailWebhookController {
  private readonly logger = new Logger(EmailWebhookController.name);
  private readonly secret: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    @InjectQueue(QUEUES.AI) private aiQueue: Queue,
  ) {
    this.secret = this.config.get<string>('EMAIL_WEBHOOK_SECRET', '');
  }

  @Post()
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Body() body: any,
    @Headers('x-webhook-secret') secret: string,
  ) {
    // Verify shared secret if configured
    if (this.secret && secret !== this.secret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    // Normalize fields (SendGrid sends multipart form data keys)
    const fromRaw: string = body?.from ?? body?.From ?? '';
    const subject: string = body?.subject ?? body?.Subject ?? '';
    const text: string = body?.text ?? body?.Text ?? body?.plain ?? '';

    // Extract email from "Name <email>" format
    const emailMatch = fromRaw.match(/<(.+?)>/) ?? fromRaw.match(/^(.+)$/);
    const senderEmail = emailMatch?.[1]?.trim().toLowerCase();

    if (!senderEmail) {
      this.logger.warn('Email webhook: could not parse sender email from:', fromRaw);
      return { status: 'ignored', reason: 'no_sender' };
    }

    // Look up user by email
    const user = await this.prisma.user.findFirst({
      where: { email: senderEmail, status: 'ACTIVE' },
      select: { id: true, name: true, tenantId: true, role: true },
    });

    if (!user) {
      this.logger.warn(`Email webhook: no active user found for ${senderEmail}`);
      return { status: 'ignored', reason: 'unknown_sender' };
    }

    const taskText = `${subject}\n\n${text}`.trim().slice(0, 3000);
    this.logger.log(`Email→Task: queuing AI parse for user ${user.name} (${user.id})`);

    await this.aiQueue.add('whatsapp-to-task', {
      userId: user.id,
      tenantId: user.tenantId,
      userRole: user.role,
      from: senderEmail,
      wabaId: null,
      text: taskText,
      messageId: `email-${Date.now()}`,
      timestamp: String(Math.floor(Date.now() / 1000)),
    });

    return { status: 'queued' };
  }
}
