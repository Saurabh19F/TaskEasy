import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { FmsService } from './fms.service';
import { FmsImportService } from './fms-import.service';
import { FmsController } from './fms.controller';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { AutomationModule } from '../automation/automation.module';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    HierarchyModule,
    AutomationModule,
    BullModule.registerQueue({ name: QUEUES.NOTIFICATION }),
  ],
  providers: [FmsService, FmsImportService],
  controllers: [FmsController],
  exports: [FmsService],
})
export class FmsModule {}
