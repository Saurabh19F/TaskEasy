import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { TenantGuard } from './common/guards/tenant.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { IpWhitelistGuard } from './common/guards/ip-whitelist.guard';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { RolesModule } from './modules/roles/roles.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { HierarchyModule } from './modules/hierarchy/hierarchy.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DelegationModule } from './modules/delegation/delegation.module';
import { WorkRequestModule } from './modules/work-request/work-request.module';
import { ChecklistModule } from './modules/checklist/checklist.module';
import { FmsModule } from './modules/fms/fms.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { MisModule } from './modules/mis/mis.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { CommentsModule } from './modules/comments/comments.module';
import { AuditModule } from './modules/audit/audit.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { AutomationModule } from './modules/automation/automation.module';
import { AiModule } from './modules/ai/ai.module';
import { FormsModule } from './modules/forms/forms.module';
import { SearchModule } from './modules/search/search.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { KanbanModule } from './modules/kanban/kanban.module';
import { ClientPortalModule } from './modules/client-portal/client-portal.module';
import { VendorPortalModule } from './modules/vendor-portal/vendor-portal.module';
import { BulkImportModule } from './modules/bulk-import/bulk-import.module';
import { PlatformModule } from './modules/platform/platform.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { SecuritySettingsModule } from './modules/security-settings/security-settings.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), 'apps/api/.env')],
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 300),
          },
        ],
      }),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('REDIS_URL') ?? {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD') || undefined,
        },
      }),
    }),

    PrismaModule,
    RedisModule,
    QueueModule,

    AuthModule,
    UsersModule,
    TenantsModule,
    RolesModule,
    ProjectsModule,
    HierarchyModule,
    DashboardModule,
    DelegationModule,
    WorkRequestModule,
    ChecklistModule,
    FmsModule,
    ApprovalModule,
    MisModule,
    ReportsModule,
    NotificationsModule,
    UploadsModule,
    CommentsModule,
    AuditModule,
    WorkflowModule,
    AutomationModule,
    AiModule,
    FormsModule,
    SearchModule,
    CalendarModule,
    KanbanModule,
    ClientPortalModule,
    VendorPortalModule,
    BulkImportModule,
    PlatformModule,
    IntegrationsModule,
    SecuritySettingsModule,
    SubscriptionsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: IpWhitelistGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
