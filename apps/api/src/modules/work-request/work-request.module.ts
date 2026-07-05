import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { WorkRequestService } from './work-request.service';
import { WorkRequestController } from './work-request.controller';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { AutomationModule } from '../automation/automation.module';
import { QUEUES } from '../../queue/queue.constants';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    HierarchyModule,
    AutomationModule,
    BullModule.registerQueue(
      { name: QUEUES.EMAIL },
      { name: QUEUES.NOTIFICATION },
    ),
  ],
  providers: [WorkRequestService],
  controllers: [WorkRequestController],
  exports: [WorkRequestService],
})
export class WorkRequestModule {}
