import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClientPortalService } from './client-portal.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Client Portal')
@ApiBearerAuth()
@Controller('client-portal')
export class ClientPortalController {
  constructor(private readonly clientPortalService: ClientPortalService) {}

  @Get('projects/:projectId')
  getProjectStatus(@Param('projectId') id: string, @CurrentUser() user: JwtPayload) {
    return this.clientPortalService.getProjectStatus(id, user.tenantId);
  }

  @Get('work-requests')
  getWorkRequests(
    @Query('email') email: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clientPortalService.getWorkRequests(user.tenantId, email);
  }
}
