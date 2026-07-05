import { SetMetadata } from '@nestjs/common';

export const SKIP_JWT_KEY = 'skipJwtGuard';

/**
 * Marks a controller/route so the global JwtAuthGuard skips JWT validation.
 * Use on platform controllers that authenticate via PlatformJwtAuthGuard instead.
 */
export const SkipJwtGuard = () => SetMetadata(SKIP_JWT_KEY, true);
