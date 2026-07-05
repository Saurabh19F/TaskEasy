import {
  IsString, IsArray, IsOptional, IsEnum, IsBoolean,
  IsDateString, ArrayMinSize, ArrayMaxSize, MinLength, MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ChecklistFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  FORTNIGHTLY = 'FORTNIGHTLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  HALF_YEARLY = 'HALF_YEARLY',
  YEARLY = 'YEARLY',
  ONE_TIME = 'ONE_TIME',
}

export class CreateChecklistMasterDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)  // MI-02 fix: prevent bulk DoS via huge array
  assignedToIds: string[];

  @ApiProperty()
  @IsString()
  projectId: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: ChecklistFrequency })
  @IsEnum(ChecklistFrequency)
  frequency: ChecklistFrequency;

  @ApiProperty({ example: '2024-12-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({ example: '2025-12-01', description: 'Leave blank for auto 1-year window' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  attachmentRequired?: boolean = false;

  @ApiPropertyOptional({ type: [String], description: 'Days of week for WEEKLY frequency, e.g. ["Mon","Wed","Fri"]' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  days?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Specific dates for recurring frequencies (FORTNIGHTLY=3, MONTHLY=1, QUARTERLY=1, HALF_YEARLY=2, YEARLY=1)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraDates?: string[];
}

export class CompleteChecklistTaskDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  remarks: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  attachmentIds?: string[];
}

export class ApproveChecklistTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}

export class ReworkChecklistTaskDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  reworkRemark: string;
}

export class BulkCompleteChecklistDto {
  @ApiProperty({ type: [String], description: 'Array of ChecklistTask IDs (max 100 per request)' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)  // VAL-04 fix: prevent a single request from bulk-completing unbounded rows
  taskIds: string[];

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  remarks: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  attachmentIds?: string[];
}

export class ChecklistQueryDto {
  @ApiPropertyOptional({ description: 'Single status or comma-separated list, e.g. PENDING,LATE,REWORK' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  period?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()  // VAL-02 fix
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter to tasks assigned to the current user' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  assignedToMe?: boolean;
}
