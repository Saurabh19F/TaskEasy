import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformJwtAuthGuard } from '../../common/guards/platform-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { SkipJwtGuard } from '../../common/decorators/skip-jwt.decorator';
import { CurrentPlatformUser, PlatformJwtPayload } from '../../common/decorators/platform-current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions';
import { PlatformService } from './platform.service';

@ApiTags('platform')
@ApiBearerAuth('access-token')
@SkipJwtGuard()
@UseGuards(PlatformJwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('dashboard')
  @RequirePermissions(PERMISSIONS.PLATFORM_COMPANIES_READ)
  getDashboard() {
    return this.platformService.getDashboard();
  }

  @Get('companies')
  @RequirePermissions(PERMISSIONS.PLATFORM_COMPANIES_READ)
  listCompanies(@Query() query: any) {
    return this.platformService.listCompanies(query);
  }

  @Post('companies')
  @RequirePermissions(PERMISSIONS.PLATFORM_COMPANIES_CREATE)
  createCompany(@Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.createCompany(body, user);
  }

  @Get('companies/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_COMPANIES_READ)
  getCompany(@Param('id') id: string) {
    return this.platformService.getCompany(id);
  }

  @Patch('companies/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_COMPANIES_UPDATE)
  updateCompany(@Param('id') id: string, @Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.updateCompany(id, body, user);
  }

  @Patch('companies/:id/status')
  @RequirePermissions(PERMISSIONS.PLATFORM_COMPANIES_SUSPEND)
  updateCompanyStatus(@Param('id') id: string, @Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.updateCompanyStatus(id, body.status, user);
  }

  @Patch('companies/:id/modules')
  @RequirePermissions(PERMISSIONS.PLATFORM_COMPANIES_UPDATE)
  updateCompanyModules(@Param('id') id: string, @Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.updateCompanyModules(id, body, user);
  }

  @Delete('companies/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_COMPANIES_UPDATE)
  deleteCompany(@Param('id') id: string, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.deleteCompany(id, user);
  }

  @Post('companies/:id/reset-admin-password')
  @RequirePermissions(PERMISSIONS.PLATFORM_COMPANIES_UPDATE)
  resetCompanyAdminPassword(@Param('id') id: string, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.resetCompanyAdminPassword(id, user);
  }

  @Post('companies/:id/impersonate')
  @RequirePermissions(PERMISSIONS.PLATFORM_COMPANIES_IMPERSONATE)
  impersonateCompanyAdmin(@Param('id') id: string, @Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.impersonateCompanyAdmin(id, body, user);
  }

  @Post('impersonation/:sessionId/exit')
  @RequirePermissions(PERMISSIONS.PLATFORM_COMPANIES_IMPERSONATE)
  exitImpersonation(@Param('sessionId') sessionId: string, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.exitImpersonation(sessionId, user);
  }

  @Get('plans')
  @RequirePermissions(PERMISSIONS.PLATFORM_PLANS_MANAGE)
  listPlans() {
    return this.platformService.listPlans();
  }

  @Post('plans')
  @RequirePermissions(PERMISSIONS.PLATFORM_PLANS_MANAGE)
  createPlan(@Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.createPlan(body, user);
  }

  @Patch('plans/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_PLANS_MANAGE)
  updatePlan(@Param('id') id: string, @Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.updatePlan(id, body, user);
  }

  @Delete('plans/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_PLANS_MANAGE)
  deletePlan(@Param('id') id: string, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.deletePlan(id, user);
  }

  @Get('plan-change-requests')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE)
  listPlanChangeRequests(@Query() query: any) {
    return this.platformService.listPlanChangeRequests(query);
  }

  @Patch('plan-change-requests/:id/approve')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE)
  approvePlanChangeRequest(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentPlatformUser() user: PlatformJwtPayload,
  ) {
    return this.platformService.approvePlanChangeRequest(id, user, body.note);
  }

  @Patch('plan-change-requests/:id/reject')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE)
  rejectPlanChangeRequest(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentPlatformUser() user: PlatformJwtPayload,
  ) {
    return this.platformService.rejectPlanChangeRequest(id, user, body.note);
  }

  @Get('subscriptions')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE)
  listSubscriptions() {
    return this.platformService.listSubscriptions();
  }

  @Post('subscriptions')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE)
  createSubscription(@Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.createSubscription(body, user);
  }

  @Patch('subscriptions/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE)
  updateSubscription(@Param('id') id: string, @Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.updateSubscription(id, body, user);
  }

  @Post('subscriptions/:id/renew')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE)
  renewSubscription(@Param('id') id: string, @Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.renewSubscription(id, body, user);
  }

  @Get('billing/invoices')
  @RequirePermissions(PERMISSIONS.PLATFORM_BILLING_READ)
  listInvoices() {
    return this.platformService.listInvoices();
  }

  @Post('billing/invoices')
  @RequirePermissions(PERMISSIONS.PLATFORM_BILLING_UPDATE)
  createInvoice(@Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.createInvoice(body, user);
  }

  @Patch('billing/invoices/:id/status')
  @RequirePermissions(PERMISSIONS.PLATFORM_BILLING_UPDATE)
  updateInvoiceStatus(@Param('id') id: string, @Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.updateInvoiceStatus(id, body, user);
  }

  @Get('billing/revenue-summary')
  @RequirePermissions(PERMISSIONS.PLATFORM_BILLING_READ)
  getRevenueSummary() {
    return this.platformService.getRevenueSummary();
  }

  @Get('support/tickets')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUPPORT_MANAGE)
  listTickets() {
    return this.platformService.listTickets();
  }

  @Patch('support/tickets/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUPPORT_MANAGE)
  updateTicket(@Param('id') id: string, @Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.updateTicket(id, body, user);
  }

  @Post('support/tickets/:id/reply')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUPPORT_MANAGE)
  replyTicket(@Param('id') id: string, @Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.replyTicket(id, body, user);
  }

  @Get('audit-logs')
  @RequirePermissions(PERMISSIONS.PLATFORM_AUDIT_READ)
  listAuditLogs(@Query() query: any) {
    return this.platformService.listAuditLogs(query);
  }

  @Get('platform-users')
  @RequirePermissions(PERMISSIONS.PLATFORM_USERS_MANAGE)
  listPlatformUsers() {
    return this.platformService.listPlatformUsers();
  }

  @Post('platform-users')
  @RequirePermissions(PERMISSIONS.PLATFORM_USERS_MANAGE)
  createPlatformUser(@Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.createPlatformUser(body, user);
  }

  @Patch('platform-users/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_USERS_MANAGE)
  updatePlatformUser(@Param('id') id: string, @Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.updatePlatformUser(id, body, user);
  }

  @Delete('platform-users/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_USERS_MANAGE)
  deletePlatformUser(@Param('id') id: string, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.deletePlatformUser(id, user);
  }

  @Post('platform-users/:id/reset-password')
  @RequirePermissions(PERMISSIONS.PLATFORM_USERS_MANAGE)
  resetPlatformUserPassword(@Param('id') id: string, @Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.resetPlatformUserPassword(id, body, user);
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.PLATFORM_ROLES_MANAGE)
  listRoles() {
    return this.platformService.listRoles();
  }

  @Post('roles')
  @RequirePermissions(PERMISSIONS.PLATFORM_ROLES_MANAGE)
  createRole(@Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.createRole(body, user);
  }

  @Patch('roles/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_ROLES_MANAGE)
  updateRole(@Param('id') id: string, @Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.updateRole(id, body, user);
  }

  @Delete('roles/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_ROLES_MANAGE)
  deleteRole(@Param('id') id: string, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.deleteRole(id, user);
  }

  @Get('notifications')
  @RequirePermissions(PERMISSIONS.PLATFORM_NOTIFICATIONS_MANAGE)
  listNotifications() {
    return this.platformService.listNotifications();
  }

  @Post('notifications')
  @RequirePermissions(PERMISSIONS.PLATFORM_NOTIFICATIONS_MANAGE)
  sendNotification(@Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.sendNotification(body, user);
  }

  @Get('reports/:type')
  @RequirePermissions(PERMISSIONS.PLATFORM_REPORTS_READ)
  listReports(@Param('type') type: string, @Query() query: any) {
    return this.platformService.listReports(type, query);
  }

  @Get('settings')
  @RequirePermissions(PERMISSIONS.PLATFORM_SETTINGS_MANAGE)
  getSettings() {
    return this.platformService.getSettings();
  }

  @Patch('settings')
  @RequirePermissions(PERMISSIONS.PLATFORM_SETTINGS_MANAGE)
  updateSettings(@Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.updateSettings(body, user);
  }

  @Get('security-center')
  @RequirePermissions(PERMISSIONS.PLATFORM_SECURITY_MANAGE)
  getSecurityCenter() {
    return this.platformService.getSecurityCenter();
  }

  @Patch('security-center/events/:id/resolve')
  @RequirePermissions(PERMISSIONS.PLATFORM_SECURITY_MANAGE)
  resolveSecurityEvent(@Param('id') id: string, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.resolveSecurityEvent(id, user);
  }

  @Get('backups')
  @RequirePermissions(PERMISSIONS.PLATFORM_BACKUPS_MANAGE)
  listBackups() {
    return this.platformService.listBackups();
  }

  @Post('backups')
  @RequirePermissions(PERMISSIONS.PLATFORM_BACKUPS_MANAGE)
  createBackup(@Body() body: any, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformService.createBackup(body, user);
  }

  @Get('payments')
  @RequirePermissions(PERMISSIONS.PLATFORM_BILLING_READ)
  listPayments() {
    return this.platformService.listPayments();
  }

  @Get('activity')
  @RequirePermissions(PERMISSIONS.PLATFORM_AUDIT_READ)
  listActivity() {
    return this.platformService.listActivityLogs();
  }

  @Get('support/stats')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUPPORT_MANAGE)
  listSupportStats() {
    return this.platformService.listSupportStats();
  }
}
