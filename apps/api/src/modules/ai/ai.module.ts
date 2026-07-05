import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { QUEUES } from '../../queue/queue.constants';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.AI }), DashboardModule],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
