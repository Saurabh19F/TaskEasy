import {
  Controller, Get, Post, Patch, UseGuards,
  Param, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DelegationService } from './delegation.service';
import {
  CreateDelegationTaskDto,
  CreateDelegationBulkDto,
  SubmitDelegationDto,
  ApproveDelegationDto,
  ReworkDelegationDto,
  DelegationQueryDto,
} from './dto/delegation.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Delegation')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('delegation')
export class DelegationController {
  constructor(private readonly delegationService: DelegationService) {}

  @Post('import')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('task.create')
  importBulk(@Body() body: { rows: any[] }, @CurrentUser() user: JwtPayload) {
    return this.delegationService.importBulk(body.rows ?? [], user.tenantId, user.sub);
  }

  @Get('export')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('task.read')
  exportAll(@CurrentUser() user: JwtPayload) {
    return this.delegationService.exportAll(user.tenantId);
  }

  /** Admin/Manager assigns tasks */
  @Post()
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('task.create')
  create(@Body() dto: CreateDelegationTaskDto, @CurrentUser() user: JwtPayload) {
    return this.delegationService.create(dto, user.tenantId, user.sub, user.role);
  }

  /** Admin/Manager bulk assigns tasks with shared assignees/project */
  @Post('bulk')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('task.create')
  bulkCreate(@Body() dto: CreateDelegationBulkDto, @CurrentUser() user: JwtPayload) {
    return this.delegationService.bulkCreate(dto, user.tenantId, user.sub, user.role);
  }

  /** All roles — hierarchy-filtered */
  @Get()
  @RequirePermissions('task.read')
  findAll(@Query() query: DelegationQueryDto, @CurrentUser() user: JwtPayload) {
    return this.delegationService.findAll(user.tenantId, user.sub, user.role, query);
  }

  /** Employee: my pending tasks (quick view) */
  @Get('my-pending')
  @RequirePermissions('task.read')
  findMyPending(@CurrentUser() user: JwtPayload) {
    return this.delegationService.findMyPending(user.tenantId, user.sub);
  }

  @Get(':id')
  @RequirePermissions('task.read')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.delegationService.findOne(id, user.tenantId, user.sub, user.role);
  }

  /** Employee submits completed task for approval */
  @Patch(':id/submit')
  @RequirePermissions('task.submit')
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitDelegationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.delegationService.submitForApproval(id, dto, user.tenantId, user.sub);
  }

  /** Admin approves */
  @Patch(':id/approve')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('task.approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveDelegationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.delegationService.approve(id, dto, user.tenantId, user.sub);
  }

  /** Admin sends back for rework */
  @Patch(':id/rework')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('task.approve')
  rework(
    @Param('id') id: string,
    @Body() dto: ReworkDelegationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.delegationService.rework(id, dto, user.tenantId, user.sub);
  }
}
