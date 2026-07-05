import { Controller, Get, Patch, Query, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { KanbanService } from './kanban.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Kanban')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('kanban')
export class KanbanController {
  constructor(private readonly kanbanService: KanbanService) {}

  @Get('board')
  getBoard(
    @Query('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.kanbanService.getBoard(user.tenantId, user.sub, user.role, projectId);
  }

  @Patch('tasks/:taskId/move')
  moveCard(
    @Param('taskId') taskId: string,
    @Body('status') status: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.kanbanService.moveCard(taskId, status, user.tenantId, user.sub, user.role);
  }
}
