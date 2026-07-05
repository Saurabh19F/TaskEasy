import {
  Controller, Get, Post, Patch, Delete, UseGuards,
  Param, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, ProjectQueryDto } from './dto/project.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles('ADMIN')
  @RequirePermissions('project.manage')
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: JwtPayload) {
    return this.projectsService.create(dto, user.tenantId, user.sub);
  }

  @Get()
  @RequirePermissions('project.read')
  findAll(@Query() query: ProjectQueryDto, @CurrentUser() user: JwtPayload) {
    return this.projectsService.findAll(user.tenantId, query);
  }

  @Post('import')
  @Roles('ADMIN')
  @RequirePermissions('project.manage')
  importBulk(@Body() body: { rows: any[] }, @CurrentUser() user: JwtPayload) {
    return this.projectsService.importBulk(body.rows ?? [], user.tenantId, user.sub);
  }

  @Get('export')
  @Roles('ADMIN')
  @RequirePermissions('project.read')
  exportAll(@CurrentUser() user: JwtPayload) {
    return this.projectsService.exportAll(user.tenantId);
  }

  /** Active projects for dropdowns — all roles */
  @Get('active')
  findActive(@CurrentUser() user: JwtPayload) {
    return this.projectsService.findActive(user.tenantId);
  }

  @Get(':id')
  @RequirePermissions('project.read')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.projectsService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @RequirePermissions('project.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.update(id, dto, user.tenantId);
  }

  @Patch(':id/toggle-status')
  @Roles('ADMIN')
  @RequirePermissions('project.manage')
  toggleStatus(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.projectsService.toggleStatus(id, user.tenantId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @RequirePermissions('project.manage')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.projectsService.remove(id, user.tenantId);
  }
}
