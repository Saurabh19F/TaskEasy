import {
  Controller, Get, Patch, Post, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { UpdateTenantSettingsDto, AddHolidayDto, UpdateFeatureFlagDto } from './dto/update-tenant.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('tenants')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current tenant info + subscription' })
  getMyTenant(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.findOne(user.tenantId);
  }

  @Get('me/settings')
  @ApiOperation({ summary: 'Get company settings' })
  getSettings(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.findOne(user.tenantId);
  }

  @Patch('me/settings')
  @ApiOperation({ summary: '[Admin] Update company settings' })
  updateSettings(@Body() dto: UpdateTenantSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.tenantsService.updateSettings(user.tenantId, dto, user);
  }

  @Get('me/holidays')
  @ApiOperation({ summary: 'List holidays for current year' })
  getHolidays(@CurrentUser() user: JwtPayload, @Query('year') year?: number) {
    return this.tenantsService.getHolidays(user.tenantId, year);
  }

  @Post('me/holidays')
  @ApiOperation({ summary: '[Admin] Add holiday' })
  addHoliday(@Body() dto: AddHolidayDto, @CurrentUser() user: JwtPayload) {
    return this.tenantsService.addHoliday(user.tenantId, dto, user);
  }

  @Delete('me/holidays/:id')
  @ApiOperation({ summary: '[Admin] Remove holiday' })
  removeHoliday(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tenantsService.removeHoliday(user.tenantId, id, user);
  }

  @Get('me/feature-flags')
  @ApiOperation({ summary: 'Get tenant feature flags' })
  getFeatureFlags(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.getFeatureFlags(user.tenantId);
  }

  @Patch('me/feature-flags')
  @ApiOperation({ summary: '[Admin] Toggle feature flag' })
  updateFeatureFlag(@Body() dto: UpdateFeatureFlagDto, @CurrentUser() user: JwtPayload) {
    return this.tenantsService.updateFeatureFlag(user.tenantId, dto, user);
  }

  @Get('me/subscription')
  @ApiOperation({ summary: 'Get subscription info' })
  getSubscription(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.getSubscription(user.tenantId);
  }
}
