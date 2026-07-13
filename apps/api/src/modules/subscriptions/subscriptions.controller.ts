import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(RolesGuard)
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get('plans')
  async listPlans() {
    return this.service.listPlans();
  }

  @Get('my')
  async getMySubscription(@CurrentUser() user: any) {
    return this.service.getMySubscription(user.tenantId);
  }

  @Post('request-change')
  @Roles('ADMIN', 'COMPANY_OWNER', 'SAAS_OWNER')
  async requestPlanChange(
    @CurrentUser() user: any,
    @Body() body: { planId: string; reason?: string },
  ) {
    return this.service.requestPlanChange(
      user.tenantId,
      user.sub,
      body.planId,
      body.reason,
    );
  }

  @Patch('requests/:id/cancel')
  @Roles('ADMIN', 'COMPANY_OWNER', 'SAAS_OWNER')
  async cancelRequest(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.service.cancelRequest(user.tenantId, id);
  }

  @Get('requests')
  @Roles('ADMIN', 'COMPANY_OWNER', 'SAAS_OWNER')
  async listMyRequests(@CurrentUser() user: any) {
    return this.service.listMyRequests(user.tenantId);
  }
}
