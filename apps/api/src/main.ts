import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  const allowedOrigins = Array.from(
    new Set(
      [
        ...frontendUrl.split(',').map((origin) => origin.trim()),
        'http://localhost:3000',
        'https://taskeasy-web.onrender.com',
      ].filter(Boolean),
    ),
  );

  // ── Security ──────────────────────────────────────────────
  app.use(helmet());
  app.use(compression());
  // Without this, req.cookies is always undefined — both auth.controller's
  // and platform-auth.controller's refresh()/logout() read
  // req.cookies?.refreshToken / req.cookies?.platformRefreshToken to rotate
  // the long-lived refresh token, so silent token refresh always failed
  // with "Refresh token required" and the frontend force-logged the user
  // out the moment the 15-min access token expired (showed as "session/token
  // expired", most noticeably on the platform admin panel which polls more).
  app.use(cookieParser());

  // ── CORS ──────────────────────────────────────────────────
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'x-skip-auth-refresh'],
  });

  // ── Health check (before global prefix so it stays at /health) ────────────
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── API Versioning + Global prefix ────────────────────────
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api');

  // ── Global Pipes ──────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global Filters & Interceptors ─────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── Swagger ───────────────────────────────────────────────
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TaskEasy API')
      .setDescription('Super Advanced SaaS Workflow Management Platform')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('auth', 'Authentication')
      .addTag('users', 'User Management')
      .addTag('tenants', 'Tenant Settings')
      .addTag('projects', 'Project Management')
      .addTag('hierarchy', 'Team Hierarchy')
      .addTag('delegation', 'Delegation Tasks')
      .addTag('work-request', 'Work Requests')
      .addTag('checklist', 'Checklists')
      .addTag('fms', 'FMS Workflows')
      .addTag('approval', 'Approvals')
      .addTag('mis', 'MIS Performance')
      .addTag('reports', 'Reports')
      .addTag('platform-auth', 'Platform Console Authentication')
      .addTag('platform', 'Platform Admin Console')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 TaskEasy API running on http://0.0.0.0:${port}/api`);
  console.log(`💚 Health check:  http://0.0.0.0:${port}/health`);
  console.log(`📚 Swagger docs:  http://0.0.0.0:${port}/docs`);
}

bootstrap();
