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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  AdminResetPasswordDto,
  ListUsersQueryDto,
} from './dto/create-user.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions(PERMISSIONS.USER_CREATE)
  @ApiOperation({ summary: 'Create a new user in the tenant' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.create(dto, user);
  }

  @Post('import')
  @Roles('ADMIN')
  @RequirePermissions(PERMISSIONS.USER_CREATE)
  @ApiOperation({ summary: 'Bulk import users from Excel (Name, Email, Phone, Role, Department, Designation)' })
  importBulk(@Body() body: { rows: any[] }, @CurrentUser() user: JwtPayload) {
    return this.usersService.importBulk(body.rows ?? [], user);
  }

  @Get('export')
  @Roles('ADMIN')
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'Export all users as JSON (frontend converts to XLSX)' })
  exportAll(@CurrentUser() user: JwtPayload) {
    return this.usersService.exportAll(user.tenantId);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'List users (filtered by hierarchy for non-super-admin)' })
  findAll(@Query() query: ListUsersQueryDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.findAll(query, user);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active users for dropdowns' })
  getActiveUsers(@CurrentUser() user: JwtPayload) {
    return this.usersService.getActiveUsers(user);
  }

  @Get('suggest-assignee')
  @ApiOperation({ summary: 'Smart assignment: rank users by availability + past performance' })
  suggestAssignee(@CurrentUser() user: JwtPayload) {
    return this.usersService.suggestAssignee(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'Get user profile' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  @ApiOperation({ summary: 'Update user details' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  @ApiOperation({ summary: 'Activate or deactivate user' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.updateStatus(id, dto, user);
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  @RequirePermissions(PERMISSIONS.USER_MANAGE_ROLES)
  @ApiOperation({ summary: 'Change user role' })
  updateRole(
    @Param('id') id: string,
    @Body() body: { role: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.updateRole(id, body.role, user);
  }

  @Patch(':id/password')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: reset user password' })
  adminResetPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.adminResetPassword(id, dto, user);
  }

  @Get(':id/activity')
  @Roles('ADMIN')
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  @ApiOperation({ summary: 'Get user activity log' })
  getActivity(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.getActivity(id, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @RequirePermissions(PERMISSIONS.USER_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive (soft delete) user' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.remove(id, user);
  }
}
