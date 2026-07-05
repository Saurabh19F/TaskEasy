import {
  Controller, Get, Post, Patch, UseGuards,
  Param, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ChecklistService } from './checklist.service';
import {
  CreateChecklistMasterDto,
  CompleteChecklistTaskDto,
  BulkCompleteChecklistDto,
  ApproveChecklistTaskDto,
  ReworkChecklistTaskDto,
  ChecklistQueryDto,
} from './dto/checklist.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Checklist')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('checklist')
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Post('import')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('task.create')
  importBulk(@Body() body: { rows: any[] }, @CurrentUser() user: JwtPayload) {
    return this.checklistService.importBulk(body.rows ?? [], user.tenantId, user.sub);
  }

  @Get('export')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('task.read')
  exportAll(@CurrentUser() user: JwtPayload) {
    return this.checklistService.exportAll(user.tenantId);
  }

  // Masters (admin)
  @Post('masters')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('task.create')
  createMaster(@Body() dto: CreateChecklistMasterDto, @CurrentUser() user: JwtPayload) {
    return this.checklistService.createMaster(dto, user.tenantId, user.sub, user.role);
  }

  @Get('masters')
  @RequirePermissions('task.read')
  findMasters(@CurrentUser() user: JwtPayload) {
    return this.checklistService.findMasters(user.tenantId, user.sub, user.role);
  }

  @Patch('masters/:id/toggle')
  @Roles('ADMIN')
  @RequirePermissions('task.create')
  toggleMaster(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.checklistService.toggleMaster(id, user.tenantId);
  }

  // Tasks
  @Get('tasks')
  @RequirePermissions('task.read')
  findTasks(@Query() query: ChecklistQueryDto, @CurrentUser() user: JwtPayload) {
    return this.checklistService.findTasks(user.tenantId, user.sub, user.role, query);
  }

  @Get('tasks/my-pending')
  @RequirePermissions('task.read')
  myPending(@CurrentUser() user: JwtPayload) {
    return this.checklistService.findMyPendingTasks(user.tenantId, user.sub);
  }

  @Patch('tasks/:id/complete')
  @RequirePermissions('checklist.complete')
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteChecklistTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.checklistService.completeTask(id, dto, user.tenantId, user.sub);
  }

  @Patch('tasks/:id/approve')
  @RequirePermissions('task.approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveChecklistTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.checklistService.approveTask(id, dto, user.tenantId, user.sub);
  }

  @Patch('tasks/:id/rework')
  @RequirePermissions('task.approve')
  rework(
    @Param('id') id: string,
    @Body() dto: ReworkChecklistTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.checklistService.reworkTask(id, dto, user.tenantId, user.sub);
  }

  @Post('tasks/bulk-complete')
  @RequirePermissions('checklist.complete')
  bulkComplete(@Body() dto: BulkCompleteChecklistDto, @CurrentUser() user: JwtPayload) {
    return this.checklistService.bulkComplete(dto, user.tenantId, user.sub);
  }
}
