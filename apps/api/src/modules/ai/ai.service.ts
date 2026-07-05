import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES } from '../../queue/queue.constants';
import { DashboardService } from '../dashboard/dashboard.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

export interface AssistantChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private dashboardService: DashboardService,
    @InjectQueue(QUEUES.AI) private aiQueue: Queue,
  ) {}

  /**
   * Generates FMS workflow steps from a natural-language description.
   * Enqueues async job; returns a jobId to poll for results.
   */
  async generateWorkflow(
    name: string,
    intent: string,
    fields: string[],
    tenantId: string,
    userId: string,
  ): Promise<{ jobId: string }> {
    const job = await this.aiQueue.add('generate-workflow', {
      name,
      intent,
      fields,
      tenantId,
      userId,
    });
    return { jobId: String(job.id) };
  }

  async autofillFields(name: string, intent: string): Promise<{ fields: string[] }> {
    const apiKey = this.configService.get<string>('MISTRAL_API_KEY');
    const fallback = ['Reference Number', 'Date', 'Description', 'Status', 'Approved By', 'Remarks'];

    if (!apiKey) return { fields: fallback };

    try {
      const model = this.configService.get<string>('MISTRAL_MODEL', 'mistral-large-latest');
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [{
            role: 'user',
            content:
              `You are helping design a business process workflow called "${name}".` +
              (intent ? ` Process intent: "${intent}".` : '') +
              ` Suggest 5 to 8 concise form field names that would be captured in this workflow's data forms (e.g. "Invoice Number", "Vendor Name", "Approval Date"). ` +
              `Return ONLY a JSON object: {"fields": ["Field One", "Field Two", ...]}`,
          }],
        }),
      });

      if (!res.ok) return { fields: fallback };
      const body = await res.json();
      const content = body?.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content);
      const result = Array.isArray(parsed?.fields) ? parsed.fields.filter((f: any) => typeof f === 'string') : [];
      return { fields: result.length > 0 ? result : fallback };
    } catch {
      return { fields: fallback };
    }
  }

  /**
   * Generates task description / delegation suggestion from a short title.
   */
  async suggestTaskDescription(
    title: string,
    context?: string,
  ): Promise<{ suggestion: string }> {
    const job = await this.aiQueue.add('suggest-description', { title, context });
    // For lightweight tasks, wait for result synchronously (short timeout)
    const result = await job.finished();
    return { suggestion: result?.description ?? '' };
  }

  /**
   * Generates MIS insight summary for a user's scores.
   */
  async generateMisInsight(
    userId: string,
    tenantId: string,
    period: string,
  ): Promise<{ insight: string; jobId: string }> {
    const job = await this.aiQueue.add('mis-insight', { userId, tenantId, period });
    return { insight: '', jobId: String(job.id) };
  }

  /**
   * Parse a voice transcript into a structured task draft using Mistral AI.
   * Returns { title, description, deadline?, priority? }.
   */
  async parseVoiceToTask(
    text: string,
    user: JwtPayload,
  ): Promise<{ title: string; description: string; deadline?: string; priority?: string }> {
    const apiKey = this.configService.get<string>('MISTRAL_API_KEY');
    const today = new Date().toISOString().split('T')[0];

    if (apiKey) {
      try {
        const model = this.configService.get<string>('MISTRAL_MODEL', 'mistral-large-latest');
        const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [{
              role: 'user',
              content:
                `Today is ${today}. Parse this voice message and extract task information.\n` +
                `Message: "${text}"\n\n` +
                `Return ONLY JSON: {"title": string, "description": string, "deadline": "YYYY-MM-DD or null", "priority": "LOW|MEDIUM|HIGH|CRITICAL or null"}`,
            }],
          }),
        });
        if (res.ok) {
          const body = await res.json();
          const content = body?.choices?.[0]?.message?.content ?? '{}';
          const parsed = JSON.parse(content);
          return {
            title: parsed.title ?? text.slice(0, 80),
            description: parsed.description ?? text,
            deadline: parsed.deadline ?? undefined,
            priority: parsed.priority ?? undefined,
          };
        }
      } catch {
        // Fall through to basic parsing
      }
    }

    // Fallback: use raw text
    return { title: text.slice(0, 80), description: text };
  }

  async getJobStatus(jobId: string): Promise<{
    status: 'waiting' | 'active' | 'completed' | 'failed';
    result?: any;
  }> {
    const job = await this.aiQueue.getJob(jobId);
    if (!job) return { status: 'failed' };
    const state = await job.getState();
    const result = state === 'completed' ? await job.finished() : undefined;
    return { status: state as any, result };
  }

  /**
   * Floating "TaskEasy AI" chat widget. Answers questions about the user's
   * own dashboard data — pulled live via DashboardService, which already
   * applies the correct hierarchy scoping (Admin sees their team, Managers
   * see their team, and employees see only themselves),
   * Admin/Manager see their team, everyone else sees only themselves).
   * This is called synchronously (not queued) since a chat widget needs an
   * immediate reply, not a job id to poll.
   */
  async askAssistant(
    message: string,
    history: AssistantChatMessage[],
    user: JwtPayload,
  ): Promise<{ reply: string }> {
    const [dashboard, notifications] = await Promise.all([
      this.dashboardService.getDashboard(user.tenantId, user.sub, user.role, 'team'),
      this.dashboardService.getNotificationCounts(user.tenantId, user.sub, user.role),
    ]);

    const context = {
      delegation: dashboard.delegation,
      workRequest: dashboard.workRequest,
      checklist: dashboard.checklist,
      fms: dashboard.fms,
      pendingApprovals: dashboard.approvalPending,
      criticalOverdueTasks: dashboard.criticalTasks.map((t: any) => ({
        title: t.title,
        targetDate: t.targetDate,
        priority: t.priority,
        status: t.status,
      })),
      sidebarNotificationCounts: notifications,
      asOf: dashboard.lastUpdated,
    };

    const apiKey = this.configService.get<string>('MISTRAL_API_KEY');
    if (!apiKey) {
      return { reply: this.buildFallbackReply(context) };
    }

    try {
      const reply = await this.callMistralChat(apiKey, message, history, context);
      return { reply };
    } catch (err) {
      this.logger.error('Mistral chat call failed, falling back to data summary', err as Error);
      return { reply: this.buildFallbackReply(context) };
    }
  }

  private async callMistralChat(
    apiKey: string,
    message: string,
    history: AssistantChatMessage[],
    context: Record<string, any>,
  ): Promise<string> {
    const model = this.configService.get<string>('MISTRAL_MODEL', 'mistral-large-latest');

    const systemPrompt =
      `You are "TaskEasy AI", an in-app assistant inside the TaskEasy workflow management product. ` +
      `Answer the user's question using ONLY the JSON data below — it is their real, live task data, ` +
      `already scoped to exactly what this user is allowed to see. Never invent numbers that aren't in ` +
      `the data. If the data can't answer the question, say so plainly. Keep replies short — 2 to 5 ` +
      `sentences of plain prose, no markdown headers, no bullet lists unless the user explicitly asks for a list.\n\n` +
      `DATA:\n${JSON.stringify(context)}`;

    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Mistral API returned ${res.status}: ${await res.text()}`);
    }

    const body = await res.json();
    const text = body?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response from Mistral');
    return text;
  }

  /**
   * Used when MISTRAL_API_KEY isn't configured, or the API call fails.
   * Still gives a real, data-backed answer rather than a dead placeholder —
   * just without natural-language flexibility.
   */
  private buildFallbackReply(context: Record<string, any>): string {
    const { delegation, workRequest, checklist, fms, pendingApprovals } = context;
    const totalPending = delegation.pending + workRequest.pending + checklist.pending + fms.pending;
    const totalDelayed = delegation.delayed + workRequest.delayed + checklist.delayed + fms.delayed;

    return (
      `Here's your current snapshot: ${totalPending} pending task(s) across Delegation (${delegation.pending}), ` +
      `Work Requests (${workRequest.pending}), Checklist (${checklist.pending}) and FMS (${fms.pending}), ` +
      `with ${totalDelayed} overdue and ${pendingApprovals} awaiting your approval. ` +
      `(AI chat isn't fully configured — set MISTRAL_API_KEY in apps/api/.env for natural-language answers; ` +
      `these numbers are pulled live from your dashboard either way.)`
    );
  }
}
