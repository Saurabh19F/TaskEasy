import {
  IsString, IsOptional, IsArray, IsDateString, IsInt, IsNotEmpty, IsNumber,
  IsUrl, MaxLength, MinLength, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFmsWorkflowDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;
}

export class CreateFmsStepDto {
  @ApiProperty()
  @IsString()
  workflowId: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ description: 'Step order number (1-based)' })
  @IsInt()  // VAL-03 fix: stepNo had no validator — "stepNo: 'abc'" silently stored NaN
  @Min(1)
  stepNo: number;

  @ApiProperty({ description: 'Assigned user ID' })
  @IsString()
  assignedToId: string;

  @ApiProperty({ example: '2024-12-31' })
  @IsDateString()
  plannedDate: string;

  @ApiPropertyOptional({ example: 'https://forms.google.com/...' })
  @IsOptional()
  @IsUrl()
  formLink?: string;
}

export class CompleteFmsStepDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}

export class CreateAndStartStepDto {
  @IsString() @IsNotEmpty() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() tatHours?: number;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() actionType?: string;
}

export class CreateAndStartWorkflowDto {
  @IsString() @MinLength(3) @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsArray() @IsOptional() steps?: CreateAndStartStepDto[];
}

export class FmsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  view?: 'my_pending' | 'my_completed' | 'team_pending' | 'team_completed';

  @ApiPropertyOptional()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  workflowId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  period?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number = 20;
}
