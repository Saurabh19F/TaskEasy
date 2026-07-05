import { IsString, IsArray, IsOptional, ArrayMinSize, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHierarchyGroupDto {
  @ApiProperty({ example: 'Sales Team' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  groupName: string;

  @ApiProperty({ description: 'Admin/Manager user ID' })
  @IsString()
  adminId: string;

  @ApiProperty({ description: 'Array of employee user IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  memberIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateHierarchyGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  groupName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
