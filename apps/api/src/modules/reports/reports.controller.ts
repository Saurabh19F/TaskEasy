import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/reports.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@RequirePermissions('report.view')
@UseGuards(PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('delegation')
  delegation(@Query() query: ReportQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.getDelegationReport(user.tenantId, user.sub, user.role, query);
  }

  @Get('work-requests')
  workRequests(@Query() query: ReportQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.getWorkRequestReport(user.tenantId, user.sub, user.role, query);
  }

  @Get('checklist')
  checklist(@Query() query: ReportQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.getChecklistReport(user.tenantId, user.sub, user.role, query);
  }

  @Get('projects')
  projects(@Query() query: ReportQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.getProjectReport(user.tenantId, query);
  }

  @Get('performance')
  performance(@Query() query: ReportQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.getPerformanceReport(user.tenantId, user.sub, user.role, query);
  }
}
