import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VendorPortalService } from './vendor-portal.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Vendor Portal')
@ApiBearerAuth()
@Controller('vendor-portal')
export class VendorPortalController {
  constructor(private readonly vendorPortalService: VendorPortalService) {}

  @Get('tasks')
  getMyTasks(@CurrentUser() user: JwtPayload) {
    return this.vendorPortalService.getAssignedTasks(user.email, user.tenantId);
  }

  @Patch('tasks/:taskId/submit')
  submitTask(
    @Param('taskId') taskId: string,
    @Body('remarks') remarks: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.vendorPortalService.submitTask(taskId, user.tenantId, remarks);
  }
}
