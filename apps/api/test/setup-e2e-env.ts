process.env.NODE_ENV = 'test';

// Force the e2e suite onto the local Docker services instead of the remote
// defaults in apps/api/.env.  This keeps the suite deterministic and avoids
// long connection hangs when the shared demo cluster is unreachable.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'mongodb://127.0.0.1:27017/taskeasy?replicaSet=rs0';
process.env.REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1';
process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6379';
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';
process.env.PORT = process.env.PORT ?? '5000';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-test-jwt-secret';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'e2e-test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'e2e-test-refresh-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
