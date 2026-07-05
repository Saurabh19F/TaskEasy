import {
  Controller, Get, Post, Delete, UseGuards,
  Param, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService, CreateCommentDto } from './comments.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.TASK_SUBMIT)
  create(@Body() dto: CreateCommentDto, @CurrentUser() user: JwtPayload) {
    return this.commentsService.create(dto, user.tenantId, user.sub);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.TASK_READ)
  findByRef(@Query('refId') refId: string, @CurrentUser() user: JwtPayload) {
    return this.commentsService.findByRef(refId, user.tenantId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.commentsService.delete(id, user.tenantId, user.sub, user.role);
  }
}
