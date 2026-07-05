import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Shared password policy (SEC-02 fix):
 *   - Min 8 characters
 *   - At least one uppercase letter
 *   - At least one lowercase letter
 *   - At least one digit
 *   - At least one special character
 *
 * Applied in LoginDto, ResetPasswordDto, and ChangePasswordDto so that
 * the rule is enforced at the DTO layer (not just in the service's
 * validatePasswordStrength() which previously only checked length >= 8).
 */
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
const PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, a digit, and a special character';

export class LoginDto {
  @ApiProperty({ example: 'sunny@company.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'MySecurePass@123' })
  @IsString()
  @MinLength(8)  // SEC-02 fix: was 6, aligning with password policy
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ description: '6-digit TOTP code if 2FA is enabled' })
  @IsOptional()
  @IsString()
  totpCode?: string;
}

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Refresh token (or send via httpOnly cookie)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'sunny@company.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ description: PASSWORD_MESSAGE })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ description: PASSWORD_MESSAGE })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class VerifyTotpDto {
  @ApiProperty({ description: '6-digit TOTP code' })
  @IsString()
  totpCode: string;
}
