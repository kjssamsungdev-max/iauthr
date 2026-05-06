// POST /api/snapshot — P10 Compliant
import { snapshotAgent } from '../../src/agents/index';
import { assertNonEmpty, assertD1Result, bounded, errorResponse, jsonResponse, LIMITS } from '../../src/utils/validate';

interface Env { DB: D1Database; ANTHROPIC_API_KEY: string; [key: string]: unknown; }

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const body = await request.json() as any;
    assertNonEmpty(body?.userId, 'userId');                  // P10-5
    assertNonEmpty(body?.input, 'input');                    // P10-5

    const input = bounded(body.input, LIMITS.MAX_USER_MESSAGE); // P10-3
    const result = await snapshotAgent(env, body.provider ?? 'claude', input);

    // P10-7: log with checked result
    const logResult = await env.DB.prepare(
      `INSERT INTO agent_logs (id, user_id, agent_type, input_text, output_text, model, tokens_in, tokens_out, latency_ms) VALUES (?, ?, 'snapshot', ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), body.userId, bounded(input, 500), JSON.stringify(result.output).slice(0, 5000), `${result.provider}/${result.model}`, result.tokensIn, result.tokensOut, result.latencyMs).run();
    assertD1Result(logResult, 'log snapshot');               // P10-7

    return jsonResponse(result.output);
  } catch (err: any) {
    return errorResponse(err.message, err.message.includes('required') ? 400 : 500);
  }
};
