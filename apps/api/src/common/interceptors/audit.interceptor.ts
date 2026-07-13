import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

const METHOD_TO_ACTION: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

const WRITE_METHODS = new Set(Object.keys(METHOD_TO_ACTION));

function moduleFromPath(path: string): string {
  // main.ts sets a global 'api' prefix, so every real request path looks
  // like /api/users/123 — segment[0] is always 'api', not the resource.
  // Without stripping it, this function always returned the AUDIT fallback.
  const segments = path.split('/').filter(Boolean);
  if (segments[0]?.toLowerCase() === 'api') segments.shift();
  const segment = segments[0]?.toUpperCase() ?? 'AUDIT';
  const MODULE_MAP: Record<string, string> = {
    AUTH: 'AUTH',
    USERS: 'USERS',
    PROJECTS: 'PROJECTS',
    HIERARCHY: 'HIERARCHY',
    DELEGATION: 'DELEGATION',
    'WORK-REQUESTS': 'WORK_REQUEST',
    CHECKLIST: 'CHECKLIST',
    FMS: 'FMS',
    WORKFLOWS: 'WORKFLOW',
    APPROVALS: 'APPROVAL',
    MIS: 'MIS',
    REPORTS: 'REPORTS',
    AUTOMATION: 'AUTOMATION',
    SETTINGS: 'SETTINGS',
    // The company settings UI calls /tenants/me/settings, /tenants/me/holidays,
    // etc. — there is no literal "/settings" route, so without this mapping
    // every settings change was mislabeled under the AUDIT fallback module.
    TENANTS: 'SETTINGS',
    AUDIT: 'AUDIT',
  };
  return MODULE_MAP[segment] ?? 'AUDIT';
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (!WRITE_METHODS.has(req.method)) return next.handle();

    const user = req.user;
    if (!user?.tenantId) return next.handle();

    return next.handle().pipe(
      tap(async () => {
        try {
          const secSettings = await this.prisma.securitySettings.findUnique({
            where: { tenantId: user.tenantId },
            select: { auditLogsEnabled: true },
          });
          if (secSettings && !secSettings.auditLogsEnabled) return;

          const action = METHOD_TO_ACTION[req.method];
          const module = moduleFromPath(req.path);
          const description = `${action} on ${req.path}`;

          await this.prisma.auditLog.create({
            data: {
              tenantId: user.tenantId,
              actorId: user.sub,
              action: action as any,
              module: module as any,
              description,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            },
          });
        } catch (err) {
          // TS-04 fix: never swallow audit failures silently — log so ops can detect missing audit data
          this.logger.error(`Audit log write failed: ${(err as Error).message}`, (err as Error).stack);
        }
      }),
    );
  }
}
