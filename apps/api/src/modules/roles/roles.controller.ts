import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesService, CreateRoleDto } from './roles.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('roles')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USER_MANAGE_ROLES)
  @ApiOperation({ summary: 'List all roles (system + custom)' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.rolesService.findAll(user.tenantId);
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.USER_MANAGE_ROLES)
  @ApiOperation({ summary: 'List all available permission keys by role' })
  getAllPermissions() {
    return this.rolesService.getAllPermissionKeys();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USER_MANAGE_ROLES)
  @ApiOperation({ summary: 'Get role details' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.rolesService.findOne(id, user.tenantId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USER_MANAGE_ROLES)
  @ApiOperation({ summary: '[Admin] Create custom role' })
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: JwtPayload) {
    return this.rolesService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USER_MANAGE_ROLES)
  @ApiOperation({ summary: '[Admin] Update role permissions' })
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateRoleDto>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rolesService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USER_MANAGE_ROLES)
  @ApiOperation({ summary: '[Admin] Delete custom role' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.rolesService.remove(id, user);
  }
}
