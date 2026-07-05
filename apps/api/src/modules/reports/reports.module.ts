import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { MisModule } from '../mis/mis.module';

@Module({
  imports: [HierarchyModule, MisModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
