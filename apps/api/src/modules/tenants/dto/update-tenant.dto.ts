import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsBoolean,
  IsNumber,
  Min,
  IsUrl,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenantSettingsDto {
  @ApiPropertyOptional({ example: 'General Shift' })
  @IsOptional()
  @IsString()
  officeShiftName?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'DD/MM/YYYY' })
  @IsOptional()
  @IsString()
  dateFormat?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  workingHoursStart?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  workingHoursEnd?: string;

  @ApiPropertyOptional({ example: 'Monday to Saturday' })
  @IsOptional()
  @IsString()
  workingWeekType?: string;

  @ApiPropertyOptional({ example: [1, 2, 3, 4, 5, 6], description: '1=Mon to 7=Sun' })
  @IsOptional()
  @IsArray()
  workingDays?: number[];

  @ApiPropertyOptional({ example: [7], description: '1=Mon to 7=Sun' })
  @IsOptional()
  @IsArray()
  weeklyOffDays?: number[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  alternateSaturdayOff?: boolean;

  @ApiPropertyOptional({ example: '2nd & 4th Saturday Off' })
  @IsOptional()
  @IsString()
  saturdayPolicy?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  punchInStartTime?: string;

  @ApiPropertyOptional({ example: '09:40' })
  @IsOptional()
  @IsString()
  punchInEndTime?: string;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional()
  @IsNumber()
  totalWorkingHours?: number;

  @ApiPropertyOptional({ example: 24, description: 'Default SLA in hours' })
  @IsOptional()
  @IsInt()
  @Min(1)
  defaultSlaHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class AddHolidayDto {
  @ApiPropertyOptional({ example: '2026-08-15T00:00:00.000Z' })
  @IsString()
  date: string;

  @ApiPropertyOptional({ example: 'Independence Day' })
  @IsString()
  name: string;
}

export class UpdateFeatureFlagDto {
  @IsString()
  feature: string;

  enabled: boolean;
}
