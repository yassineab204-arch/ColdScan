/**
 * Tiny Redis-over-HTTP client for the trial store.
 *
 * Vercel functions are stateless, so the trial clock has to live in a real
 * datastore. This talks to Upstash Redis / Vercel KV over their REST API with
 * plain `fetch` — no extra npm dependency, works on every runtime.
 *
 * Configure ONE of these pairs as environment variables (never in code):
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   KV_REST_API_URL        + KV_REST_API_TOKEN
 *
 * If neither is set the module falls back to a per-process in-memory map so
 * `npm run dev` still works. That fallback is NOT persistence: it is wiped on
 * every restart and is not shared between serverless instances, so
 * `isPersistentStore()` reports false and `/api/health` surfaces it.
 */

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

/** True when a real, shared datastore is configured. */
export function isPersistentStore(): boolean {
  return Boolean(REST_URL && REST_TOKEN);
}

/* ------------------------------------------------------------------ *
 * In-memory dev fallback
 * ------------------------------------------------------------------ */

interface MemoryEntry {
  value: string;
  expiresAt: number | null;
}

const memory = new Map<string, MemoryEntry>();
let warnedAboutMemory = false;

function warnMemory(): void {
  if (warnedAboutMemory) return;
  warnedAboutMemory = true;
  console.warn(
    '[trial] No Redis REST credentials found (UPSTASH_REDIS_REST_URL / KV_REST_API_URL). ' +
      'Falling back to an in-memory store: trials reset when the process restarts and are ' +
      'not shared between serverless instances. Configure the store before deploying.'
  );
}

function memoryGet(key: string): string | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

/* ------------------------------------------------------------------ *
 * REST transport
 * ------------------------------------------------------------------ */

async function command<T = unknown>(args: (string | number)[]): Promise<T | null> {
  if (!isPersistentStore()) {
    warnMemory();
    return null;
  }

  const res = await fetch(REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args.map(String)),
  });

  if (!res.ok) {
    // Never echo the datastore's response to the caller — it can contain the
    // endpoint and other infrastructure details.
    throw new Error(`kv command failed with status ${res.status}`);
  }

  const payload = (await res.json()) as { result?: T; error?: string };
  if (payload.error) throw new Error('kv command returned an error');
  return (payload.result ?? null) as T | null;
}

export async function kvGet(key: string): Promise<string | null> {
  if (!isPersistentStore()) {
    warnMemory();
    return memoryGet(key);
  }
  return (await command<string | null>(['GET', key])) ?? null;
}

export async function kvSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (!isPersistentStore()) {
    warnMemory();
    memory.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
    return;
  }
  const args: (string | number)[] = ['SET', key, value];
  if (ttlSeconds) args.push('EX', ttlSeconds);
  await command(args);
}

/** SET NX — returns true when the key was created by this call. */
export async function kvSetIfAbsent(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  if (!isPersistentStore()) {
    warnMemory();
    if (memoryGet(key) !== null) return false;
    memory.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
    return true;
  }
  const args: (string | number)[] = ['SET', key, value, 'NX'];
  if (ttlSeconds) args.push('EX', ttlSeconds);
  const result = await command<string | null>(args);
  return result === 'OK';
}

/** INCR with a TTL applied on first increment. Used for rate limiting. */
export async function kvIncrWithTtl(key: string, ttlSeconds: number): Promise<number> {
  if (!isPersistentStore()) {
    warnMemory();
    const current = Number(memoryGet(key) || 0) + 1;
    const existing = memory.get(key);
    memory.set(key, {
      value: String(current),
      expiresAt: existing?.expiresAt ?? Date.now() + ttlSeconds * 1000,
    });
    return current;
  }
  const count = Number((await command<number>(['INCR', key])) ?? 0);
  if (count === 1) await command(['EXPIRE', key, ttlSeconds]);
  return count;
}
