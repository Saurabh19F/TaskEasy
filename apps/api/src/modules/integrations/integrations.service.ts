import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

type IntegrationProvider =
  | 'GOOGLE_CALENDAR'
  | 'GOOGLE_SHEETS'
  | 'GOOGLE_SSO'
  | 'MICROSOFT_SSO'
  | 'SENDGRID'
  | 'AWS_SES'
  | 'WHATSAPP';

type EntityType = 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS';
type TestProvider = 'SENDGRID' | 'AWS_SES' | 'WHATSAPP' | 'GOOGLE_CALENDAR' | 'GOOGLE_SHEETS';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  async listAccounts(tenantId: string) {
    const accounts = await this.db.integrationAccount.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });

    return accounts.map((account: any) => this.sanitizeAccount(account));
  }

  async upsertAccount(
    tenantId: string,
    provider: IntegrationProvider,
    config: Record<string, any>,
    isEnabled = true,
    createdBy?: string,
  ) {
    const existing = await this.db.integrationAccount.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });

    const mergedConfig = {
      ...(existing?.config ?? {}),
      ...config,
    };

    const account = await this.db.integrationAccount.upsert({
      where: { tenantId_provider: { tenantId, provider } },
      update: {
        isEnabled,
        config: mergedConfig,
        lastTestedAt: new Date(),
      },
      create: {
        tenantId,
        provider,
        isEnabled,
        config: mergedConfig,
        createdBy,
      },
    });

    return this.sanitizeAccount(account);
  }

  removeAccount(tenantId: string, provider: IntegrationProvider) {
    return Promise.all([
      this.db.integrationAccount.deleteMany({
        where: { tenantId, provider },
      }),
      this.db.externalSync.deleteMany({
        where: { tenantId, provider },
      }),
    ]);
  }

  async rotateAccountCredentials(tenantId: string, provider: IntegrationProvider) {
    const account = await this.getEnabledAccount(tenantId, provider);
    const rotatedConfig = this.buildRotatedConfig(provider, account.config ?? {});
    const updated = await this.db.integrationAccount.update({
      where: { tenantId_provider: { tenantId, provider } },
      data: {
        isEnabled: false,
        config: rotatedConfig,
        lastTestedAt: null,
        lastSyncedAt: null,
      },
    });

    if (provider === 'GOOGLE_CALENDAR') {
      await this.db.externalSync.updateMany({
        where: {
          tenantId,
          provider: 'GOOGLE_CALENDAR',
          entityType: { in: ['DELEGATION', 'WORK_REQUEST', 'CHECKLIST', 'FMS'] },
        },
        data: {
          status: 'ROTATED',
          lastError: 'Credentials rotated; re-sync required',
        },
      });
    }

    return this.sanitizeAccount(updated);
  }

  async testProvider(
    tenantId: string,
    provider: TestProvider,
    payload: { to?: string; subject?: string; message?: string; entityType?: EntityType },
  ) {
    switch (provider) {
      case 'SENDGRID':
      case 'AWS_SES':
        if (!payload.to) {
          throw new BadRequestException('Recipient email is required');
        }
        return this.sendTestEmail(tenantId, provider, payload.to, payload.subject, payload.message);
      case 'WHATSAPP':
        if (!payload.to) {
          throw new BadRequestException('Recipient phone number is required');
        }
        return this.sendTestWhatsApp(tenantId, payload.to, payload.message);
      case 'GOOGLE_CALENDAR':
        return this.testGoogleCalendarConnection(tenantId);
      case 'GOOGLE_SHEETS':
        return this.sendTestGoogleSheet(tenantId, payload.entityType ?? 'DELEGATION');
      default:
        throw new BadRequestException(`Unsupported provider: ${provider}`);
    }
  }

  async createGoogleCalendarWatch(
    tenantId: string,
    webhookUrl: string,
    createdBy?: string,
  ) {
    if (!webhookUrl) {
      throw new BadRequestException('Webhook URL is required');
    }

    const account = await this.getEnabledAccount(tenantId, 'GOOGLE_CALENDAR');
    const calendarId = account.config.calendarId ?? this.config.get<string>('GOOGLE_CALENDAR_ID');
    if (!calendarId) {
      throw new BadRequestException('Google Calendar ID is not configured');
    }

    const token = await this.getGoogleAccessToken(account.config, ['https://www.googleapis.com/auth/calendar']);
    const channelId = randomUUID();
    const webhookToken = account.config.webhookToken ?? randomUUID().replace(/-/g, '');

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: webhookToken,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(`Google Calendar watch failed (${response.status}): ${text}`);
    }

    const watch = await response.json() as any;
    const config = {
      ...(account.config ?? {}),
      calendarId,
      webhookUrl,
      webhookToken,
      watchChannelId: watch.id ?? channelId,
      watchResourceId: watch.resourceId ?? null,
      watchResourceUri: watch.resourceUri ?? null,
      watchExpiration: watch.expiration ? new Date(Number(watch.expiration)).toISOString() : null,
    };

    const saved = await this.db.integrationAccount.upsert({
      where: { tenantId_provider: { tenantId, provider: 'GOOGLE_CALENDAR' } },
      update: {
        config,
        isEnabled: true,
        lastSyncedAt: new Date(),
      },
      create: {
        tenantId,
        provider: 'GOOGLE_CALENDAR',
        isEnabled: true,
        config,
        createdBy,
      },
    });

    return {
      account: this.sanitizeAccount(saved),
      watch: {
        channelId: config.watchChannelId,
        resourceId: config.watchResourceId,
        resourceUri: config.watchResourceUri,
        expiresAt: config.watchExpiration,
      },
    };
  }

  private async sendTestEmail(
    tenantId: string,
    provider: 'SENDGRID' | 'AWS_SES',
    to: string,
    subject?: string,
    message?: string,
  ) {
    const account = await this.getEnabledAccount(tenantId, provider);
    const body = message?.trim() || 'This is a TaskEasy integration test email.';
    const html = this.buildNotificationHtml('TaskEasy integration test', body, 'Open TaskEasy');

    if (provider === 'SENDGRID') {
      await this.sendEmailViaSendGrid(
        to,
        subject ?? 'TaskEasy integration test',
        html,
        account.config as Record<string, any>,
      );
    } else {
      await this.sendEmailViaSes(
        to,
        subject ?? 'TaskEasy integration test',
        html,
        account.config as Record<string, any>,
      );
    }

    await this.markAccountTested(tenantId, provider);
    return {
      provider,
      message: `Test email sent via ${provider}`,
    };
  }

  private async sendTestWhatsApp(tenantId: string, to: string, message?: string) {
    const account = await this.getEnabledAccount(tenantId, 'WHATSAPP');
    const config = account.config as Record<string, any>;
    const accessToken = this.pickValue(config.accessToken, this.config.get<string>('WHATSAPP_ACCESS_TOKEN'));
    const phoneNumberId = this.pickValue(config.phoneNumberId, this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID'));
    const graphApiVersion = this.pickValue(config.graphApiVersion, this.config.get<string>('WHATSAPP_GRAPH_API_VERSION', 'v20.0'));

    if (!accessToken || !phoneNumberId) {
      throw new BadRequestException('WhatsApp credentials are not configured');
    }

    const response = await fetch(
      `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to.replace(/[^\d]/g, ''),
          type: 'text',
          text: {
            body: message?.trim() || 'This is a TaskEasy integration test WhatsApp message.',
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(`WhatsApp test failed (${response.status}): ${text}`);
    }

    await this.markAccountTested(tenantId, 'WHATSAPP');
    return {
      provider: 'WHATSAPP',
      message: 'Test WhatsApp message sent',
    };
  }

  private async testGoogleCalendarConnection(tenantId: string) {
    const account = await this.getEnabledAccount(tenantId, 'GOOGLE_CALENDAR');
    const calendarId = account.config.calendarId ?? this.config.get<string>('GOOGLE_CALENDAR_ID');
    if (!calendarId) {
      throw new BadRequestException('Google Calendar ID is not configured');
    }

    const token = await this.getGoogleAccessToken(account.config, ['https://www.googleapis.com/auth/calendar.readonly']);
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(`Google Calendar test failed (${response.status}): ${text}`);
    }

    const calendar = await response.json() as any;
    await this.markAccountTested(tenantId, 'GOOGLE_CALENDAR');
    return {
      provider: 'GOOGLE_CALENDAR',
      message: 'Google Calendar connection verified',
      calendar: {
        id: calendar.id,
        summary: calendar.summary,
        timeZone: calendar.timeZone,
      },
    };
  }

  private async sendTestGoogleSheet(tenantId: string, entityType: EntityType) {
    const account = await this.getEnabledAccount(tenantId, 'GOOGLE_SHEETS');
    const token = await this.getGoogleAccessToken(account.config, ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']);
    const title = `TaskEasy Integration Test - ${new Date().toISOString().slice(0, 10)}`;
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: { title } }),
    });

    if (!createResponse.ok) {
      const text = await createResponse.text();
      throw new BadRequestException(`Google Sheets test failed (${createResponse.status}): ${text}`);
    }

    const spreadsheet = await createResponse.json() as any;
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheet.spreadsheetId)}/values/A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [
            ['Provider', 'Status', 'Timestamp'],
            [entityType, 'OK', new Date().toISOString()],
          ],
        }),
      },
    );

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}`;
    await this.db.externalSync.upsert({
      where: {
        tenantId_provider_entityType_entityId: {
          tenantId,
          provider: 'GOOGLE_SHEETS',
          entityType: 'REPORT',
          entityId: 'integration-test',
        },
      },
      update: {
        externalId: spreadsheet.spreadsheetId,
        externalUrl: url,
        payload: { title, entityType },
        status: 'ACTIVE',
        lastError: null,
        lastSyncedAt: new Date(),
      },
      create: {
        tenantId,
        provider: 'GOOGLE_SHEETS',
        entityType: 'REPORT',
        entityId: 'integration-test',
        externalId: spreadsheet.spreadsheetId,
        externalUrl: url,
        payload: { title, entityType },
        status: 'ACTIVE',
        lastSyncedAt: new Date(),
      },
    });

    await this.markAccountTested(tenantId, 'GOOGLE_SHEETS');
    return {
      provider: 'GOOGLE_SHEETS',
      message: 'Google Sheets test export created',
      spreadsheetId: spreadsheet.spreadsheetId,
      url,
    };
  }

  async handleGoogleCalendarWebhook(headers: Record<string, any>) {
    const channelId = String(headers['x-goog-channel-id'] ?? headers['X-Goog-Channel-Id'] ?? '').trim();
    const channelToken = String(headers['x-goog-channel-token'] ?? headers['X-Goog-Channel-Token'] ?? '').trim();
    const resourceId = String(headers['x-goog-resource-id'] ?? headers['X-Goog-Resource-Id'] ?? '').trim();
    const resourceState = String(headers['x-goog-resource-state'] ?? headers['X-Goog-Resource-State'] ?? '').trim();

    const accounts = await this.db.integrationAccount.findMany({
      where: {
        provider: 'GOOGLE_CALENDAR',
        isEnabled: true,
      },
    });

    const matched = accounts.filter((account: any) => {
      const config = (account.config ?? {}) as Record<string, any>;
      const matchesChannel = channelId && config.watchChannelId === channelId;
      const matchesResource = resourceId && config.watchResourceId === resourceId;
      const tokenMatches = !config.webhookToken || !channelToken || config.webhookToken === channelToken;
      return (matchesChannel || matchesResource) && tokenMatches;
    });

    if (!matched.length) {
      this.logger.warn(`Google Calendar webhook ignored: no matching channel (${channelId || 'n/a'})`);
      return { matched: 0, reconciled: 0, resourceState };
    }

    let reconciled = 0;
    for (const account of matched) {
      try {
        reconciled += await this.reconcileGoogleCalendarAccount(account);
      } catch (error: any) {
        this.logger.warn(`Google Calendar webhook reconcile failed for tenant ${account.tenantId}: ${error?.message ?? error}`);
      }
    }

    await Promise.all(
      matched.map((account: any) =>
        this.db.integrationAccount.update({
          where: { tenantId_provider: { tenantId: account.tenantId, provider: 'GOOGLE_CALENDAR' } },
          data: {
            lastSyncedAt: new Date(),
            config: {
              ...(account.config ?? {}),
              lastWebhookState: resourceState || null,
              lastWebhookAt: new Date().toISOString(),
            },
          },
        }),
      ),
    );

    return {
      matched: matched.length,
      reconciled,
      resourceState,
      channelId: channelId || null,
      resourceId: resourceId || null,
    };
  }

  async syncEntityToGoogleCalendar(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
  ) {
    const account = await this.getEnabledAccount(tenantId, 'GOOGLE_CALENDAR');
    const calendarId = account.config.calendarId ?? this.config.get<string>('GOOGLE_CALENDAR_ID');
    if (!calendarId) {
      throw new BadRequestException('Google Calendar ID is not configured');
    }

    const entity = await this.loadEntity(tenantId, entityType, entityId);
    const token = await this.getGoogleAccessToken(account.config, ['https://www.googleapis.com/auth/calendar']);
    const externalSync = await this.db.externalSync.findUnique({
      where: {
        tenantId_provider_entityType_entityId: {
          tenantId,
          provider: 'GOOGLE_CALENDAR',
          entityType,
          entityId,
        },
      },
    });

    const event = this.buildCalendarEvent(entityType, entity);
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const isUpdate = Boolean(externalSync?.externalId);
    const url = isUpdate ? `${baseUrl}/${encodeURIComponent(externalSync!.externalId!)}` : baseUrl;
    const method = isUpdate ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(`Google Calendar sync failed (${response.status}): ${text}`);
    }

    const saved = await response.json() as any;
    await this.db.externalSync.upsert({
      where: {
        tenantId_provider_entityType_entityId: {
          tenantId,
          provider: 'GOOGLE_CALENDAR',
          entityType,
          entityId,
        },
      },
      update: {
        externalId: saved.id,
        externalUrl: saved.htmlLink ?? null,
        payload: event,
        status: 'ACTIVE',
        lastError: null,
        lastSyncedAt: new Date(),
      },
      create: {
        tenantId,
        provider: 'GOOGLE_CALENDAR',
        entityType,
        entityId,
        externalId: saved.id,
        externalUrl: saved.htmlLink ?? null,
        payload: event,
        status: 'ACTIVE',
        lastSyncedAt: new Date(),
      },
    });

    return {
      externalId: saved.id,
      externalUrl: saved.htmlLink ?? null,
      summary: event.summary,
      status: 'synced',
    };
  }

  async exportEntityToGoogleSheets(
    tenantId: string,
    entityType: EntityType,
  ) {
    const account = await this.getEnabledAccount(tenantId, 'GOOGLE_SHEETS');
    const token = await this.getGoogleAccessToken(account.config, ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']);
    const rows = await this.buildSheetRows(tenantId, entityType);
    const title = `${entityType.replace(/_/g, ' ')} Export - ${new Date().toISOString().slice(0, 10)}`;

    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: { title } }),
    });

    if (!createResponse.ok) {
      const text = await createResponse.text();
      throw new BadRequestException(`Google Sheets create failed (${createResponse.status}): ${text}`);
    }

    const spreadsheet = await createResponse.json() as any;
    const valuesResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheet.spreadsheetId)}/values/A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rows.headers, ...rows.rows],
        }),
      },
    );

    if (!valuesResponse.ok) {
      const text = await valuesResponse.text();
      throw new BadRequestException(`Google Sheets write failed (${valuesResponse.status}): ${text}`);
    }

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}`;
    await this.db.externalSync.upsert({
      where: {
        tenantId_provider_entityType_entityId: {
          tenantId,
          provider: 'GOOGLE_SHEETS',
          entityType,
          entityId: `${entityType}-export`,
        },
      },
      update: {
        externalId: spreadsheet.spreadsheetId,
        externalUrl: url,
        payload: { title, entityType },
        status: 'ACTIVE',
        lastError: null,
        lastSyncedAt: new Date(),
      },
      create: {
        tenantId,
        provider: 'GOOGLE_SHEETS',
        entityType,
        entityId: `${entityType}-export`,
        externalId: spreadsheet.spreadsheetId,
        externalUrl: url,
        payload: { title, entityType },
        status: 'ACTIVE',
        lastSyncedAt: new Date(),
      },
    });

    return { spreadsheetId: spreadsheet.spreadsheetId, url, rowCount: rows.rows.length };
  }

  private async getEnabledAccount(tenantId: string, provider: IntegrationProvider) {
    const account = await this.db.integrationAccount.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });

    if (!account || !account.isEnabled) {
      throw new NotFoundException(`${provider} integration is not configured for this tenant`);
    }

    return account;
  }

  private sanitizeAccount(account: any) {
    const config = this.sanitizeConfig(account?.config ?? {});
    return {
      ...account,
      config,
    };
  }

  private sanitizeConfig(config: Record<string, any>) {
    const {
      accessToken,
      refreshToken,
      clientSecret,
      privateKey,
      apiKey,
      secret,
      secretAccessKey,
      smtpPass,
      webhookToken,
      ...rest
    } = config ?? {};

    return {
      ...rest,
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(refreshToken),
      hasClientSecret: Boolean(clientSecret),
      hasPrivateKey: Boolean(privateKey),
      hasApiKey: Boolean(apiKey ?? secret),
      hasSecretAccessKey: Boolean(secretAccessKey),
      hasSmtpPassword: Boolean(smtpPass),
      hasWebhookToken: Boolean(webhookToken),
    };
  }

  private buildRotatedConfig(provider: IntegrationProvider, config: Record<string, any>) {
    switch (provider) {
      case 'SENDGRID':
        return {
          from: config.from ?? null,
        };
      case 'AWS_SES':
        return {
          region: config.region ?? null,
          from: config.from ?? null,
        };
      case 'WHATSAPP':
        return {
          phoneNumberId: config.phoneNumberId ?? null,
          businessAccountId: config.businessAccountId ?? null,
          graphApiVersion: config.graphApiVersion ?? 'v20.0',
        };
      case 'GOOGLE_CALENDAR':
        return {
          calendarId: config.calendarId ?? null,
          clientId: config.clientId ?? null,
          serviceAccountEmail: config.serviceAccountEmail ?? null,
          webhookUrl: config.webhookUrl ?? null,
        };
      case 'GOOGLE_SHEETS':
        return {
          folderId: config.folderId ?? null,
          clientId: config.clientId ?? null,
          serviceAccountEmail: config.serviceAccountEmail ?? null,
        };
      case 'GOOGLE_SSO':
        return {
          clientId: config.clientId ?? null,
          redirectUri: config.redirectUri ?? null,
        };
      case 'MICROSOFT_SSO':
        return {
          clientId: config.clientId ?? null,
          tenantId: config.tenantId ?? 'common',
          redirectUri: config.redirectUri ?? null,
        };
      default:
        return {};
    }
  }

  private async markAccountTested(tenantId: string, provider: IntegrationProvider) {
    await this.db.integrationAccount.update({
      where: { tenantId_provider: { tenantId, provider } },
      data: { lastTestedAt: new Date() },
    });
  }

  private buildNotificationHtml(title: string, body: string, actionLabel?: string) {
    return `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin:0 0 12px">${title}</h2>
        <div style="padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc">
          <p style="margin:0 0 12px">${body}</p>
          ${actionLabel ? `<p style="margin:0"><span style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${actionLabel}</span></p>` : ''}
        </div>
      </div>
    `;
  }

  private async sendEmailViaSendGrid(to: string, subject: string, html: string, config: Record<string, any>) {
    const apiKey = this.pickValue(config.apiKey, this.config.get<string>('SENDGRID_API_KEY'));
    if (!apiKey) {
      throw new BadRequestException('SendGrid API key is not configured');
    }

    const fromRaw = this.pickValue(
      config.from,
      this.config.get<string>('SENDGRID_FROM') ?? this.config.get<string>('EMAIL_FROM') ?? 'no-reply@taskeasy.app',
    );
    const fromEmail = this.extractEmailAddress(fromRaw);

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(`SendGrid test failed (${response.status}): ${text}`);
    }
  }

  private async sendEmailViaSes(to: string, subject: string, html: string, config: Record<string, any>) {
    const region = this.pickValue(config.region, this.config.get<string>('AWS_SES_REGION'));
    const accessKeyId = this.pickValue(config.accessKeyId, this.config.get<string>('AWS_SES_ACCESS_KEY_ID'));
    const secretAccessKey = this.pickValue(config.secretAccessKey, this.config.get<string>('AWS_SES_SECRET_ACCESS_KEY'));
    const fromRaw = this.pickValue(config.from, this.config.get<string>('AWS_SES_FROM') ?? this.config.get<string>('EMAIL_FROM'));

    if (!region || !accessKeyId || !secretAccessKey || !fromRaw) {
      throw new BadRequestException('AWS SES credentials are not configured');
    }

    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
    const client = new SESClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    await client.send(
      new SendEmailCommand({
        Source: this.extractEmailAddress(fromRaw),
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Html: { Data: html, Charset: 'UTF-8' } },
        },
      }),
    );
  }

  private pickValue<T>(value: T | '' | null | undefined, fallback: T) {
    return value === '' || value === undefined || value === null ? fallback : value;
  }

  private extractEmailAddress(value: string) {
    if (!value.includes('<')) {
      return value;
    }

    return value.split('<').pop()!.replace('>', '').trim();
  }

  private async reconcileGoogleCalendarAccount(account: any) {
    const calendarId = account.config.calendarId ?? this.config.get<string>('GOOGLE_CALENDAR_ID');
    if (!calendarId) {
      throw new BadRequestException('Google Calendar ID is not configured');
    }

    const token = await this.getGoogleAccessToken(account.config, ['https://www.googleapis.com/auth/calendar']);
    const syncs = await this.db.externalSync.findMany({
      where: {
        tenantId: account.tenantId,
        provider: 'GOOGLE_CALENDAR',
        status: 'ACTIVE',
        externalId: { not: null },
      },
    });

    let reconciled = 0;
    for (const sync of syncs) {
      const externalId = sync.externalId as string | null;
      if (!externalId) continue;

      const event = await this.fetchGoogleCalendarEvent(token, calendarId, externalId);
      if (!event) {
        await this.db.externalSync.update({
          where: {
            tenantId_provider_entityType_entityId: {
              tenantId: sync.tenantId,
              provider: sync.provider,
              entityType: sync.entityType,
              entityId: sync.entityId,
            },
          },
          data: {
            status: 'MISSING',
            lastError: 'Calendar event was deleted remotely',
            lastSyncedAt: new Date(),
          },
        });
        continue;
      }

      await this.applyGoogleCalendarEventToEntity(sync.tenantId, sync.entityType as EntityType, sync.entityId, event);
      await this.db.externalSync.update({
        where: {
          tenantId_provider_entityType_entityId: {
            tenantId: sync.tenantId,
            provider: sync.provider,
            entityType: sync.entityType,
            entityId: sync.entityId,
          },
        },
        data: {
          status: 'ACTIVE',
          lastError: null,
          payload: event,
          lastSyncedAt: new Date(),
        },
      });
      reconciled += 1;
    }

    await this.db.integrationAccount.update({
      where: { tenantId_provider: { tenantId: account.tenantId, provider: 'GOOGLE_CALENDAR' } },
      data: { lastSyncedAt: new Date() },
    });

    return reconciled;
  }

  private async fetchGoogleCalendarEvent(token: string, calendarId: string, eventId: string) {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(`Google Calendar fetch failed (${response.status}): ${text}`);
    }

    return response.json();
  }

  private async applyGoogleCalendarEventToEntity(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    event: any,
  ) {
    const start = this.parseGoogleCalendarStart(event?.start);
    if (!start) {
      return;
    }

    switch (entityType) {
      case 'DELEGATION':
        await this.db.delegationTask.updateMany({
          where: { tenantId, id: entityId },
          data: {
            targetDate: start.date,
            ...(start.time ? { targetTime: start.time } : {}),
          },
        });
        break;
      case 'WORK_REQUEST':
        await this.db.workRequest.updateMany({
          where: { tenantId, id: entityId },
          data: {
            deadlineDate: start.date,
            ...(start.time ? { deadlineTime: start.time } : {}),
          },
        });
        break;
      case 'CHECKLIST':
        await this.db.checklistTask.updateMany({
          where: { tenantId, id: entityId },
          data: {
            plannedDate: start.date,
            ...(start.time ? { plannedTime: start.time } : {}),
          },
        });
        break;
      case 'FMS':
        await this.db.fmsTask.updateMany({
          where: { tenantId, id: entityId },
          data: {
            plannedDate: start.date,
          },
        });
        break;
      default:
        break;
    }
  }

  private parseGoogleCalendarStart(start: any): { date: Date; time?: string } | null {
    if (!start) {
      return null;
    }

    if (start.dateTime) {
      const date = new Date(start.dateTime);
      return {
        date,
        time: this.formatTime(date),
      };
    }

    if (start.date) {
      const date = new Date(`${start.date}T00:00:00.000Z`);
      return { date };
    }

    return null;
  }

  private formatTime(date: Date) {
    return [
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
    ].join(':');
  }

  private async loadEntity(tenantId: string, entityType: EntityType, entityId: string) {
    switch (entityType) {
      case 'DELEGATION':
        return this.db.delegationTask.findFirst({
          where: { tenantId, id: entityId },
          include: { delegatedBy: { select: { name: true, email: true } }, delegatedTo: { select: { name: true, email: true } }, project: { select: { name: true } } },
        });
      case 'WORK_REQUEST':
        return this.db.workRequest.findFirst({
          where: { tenantId, id: entityId },
          include: { requestedBy: { select: { name: true, email: true } }, requestFor: { select: { name: true, email: true } }, project: { select: { name: true } } },
        });
      case 'CHECKLIST':
        return this.db.checklistTask.findFirst({
          where: { tenantId, id: entityId },
          include: { assignedTo: { select: { name: true, email: true } }, project: { select: { name: true } } },
        });
      case 'FMS':
        return this.db.fmsTask.findFirst({
          where: { tenantId, id: entityId },
        });
    }
  }

  private buildCalendarEvent(entityType: EntityType, entity: any) {
    if (!entity) {
      throw new NotFoundException('Entity not found');
    }

    const summaryMap: Record<EntityType, string> = {
      DELEGATION: `TaskEasy Delegation: ${entity.title}`,
      WORK_REQUEST: `TaskEasy Work Request: ${entity.title ?? entity.description?.slice(0, 40) ?? 'Work Request'}`,
      CHECKLIST: `TaskEasy Checklist: ${entity.title}`,
      FMS: `TaskEasy FMS: ${entity.stepName ?? entity.fmsName ?? 'FMS Task'}`,
    };

    const dueDate = entity.targetDate ?? entity.deadlineDate ?? entity.plannedDate ?? entity.actualDate ?? new Date();
    const endDate = new Date(new Date(dueDate).getTime() + 30 * 60 * 1000);
    const descriptionParts = [
      `Entity Type: ${entityType}`,
      entity.project?.name ? `Project: ${entity.project.name}` : '',
      entity.delegatedTo?.name ? `Assignee: ${entity.delegatedTo.name}` : entity.requestFor?.name ? `Assignee: ${entity.requestFor.name}` : entity.assignedTo?.name ? `Assignee: ${entity.assignedTo.name}` : '',
      entity.status ? `Status: ${entity.status}` : '',
    ].filter(Boolean);

    return {
      summary: summaryMap[entityType],
      description: descriptionParts.join('\n'),
      start: { dateTime: new Date(dueDate).toISOString() },
      end: { dateTime: endDate.toISOString() },
      extendedProperties: {
        private: {
          tenantId: entity.tenantId,
          entityType,
          entityId: entity.id,
        },
      },
    };
  }

  private async buildSheetRows(tenantId: string, entityType: EntityType) {
    switch (entityType) {
      case 'DELEGATION': {
        const rows = await this.db.delegationTask.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          include: {
            delegatedBy: { select: { name: true } },
            delegatedTo: { select: { name: true } },
            project: { select: { name: true } },
          },
        });
        return {
          headers: ['Task ID', 'Title', 'Delegated By', 'Delegated To', 'Project', 'Target Date', 'Status', 'Priority'],
          rows: rows.map((row) => [
            row.taskId,
            row.title,
            row.delegatedBy?.name ?? '',
            row.delegatedTo?.name ?? '',
            row.project?.name ?? '',
            row.targetDate?.toISOString() ?? '',
            row.status,
            row.priority,
          ]),
        };
      }
      case 'WORK_REQUEST': {
        const rows = await this.db.workRequest.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          include: {
            requestedBy: { select: { name: true } },
            requestFor: { select: { name: true } },
            project: { select: { name: true } },
          },
        });
        return {
          headers: ['Request ID', 'Description', 'Requested By', 'Requested For', 'Project', 'Deadline', 'Status', 'Priority'],
          rows: rows.map((row) => [
            row.requestId,
            row.description,
            row.requestedBy?.name ?? '',
            row.requestFor?.name ?? '',
            row.project?.name ?? '',
            row.deadlineDate?.toISOString() ?? '',
            row.status,
            row.priority,
          ]),
        };
      }
      case 'CHECKLIST': {
        const rows = await this.db.checklistTask.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          include: {
            assignedTo: { select: { name: true } },
            project: { select: { name: true } },
          },
        });
        return {
          headers: ['Task ID', 'Title', 'Assigned To', 'Project', 'Planned Date', 'Status', 'On Time Status'],
          rows: rows.map((row) => [
            row.taskId,
            row.title,
            row.assignedTo?.name ?? '',
            row.project?.name ?? '',
            row.plannedDate?.toISOString() ?? '',
            row.status,
            row.onTimeStatus ?? '',
          ]),
        };
      }
      case 'FMS': {
        const rows = await this.db.fmsTask.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
        });
        return {
          headers: ['Task ID', 'Step', 'Workflow', 'Planned Date', 'Actual Date', 'Status', 'On Time Status'],
          rows: rows.map((row) => [
            row.fmsTaskId,
            row.stepName,
            row.fmsName,
            row.plannedDate?.toISOString() ?? '',
            row.actualDate?.toISOString() ?? '',
            row.status,
            row.onTimeStatus ?? '',
          ]),
        };
      }
    }
  }

  private async getGoogleAccessToken(config: Record<string, any>, scopes: string[]): Promise<string> {
    if (config.accessToken) {
      return String(config.accessToken);
    }

    const clientId = config.clientId ?? this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = config.clientSecret ?? this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET');
    const refreshToken = config.refreshToken;
    const serviceAccountEmail = config.serviceAccountEmail ?? this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey = (config.privateKey ?? this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'))?.replace(/\\n/g, '\n');

    if (refreshToken && clientId && clientSecret) {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          scope: scopes.join(' '),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new BadRequestException(`Google refresh failed (${response.status}): ${text}`);
      }
      const json = await response.json() as any;
      return json.access_token;
    }

    if (serviceAccountEmail && privateKey) {
      const now = Math.floor(Date.now() / 1000);
      const header = this.base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const payload = this.base64Url(JSON.stringify({
        iss: serviceAccountEmail,
        scope: scopes.join(' '),
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }));
      const signer = await import('crypto');
      const sign = signer.createSign('RSA-SHA256');
      sign.update(`${header}.${payload}`);
      sign.end();
      const signature = this.base64Url(sign.sign(privateKey));
      const assertion = `${header}.${payload}.${signature}`;

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new BadRequestException(`Google service account auth failed (${response.status}): ${text}`);
      }
      const json = await response.json() as any;
      return json.access_token;
    }

    throw new BadRequestException('Google credentials are not configured');
  }

  private base64Url(input: string | Buffer) {
    return Buffer.from(input).toString('base64url');
  }
}
