import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApprovalService } from './approval.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  /** Admin/Manager: approval queue (new submissions) */
  @Get('queue')
  @RequirePermissions('task.approve')
  getQueue(
    @Query('tab') tab: 'new' | 'rework' = 'new',
    @CurrentUser() user: JwtPayload,
  ) {
    return this.approvalService.getApprovalQueue(user.tenantId, user.sub, user.role, tab);
  }

  /** Admin: items in REWORK status */
  @Get('rework-history')
  @RequirePermissions('task.approve')
  getReworkHistory(@CurrentUser() user: JwtPayload) {
    return this.approvalService.getReworkHistory(user.tenantId, user.sub, user.role);
  }

  /** Count for notification dot */
  @Get('count')
  getCount(@CurrentUser() user: JwtPayload) {
    return this.approvalService.getPendingApprovalCount(user.tenantId, user.sub, user.role);
  }

  /** Employee: my submitted tasks + status */
  @Get('my-submissions')
  getMySubmissions(@CurrentUser() user: JwtPayload) {
    return this.approvalService.getMySubmissions(user.tenantId, user.sub);
  }
}
