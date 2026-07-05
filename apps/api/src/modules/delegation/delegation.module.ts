import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DelegationService } from './delegation.service';
import { DelegationController } from './delegation.controller';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AutomationModule } from '../automation/automation.module';
import { QUEUES } from '../../queue/queue.constants';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    HierarchyModule,
    UploadsModule,
    AutomationModule,
    BullModule.registerQueue(
      { name: QUEUES.EMAIL },
      { name: QUEUES.NOTIFICATION },
    ),
  ],
  providers: [DelegationService],
  controllers: [DelegationController],
  exports: [DelegationService],
})
export class DelegationModule {}
