import {
  Controller, Get, Post, Patch, UseGuards,
  Param, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsArray } from 'class-validator';
import { FmsService } from './fms.service';
import { FmsImportService } from './fms-import.service';
import {
  CreateFmsWorkflowDto,
  CreateFmsStepDto,
  CompleteFmsStepDto,
  FmsQueryDto,
  CreateAndStartWorkflowDto,
} from './dto/fms.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

class ImportFmsDto {
  @IsArray() rows: any[];
}

@ApiTags('FMS')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('fms')
export class FmsController {
  constructor(
    private readonly fmsService: FmsService,
    private readonly fmsImportService: FmsImportService,
  ) {}

  @Post('workflows')
  @Roles('ADMIN')
  @RequirePermissions('fms.create')
  createWorkflow(@Body() dto: CreateFmsWorkflowDto, @CurrentUser() user: JwtPayload) {
    return this.fmsService.createWorkflow(dto, user.tenantId, user.sub);
  }

  @Post('workflows/create-and-start')
  @Roles('ADMIN')
  @RequirePermissions('fms.create')
  createAndStart(@Body() dto: CreateAndStartWorkflowDto, @CurrentUser() user: JwtPayload) {
    return this.fmsService.createAndStart(dto, user.tenantId, user.sub, user.role);
  }

  @Get('workflows')
  @RequirePermissions('task.read')
  findWorkflows(@CurrentUser() user: JwtPayload) {
    return this.fmsService.findWorkflows(user.tenantId);
  }

  @Post('steps')
  @Roles('ADMIN')
  @RequirePermissions('fms.create')
  addStep(@Body() dto: CreateFmsStepDto, @CurrentUser() user: JwtPayload) {
    return this.fmsService.addStep(dto, user.tenantId, user.sub, user.role);
  }

  @Get('steps')
  @RequirePermissions('fms.read')
  findSteps(@Query() query: FmsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.fmsService.findSteps(user.tenantId, user.sub, user.role, query);
  }

  @Patch('steps/:id/complete')
  @RequirePermissions('fms.complete')
  completeStep(
    @Param('id') id: string,
    @Body() dto: CompleteFmsStepDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fmsService.completeStep(id, dto, user.tenantId, user.sub);
  }

  @Post('import')
  @Roles('ADMIN', 'MANAGER')
  importData(@Body() dto: ImportFmsDto, @CurrentUser() user: JwtPayload) {
    return this.fmsImportService.importFromJson(dto.rows, user.tenantId, user.sub, user.role);
  }

  @Get('analytics')
  @RequirePermissions('fms.read')
  getAnalytics(@CurrentUser() user: JwtPayload) {
    return this.fmsService.getAnalytics(user.tenantId, user.sub, user.role);
  }
}
