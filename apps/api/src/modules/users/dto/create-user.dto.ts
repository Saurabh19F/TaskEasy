import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNotEmpty,
  ValidateIf,
  Matches,
  MaxLength,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Punch-in tracking is mandatory for the roles that actually log a daily
// attendance window - Admins aren't tracked this way.
const PUNCH_TRACKED_ROLES = ['MANAGER', 'EMPLOYEE', 'VIEWER'];
const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  TEAM_LEAD = 'TEAM_LEAD',
  EMPLOYEE = 'EMPLOYEE',
  AUDITOR = 'AUDITOR',
  VIEWER = 'VIEWER',
  CLIENT = 'CLIENT',
  VENDOR = 'VENDOR',
}

export class CreateUserDto {
  @ApiProperty({ example: 'Sunny Gupta' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'sunny@company.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Profile photo URL or Cloudinary secure URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({ example: 'Male' })
  @IsString()
  gender: string;

  @ApiProperty({ example: '1994-02-14', description: 'YYYY-MM-DD' })
  @IsDateString()
  dateOfBirth: string;

  @ApiPropertyOptional({ example: '2020-06-15', description: 'Anniversary date YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  anniversaryDate?: string;

  @ApiProperty({ example: 'SecurePass@123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.EMPLOYEE })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: 'EMP001' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ example: 'Sales' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'Sales Executive' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiProperty({ example: '2026-06-19', description: 'YYYY-MM-DD' })
  @IsDateString()
  joiningDate: string;

  @ApiProperty({ example: 'Full Time' })
  @IsString()
  employmentType: string;

  @ApiPropertyOptional({ example: 'Hybrid' })
  @IsOptional()
  @IsString()
  workMode?: string;

  @ApiPropertyOptional({ example: 'Mumbai HQ' })
  @IsOptional()
  @IsString()
  workLocation?: string;

  @ApiProperty({ example: 'Active' })
  @IsString()
  employeeStatus: string;

  @ApiPropertyOptional({ description: 'Manager/Admin user ID' })
  @IsOptional()
  @ValidateIf((o) => !!o.managerId)
  @IsMongoId()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional({
    example: '09:30',
    description: 'Expected daily punch-in/login time, "HH:mm". Required for Manager, Employee and Viewer roles.',
  })
  @ValidateIf((o) => PUNCH_TRACKED_ROLES.includes(o.role ?? 'EMPLOYEE'))
  @IsString()
  @Matches(HHMM_REGEX, { message: 'punchInTime must be in HH:mm 24-hour format' })
  punchInTime?: string;

  @ApiPropertyOptional({
    description:
      'Backup user who covers this person\'s active work if they have not logged in within 15 minutes of punchInTime. Required for Manager, Employee and Viewer roles.',
  })
  @ValidateIf((o) => PUNCH_TRACKED_ROLES.includes(o.role ?? 'EMPLOYEE'))
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  buddyId?: string;

  @ApiPropertyOptional({ example: ['MON', 'TUE', 'WED', 'THU', 'FRI'], description: 'Working days of the week' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  officeDays?: string[];

  @ApiPropertyOptional({ example: ['SUN'], description: 'Weekly off days' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  weeklyOff?: string[];
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: 'EMP001' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @ApiPropertyOptional({ example: '2020-06-15', description: 'Anniversary date YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  anniversaryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employmentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => !!o.managerId)
  @IsMongoId()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: '09:30', description: 'HH:mm 24-hour format' })
  @ValidateIf((o) => !!o.punchInTime)
  @IsString()
  @Matches(HHMM_REGEX, { message: 'punchInTime must be in HH:mm 24-hour format' })
  punchInTime?: string;

  @ApiPropertyOptional({ description: 'Backup user id who covers this person\'s work if they miss punch-in' })
  @IsOptional()
  @ValidateIf((o) => !!o.buddyId)
  @IsMongoId()
  @IsString()
  buddyId?: string;

  @ApiPropertyOptional({ example: ['MON', 'TUE', 'WED', 'THU', 'FRI'], description: 'Working days of the week' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  officeDays?: string[];

  @ApiPropertyOptional({ example: ['SUN'], description: 'Weekly off days' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  weeklyOff?: string[];
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status: 'ACTIVE' | 'INACTIVE';
}

export class AdminResetPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class ListUsersQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'LOCKED'] })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  department?: string;
}
