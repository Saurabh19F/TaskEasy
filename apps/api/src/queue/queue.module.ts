import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmailProcessor } from './processors/email.processor';
import { WhatsAppProcessor } from './processors/whatsapp.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { ChecklistProcessor } from './processors/checklist.processor';
import { EscalationProcessor } from './processors/escalation.processor';
import { MisProcessor } from './processors/mis.processor';
import { FmsProcessor } from './processors/fms.processor';
import { ReportProcessor } from './processors/report.processor';
import { AiProcessor } from './processors/ai.processor';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { MisCalculatorService } from '../modules/mis/mis-calculator.service';
import { AutomationService } from '../modules/automation/automation.service';
import { QueueSchedulerService } from './queue-scheduler.service';
import { QUEUES } from './queue.constants';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue(
      { name: QUEUES.EMAIL },
      { name: QUEUES.WHATSAPP },
      { name: QUEUES.NOTIFICATION },
      { name: QUEUES.CHECKLIST },
      { name: QUEUES.FMS },
      { name: QUEUES.ESCALATION },
      { name: QUEUES.MIS },
      { name: QUEUES.REPORT },
      { name: QUEUES.AUTOMATION },
      { name: QUEUES.AI },
    ),
  ],
  providers: [
    EmailProcessor,
    WhatsAppProcessor,
    NotificationProcessor,
    ChecklistProcessor,
    EscalationProcessor,
    MisProcessor,
    FmsProcessor,
    ReportProcessor,
    AiProcessor,
    QueueSchedulerService,
    // MisCalculatorService only depends on the (global) PrismaService, so it's
    // safe to provide it here directly rather than importing MisModule (which
    // would pull in HierarchyModule + the MIS queue registration unnecessarily
    // and risks a circular import back into QueueModule).
    MisCalculatorService,
    // AutomationService is kept here (not imported via AutomationModule) because
    // EscalationProcessor needs it and importing AutomationModule would create a
    // circular dep chain: AutomationModule → QueueModule → AutomationModule.
    // AutomationProcessor itself lives in AutomationModule to avoid the
    // "same handler twice" Bull error that occurs when two NestJS providers
    // register @Process handlers. See comment in providers above.
    AutomationService,
  ],
  exports: [BullModule],
})
export class QueueModule {}
