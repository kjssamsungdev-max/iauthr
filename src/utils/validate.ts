// P10-5: Min 2 assertions per function
// P10-7: Check every return value
// Shared validation guards for iauthr

const MAX_MEMO_TEXT = 50_000;     // P10-3: bounded memory
const MAX_ENTITY_NAME = 200;
const MAX_ENTITIES_PER_USER = 500;
const MAX_SPARKS_PER_USER = 10_000;
const MAX_SYSTEM_PROMPT = 4_000;
const MAX_USER_MESSAGE = 50_000;
const MAX_ENTITY_TYPES = 14;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const LIMITS = {
  MAX_MEMO_TEXT,
  MAX_ENTITY_NAME,
  MAX_ENTITIES_PER_USER,
  MAX_SPARKS_PER_USER,
  MAX_SYSTEM_PROMPT,
  MAX_USER_MESSAGE,
  MAX_ENTITY_TYPES,
} as const;  // P10-6: immutable

export const VALID_TRUTH_MODES = ['brutal', 'clean', 'fiction'] as const;
export type TruthMode = typeof VALID_TRUTH_MODES[number];

export const VALID_SOURCES = ['text', 'voice', 'prompt', 'trigger'] as const;
export type MemoSource = typeof VALID_SOURCES[number];

// P10-5: assertion helpers — throw on invalid input
export function assertNonEmpty(val: unknown, name: string): asserts val is string {
  if (typeof val !== 'string' || val.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

export function assertUUID(val: unknown, name: string): asserts val is string {
  assertNonEmpty(val, name);
  if (!UUID_REGEX.test(val as string)) {
    throw new Error(`${name} must be a valid UUID`);
  }
}

export function assertBounded(val: string, maxLen: number, name: string): void {
  if (val.length > maxLen) {
    throw new Error(`${name} exceeds max length ${maxLen} (got ${val.length})`);
  }
}

export function assertTruthMode(val: unknown): asserts val is TruthMode {
  if (!VALID_TRUTH_MODES.includes(val as TruthMode)) {
    throw new Error(`Invalid truth mode: ${val}. Must be ${VALID_TRUTH_MODES.join(', ')}`);
  }
}

export function assertSource(val: unknown): asserts val is MemoSource {
  if (!VALID_SOURCES.includes(val as MemoSource)) {
    throw new Error(`Invalid source: ${val}. Must be ${VALID_SOURCES.join(', ')}`);
  }
}

// P10-7: check D1 result and throw if failed
export function assertD1Result(result: D1Result<unknown>, operation: string): void {
  if (!result.success) {
    throw new Error(`D1 ${operation} failed: ${result.error || 'unknown'}`);
  }
}

// P10-7: check R2 result
export function assertR2Put(obj: R2Object | null, key: string): asserts obj is R2Object {
  if (!obj) {
    throw new Error(`R2 put failed for key: ${key}`);
  }
}

// P10-3: truncate to bounded length (safe, no mutation)
export function bounded(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

// P10-7: safe JSON parse with fallback
export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean) as T;
  } catch {
    return fallback;
  }
}

// P10-7: HTTP error response builder
export function errorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

// P10-7: HTTP success response builder
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}
