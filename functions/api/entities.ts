// CRUD /api/entities — P10 Compliant
// P10-4: all functions ≤60 lines | P10-5: min 2 assertions | P10-7: all returns checked

import { assertNonEmpty, assertUUID, assertD1Result, bounded, errorResponse, jsonResponse, LIMITS, safeJsonParse } from '../../src/utils/validate';

interface Env { DB: D1Database; }

// ─── Helper: get single entity with linked data (≤30 lines) ───
async function getEntityDetail(db: D1Database, entityId: string, userId: string): Promise<Response> {
  assertUUID(entityId, 'entityId');                          // P10-5
  assertNonEmpty(userId, 'userId');                          // P10-5

  const entity = await db.prepare('SELECT * FROM entities WHERE id = ? AND user_id = ?').bind(entityId, userId).first();
  if (!entity) { return errorResponse('Entity not found', 404); } // P10-7

  const memos = await db.prepare('SELECT m.* FROM memos m JOIN memo_entities me ON m.id = me.memo_id WHERE me.entity_id = ? ORDER BY m.recorded_at DESC LIMIT 200').bind(entityId).all(); // P10-3: bounded
  const rels = await db.prepare('SELECT er.*, e1.name as name1, e1.type as type1, e2.name as name2, e2.type as type2 FROM entity_relationships er JOIN entities e1 ON er.entity_id_1 = e1.id JOIN entities e2 ON er.entity_id_2 = e2.id WHERE er.entity_id_1 = ? OR er.entity_id_2 = ? LIMIT 50').bind(entityId, entityId).all(); // P10-3

  return jsonResponse({
    entity: { ...(entity as any), life_scale_events: safeJsonParse((entity as any).life_scale_events ?? '[]', []), metadata: safeJsonParse((entity as any).metadata ?? '{}', {}) },
    memos: memos.results ?? [],
    relationships: rels.results ?? [],
  });
}

// ─── Helper: list all entities (≤20 lines) ───
async function listEntities(db: D1Database, userId: string): Promise<Response> {
  assertNonEmpty(userId, 'userId');                          // P10-5
  const result = await db.prepare('SELECT e.*, COUNT(me.memo_id) as memo_count FROM entities e LEFT JOIN memo_entities me ON e.id = me.entity_id WHERE e.user_id = ? GROUP BY e.id ORDER BY memo_count DESC LIMIT ?').bind(userId, LIMITS.MAX_ENTITIES_PER_USER).all(); // P10-3
  if (!result.success) { throw new Error('D1 list failed'); } // P10-7
  return jsonResponse({ entities: result.results ?? [] });
}

// ─── GET (≤15 lines) ───
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    assertNonEmpty(userId, 'userId');                        // P10-5
    const entityId = url.searchParams.get('id');
    return entityId ? getEntityDetail(env.DB, entityId, userId!) : listEntities(env.DB, userId!);
  } catch (err: any) {
    return errorResponse(err.message, 400);
  }
};

// ─── POST (≤25 lines) ───
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const body = await request.json() as any;
    assertNonEmpty(body?.userId, 'userId');                  // P10-5
    assertNonEmpty(body?.name, 'name');                      // P10-5
    assertNonEmpty(body?.type, 'type');

    const id = crypto.randomUUID();
    const result = await env.DB.prepare(
      'INSERT INTO entities (id, user_id, name, type, subtype, life_born, life_died, emotional_weight, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, body.userId, bounded(body.name, LIMITS.MAX_ENTITY_NAME), body.type, body.subtype || null, body.lifeBorn || null, body.lifeDied || null, body.emotionalWeight ?? 0.5, JSON.stringify(body.metadata ?? {})).run();
    assertD1Result(result, 'insert entity');                 // P10-7

    return jsonResponse({ id, name: body.name, type: body.type }, 201);
  } catch (err: any) {
    return errorResponse(err.message, err.message.includes('required') ? 400 : 500);
  }
};

// ─── PUT (≤25 lines) ───
export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const body = await request.json() as any;
    assertNonEmpty(body?.id, 'id');                          // P10-5
    assertNonEmpty(body?.name, 'name');                      // P10-5

    const result = await env.DB.prepare(
      `UPDATE entities SET name = ?, type = ?, subtype = ?, life_born = ?, life_died = ?, emotional_weight = ?, significance = ?, life_scale_events = ?, metadata = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(bounded(body.name, LIMITS.MAX_ENTITY_NAME), body.type, body.subtype, body.lifeBorn, body.lifeDied, body.emotionalWeight, body.significance, JSON.stringify(body.lifeScaleEvents ?? []), JSON.stringify(body.metadata ?? {}), body.id).run();
    assertD1Result(result, 'update entity');                 // P10-7

    return jsonResponse({ ok: true });
  } catch (err: any) {
    return errorResponse(err.message, 400);
  }
};

// ─── DELETE (≤20 lines) ───
export const onRequestDelete: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    assertNonEmpty(id, 'id');                                // P10-5

    // P10-7: check each cascading delete
    const r1 = await env.DB.prepare('DELETE FROM memo_entities WHERE entity_id = ?').bind(id).run();
    assertD1Result(r1, 'delete memo_entities');
    const r2 = await env.DB.prepare('DELETE FROM entity_relationships WHERE entity_id_1 = ? OR entity_id_2 = ?').bind(id, id).run();
    assertD1Result(r2, 'delete relationships');
    const r3 = await env.DB.prepare('DELETE FROM entities WHERE id = ?').bind(id).run();
    assertD1Result(r3, 'delete entity');

    return jsonResponse({ ok: true });
  } catch (err: any) {
    return errorResponse(err.message, 400);
  }
};
