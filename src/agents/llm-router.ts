// IAUTHR LLM Router — NASA P10 Compliant
// P10-4: all functions under 60 lines
// P10-5: min 2 assertions per function
// P10-6: no global mutable state (all const/readonly)
// P10-7: every return value checked

import { assertNonEmpty, assertBounded, bounded, LIMITS } from '../utils/validate';

export type LLMProvider = 'claude' | 'grok' | 'gemini' | 'minimax' | 'openai' | 'mistral' | 'deepseek' | 'llama';
export type LLMFormat = 'anthropic' | 'openai' | 'gemini';

export interface LLMConfig {
  readonly provider: LLMProvider;
  readonly label: string;
  readonly model: string;
  readonly endpoint: string;
  readonly authHeader: string;
  readonly envKey: string;
  readonly maxTokens: number;
  readonly format: LLMFormat;
  readonly icon: string;
  readonly description: string;
  readonly costPer1kInput: number;
  readonly costPer1kOutput: number;
}

export interface LLMResponse {
  readonly content: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly provider: LLMProvider;
  readonly model: string;
}

// P10-6: immutable provider registry
export const LLM_PROVIDERS: Readonly<Record<LLMProvider, LLMConfig>> = Object.freeze({
  claude:   { provider: 'claude',   label: 'Claude',    model: 'claude-sonnet-4-20250514',                           endpoint: 'https://api.anthropic.com/v1/messages',                                              authHeader: 'x-api-key',      envKey: 'ANTHROPIC_API_KEY', maxTokens: 1024, format: 'anthropic', icon: '🟣', description: 'Anthropic Claude — nuanced, safe, excellent at narrative', costPer1kInput: 0.003,  costPer1kOutput: 0.015  },
  grok:     { provider: 'grok',     label: 'Grok',      model: 'grok-3-mini',                                        endpoint: 'https://api.x.ai/v1/chat/completions',                                              authHeader: 'Authorization',  envKey: 'XAI_API_KEY',      maxTokens: 1024, format: 'openai',    icon: '⚡', description: 'xAI Grok — fast, unfiltered, good for brutal mode',       costPer1kInput: 0.002,  costPer1kOutput: 0.010  },
  gemini:   { provider: 'gemini',   label: 'Gemini',    model: 'gemini-2.5-flash',                                   endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', authHeader: 'x-goog-api-key', envKey: 'GOOGLE_API_KEY',   maxTokens: 1024, format: 'gemini',    icon: '🔵', description: 'Google Gemini — multimodal, great with photos',          costPer1kInput: 0.001,  costPer1kOutput: 0.004  },
  minimax:  { provider: 'minimax',  label: 'MiniMax',   model: 'MiniMax-Text-01',                                    endpoint: 'https://api.minimaxi.chat/v1/text/chatcompletion_v2',                                authHeader: 'Authorization',  envKey: 'MINIMAX_API_KEY',  maxTokens: 1024, format: 'openai',    icon: '🟡', description: 'MiniMax — strong multilingual, non-English memoirs',      costPer1kInput: 0.001,  costPer1kOutput: 0.005  },
  openai:   { provider: 'openai',   label: 'GPT-4o',    model: 'gpt-4o',                                             endpoint: 'https://api.openai.com/v1/chat/completions',                                        authHeader: 'Authorization',  envKey: 'OPENAI_API_KEY',   maxTokens: 1024, format: 'openai',    icon: '🟢', description: 'OpenAI GPT-4o — versatile, widely trusted',              costPer1kInput: 0.005,  costPer1kOutput: 0.015  },
  mistral:  { provider: 'mistral',  label: 'Mistral',   model: 'mistral-large-latest',                               endpoint: 'https://api.mistral.ai/v1/chat/completions',                                        authHeader: 'Authorization',  envKey: 'MISTRAL_API_KEY',  maxTokens: 1024, format: 'openai',    icon: '🔶', description: 'Mistral — European, privacy-focused, efficient',         costPer1kInput: 0.002,  costPer1kOutput: 0.006  },
  deepseek: { provider: 'deepseek', label: 'DeepSeek',  model: 'deepseek-chat',                                      endpoint: 'https://api.deepseek.com/v1/chat/completions',                                      authHeader: 'Authorization',  envKey: 'DEEPSEEK_API_KEY', maxTokens: 1024, format: 'openai',    icon: '🐋', description: 'DeepSeek — ultra-low cost, strong reasoning',            costPer1kInput: 0.0003, costPer1kOutput: 0.001  },
  llama:    { provider: 'llama',    label: 'Llama 4',   model: 'meta-llama/llama-4-maverick-17b-128e-instruct',       endpoint: 'https://api.groq.com/openai/v1/chat/completions',                                   authHeader: 'Authorization',  envKey: 'GROQ_API_KEY',     maxTokens: 1024, format: 'openai',    icon: '🦙', description: 'Meta Llama via Groq — blazing fast, open-source',        costPer1kInput: 0.0001, costPer1kOutput: 0.0004 },
});

// P10-2: fixed upper-bound for fallback loop
const FALLBACK_ORDER: readonly LLMProvider[] = Object.freeze(
  ['claude', 'grok', 'gemini', 'openai', 'deepseek', 'mistral', 'llama', 'minimax'] as const
);
const MAX_FALLBACK_ATTEMPTS = FALLBACK_ORDER.length; // P10-2: bounded

// ─── Anthropic format call (≤30 lines) ───
async function callAnthropic(cfg: LLMConfig, key: string, sys: string, msg: string, maxTok: number): Promise<LLMResponse> {
  assertNonEmpty(key, 'apiKey');                                    // P10-5
  assertBounded(msg, LIMITS.MAX_USER_MESSAGE, 'userMessage');       // P10-5

  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [cfg.authHeader]: key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: cfg.model, max_tokens: maxTok, system: bounded(sys, LIMITS.MAX_SYSTEM_PROMPT), messages: [{ role: 'user', content: bounded(msg, LIMITS.MAX_USER_MESSAGE) }] }),
  });
  if (!res.ok) { throw new Error(`${cfg.label} ${res.status}: ${await res.text()}`); } // P10-7

  const data = await res.json() as any;
  const content = data?.content?.[0]?.text;                         // P10-7
  if (typeof content !== 'string') { throw new Error(`${cfg.label}: no content in response`); }

  return { content, tokensIn: data.usage?.input_tokens ?? 0, tokensOut: data.usage?.output_tokens ?? 0, provider: cfg.provider, model: cfg.model };
}

// ─── OpenAI-compatible format call (≤30 lines) ───
async function callOpenAI(cfg: LLMConfig, key: string, sys: string, msg: string, maxTok: number): Promise<LLMResponse> {
  assertNonEmpty(key, 'apiKey');                                    // P10-5
  assertBounded(msg, LIMITS.MAX_USER_MESSAGE, 'userMessage');       // P10-5

  const auth = cfg.authHeader === 'Authorization' ? `Bearer ${key}` : key;
  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [cfg.authHeader]: auth },
    body: JSON.stringify({ model: cfg.model, max_tokens: maxTok, temperature: 0.7, messages: [{ role: 'system', content: bounded(sys, LIMITS.MAX_SYSTEM_PROMPT) }, { role: 'user', content: bounded(msg, LIMITS.MAX_USER_MESSAGE) }] }),
  });
  if (!res.ok) { throw new Error(`${cfg.label} ${res.status}: ${await res.text()}`); } // P10-7

  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content;             // P10-7
  if (typeof content !== 'string') { throw new Error(`${cfg.label}: no content in response`); }

  return { content, tokensIn: data.usage?.prompt_tokens ?? 0, tokensOut: data.usage?.completion_tokens ?? 0, provider: cfg.provider, model: cfg.model };
}

// ─── Gemini format call (≤30 lines) ───
async function callGemini(cfg: LLMConfig, key: string, sys: string, msg: string, maxTok: number): Promise<LLMResponse> {
  assertNonEmpty(key, 'apiKey');                                    // P10-5
  assertBounded(msg, LIMITS.MAX_USER_MESSAGE, 'userMessage');       // P10-5

  const res = await fetch(`${cfg.endpoint}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system_instruction: { parts: [{ text: bounded(sys, LIMITS.MAX_SYSTEM_PROMPT) }] }, contents: [{ parts: [{ text: bounded(msg, LIMITS.MAX_USER_MESSAGE) }] }], generationConfig: { maxOutputTokens: maxTok, temperature: 0.7 } }),
  });
  if (!res.ok) { throw new Error(`${cfg.label} ${res.status}: ${await res.text()}`); } // P10-7

  const data = await res.json() as any;
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text; // P10-7
  if (typeof content !== 'string') { throw new Error(`${cfg.label}: no content in response`); }

  return { content, tokensIn: data.usageMetadata?.promptTokenCount ?? 0, tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0, provider: cfg.provider, model: cfg.model };
}

// ─── Unified call dispatcher (≤20 lines) ───
export async function callLLM(provider: LLMProvider, apiKey: string, system: string, userMessage: string, maxTokens?: number): Promise<LLMResponse> {
  const cfg = LLM_PROVIDERS[provider];
  if (!cfg) { throw new Error(`Unknown provider: ${provider}`); }   // P10-5
  assertNonEmpty(apiKey, `API key for ${provider}`);                 // P10-5

  const tokens = maxTokens ?? cfg.maxTokens;

  switch (cfg.format) {
    case 'anthropic': return callAnthropic(cfg, apiKey, system, userMessage, tokens);
    case 'openai':    return callOpenAI(cfg, apiKey, system, userMessage, tokens);
    case 'gemini':    return callGemini(cfg, apiKey, system, userMessage, tokens);
    default:          throw new Error(`Unknown format: ${cfg.format}`); // P10-1: no fallthrough
  }
}

// ─── Env helpers (≤10 lines each) ───
export function getApiKey(env: Record<string, unknown>, provider: LLMProvider): string {
  const cfg = LLM_PROVIDERS[provider];
  if (!cfg) { throw new Error(`Unknown provider: ${provider}`); }   // P10-5
  return (env[cfg.envKey] as string) || '';
}

export function getAvailableProviders(env: Record<string, unknown>): LLMProvider[] {
  return (Object.keys(LLM_PROVIDERS) as LLMProvider[]).filter(p => {
    const key = getApiKey(env, p);
    return typeof key === 'string' && key.length > 0;               // P10-7: explicit check
  });
}

// ─── Fallback caller (≤35 lines, bounded loop) ───
export async function callLLMWithFallback(env: Record<string, unknown>, preferred: LLMProvider, system: string, userMessage: string, maxTokens?: number): Promise<LLMResponse> {
  assertNonEmpty(system, 'system prompt');                           // P10-5
  assertNonEmpty(userMessage, 'user message');                       // P10-5

  const available = getAvailableProviders(env);
  if (available.length === 0) { throw new Error('No LLM API keys configured'); }

  // Try preferred first
  if (available.includes(preferred)) {
    try {
      return await callLLM(preferred, getApiKey(env, preferred), system, userMessage, maxTokens);
    } catch (err) {
      console.error(`${preferred} failed:`, err);
    }
  }

  // P10-2: bounded fallback loop (max MAX_FALLBACK_ATTEMPTS iterations)
  for (let i = 0; i < MAX_FALLBACK_ATTEMPTS; i++) {
    const provider = FALLBACK_ORDER[i];
    if (provider === preferred || !available.includes(provider)) { continue; }
    try {
      return await callLLM(provider, getApiKey(env, provider), system, userMessage, maxTokens);
    } catch (err) {
      console.error(`${provider} fallback failed:`, err);
    }
  }

  throw new Error('All LLM providers failed');
}
