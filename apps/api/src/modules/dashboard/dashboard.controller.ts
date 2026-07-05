import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { isTeamManagerRole, isTenantWideRole } from '../../common/utils/role.utils';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(
    @CurrentUser() user: JwtPayload,
    @Query('view') view: 'team' | 'my' = 'team',
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
  ) {
    if (view === 'team' && !isTeamManagerRole(user.role) && !isTenantWideRole(user.role)) {
      throw new ForbiddenException('Team view requires admin or manager role');
    }
    return this.dashboardService.getDashboard(
      user.tenantId, user.sub, user.role, view,
      { period, dateFrom, dateTo, userId, projectId },
    );
  }

  @Get('drilldown')
  getDrilldown(
    @Query('module') module: 'delegation' | 'workRequest' | 'checklist' | 'fms',
    @Query('status') status: 'total' | 'done' | 'pending' | 'delayed',
    @Query('view') view: 'team' | 'my' = 'team',
    @CurrentUser() user: JwtPayload,
  ) {
    if (view === 'team' && !isTeamManagerRole(user.role) && !isTenantWideRole(user.role)) {
      throw new ForbiddenException('Team view requires admin or manager role');
    }
    return this.dashboardService.getDrilldown(user.tenantId, user.sub, user.role, module, status, view);
  }

  @Get('notifications/count')
  getNotificationCounts(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getNotificationCounts(user.tenantId, user.sub, user.role);
  }
}
