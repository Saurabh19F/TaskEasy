import {
  IsString, IsOptional, IsArray, IsDateString, IsEnum, MaxLength, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkRequestDto {
  @ApiProperty({ description: 'User ID of the doer' })
  @IsString()
  requestForId: string;

  @ApiProperty()
  @IsString()
  projectId: string;

  @ApiProperty({ example: 'Please prepare the client onboarding checklist' })
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
  deadlineDate: string;

  @ApiPropertyOptional({ example: '17:00' })
  @IsOptional()
  @IsString()
  deadlineTime?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  attachmentIds?: string[];
}

export class SubmitWorkRequestDto {
  @ApiProperty({ example: 'Checklist prepared and sent to client.' })
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  doerRemarks: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  attachmentIds?: string[];
}

export class ApproveWorkRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class ReworkWorkRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reworkRemark: string;
}

export class WorkRequestQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'SEND_FOR_APPROVAL', 'REWORK', 'COMPLETED'] })
  @IsOptional()
  @IsEnum(['PENDING', 'SEND_FOR_APPROVAL', 'REWORK', 'COMPLETED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  /** Filter: 'requested_by_me' | 'assigned_to_me' | all */
  @ApiPropertyOptional()
  @IsOptional()
  view?: 'mine' | 'for_me' | 'team';

  @ApiPropertyOptional()
  @IsOptional()
  period?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()  // VAL-02 fix
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()  // VAL-02 fix
  dateTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number = 20;
}
