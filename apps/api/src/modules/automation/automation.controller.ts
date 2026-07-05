import {
  Controller, Get, Post, Patch, Delete, UseGuards,
  Param, Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AutomationService } from './automation.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Automation')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('automation')
@Roles('ADMIN')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get()
  @RequirePermissions('automation.read')
  findAll(@CurrentUser() user: JwtPayload) {
    return this.automationService.findAll(user.tenantId);
  }

  @Get(':id')
  @RequirePermissions('automation.read')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.automationService.findOne(id, user.tenantId);
  }

  @Post()
  @RequirePermissions('automation.create')
  create(@Body() dto: CreateAutomationRuleDto, @CurrentUser() user: JwtPayload) {
    return this.automationService.create(dto, user.tenantId, user.sub);
  }

  @Patch(':id')
  @RequirePermissions('automation.update')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateAutomationRuleDto>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.automationService.update(id, dto, user.tenantId);
  }

  @Patch(':id/toggle')
  @RequirePermissions('automation.update')
  toggle(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.automationService.toggleActive(id, user.tenantId);
  }

  @Delete(':id')
  @RequirePermissions('automation.delete')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.automationService.remove(id, user.tenantId);
  }
}
