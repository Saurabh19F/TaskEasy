import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@ApiExcludeController()
@Controller('integrations/google-calendar')
export class GoogleCalendarWebhookController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('webhook')
  handleWebhook(@Headers() headers: Record<string, any>, @Body() body: Record<string, any>) {
    void body;
    return this.integrationsService.handleGoogleCalendarWebhook(headers);
  }
}
