import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SecuritySettingsService } from './security-settings.service';
import { UpdateSecuritySettingsDto } from './dto/update-security-settings.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Security Settings')
@Controller('security-settings')
@UseGuards(RolesGuard)
export class SecuritySettingsController {
  constructor(private readonly service: SecuritySettingsService) {}

  @Get()
  @Roles('ADMIN', 'COMPANY_OWNER', 'SAAS_OWNER')
  async get(@CurrentUser() user: any) {
    return this.service.get(user.tenantId);
  }

  @Patch()
  @Roles('ADMIN', 'COMPANY_OWNER', 'SAAS_OWNER')
  async update(
    @CurrentUser() user: any,
    @Body() dto: UpdateSecuritySettingsDto,
  ) {
    return this.service.update(user.tenantId, dto);
  }
}
