import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { IntegrationsController } from './integrations.controller';
import { GoogleCalendarWebhookController } from './google-calendar-webhook.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { EmailWebhookController } from './email-webhook.controller';
import { IntegrationsService } from './integrations.service';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.WHATSAPP }, { name: QUEUES.AI }),
  ],
  controllers: [IntegrationsController, GoogleCalendarWebhookController, WhatsappWebhookController, EmailWebhookController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
