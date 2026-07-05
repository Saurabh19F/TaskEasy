import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MisService } from './mis.service';
import { MisCalculatorService } from './mis-calculator.service';
import { PredictiveService } from './predictive.service';
import { MisController } from './mis.controller';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    HierarchyModule,
    BullModule.registerQueue({ name: QUEUES.MIS }),
  ],
  providers: [MisService, MisCalculatorService, PredictiveService],
  controllers: [MisController],
  exports: [MisService, MisCalculatorService, PredictiveService],
})
export class MisModule {}
