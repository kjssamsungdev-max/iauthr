// POST/GET /api/memos — P10 Compliant
// P10-4: all functions ≤60 lines | P10-5: min 2 assertions | P10-7: all returns checked

import { processMemo } from '../../src/agents/index';
import { assertNonEmpty, assertTruthMode, assertSource, assertD1Result, bounded, errorResponse, jsonResponse, LIMITS, VALID_TRUTH_MODES } from '../../src/utils/validate';

interface Env { DB: D1Database; AUDIO: R2Bucket; ANTHROPIC_API_KEY: string; [key: string]: unknown; }

// ─── Helper: validate + parse POST body (≤25 lines) ───
function validateMemoBody(body: any): { userId: string; text: string; truthMode: string; audioBase64?: string; location?: any; source: string; promptId?: string; provider: string } {
  assertNonEmpty(body?.userId, 'userId');                    // P10-5
  assertNonEmpty(body?.text, 'text');                        // P10-5

  const truthMode = body.truthMode || 'clean';
  assertTruthMode(truthMode);

  const source = body.source || 'text';
  assertSource(source);

  return {
    userId: body.userId,
    text: bounded(body.text, LIMITS.MAX_MEMO_TEXT),          // P10-3: bounded
    truthMode,
    audioBase64: body.audioBase64 || undefined,
    location: body.location || undefined,
    source,
    promptId: body.promptId || undefined,
    provider: body.provider || 'claude',
  };
}

// ─── Helper: upload audio to R2 (≤15 lines) ───
async function uploadAudio(bucket: R2Bucket, userId: string, memoId: string, base64: string): Promise<string> {
  assertNonEmpty(base64, 'audioBase64');                     // P10-5
  const key = `${userId}/${memoId}.webm`;
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const obj = await bucket.put(key, bytes, { httpMetadata: { contentType: 'audio/webm' } });
  if (!obj) { throw new Error(`R2 upload failed: ${key}`); } // P10-7
  return key;
}

// ─── Helper: insert memo row (≤20 lines) ───
async function insertMemo(db: D1Database, id: string, p: ReturnType<typeof validateMemoBody>, audioKey: string | null, now: string): Promise<void> {
  assertNonEmpty(id, 'memoId');                              // P10-5
  const wordCount = p.text.trim().split(/\s+/).length;
  const result = await db.prepare(
    `INSERT INTO memos (id, user_id, recorded_at, transcript, audio_key, truth_mode, is_private, word_count, source, prompt_id, location_lat, location_lng, location_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, p.userId, now, p.text, audioKey, p.truthMode, p.truthMode === 'brutal' ? 1 : 0, wordCount, p.source, p.promptId || null, p.location?.lat || null, p.location?.lng || null, p.location?.name || null).run();
  assertD1Result(result, 'insert memo');                     // P10-7
}

// ─── POST handler (≤30 lines) ───
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const body = await request.json();
    const params = validateMemoBody(body);
    const memoId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Upload audio if provided
    const audioKey = params.audioBase64
      ? await uploadAudio(env.AUDIO, params.userId, memoId, params.audioBase64)
      : null;

    await insertMemo(env.DB, memoId, params, audioKey, now);

    // Run agent pipeline (don't block on failure)
    let agents = null;
    try { agents = await processMemo(env, params.userId, memoId, params.text, params.truthMode, params.provider as any); }
    catch (err) { console.error('Agent pipeline error:', err); }

    return jsonResponse({ id: memoId, recorded_at: now, word_count: params.text.trim().split(/\s+/).length, agents }, 201);
  } catch (err: any) {
    return errorResponse(err.message, err.message.includes('required') ? 400 : 500);
  }
};

// ─── GET handler (≤40 lines) ───
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    assertNonEmpty(userId, 'userId');                        // P10-5

    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100); // P10-3: bounded
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
    const entityId = url.searchParams.get('entityId');
    const truthMode = url.searchParams.get('truthMode');

    let query = `SELECT m.*, GROUP_CONCAT(e.name || '|' || e.type || '|' || e.id, ';;') as entity_names FROM memos m LEFT JOIN memo_entities me ON m.id = me.memo_id LEFT JOIN entities e ON me.entity_id = e.id WHERE m.user_id = ?`;
    const bindings: any[] = [userId];

    if (entityId) { query += ` AND m.id IN (SELECT memo_id FROM memo_entities WHERE entity_id = ?)`; bindings.push(entityId); }
    if (truthMode && VALID_TRUTH_MODES.includes(truthMode as any)) { query += ` AND m.truth_mode = ?`; bindings.push(truthMode); }

    query += ` GROUP BY m.id ORDER BY m.recorded_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...bindings).all();
    if (!result.success) { throw new Error('D1 query failed'); } // P10-7

    const memos = (result.results ?? []).map((m: any) => ({
      ...m,
      ai_themes: JSON.parse(m.ai_themes || '[]'),
      entities: m.entity_names ? m.entity_names.split(';;').filter(Boolean).map((en: string) => { const [name, type, id] = en.split('|'); return { name, type, id }; }) : [],
    }));

    return jsonResponse({ memos, total: memos.length });
  } catch (err: any) {
    return errorResponse(err.message, err.message.includes('required') ? 400 : 500);
  }
};
