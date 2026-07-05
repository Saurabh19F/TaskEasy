import {
  Controller, Get, Post, Patch, UseGuards,
  Param, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkRequestService } from './work-request.service';
import {
  CreateWorkRequestDto,
  SubmitWorkRequestDto,
  ApproveWorkRequestDto,
  ReworkWorkRequestDto,
  WorkRequestQueryDto,
} from './dto/work-request.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Work Requests')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('work-requests')
export class WorkRequestController {
  constructor(private readonly workRequestService: WorkRequestService) {}

  @Post('import')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('task.create')
  importBulk(@Body() body: { rows: any[] }, @CurrentUser() user: JwtPayload) {
    return this.workRequestService.importBulk(body.rows ?? [], user.tenantId, user.sub);
  }

  @Get('export')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('task.read')
  exportAll(@CurrentUser() user: JwtPayload) {
    return this.workRequestService.exportAll(user.tenantId);
  }

  @Post()
  @RequirePermissions('task.create')
  create(@Body() dto: CreateWorkRequestDto, @CurrentUser() user: JwtPayload) {
    return this.workRequestService.create(dto, user.tenantId, user.sub, user.role);
  }

  @Get()
  @RequirePermissions('task.read')
  findAll(@Query() query: WorkRequestQueryDto, @CurrentUser() user: JwtPayload) {
    return this.workRequestService.findAll(user.tenantId, user.sub, user.role, query);
  }

  @Get(':id')
  @RequirePermissions('task.read')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.workRequestService.findOne(id, user.tenantId, user.sub, user.role);
  }

  @Patch(':id/submit')
  @RequirePermissions('task.submit')
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitWorkRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workRequestService.submit(id, dto, user.tenantId, user.sub);
  }

  @Patch(':id/approve')
  @RequirePermissions('task.approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveWorkRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workRequestService.approve(id, dto, user.tenantId, user.sub);
  }

  @Patch(':id/rework')
  @RequirePermissions('task.approve')
  rework(
    @Param('id') id: string,
    @Body() dto: ReworkWorkRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workRequestService.rework(id, dto, user.tenantId, user.sub);
  }
}
