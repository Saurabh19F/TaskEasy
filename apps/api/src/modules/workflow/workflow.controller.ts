import {
  Controller, Get, Post, Patch, Delete, UseGuards,
  Param, Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Workflow')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get()
  @RequirePermissions('fms.read')
  findAll(@CurrentUser() user: JwtPayload) {
    return this.workflowService.findAll(user.tenantId);
  }

  @Get(':id')
  @RequirePermissions('fms.read')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.workflowService.findOne(id, user.tenantId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('fms.create')
  create(@Body() dto: CreateWorkflowDto, @CurrentUser() user: JwtPayload) {
    return this.workflowService.create(dto, user.tenantId, user.sub);
  }

  @Patch(':id/toggle-status')
  @Roles('ADMIN')
  @RequirePermissions('fms.update')
  toggleStatus(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.workflowService.toggleStatus(id, user.tenantId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @RequirePermissions('fms.delete')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.workflowService.remove(id, user.tenantId);
  }
}
