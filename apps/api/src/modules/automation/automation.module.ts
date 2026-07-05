import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { AutomationProcessor } from '../../queue/processors/automation.processor';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    // AUTOMATION queue: consumed by AutomationProcessor.
    // NOTIFICATION + EMAIL: injected by AutomationProcessor to dispatch alerts.
    BullModule.registerQueue(
      { name: QUEUES.AUTOMATION },
      { name: QUEUES.NOTIFICATION },
      { name: QUEUES.EMAIL },
    ),
  ],
  providers: [AutomationService, AutomationProcessor],
  controllers: [AutomationController],
  exports: [AutomationService],
})
export class AutomationModule {}
