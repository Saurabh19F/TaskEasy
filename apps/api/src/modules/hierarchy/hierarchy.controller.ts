import {
  Controller, Get, Post, Patch, Delete, UseGuards,
  Param, Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { HierarchyService } from './hierarchy.service';
import { CreateHierarchyGroupDto, UpdateHierarchyGroupDto } from './dto/hierarchy.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Hierarchy')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('hierarchy')
export class HierarchyController {
  constructor(private readonly hierarchyService: HierarchyService) {}

  @Post()
  create(@Body() dto: CreateHierarchyGroupDto, @CurrentUser() user: JwtPayload) {
    return this.hierarchyService.createGroup(dto, user.tenantId, user.sub);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.hierarchyService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.hierarchyService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHierarchyGroupDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.hierarchyService.updateGroup(id, dto, user.tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.hierarchyService.removeGroup(id, user.tenantId);
  }
}
