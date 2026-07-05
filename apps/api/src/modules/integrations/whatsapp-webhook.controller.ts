import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES } from '../../queue/queue.constants';
import * as crypto from 'crypto';

/**
 * WhatsApp Cloud API inbound webhook.
 *
 * Verification (GET /webhooks/whatsapp):
 *   WhatsApp sends hub.mode, hub.challenge, hub.verify_token
 *   → respond with hub.challenge if verify_token matches WHATSAPP_VERIFY_TOKEN env var.
 *
 * Inbound messages (POST /webhooks/whatsapp):
 *   Signature verified against X-Hub-Signature-256 header.
 *   Text messages from known users are parsed and enqueued for AI draft creation.
 *   Unknown senders receive an onboarding reply (queued for whatsappQueue).
 *
 * Task draft creation is handled by the whatsapp processor which calls
 * the AI service to parse intent and creates a WorkRequest or Delegation draft
 * with status=DRAFT and draftSource=WHATSAPP.
 */
@Public()
@ApiTags('webhooks')
@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);
  private readonly verifyToken: string;
  private readonly appSecret: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    @InjectQueue(QUEUES.WHATSAPP) private whatsappQueue: Queue,
    @InjectQueue(QUEUES.AI) private aiQueue: Queue,
  ) {
    this.verifyToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN', 'taskeasy-webhook');
    this.appSecret = this.config.get<string>('WHATSAPP_APP_SECRET', '');
  }

  // ── Webhook verification (GET) ───────────────────────────────────────────────

  @Get()
  @ApiExcludeEndpoint()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') token: string,
  ): string {
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('WhatsApp webhook verified');
      return challenge;
    }
    throw new UnauthorizedException('Webhook verification failed');
  }

  // ── Inbound message handler (POST) ──────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'WhatsApp Cloud API inbound message webhook' })
  @HttpCode(HttpStatus.OK)
  async receive(
    @Body() body: any,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    // 1. Signature verification
    if (this.appSecret) {
      this.verifySignature(JSON.stringify(body), signature);
    }

    // 2. Extract messages
    const entries: any[] = body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const messages: any[] = change?.value?.messages ?? [];
        const contacts: any[] = change?.value?.contacts ?? [];

        for (const msg of messages) {
          if (msg.type !== 'text') continue; // Only handle text for now

          const from: string = msg.from; // WhatsApp number (E.164, no +)
          const text: string = msg.text?.body ?? '';
          const senderName: string = contacts[0]?.profile?.name ?? 'Unknown';
          const wabaId: string = change?.value?.metadata?.phone_number_id ?? '';

          if (!text.trim()) continue;

          // 3. Look up user by phone number
          const normalizedPhone = `+${from}`;
          const user = await this.prisma.user.findFirst({
            where: { phone: normalizedPhone, status: 'ACTIVE' },
            select: { id: true, name: true, tenantId: true, role: true },
          });

          if (!user) {
            // Onboard unknown sender with a reply
            await this.whatsappQueue.add('send-onboarding', {
              to: from,
              wabaId,
              senderName,
            });
            this.logger.warn(`WhatsApp message from unknown number: ${normalizedPhone}`);
            continue;
          }

          this.logger.log(`WhatsApp message from ${user.name} (${user.id}): "${text}"`);

          // 4. Enqueue AI parsing to create task draft
          await this.aiQueue.add('whatsapp-to-task', {
            userId: user.id,
            tenantId: user.tenantId,
            userRole: user.role,
            from,
            wabaId,
            text,
            messageId: msg.id,
            timestamp: msg.timestamp,
          });
        }
      }
    }

    // WhatsApp expects 200 OK within 20 s regardless of processing outcome
    return { status: 'ok' };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private verifySignature(payload: string, signatureHeader: string) {
    if (!signatureHeader?.startsWith('sha256=')) {
      throw new UnauthorizedException('Missing X-Hub-Signature-256 header');
    }
    const expected = `sha256=${crypto
      .createHmac('sha256', this.appSecret)
      .update(payload, 'utf8')
      .digest('hex')}`;

    const given = Buffer.from(signatureHeader, 'utf8');
    const computed = Buffer.from(expected, 'utf8');
    if (given.length !== computed.length || !crypto.timingSafeEqual(given, computed)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
