import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { HierarchyModule } from '../hierarchy/hierarchy.module';

@Module({
  imports: [HierarchyModule],
  providers: [DashboardService],
  controllers: [DashboardController],
  // Needed by AiModule's chat assistant, which reuses this service's
  // already-correct hierarchy-scoped metrics instead of re-deriving them.
  exports: [DashboardService],
})
export class DashboardModule {}
