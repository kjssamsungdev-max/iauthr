// POST/GET /api/chapters — P10 Compliant
import { chapterAssemblerAgent } from '../../src/agents/index';
import { assertNonEmpty, assertD1Result, errorResponse, jsonResponse, safeJsonParse } from '../../src/utils/validate';

interface Env { DB: D1Database; AUDIO: R2Bucket; ANTHROPIC_API_KEY: string; [key: string]: unknown; }

// ─── Helper: fetch & format memos for assembly (≤25 lines) ───
async function fetchMemosForAssembly(db: D1Database, userId: string) {
  assertNonEmpty(userId, 'userId');                          // P10-5
  const result = await db.prepare(
    `SELECT m.transcript as text, m.recorded_at as date, m.emotion_primary as emotion, m.ai_themes as themes, GROUP_CONCAT(e.name, ', ') as entity_names FROM memos m LEFT JOIN memo_entities me ON m.id = me.memo_id LEFT JOIN entities e ON me.entity_id = e.id WHERE m.user_id = ? AND m.is_private = 0 GROUP BY m.id ORDER BY m.recorded_at ASC LIMIT 500`
  ).bind(userId).all();                                      // P10-3: bounded to 500
  if (!result.success) { throw new Error('D1 query failed'); } // P10-7

  return (result.results ?? []).map((m: any) => ({
    text: m.text ?? '', date: m.date ?? '',
    entities: m.entity_names ? m.entity_names.split(', ').slice(0, 20) : [], // P10-3
    emotion: m.emotion ?? 'reflection',
    themes: safeJsonParse(m.themes ?? '[]', []),
  }));
}

// ─── Helper: save chapters to DB (≤20 lines) ───
async function saveChapters(db: D1Database, userId: string, chapters: any[]): Promise<void> {
  assertNonEmpty(userId, 'userId');                          // P10-5
  const MAX_CHAPTERS = 20;                                   // P10-2: bounded
  const toSave = (chapters ?? []).slice(0, MAX_CHAPTERS);
  for (let i = 0; i < toSave.length; i++) {
    const ch = toSave[i];
    const r = await db.prepare(
      `INSERT INTO chapters (id, user_id, title, subtitle, chapter_order, cliffhanger, echo_theme, narrative_arc, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`
    ).bind(crypto.randomUUID(), userId, ch.title ?? 'Untitled', ch.subtitle ?? '', i + 1, ch.cliffhanger ?? '', ch.echoTheme ?? '', ch.narrativeArc ?? '').run();
    assertD1Result(r, `insert chapter ${i + 1}`);            // P10-7
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const body = await request.json() as any;
    assertNonEmpty(body?.userId, 'userId');                  // P10-5
    const memos = await fetchMemosForAssembly(env.DB, body.userId);
    if (memos.length < 3) { return errorResponse('Need at least 3 memos', 400); } // P10-5

    const result = await chapterAssemblerAgent(env, body.provider ?? 'claude', memos, body.preference ?? null);
    await saveChapters(env.DB, body.userId, result.output.chapters as any[]);
    return jsonResponse({ chapters: result.output.chapters, suggestedTitle: result.output.suggestedBookTitle, gaps: result.output.missingGaps });
  } catch (err: any) { return errorResponse(err.message, 500); }
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const userId = new URL(request.url).searchParams.get('userId');
    assertNonEmpty(userId, 'userId');                        // P10-5
    const result = await env.DB.prepare('SELECT c.*, COUNT(m.id) as memo_count FROM chapters c LEFT JOIN memos m ON m.chapter_id = c.id WHERE c.user_id = ? GROUP BY c.id ORDER BY c.chapter_order ASC LIMIT 50').bind(userId).all(); // P10-3
    if (!result.success) { throw new Error('D1 query failed'); } // P10-7
    return jsonResponse({ chapters: result.results ?? [] });
  } catch (err: any) { return errorResponse(err.message, 400); }
};
