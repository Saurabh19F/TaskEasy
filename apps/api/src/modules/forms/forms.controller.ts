import {
  Controller, Get, Post, Patch, Delete, UseGuards,
  Param, Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FormsService, CreateFormDto } from './forms.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Forms')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get()
  @RequirePermissions('forms.read')
  findAll(@CurrentUser() user: JwtPayload) {
    return this.formsService.findAll(user.tenantId);
  }

  @Get(':id')
  @RequirePermissions('forms.read')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.formsService.findOne(id, user.tenantId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('forms.create')
  create(@Body() dto: CreateFormDto, @CurrentUser() user: JwtPayload) {
    return this.formsService.create(dto, user.tenantId, user.sub);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('forms.update')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateFormDto>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.formsService.update(id, dto, user.tenantId);
  }

  @Post(':id/submit')
  @RequirePermissions('forms.submit')
  submit(
    @Param('id') id: string,
    @Body() body: { refType?: string; refId?: string; [key: string]: any },
    @CurrentUser() user: JwtPayload,
  ) {
    const { refType = 'GENERAL', refId = '', ...responses } = body;
    return this.formsService.submit(id, refType, refId, user.sub, responses);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @RequirePermissions('forms.delete')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.formsService.remove(id, user.tenantId);
  }
}
