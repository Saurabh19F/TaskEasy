import {
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  IsString,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const IP_OR_CIDR =
  /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

export class UpdateSecuritySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sessionTimeoutEnabled?: boolean;

  @ApiPropertyOptional({ example: 30, minimum: 5, maximum: 480 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  sessionTimeoutMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  auditLogsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ipWhitelistEnabled?: boolean;

  @ApiPropertyOptional({ example: ['192.168.1.0/24', '10.0.0.1'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(IP_OR_CIDR, { each: true, message: 'Each entry must be a valid IPv4 address or CIDR range' })
  whitelistedIps?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enforce2fa?: boolean;
}
