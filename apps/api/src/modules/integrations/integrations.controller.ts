import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/constants/permissions';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.SETTINGS_COMPANY)
@UseGuards(PermissionsGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('accounts')
  listAccounts(@CurrentUser() user: JwtPayload) {
    return this.integrationsService.listAccounts(user.tenantId);
  }

  @Put('accounts/:provider')
  upsertAccount(
    @Param('provider') provider: string,
    @Body() body: { config: Record<string, any>; isEnabled?: boolean },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.integrationsService.upsertAccount(
      user.tenantId,
      provider as any,
      body.config ?? {},
      body.isEnabled ?? true,
      user.sub,
    );
  }

  @Delete('accounts/:provider')
  removeAccount(@Param('provider') provider: string, @CurrentUser() user: JwtPayload) {
    return this.integrationsService.removeAccount(user.tenantId, provider as any);
  }

  @Post('accounts/:provider/rotate')
  rotateAccount(@Param('provider') provider: string, @CurrentUser() user: JwtPayload) {
    return this.integrationsService.rotateAccountCredentials(user.tenantId, provider as any);
  }

  @Post('test/:provider')
  testProvider(
    @Param('provider') provider: string,
    @Body() body: { to?: string; subject?: string; message?: string; entityType?: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS' },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.integrationsService.testProvider(user.tenantId, provider as any, body ?? {});
  }

  @Post('google-calendar/sync')
  syncCalendar(
    @Body() body: { entityType: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS'; entityId: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.integrationsService.syncEntityToGoogleCalendar(user.tenantId, body.entityType, body.entityId);
  }

  @Post('google-calendar/watch')
  createCalendarWatch(
    @Body() body: { webhookUrl: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.integrationsService.createGoogleCalendarWatch(user.tenantId, body.webhookUrl, user.sub);
  }

  @Post('google-sheets/export')
  exportToSheets(
    @Body() body: { entityType: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS' },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.integrationsService.exportEntityToGoogleSheets(user.tenantId, body.entityType);
  }
}
