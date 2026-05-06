// GET /api/prompts — P10 Compliant
import { errorResponse, jsonResponse } from '../../src/utils/validate';

interface Env { DB: D1Database; }

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const lifeStage = url.searchParams.get('lifeStage');

    let query = 'SELECT * FROM prompts WHERE 1=1';
    const bindings: string[] = [];

    if (category && category.length <= 50) {                 // P10-3: bounded input
      query += ' AND category = ?';
      bindings.push(category);
    }
    if (lifeStage && lifeStage.length <= 50) {               // P10-3
      query += ' AND (life_stage = ? OR life_stage IS NULL)';
      bindings.push(lifeStage);
    }

    query += ' ORDER BY sort_order ASC LIMIT 100';           // P10-3: bounded results

    const result = await env.DB.prepare(query).bind(...bindings).all();
    if (!result.success) { throw new Error('D1 query failed'); } // P10-7

    return jsonResponse({ prompts: result.results ?? [] });
  } catch (err: any) {
    return errorResponse(err.message, 500);
  }
};
