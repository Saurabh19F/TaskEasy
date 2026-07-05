import {
  IsString, IsArray, IsOptional, IsEnum, IsDateString,
  IsBoolean, ArrayMinSize, ArrayMaxSize, MaxLength, MinLength,
  IsNumber, Min, Max,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL',
}

export class CreateDelegationTaskDto {
  /**
   * Support assigning to multiple users at once.
   * Backend creates one task per doer.
   */
  @ApiProperty({ description: 'One or more user IDs to assign the task to', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)  // MI-01 fix: prevent bulk DoS via huge array
  delegatedToIds: string[];

  @ApiProperty()
  @IsString()
  projectId: string;

  @ApiProperty({ example: 'Follow up with client for payment confirmation' })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: '2024-12-31' })
  @IsDateString()
  targetDate: string;

  @ApiPropertyOptional({ example: '17:00' })
  @IsOptional()
  @IsString()
  targetTime?: string;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority = TaskPriority.MEDIUM;

  /** Cloudinary publicIds of pre-uploaded attachments */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  attachmentIds?: string[];
}

export class BulkDelegationTaskDto {
  @ApiProperty({ example: 'Follow up with client for payment confirmation' })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: '2024-12-31' })
  @IsDateString()
  targetDate: string;

  @ApiPropertyOptional({ example: '17:00' })
  @IsOptional()
  @IsString()
  targetTime?: string;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority = TaskPriority.MEDIUM;

  /** Cloudinary publicIds of pre-uploaded attachments */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  attachmentIds?: string[];
}

export class CreateDelegationBulkDto {
  @ApiProperty({ description: 'One or more user IDs to assign every task to', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  delegatedToIds: string[];

  @ApiProperty()
  @IsString()
  projectId: string;

  @ApiProperty({ type: [BulkDelegationTaskDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BulkDelegationTaskDto)
  tasks: BulkDelegationTaskDto[];
}

export class SubmitDelegationDto {
  @ApiProperty({ example: 'Done. Attached invoice confirmation.' })
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  doerRemarks: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  attachmentIds?: string[];
}

export class ApproveDelegationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @ApiPropertyOptional({ example: 5, description: 'Rating 1-5' })
  @IsOptional()
  @IsNumber()  // SEC-03 fix: was unvalidated — attacker could send "rating: 999"
  @Min(1)
  @Max(5)
  rating?: number;
}

export class ReworkDelegationDto {
  @ApiProperty({ example: 'Proof is blurry. Please re-upload.' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reworkRemark: string;
}

export class DelegationQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'IN_PROGRESS', 'SEND_FOR_APPROVAL', 'REWORK', 'COMPLETED'] })
  @IsOptional()
  @IsEnum(['PENDING', 'IN_PROGRESS', 'SEND_FOR_APPROVAL', 'REWORK', 'COMPLETED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({ enum: ['TODAY', 'THIS_WEEK', 'LAST_WEEK', 'THIS_MONTH', 'LAST_MONTH'] })
  @IsOptional()
  period?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()  // VAL-02 fix: reject malformed date strings early
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

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ['CREATED_AT', 'DUE_DATE', 'PROJECT', 'ASSIGNEE', 'STATUS'] })
  @IsOptional()
  @IsEnum(['CREATED_AT', 'DUE_DATE', 'PROJECT', 'ASSIGNEE', 'STATUS'])
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
