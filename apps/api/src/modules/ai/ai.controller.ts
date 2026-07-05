import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AiService, AssistantChatMessage } from './ai.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsIn, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

class GenerateWorkflowDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() intent: string;
  @IsOptional() @IsArray() @IsString({ each: true }) fields?: string[];
}

class AutofillFieldsDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() intent?: string;
}

class VoiceToTaskDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) text: string;
}

class SuggestDescriptionDto {
  @IsString() @IsNotEmpty() title: string;
  @IsOptional() @IsString() context?: string;
}

class AssistantChatTurnDto {
  @IsIn(['user', 'assistant']) role: 'user' | 'assistant';
  @IsString() @MaxLength(2000) content: string;
}

class AskAssistantDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) message: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistantChatTurnDto)
  history?: AssistantChatTurnDto[];
}

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-workflow')
  generateWorkflow(@Body() dto: GenerateWorkflowDto, @CurrentUser() user: JwtPayload) {
    return this.aiService.generateWorkflow(dto.name, dto.intent, dto.fields ?? [], user.tenantId, user.sub);
  }

  @Post('autofill-fields')
  autofillFields(@Body() dto: AutofillFieldsDto) {
    return this.aiService.autofillFields(dto.name, dto.intent ?? '');
  }

  @Post('suggest-description')
  suggestDescription(@Body() dto: SuggestDescriptionDto) {
    return this.aiService.suggestTaskDescription(dto.title, dto.context);
  }

  @Post('mis-insight')
  generateMisInsight(@Query('period') period: string, @CurrentUser() user: JwtPayload) {
    return this.aiService.generateMisInsight(user.sub, user.tenantId, period ?? 'THIS_WEEK');
  }

  @Get('jobs/:jobId')
  getJobStatus(@Param('jobId') jobId: string) {
    return this.aiService.getJobStatus(jobId);
  }

  @Post('assistant')
  askAssistant(@Body() dto: AskAssistantDto, @CurrentUser() user: JwtPayload) {
    const history: AssistantChatMessage[] = (dto.history ?? []).map((h) => ({
      role: h.role,
      content: h.content,
    }));
    return this.aiService.askAssistant(dto.message, history, user);
  }

  /**
   * Parse a voice transcript into a structured task draft.
   * Called by the VoiceTaskButton component on the frontend.
   */
  @Post('voice-to-task')
  voiceToTask(@Body() dto: VoiceToTaskDto, @CurrentUser() user: JwtPayload) {
    return this.aiService.parseVoiceToTask(dto.text, user);
  }
}
