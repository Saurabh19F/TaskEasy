import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ChecklistService } from './checklist.service';
import { ChecklistController } from './checklist.controller';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { AutomationModule } from '../automation/automation.module';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    HierarchyModule,
    AutomationModule,
    BullModule.registerQueue(
      { name: QUEUES.CHECKLIST },
      { name: QUEUES.NOTIFICATION },
    ),
  ],
  providers: [ChecklistService],
  controllers:[ChecklistController],
  exports: [ChecklistService],
})
export class ChecklistModule {}

