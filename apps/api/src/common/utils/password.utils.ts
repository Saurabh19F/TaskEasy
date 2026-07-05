import { BadRequestException } from '@nestjs/common';

export function validatePasswordStrength(password: string): void {
  if (password.length < 8) {
    throw new BadRequestException('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    throw new BadRequestException('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    throw new BadRequestException('Password must contain at least one lowercase letter');
  }
  if (!/\d/.test(password)) {
    throw new BadRequestException('Password must contain at least one digit');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    throw new BadRequestException('Password must contain at least one special character');
  }
}
