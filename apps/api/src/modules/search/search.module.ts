import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { HierarchyModule } from '../hierarchy/hierarchy.module';

@Module({
  imports: [HierarchyModule],
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
