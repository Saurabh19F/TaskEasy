import { Controller, Get, Post, Query, Body, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MisService } from './mis.service';
import { PredictiveService } from './predictive.service';
import { MisQueryDto, SaveWeeklyTargetDto } from './dto/mis.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { getPeriodRange } from '../../common/utils/date.utils';
import { isApproverRole, isTenantWideRole } from '../../common/utils/role.utils';

@ApiTags('MIS')
@ApiBearerAuth()
@RequirePermissions('mis.view')
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('mis')
export class MisController {
  constructor(
    private readonly misService: MisService,
    private readonly predictiveService: PredictiveService,
  ) {}

  @Get()
  getMis(@Query() query: MisQueryDto, @CurrentUser() user: JwtPayload) {
    return this.misService.getMis(user.tenantId, user.sub, user.role, query);
  }

  @Get('detailed')
  getDetailed(
    @Query('userId')   targetUserId: string,
    @Query('category') category: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo')   dateTo: string,
    @Query('period')   period: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Resolve date range from either explicit dates or a period keyword
    let from: Date;
    let to: Date;

    if (period) {
      const range = getPeriodRange(period as any, 'UTC');
      if (range) {
        ({ from, to } = range);
      } else {
        throw new BadRequestException('Unsupported period');
      }
    } else {
      from = dateFrom ? new Date(dateFrom) : new Date(new Date().setDate(1));
      to   = dateTo   ? new Date(dateTo)   : new Date();
    }

    // Normalise category — frontend sends lowercase ('delegation', 'workRequest', …)
    const categoryMap: Record<string, any> = {
      delegation:   'DELEGATION',
      workrequest:  'WORK_REQUEST',
      work_request: 'WORK_REQUEST',
      checklist:    'CHECKLIST',
      fms:          'FMS',
    };
    const normCategory = categoryMap[category?.toLowerCase()] ?? category?.toUpperCase();

    const resolvedUserId = targetUserId ?? user.sub;
    if (resolvedUserId !== user.sub && !isApproverRole(user.role)) {
      throw new ForbiddenException('Only Admins and Managers can query other users.');
    }

    return this.misService.getDetailedData(
      user.tenantId,
      user.sub,
      user.role,
      resolvedUserId,
      normCategory,
      from,
      to,
    );
  }

  @Get('history')
  getHistory(@Query('userId') userId: string, @CurrentUser() user: JwtPayload) {
    const resolvedHistoryUserId = userId ?? user.sub;
    if (resolvedHistoryUserId !== user.sub && !isApproverRole(user.role)) {
      throw new ForbiddenException('Only Admins and Managers can query other users.');
    }

    return this.misService.getMisHistory(user.tenantId, user.sub, user.role, resolvedHistoryUserId);
  }

  @Post('weekly-target')
  @Roles('ADMIN')
  saveWeeklyTarget(@Body() dto: SaveWeeklyTargetDto, @CurrentUser() user: JwtPayload) {
    return this.misService.saveWeeklyTarget(dto, user.tenantId);
  }

  @Get('kra-master')
  @ApiOperation({ summary: 'List active KRA / checklist masters visible to the current user' })
  getKraMaster(
    @Query('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.misService.getKraMaster(user.tenantId, user.sub, user.role, projectId);
  }

  @Post('snapshot')
  @Roles('ADMIN', 'MANAGER', 'COMPANY_OWNER')
  @ApiOperation({ summary: 'Save a weekly MIS snapshot for all visible employees' })
  saveTenantSnapshot(@CurrentUser() user: JwtPayload) {
    return this.misService.saveTenantSnapshot(user.tenantId, user.sub, user.role);
  }

  // ── Predictive Analytics ────────────────────────────────────────────────────

  @Get('predict/task-delays')
  @ApiOperation({ summary: 'Predict which active tasks are at risk of delay' })
  predictTaskDelays(@CurrentUser() user: JwtPayload) {
    return this.predictiveService.predictTaskDelays(user);
  }

  @Get('predict/workload')
  @ApiOperation({ summary: 'Predict employee workload and burnout risk' })
  predictWorkload(@CurrentUser() user: JwtPayload) {
    return this.predictiveService.predictWorkload(user);
  }

  @Get('predict/project-health')
  @ApiOperation({ summary: 'Predict project health scores' })
  predictProjectHealth(@CurrentUser() user: JwtPayload) {
    return this.predictiveService.predictProjectHealth(user);
  }
}
