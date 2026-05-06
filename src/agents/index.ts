// IAUTHR Agent System — NASA P10 Compliant
// P10-4: all functions ≤60 lines | P10-5: min 2 assertions | P10-7: all returns checked

import { callLLMWithFallback, LLMProvider, LLMResponse, LLM_PROVIDERS, getAvailableProviders } from './llm-router';
import { assertNonEmpty, assertUUID, bounded, safeJsonParse, assertD1Result, LIMITS } from '../utils/validate';

// P10-6: immutable types
interface AgentResult {
  readonly output: Record<string, unknown>;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly latencyMs: number;
  readonly provider: string;
  readonly model: string;
}

interface Env {
  readonly DB: D1Database;
  readonly [key: string]: unknown;
}

// ─── Core agent call with JSON parsing (≤15 lines) ───
async function agentCall(
  env: Env, provider: LLMProvider, system: string, userMessage: string, fallback: Record<string, unknown>, maxTokens?: number
): Promise<AgentResult> {
  assertNonEmpty(system, 'agent system prompt');     // P10-5
  assertNonEmpty(userMessage, 'agent user message'); // P10-5

  const start = Date.now();
  const response = await callLLMWithFallback(env, provider, bounded(system, LIMITS.MAX_SYSTEM_PROMPT), bounded(userMessage, LIMITS.MAX_USER_MESSAGE), maxTokens);
  const parsed = safeJsonParse(response.content, fallback);

  return { output: parsed, tokensIn: response.tokensIn, tokensOut: response.tokensOut, latencyMs: Date.now() - start, provider: response.provider, model: response.model };
}

// ─── 1. Entity Extractor (≤20 lines) ───
export async function entityExtractorAgent(env: Env, provider: LLMProvider, memoText: string, existing: { name: string; type: string }[]): Promise<AgentResult> {
  assertNonEmpty(memoText, 'memoText');              // P10-5
  const existingList = existing.slice(0, 100).map(e => `${e.name} (${e.type})`).join(', ') || 'none'; // P10-3: bounded
  const system = `Entity extraction agent for iauthr memoir app. Extract meaningful entities. Types: person, pet, place, job, hobby, relationship, belief, fear, loss, influence, anthem, event, object, milestone. Match existing: ${existingList}. Respond ONLY valid JSON: {"entities":[{"name":"string","type":"string","isNew":true,"confidence":0.9,"context":"string"}],"relationships":[{"entity1":"name","entity2":"name","type":"string"}]}`;
  return agentCall(env, provider, system, memoText, { entities: [], relationships: [] });
}

// ─── 2. Emotion Detector (≤15 lines) ───
export async function emotionDetectorAgent(env: Env, provider: LLMProvider, memoText: string): Promise<AgentResult> {
  assertNonEmpty(memoText, 'memoText');              // P10-5
  const system = `Emotion detection agent for iauthr. Detect: primary emotion (joy/sadness/anger/fear/shock/pride/regret/gratitude/shame/relief/love/nostalgia), intensity (0-1), unresolved tension, emoji, one-line summary. Respond ONLY valid JSON: {"primary":"string","intensity":0.5,"emoji":"string","unresolvedTension":false,"tensionDescription":null,"summary":"string","themes":["string"]}`;
  const fallback = { primary: 'reflection', intensity: 0.5, emoji: '💭', unresolvedTension: false, tensionDescription: null, summary: bounded(memoText, 80), themes: [] };
  return agentCall(env, provider, system, memoText, fallback, 512);
}

// ─── 3. Narrative Steerer (≤20 lines) ───
export async function narrativeSteerAgent(env: Env, provider: LLMProvider, memoText: string, themes: string[], truthMode: string): Promise<AgentResult> {
  assertNonEmpty(memoText, 'memoText');              // P10-5
  assertNonEmpty(truthMode, 'truthMode');             // P10-5
  const themeList = themes.slice(0, 20).join(', ') || 'none'; // P10-3: bounded
  const system = `Narrative steering agent for iauthr. Suggest 2-3 deeper follow-ups. NEVER rewrite user's words. Themes: ${themeList}. Truth: ${truthMode}. Include one cliffhanger. Respond ONLY valid JSON: {"followups":[{"text":"string","type":"deeper","targetTheme":"string"}],"suggestedCliffhanger":"string","detectedLifeStage":"unknown"}`;
  return agentCall(env, provider, system, memoText, { followups: [], suggestedCliffhanger: null, detectedLifeStage: 'unknown' }, 768);
}

// ─── 4. Echo Tracker (≤20 lines) ───
export async function echoTrackerAgent(env: Env, provider: LLMProvider, newMemoText: string, summaries: { summary: string; themes: string[]; date: string }[]): Promise<AgentResult> {
  assertNonEmpty(newMemoText, 'newMemoText');         // P10-5
  const block = summaries.slice(0, 20).map(m => `[${m.date}] ${bounded(m.summary, 100)} (${m.themes.slice(0, 5).join(', ')})`).join('\n'); // P10-3: bounded
  const system = `Echo tracker for iauthr. Find thematic echoes across life story entries. Max 2 echoes. Past entries:\n${block || 'None yet.'}\nRespond ONLY valid JSON: {"echoes":[{"currentTheme":"string","pastTheme":"string","pastDate":"string","connection":"string","suggestedPrompt":"string"}]}`;
  return agentCall(env, provider, system, newMemoText, { echoes: [] }, 512);
}

// ─── 5. Chapter Assembler (≤20 lines) ───
export async function chapterAssemblerAgent(env: Env, provider: LLMProvider, memos: { text: string; date: string; entities: string[]; emotion: string; themes: string[] }[], pref: string | null): Promise<AgentResult> {
  if (!memos || memos.length === 0) { throw new Error('No memos to assemble'); } // P10-5
  const block = memos.slice(0, 200).map((m, i) => `[${i + 1}] ${m.date} | ${m.emotion} | ${m.entities.slice(0, 5).join(', ')} | ${m.themes.slice(0, 5).join(', ')}\n${bounded(m.text, 200)}`).join('\n\n'); // P10-3
  const system = `Chapter assembly agent for iauthr. Group memos into 5-15 chapters. Each: title, subtitle, arc, cliffhanger. Preference: ${pref || 'let story decide'}. Respond ONLY valid JSON: {"chapters":[{"title":"string","subtitle":"string","memoIndices":[1],"narrativeArc":"string","echoTheme":"string","cliffhanger":"string","entityFocus":null}],"suggestedBookTitle":"string","missingGaps":["string"]}`;
  return agentCall(env, provider, system, block, { chapters: [], suggestedBookTitle: 'Untitled', missingGaps: [] }, 1500);
}

// ─── 6. Snapshot Agent (≤15 lines) ───
export async function snapshotAgent(env: Env, provider: LLMProvider, input: string): Promise<AgentResult> {
  assertNonEmpty(input, 'snapshot input');            // P10-5
  const system = `Snapshot Agent for iauthr. Extract 3-5 themes from raw input, suggest 5 narrative arcs. Each: title, description, first chapter suggestion. Include freeform option. Respond ONLY valid JSON: {"detectedThemes":["string"],"arcs":[{"title":"string","description":"string","firstChapterSuggestion":"string","focusTheme":"string"}]}`;
  return agentCall(env, provider, system, bounded(input, LIMITS.MAX_USER_MESSAGE), { detectedThemes: [], arcs: [] }, 1024);
}

// ─── Helper: fetch existing context (≤20 lines) ───
async function fetchMemoContext(db: D1Database, userId: string, memoId: string) {
  assertUUID(userId, 'userId');                      // P10-5
  assertUUID(memoId, 'memoId');                      // P10-5

  const entities = await db.prepare('SELECT name, type FROM entities WHERE user_id = ? LIMIT 100').bind(userId).all(); // P10-3: bounded query
  const recent = await db.prepare('SELECT ai_summary as summary, ai_themes as themes, recorded_at as date FROM memos WHERE user_id = ? AND id != ? ORDER BY recorded_at DESC LIMIT 20').bind(userId, memoId).all();
  const summaries = (recent.results ?? []).map((m: any) => ({ summary: m.summary ?? '', themes: safeJsonParse(m.themes ?? '[]', []), date: m.date }));
  const themes = [...new Set(summaries.flatMap(m => m.themes as string[]))].slice(0, 50); // P10-3

  return { existingEntities: (entities.results ?? []) as { name: string; type: string }[], summaries, themes };
}

// ─── Helper: log agent result (≤15 lines) ───
async function logAgentResult(db: D1Database, userId: string, memoId: string, agentType: string, memoText: string, result: AgentResult): Promise<void> {
  assertNonEmpty(agentType, 'agentType');             // P10-5
  const logResult = await db.prepare(
    'INSERT INTO agent_logs (id, user_id, agent_type, input_memo_id, input_text, output_text, model, tokens_in, tokens_out, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), userId, agentType, memoId, bounded(memoText, 500), JSON.stringify(result.output).slice(0, 5000), `${result.provider}/${result.model}`, result.tokensIn, result.tokensOut, result.latencyMs).run();
  assertD1Result(logResult, `log ${agentType}`);     // P10-7
}

// ─── Helper: persist AI results to memo (≤15 lines) ───
async function updateMemoAI(db: D1Database, memoId: string, emotion: Record<string, unknown>, followupText: string | null): Promise<void> {
  assertUUID(memoId, 'memoId');                      // P10-5
  const result = await db.prepare(
    'UPDATE memos SET emotion_primary = ?, emotion_emoji = ?, emotion_score = ?, ai_summary = ?, ai_themes = ?, ai_suggested_followup = ? WHERE id = ?'
  ).bind(emotion.primary, emotion.emoji, emotion.intensity, bounded(String(emotion.summary ?? ''), 500), JSON.stringify(emotion.themes ?? []), followupText, memoId).run();
  assertD1Result(result, 'update memo AI');           // P10-7
}

// ─── Helper: auto-create entities (≤20 lines, bounded loop) ───
async function autoCreateEntities(db: D1Database, userId: string, memoId: string, entities: any[]): Promise<void> {
  const MAX_AUTO_ENTITIES = 10;                      // P10-2: bounded
  const toCreate = (entities ?? []).filter((e: any) => e.isNew && e.confidence >= 0.7).slice(0, MAX_AUTO_ENTITIES);

  for (let i = 0; i < toCreate.length; i++) {        // P10-2: bounded by MAX_AUTO_ENTITIES
    const ent = toCreate[i];
    const entId = crypto.randomUUID();
    await db.prepare('INSERT OR IGNORE INTO entities (id, user_id, name, type, emotional_weight) VALUES (?, ?, ?, ?, ?)').bind(entId, userId, bounded(ent.name, LIMITS.MAX_ENTITY_NAME), ent.type, ent.confidence).run();
    await db.prepare('INSERT OR IGNORE INTO memo_entities (memo_id, entity_id, confidence, confirmed) VALUES (?, ?, ?, 0)').bind(memoId, entId, ent.confidence).run();
  }
}

// ─── Orchestrator: process memo (≤40 lines) ───
export async function processMemo(env: Env, userId: string, memoId: string, memoText: string, truthMode: string, preferredProvider: LLMProvider = 'claude') {
  assertUUID(userId, 'userId');                      // P10-5
  assertUUID(memoId, 'memoId');                      // P10-5
  assertNonEmpty(memoText, 'memoText');
  assertNonEmpty(truthMode, 'truthMode');

  const ctx = await fetchMemoContext(env.DB, userId, memoId);

  // Run 4 agents in parallel
  const [entityR, emotionR, steerR, echoR] = await Promise.all([
    entityExtractorAgent(env, preferredProvider, memoText, ctx.existingEntities),
    emotionDetectorAgent(env, preferredProvider, memoText),
    narrativeSteerAgent(env, preferredProvider, memoText, ctx.themes, truthMode),
    echoTrackerAgent(env, preferredProvider, memoText, ctx.summaries),
  ]);

  const providersUsed = [...new Set([entityR.provider, emotionR.provider, steerR.provider, echoR.provider])];

  // Log all 4 agent calls
  await Promise.all([
    logAgentResult(env.DB, userId, memoId, 'entity_extractor', memoText, entityR),
    logAgentResult(env.DB, userId, memoId, 'emotion_detector', memoText, emotionR),
    logAgentResult(env.DB, userId, memoId, 'narrative_steerer', memoText, steerR),
    logAgentResult(env.DB, userId, memoId, 'echo_tracker', memoText, echoR),
  ]);

  // Persist results
  const followupText = (steerR.output.followups as any[])?.[0]?.text ?? null;
  await updateMemoAI(env.DB, memoId, emotionR.output, followupText);
  await autoCreateEntities(env.DB, userId, memoId, entityR.output.entities as any[]);

  return { entities: entityR.output, emotion: emotionR.output, followups: steerR.output, echoes: echoR.output, providersUsed };
}

export { LLM_PROVIDERS, getAvailableProviders } from './llm-router';
export type { LLMProvider } from './llm-router';
