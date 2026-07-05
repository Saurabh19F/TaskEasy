import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import { QUEUES } from '../queue.constants';

interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  validationRules?: Record<string, any>;
  options?: string[];
}

interface GeneratedStep {
  sequence: number;
  title: string;
  description: string;
  role: string;
  actionType: string;
  tatHours: number;
  assignmentMode: string;
  nextOnComplete: number;
  nextOnReject: number;
  formSchema: FormField[];
}

function normalizeRole(raw: any): string {
  const r = String(raw ?? '').trim().toLowerCase();
  if (r === 'super admin' || r === 'superadmin') return 'Super Admin';
  if (r === 'admin') return 'Admin';
  return 'Employee';
}

function normalizeFormSchema(raw: any[], stepIdx: number): FormField[] {
  const VALID_TYPES = ['text', 'number', 'date', 'dropdown', 'boolean', 'file', 'textarea'];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f) => f && typeof f === 'object')
    .map((f, fi) => ({
      id: String(f.id || `field_${stepIdx + 1}_${fi + 1}`).replace(/\s+/g, '_').toLowerCase(),
      label: String(f.label || `Field ${fi + 1}`).trim(),
      type: VALID_TYPES.includes(String(f.type || '').toLowerCase()) ? String(f.type).toLowerCase() : 'text',
      required: Boolean(f.required),
      defaultValue: String(f.defaultValue ?? ''),
      validationRules: f.validationRules && typeof f.validationRules === 'object' ? f.validationRules : {},
      options: Array.isArray(f.options) ? f.options.map(String) : [],
    }));
}

function normalizeSteps(raw: any[]): GeneratedStep[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const VALID_ACTIONS = ['submit', 'review', 'approve'];

  const cleaned = raw
    .filter((s) => s && typeof s === 'object')
    .map((s, idx) => {
      const role = normalizeRole(s.role ?? s.assignedRole);
      const actionType = VALID_ACTIONS.includes(String(s.actionType ?? '').toLowerCase())
        ? String(s.actionType).toLowerCase()
        : role === 'Employee' ? 'submit' : role === 'Admin' ? 'review' : 'approve';

      return {
        sequence: Number(s.sequence ?? s.stepNo ?? idx + 1),
        title: String(s.title || `Step ${idx + 1}`).trim(),
        description: String(s.description || '').trim(),
        role,
        actionType,
        tatHours: Math.max(0, Number(s.tatHours ?? s.slaHours ?? 0)),
        assignmentMode: ['role', 'user'].includes(String(s.assignmentMode ?? '').toLowerCase())
          ? String(s.assignmentMode).toLowerCase()
          : 'user',
        nextOnComplete: Math.max(0, Number(s.nextOnComplete ?? 0)),
        nextOnReject: Math.max(0, Number(s.nextOnReject ?? 0)),
        formSchema: normalizeFormSchema(s.formSchema ?? [], idx),
      };
    })
    .filter((s) => s.title);

  cleaned.sort((a, b) => a.sequence - b.sequence);
  cleaned.forEach((s, i) => { s.sequence = i + 1; });
  return cleaned;
}

@Processor(QUEUES.AI)
export class AiProcessor {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(private configService: ConfigService) {}

  @Process('generate-workflow')
  async handleGenerateWorkflow(job: Job<{
    name: string;
    intent: string;
    fields: string[];
    tenantId: string;
    userId: string;
  }>) {
    const { name, intent, fields } = job.data;
    this.logger.log(`AI: generating workflow "${name}" for tenant ${job.data.tenantId}`);

    const apiKey = this.configService.get<string>('MISTRAL_API_KEY');
    if (!apiKey) {
      this.logger.warn('MISTRAL_API_KEY not configured — returning placeholder workflow');
      return {
        name,
        isPlaceholder: true,
        message: 'AI generation is not configured (missing MISTRAL_API_KEY). Showing a placeholder — set the key in apps/api/.env to enable real generation.',
        steps: normalizeSteps([
          { sequence: 1, title: 'Step 1 (placeholder — configure MISTRAL_API_KEY)', description: intent, role: 'Employee', actionType: 'submit', tatHours: 24 },
        ]),
      };
    }

    const fieldsStr = fields?.filter(Boolean).length
      ? `\nThe workflow involves these data fields: ${fields.filter(Boolean).join(', ')}.`
      : '';
    const userPrompt = name
      ? `Flow name hint: "${name}".\nIntent: ${intent}.${fieldsStr}`
      : `Intent: ${intent}.${fieldsStr}`;

    try {
      const steps = await this.callMistral(apiKey, userPrompt);
      return { name, isPlaceholder: false, steps };
    } catch (err) {
      this.logger.error('Mistral API call failed, falling back to placeholder', err as Error);
      return {
        name,
        isPlaceholder: true,
        message: `AI generation failed (${(err as Error).message}). Showing a placeholder.`,
        steps: normalizeSteps([
          { sequence: 1, title: 'Step 1 (placeholder — AI call failed)', description: intent, role: 'Employee', actionType: 'submit', tatHours: 24 },
        ]),
      };
    }
  }

  private async callMistral(apiKey: string, userPrompt: string): Promise<GeneratedStep[]> {
    const model = this.configService.get<string>('MISTRAL_MODEL', 'mistral-large-latest');

    const systemPrompt = [
      'You are an expert workflow designer for an enterprise Flow Management System (FMS).',
      'Your job: convert a plain-language process intent into a structured JSON workflow.',
      '',
      '=== ROLES AND ACTION TYPES ===',
      '- Employee + submit   → person entering/submitting data or a request',
      '- Admin + review      → manager/supervisor reviewing submitted data',
      '- Super Admin + approve → final sign-off or escalation authority',
      'Always sequence: Employee submits first, then Admin reviews, then Super Admin approves (if needed).',
      'Use only these roles: "Employee", "Admin", "Super Admin".',
      'Use only these actionTypes: "submit", "review", "approve".',
      '',
      '=== TAT HOURS (turnaround time) ===',
      'Set realistic tatHours based on step urgency:',
      '- Data entry / submission: 24',
      '- Internal review: 48',
      '- Management approval: 72',
      '- Compliance / legal sign-off: 168 (1 week)',
      'Use 0 only if there is genuinely no deadline.',
      '',
      '=== FORM SCHEMA ===',
      'Add formSchema fields to capture data at each step. Field types: "text", "number", "date", "dropdown", "boolean", "file".',
      'Rules:',
      '  - id: snake_case, unique within the step (e.g. "employee_name", "start_date")',
      '  - label: human-readable label',
      '  - required: true for essential fields, false for optional ones',
      '  - type "dropdown" must include an "options" array of strings',
      '  - type "boolean" is for yes/no checkboxes',
      '  - type "file" is for document/attachment uploads',
      '  - defaultValue: empty string "" unless there is a sensible default',
      '  - validationRules: {} unless you need {"min":0,"max":100} for numbers',
      'The Employee submit step should have the most form fields (the data being entered).',
      'Review/approve steps may have fewer fields (remarks, decision dropdowns).',
      '',
      '=== BRANCHING (nextOnComplete / nextOnReject) ===',
      'Use 0 for both if the flow is linear (most cases).',
      'Only set these to a non-zero step sequence number if the intent explicitly requires conditional routing.',
      '',
      '=== ASSIGNMENT MODE ===',
      'Use "user" (default) — a specific person will be assigned later.',
      'Use "role" only if the intent says "any admin" or "whoever is available in that role".',
      '',
      '=== OUTPUT FORMAT ===',
      'Return ONLY a raw JSON object. No markdown fences, no explanation, no extra keys.',
      'Shape:',
      '{',
      '  "name": "short descriptive flow name",',
      '  "steps": [',
      '    {',
      '      "sequence": 1,',
      '      "title": "Step title (verb phrase)",',
      '      "description": "One sentence explaining what happens at this step",',
      '      "role": "Employee",',
      '      "actionType": "submit",',
      '      "tatHours": 24,',
      '      "assignmentMode": "user",',
      '      "nextOnComplete": 0,',
      '      "nextOnReject": 0,',
      '      "formSchema": [',
      '        { "id": "field_id", "label": "Field Label", "type": "text", "required": true, "defaultValue": "", "validationRules": {}, "options": [] }',
      '      ]',
      '    }',
      '  ]',
      '}',
    ].join('\n');

    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Mistral API returned ${res.status}: ${await res.text()}`);
    }

    const body = await res.json();
    const text = body?.choices?.[0]?.message?.content ?? '';

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Could not find a JSON object in the AI response');
      parsed = JSON.parse(jsonMatch[0]);
    }

    const rawSteps = parsed?.steps;
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
      throw new Error('AI response parsed to an empty/invalid step list');
    }
    return normalizeSteps(rawSteps);
  }

  @Process('suggest-description')
  async handleSuggestDescription(job: Job<{ title: string; context?: string }>) {
    this.logger.log(`AI: suggesting description for "${job.data.title}"`);
    return {
      description: `Detailed description for: ${job.data.title}`,
    };
  }

  @Process('mis-insight')
  async handleMisInsight(job: Job<{
    userId: string;
    tenantId: string;
    period: string;
  }>) {
    this.logger.log(`AI: generating MIS insight for user ${job.data.userId}`);
    return {
      insight: 'Performance is on track. Focus on reducing rework count for higher score.',
    };
  }

  /**
   * Parse an inbound WhatsApp text message and create a WorkRequest draft.
   * Draft is stored in the database with status=PENDING and source=WHATSAPP
   * so the user can review and confirm via the app or reply to the bot.
   */
  @Process('whatsapp-to-task')
  async handleWhatsappToTask(job: Job<{
    userId: string;
    tenantId: string;
    userRole: string;
    from: string;
    wabaId: string;
    text: string;
    messageId: string;
    timestamp: string;
  }>) {
    const { userId, tenantId, text } = job.data;
    this.logger.log(`WhatsApp→Task: parsing message from user ${userId}: "${text}"`);

    const apiKey = this.configService.get<string>('MISTRAL_API_KEY');

    let parsed: { title: string; description: string; deadline?: string } | null = null;

    if (apiKey) {
      try {
        const model = this.configService.get<string>('MISTRAL_MODEL', 'mistral-large-latest');
        const today = new Date().toISOString().split('T')[0];
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
                `Today is ${today}. Parse this WhatsApp task message and extract task information.\n` +
                `Message: "${text}"\n\n` +
                `Respond ONLY with JSON: {"title": string, "description": string, "deadline": "YYYY-MM-DD or null"}`,
            }],
          }),
        });
        if (res.ok) {
          const body = await res.json();
          const content = body?.choices?.[0]?.message?.content ?? '';
          parsed = JSON.parse(content);
        }
      } catch (err) {
        this.logger.warn('AI parsing failed for WhatsApp message, using raw text', err as Error);
      }
    }

    // Fallback: use raw text as title
    const title = parsed?.title ?? text.slice(0, 80);
    const description = parsed?.description ?? text;
    const deadlineDate = parsed?.deadline ?? null;

    return {
      userId,
      tenantId,
      title,
      description,
      deadlineDate,
      source: 'WHATSAPP',
      status: 'DRAFT',
    };
  }
}
