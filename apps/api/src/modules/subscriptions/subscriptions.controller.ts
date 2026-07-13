import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
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

  @Patch('change-plan')
  @Roles('ADMIN', 'COMPANY_OWNER', 'SAAS_OWNER')
  async changePlan(
    @CurrentUser() user: any,
    @Body() body: { planId: string },
  ) {
    return this.service.changePlan(user.tenantId, body.planId);
  }
}
