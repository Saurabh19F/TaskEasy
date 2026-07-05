import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsObject, IsBoolean, IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AutomationTrigger {
  TASK_OVERDUE = 'TASK_OVERDUE',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_CREATED = 'TASK_CREATED',
  REWORK_REQUESTED = 'REWORK_REQUESTED',
  CHECKLIST_MISSED = 'CHECKLIST_MISSED',
  FMS_STEP_COMPLETED = 'FMS_STEP_COMPLETED',
  SLA_BREACHED = 'SLA_BREACHED',
  USER_WORKLOAD_HIGH = 'USER_WORKLOAD_HIGH',
  PROJECT_HEALTH_LOW = 'PROJECT_HEALTH_LOW',
  APPROVAL_PENDING_TOO_LONG = 'APPROVAL_PENDING_TOO_LONG',
}

export enum AutomationAction {
  NOTIFY_USER = 'NOTIFY_USER',
  NOTIFY_MANAGER = 'NOTIFY_MANAGER',
  NOTIFY_ADMIN = 'NOTIFY_ADMIN',
  CREATE_TASK = 'CREATE_TASK',
  CHANGE_STATUS = 'CHANGE_STATUS',
  ESCALATE = 'ESCALATE',
  MARK_CRITICAL = 'MARK_CRITICAL',
  ASSIGN_TO = 'ASSIGN_TO',
  SEND_EMAIL = 'SEND_EMAIL',
  ADD_COMMENT = 'ADD_COMMENT',
}

export class CreateAutomationRuleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: AutomationTrigger })
  @IsEnum(AutomationTrigger)
  trigger: AutomationTrigger;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  conditions?: Record<string, any>[];

  @ApiProperty({ enum: AutomationAction })
  @IsEnum(AutomationAction)
  action: AutomationAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  actionConfig?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
