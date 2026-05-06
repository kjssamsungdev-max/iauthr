// GET/POST /api/providers — P10 Compliant
import { LLM_PROVIDERS, getAvailableProviders, LLMProvider } from '../../src/agents/llm-router';
import { assertNonEmpty, assertD1Result, errorResponse, jsonResponse, safeJsonParse } from '../../src/utils/validate';

interface Env { DB: D1Database; [key: string]: unknown; }

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const available = getAvailableProviders(env);
  if (available.length === 0 && Object.keys(LLM_PROVIDERS).length === 0) { // P10-5: defensive
    return errorResponse('No providers configured', 500);
  }

  const providers = Object.entries(LLM_PROVIDERS).map(([key, cfg]) => ({
    id: key, label: cfg.label, icon: cfg.icon, description: cfg.description, model: cfg.model,
    available: available.includes(key as LLMProvider),
    costPer1kInput: cfg.costPer1kInput, costPer1kOutput: cfg.costPer1kOutput,
    estimatedCostPerMemo: ((cfg.costPer1kInput * 2.3) + (cfg.costPer1kOutput * 0.8)).toFixed(4),
  }));

  return jsonResponse({ providers, availableCount: available.length, defaultProvider: available.includes('claude') ? 'claude' : available[0] ?? null });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const body = await request.json() as any;
    assertNonEmpty(body?.userId, 'userId');                  // P10-5
    assertNonEmpty(body?.provider, 'provider');              // P10-5

    if (!LLM_PROVIDERS[body.provider as LLMProvider]) {
      return errorResponse(`Unknown provider: ${body.provider}`, 400);
    }

    const user = await env.DB.prepare('SELECT settings FROM users WHERE id = ?').bind(body.userId).first() as any;
    if (!user) { return errorResponse('User not found', 404); } // P10-7

    const settings = safeJsonParse(user.settings ?? '{}', {});
    (settings as any).preferredProvider = body.provider;

    const result = await env.DB.prepare("UPDATE users SET settings = ?, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(settings), body.userId).run();
    assertD1Result(result, 'update user provider');          // P10-7

    return jsonResponse({ ok: true, provider: body.provider });
  } catch (err: any) { return errorResponse(err.message, 400); }
};
