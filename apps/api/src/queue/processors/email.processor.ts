import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import * as Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES } from '../queue.constants';

export interface SendEmailJob {
  to: string | string[];
  subject: string;
  template:
    | 'task-assigned'
    | 'task-approved'
    | 'task-rework'
    | 'password-reset'
    | 'welcome'
    | 'checklist-reminder'
    | 'fms-step-assigned'
    | 'daily-digest'
    | 'sla-breach'
    | 'approval-pending'
    | 'notification';
  data: Record<string, any>;
  tenantId?: string;
}

type EmailProvider = 'SMTP' | 'SENDGRID' | 'AWS_SES';

@Processor(QUEUES.EMAIL)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly smtpTransporter: nodemailer.Transporter;
  private readonly templateCache = new Map<string, Handlebars.TemplateDelegate>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.smtpTransporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
    Handlebars.registerHelper('json', (value: any) => JSON.stringify(value, null, 2));
  }

  @Process('send-email')
  async handleSendEmail(job: Job<SendEmailJob>) {
    const { to, subject, template, data, tenantId } = job.data;
    const recipient = Array.isArray(to) ? to.join(', ') : to;
    const html = this.renderTemplate(template, data);
    const provider = await this.resolveEmailProvider(tenantId);

    this.logger.log(`Sending email: ${template} to ${recipient} via ${provider.provider}`);

    try {
      if (provider.provider === 'SENDGRID') {
        await this.sendViaSendGrid(recipient, subject, html, provider.config);
      } else if (provider.provider === 'AWS_SES') {
        await this.sendViaSes(recipient, subject, html, provider.config);
      } else {
        await this.sendViaSmtp(recipient, subject, html, provider.config);
      }

      this.logger.log(`Email sent: ${template}`);
    } catch (error) {
      if (this.isNonRetryableEmailFailure(error)) {
        this.logger.warn(
          `Email job ${job.id} skipped: ${this.describeEmailFailure(error)}`,
        );
        return { skipped: true, reason: this.describeEmailFailure(error) };
      }

      throw error;
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Email job ${job.id} failed: ${err.message}`, err.stack);
  }

  private async resolveEmailProvider(tenantId?: string): Promise<{ provider: EmailProvider; config: Record<string, any> }> {
    const accounts = tenantId
      ? await this.prisma.integrationAccount.findMany({
          where: {
            tenantId,
            provider: { in: ['SENDGRID', 'AWS_SES'] },
            isEnabled: true,
          },
          orderBy: { updatedAt: 'desc' },
        })
      : [];

    const account = accounts[0];
    if (account) {
      return {
        provider: account.provider as EmailProvider,
        config: (account.config ?? {}) as Record<string, any>,
      };
    }

    const envProvider = String(this.configService.get('EMAIL_PROVIDER', 'smtp')).toLowerCase();
    if (envProvider === 'sendgrid') {
      return {
        provider: 'SENDGRID',
        config: {
          apiKey: this.configService.get<string>('SENDGRID_API_KEY'),
          from: this.configService.get<string>('SENDGRID_FROM') ?? this.configService.get<string>('EMAIL_FROM'),
        },
      };
    }

    if (envProvider === 'ses') {
      return {
        provider: 'AWS_SES',
        config: {
          region: this.configService.get<string>('AWS_SES_REGION'),
          accessKeyId: this.configService.get<string>('AWS_SES_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.get<string>('AWS_SES_SECRET_ACCESS_KEY'),
          from: this.configService.get<string>('AWS_SES_FROM') ?? this.configService.get<string>('EMAIL_FROM'),
        },
      };
    }

    return {
      provider: 'SMTP',
      config: {
        host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
        port: this.configService.get<number>('SMTP_PORT', 587),
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
        from: this.configService.get<string>('EMAIL_FROM'),
      },
    };
  }

  private renderTemplate(template: SendEmailJob['template'], data: Record<string, any>): string {
    const templates: Record<SendEmailJob['template'], string> = {
      'task-assigned': `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>New Task Assigned</h2>
          <p>Hi {{assigneeName}}, you have been assigned: <strong>{{taskTitle}}</strong></p>
          <p>Priority: {{priority}} | Due: {{dueDate}} | By: {{assignedBy}}</p>
          {{#if taskUrl}}<p><a href="{{taskUrl}}" style="background:#6366f1;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">View Task</a></p>{{/if}}
        </div>
      `,
      'task-approved': `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>Task Approved</h2>
          <p>Hi {{name}}, your task <strong>{{taskTitle}}</strong> has been approved.</p>
          {{#if remarks}}<p>Remarks: {{remarks}}</p>{{/if}}
        </div>
      `,
      'task-rework': `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>Task Sent for Rework</h2>
          <p>Hi {{name}}, your task <strong>{{taskTitle}}</strong> needs rework.</p>
          <p>Reason: {{remarks}}</p>
          {{#if taskUrl}}<p><a href="{{taskUrl}}">View Task</a></p>{{/if}}
        </div>
      `,
      'password-reset': `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>Password Reset Request</h2>
          <p>Hi {{name}}, click below to reset your password. Link expires in 1 hour.</p>
          <p><a href="{{resetUrl}}" style="background:#6366f1;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Reset Password</a></p>
        </div>
      `,
      'welcome': `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>Welcome to TaskEasy</h2>
          <p>Hi {{name}}, your account has been created. Login: {{email}}</p>
          {{#if loginUrl}}<p><a href="{{loginUrl}}">Login Now</a></p>{{/if}}
        </div>
      `,
      'checklist-reminder': `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>Checklist Reminder</h2>
          <p>Hi {{name}}, you have {{pendingCount}} pending checklist item(s).</p>
        </div>
      `,
      'fms-step-assigned': `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>FMS Step Assigned</h2>
          <p>Hi {{name}}, step <strong>{{stepName}}</strong> is waiting for you.</p>
        </div>
      `,
      'daily-digest': `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>Your Daily TaskEasy Summary</h2>
          <p>Hi {{name}},</p>
          <ul>
            <li>Pending: {{pendingTasks}}</li>
            <li>Due Today: {{dueToday}}</li>
            <li>Overdue: {{overdue}}</li>
            <li>Pending Approvals: {{pendingApprovals}}</li>
          </ul>
        </div>
      `,
      'sla-breach': `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>SLA Breached</h2>
          <p>Task <strong>{{taskTitle}}</strong> assigned to {{assigneeName}} has breached SLA by {{delayDays}} day(s).</p>
        </div>
      `,
      'approval-pending': `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>Approval Pending</h2>
          <p>Hi {{name}}, you have a pending approval for <strong>{{taskTitle}}</strong>.</p>
          {{#if taskUrl}}<p><a href="{{taskUrl}}">Review Now</a></p>{{/if}}
        </div>
      `,
      'notification': `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>TaskEasy Notification</h2>
          <p>Hi {{recipientName}},</p>
          <div style="padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc">
            <h3 style="margin:0 0 8px">{{title}}</h3>
            <p style="margin:0 0 12px">{{body}}</p>
            {{#if taskUrl}}
              <p style="margin:0"><a href="{{taskUrl}}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open Task</a></p>
            {{else}}
              {{#if notificationUrl}}
                <p style="margin:0"><a href="{{notificationUrl}}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open TaskEasy</a></p>
              {{/if}}
            {{/if}}
          </div>
        </div>
      `,
    };

    const templateSource = templates[template];
    if (!templateSource) {
      this.logger.error(`Unknown email template: ${template}`);
      return '<p>An internal notification was triggered.</p>';
    }
    return this.compileTemplate(template)(templateSource, data);
  }

  private compileTemplate(key: string) {
    return (source: string, data: Record<string, any>) => {
      const cacheKey = `${key}:${source}`;
      let fn = this.templateCache.get(cacheKey);
      if (!fn) {
        fn = Handlebars.compile(source);
        this.templateCache.set(cacheKey, fn);
      }
      return fn(data);
    };
  }

  private async sendViaSendGrid(to: string, subject: string, html: string, config: Record<string, any>) {
    const apiKey = this.pickValue(config.apiKey, this.configService.get<string>('SENDGRID_API_KEY'));
    if (!apiKey) throw new Error('SENDGRID_API_KEY is not configured');

    const fromRaw = this.pickValue(
      config.from,
      this.configService.get<string>('SENDGRID_FROM') ?? this.configService.get<string>('EMAIL_FROM') ?? 'no-reply@taskeasy.app',
    );

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: this.extractEmailAddress(fromRaw) },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SendGrid request failed (${response.status}): ${text}`);
    }
  }

  private async sendViaSes(to: string, subject: string, html: string, config: Record<string, any>) {
    const region = this.pickValue(config.region, this.configService.get<string>('AWS_SES_REGION'));
    const accessKeyId = this.pickValue(config.accessKeyId, this.configService.get<string>('AWS_SES_ACCESS_KEY_ID'));
    const secretAccessKey = this.pickValue(config.secretAccessKey, this.configService.get<string>('AWS_SES_SECRET_ACCESS_KEY'));
    const fromRaw = this.pickValue(config.from, this.configService.get<string>('AWS_SES_FROM') ?? this.configService.get<string>('EMAIL_FROM'));

    if (!region || !accessKeyId || !secretAccessKey || !fromRaw) throw new Error('AWS SES credentials not configured');

    const client = new SESClient({ region, credentials: { accessKeyId, secretAccessKey } });
    const response = await client.send(new SendEmailCommand({
      Source: this.extractEmailAddress(fromRaw),
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: html, Charset: 'UTF-8' } },
      },
    }));
    this.logger.debug(`SES message id: ${response.MessageId ?? 'unknown'}`);
  }

  private async sendViaSmtp(to: string, subject: string, html: string, config: Record<string, any>) {
    const transporter =
      config.host || config.port || config.user || config.pass
        ? nodemailer.createTransport({
            host: this.pickValue(config.host, this.configService.get('SMTP_HOST', 'smtp.gmail.com')),
            port: this.pickValue(config.port, this.configService.get<number>('SMTP_PORT', 587)),
            auth: {
              user: this.pickValue(config.user, this.configService.get('SMTP_USER')),
              pass: this.pickValue(config.pass, this.configService.get('SMTP_PASS')),
            },
          })
        : this.smtpTransporter;

    await transporter.sendMail({
      from: `"${this.configService.get('EMAIL_FROM_NAME', 'TaskEasy')}" <${this.pickValue(config.from, this.configService.get('EMAIL_FROM'))}>`,
      to,
      subject,
      html,
    });
  }

  private isNonRetryableEmailFailure(error: unknown) {
    const message = this.describeEmailFailure(error).toLowerCase();
    const code = this.getEmailErrorCode(error).toUpperCase();

    return (
      code === 'EAUTH' ||
      code === '535' ||
      message.includes('invalid login') ||
      message.includes('authentication failed') ||
      message.includes('smtp credentials are not configured') ||
      message.includes('sendgrid api key is not configured') ||
      message.includes('aws ses credentials not configured')
    );
  }

  private describeEmailFailure(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Unknown email failure';
  }

  private getEmailErrorCode(error: unknown) {
    if (!error || typeof error !== 'object') {
      return '';
    }

    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : '';
  }

  private pickValue<T>(value: T | '' | null | undefined, fallback: T) {
    return value === '' || value === undefined || value === null ? fallback : value;
  }

  private extractEmailAddress(value: string) {
    if (!value.includes('<')) return value;
    return value.split('<').pop()!.replace('>', '').trim();
  }
}
