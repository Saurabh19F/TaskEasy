import { Module } from '@nestjs/common';
import { KanbanService } from './kanban.service';
import { KanbanController } from './kanban.controller';
import { HierarchyModule } from '../hierarchy/hierarchy.module';

@Module({
  imports: [HierarchyModule],
  providers: [KanbanService],
  controllers: [KanbanController],
})
export class KanbanModule {}
