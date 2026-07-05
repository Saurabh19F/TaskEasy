import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MisQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ enum: ['TODAY', 'THIS_WEEK', 'LAST_WEEK', 'THIS_MONTH', 'LAST_MONTH'] })
  @IsOptional()
  period?: string;

  @ApiPropertyOptional()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  dateTo?: string;
}

export class SaveWeeklyTargetDto {
  @ApiPropertyOptional()
  @IsString()
  userId: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  targetScore: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
