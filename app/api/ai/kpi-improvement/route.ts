import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/libs/supabase/server';
import { decrypt } from '@/libs/crypto';

export const runtime = 'nodejs';

interface KpiImproveRequest {
  metricId?: string;
  metricName?: string;
  metricValue?: string | number;
  scope?: 'workspace' | 'dataset';
  workspaceName?: string;
  datasetName?: string;
  context?: string;
}

interface ParsedAdvice {
  summary: string;
  actions: Array<{
    title: string;
    why: string;
    impact: 'high' | 'medium' | 'low';
    steps: string[];
  }>;
  quickWins: string[];
}

function coerceString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function safeJsonParse<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch (_error) {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1)) as T;
      } catch (_nestedError) {
        return null;
      }
    }
    return null;
  }
}

function fallbackAdvice(metricName: string): ParsedAdvice {
  return {
    summary: `Prioritize root-cause analysis, targeted validation rules, and automated monitoring to improve ${metricName}.`,
    actions: [
      {
        title: `Profile and baseline ${metricName}`,
        why: 'You need a stable baseline before making changes.',
        impact: 'high',
        steps: [
          'Capture current KPI trend and segment by source table.',
          'Identify top contributors by error volume or staleness.',
          'Set numeric target and owner for next reporting cycle.',
        ],
      },
      {
        title: 'Introduce automated controls',
        why: 'Automation prevents repeated regressions.',
        impact: 'high',
        steps: [
          'Add data validation checks in ingestion and transform steps.',
          'Block or quarantine records failing business-critical rules.',
          'Create alerts for KPI threshold breaches.',
        ],
      },
    ],
    quickWins: [
      'Fix top 3 failing columns first.',
      'Backfill missing critical fields.',
      'Enable daily KPI trend alerts.',
    ],
  };
}

async function resolveGeminiConfig() {
  let model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
  let apiKey = process.env.GEMINI_API_KEY || '';

  try {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      return { model, apiKey };
    }

    const { data } = await supabase
      .from('ai_settings')
      .select('gemini_model, gemini_api_key_encrypted')
      .eq('user_id', user.id)
      .single();

    if (typeof data?.gemini_model === 'string' && data.gemini_model.trim().length > 0) {
      model = data.gemini_model;
    }
    if (
      typeof data?.gemini_api_key_encrypted === 'string' &&
      data.gemini_api_key_encrypted.trim().length > 0
    ) {
      const decrypted = decrypt(data.gemini_api_key_encrypted);
      if (decrypted.trim().length > 0) {
        apiKey = decrypted;
      }
    }
  } catch (error) {
    console.warn('Unable to resolve user-specific Gemini settings, falling back to environment:', error);
  }

  return { model, apiKey };
}

function buildPrompt(payload: KpiImproveRequest): string {
  const metricName = payload.metricName || payload.metricId || 'Data Quality KPI';
  const metricValue =
    typeof payload.metricValue === 'number'
      ? String(payload.metricValue)
      : coerceString(payload.metricValue, 'unknown');
  const scope = payload.scope || 'workspace';
  const workspaceName = coerceString(payload.workspaceName, 'Current Workspace');
  const datasetName = coerceString(payload.datasetName, 'N/A');
  const context = coerceString(payload.context, 'No extra context provided.');

  return `
You are a senior Data Quality agent. Produce improvement guidance for KPI remediation.

Context:
- Scope: ${scope}
- Workspace: ${workspaceName}
- Dataset: ${datasetName}
- KPI: ${metricName}
- Current Value: ${metricValue}
- Additional Context: ${context}

Requirements:
- Focus on practical enterprise actions.
- Include quick wins and medium-term controls.
- Explain why each action improves the KPI.
- Keep recommendations specific to pipelines, validation, governance, and operational monitoring.

Return STRICT JSON only in this schema:
{
  "summary": "short assessment",
  "actions": [
    {
      "title": "action title",
      "why": "why it helps this KPI",
      "impact": "high|medium|low",
      "steps": ["step 1", "step 2", "step 3"]
    }
  ],
  "quickWins": ["quick win 1", "quick win 2", "quick win 3"]
}
`.trim();
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as KpiImproveRequest;
    const metricName = payload.metricName || payload.metricId || 'Data Quality KPI';

    const { model, apiKey } = await resolveGeminiConfig();
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Gemini API key is not configured. Add GEMINI_API_KEY or set it in AI Settings.',
        },
        { status: 400 }
      );
    }

    const client = new GoogleGenerativeAI(apiKey);
    const geminiModel = client.getGenerativeModel({ model });
    const result = await geminiModel.generateContent(buildPrompt(payload));
    const response = await result.response;
    const raw = response.text();

    const parsed = safeJsonParse<ParsedAdvice>(raw) || fallbackAdvice(metricName);
    const normalized: ParsedAdvice = {
      summary: coerceString(parsed.summary, `Recommended improvements generated for ${metricName}.`),
      actions: Array.isArray(parsed.actions)
        ? parsed.actions
            .map((action) => ({
              title: coerceString(action.title, 'Suggested action'),
              why: coerceString(action.why, 'This action improves KPI quality and reliability.'),
              impact:
                action.impact === 'high' || action.impact === 'medium' || action.impact === 'low'
                  ? action.impact
                  : 'medium',
              steps: Array.isArray(action.steps)
                ? action.steps
                    .map((step) => coerceString(step))
                    .filter((step) => step.length > 0)
                : [],
            }))
            .filter((action) => action.title.length > 0)
        : [],
      quickWins: Array.isArray(parsed.quickWins)
        ? parsed.quickWins.map((item) => coerceString(item)).filter((item) => item.length > 0)
        : [],
    };

    if (normalized.actions.length === 0) {
      normalized.actions = fallbackAdvice(metricName).actions;
    }

    return NextResponse.json({
      provider: 'gemini',
      model,
      advice: normalized,
    });
  } catch (error) {
    console.error('Error generating KPI improvement advice:', error);
    return NextResponse.json(
      { error: 'Failed to generate KPI improvement advice.' },
      { status: 500 }
    );
  }
}
