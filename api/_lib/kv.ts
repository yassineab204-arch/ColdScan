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

/**
 * Credentials are read lazily on every call rather than captured at module
 * load. The Vercel + Upstash Marketplace integration injects whichever pair it
 * chose (`UPSTASH_REDIS_REST_*` for a native Upstash resource,
 * `KV_REST_API_*` for the Vercel KV-style binding), and both Production and
 * Preview get their own values — reading late means we always see the ones for
 * the environment this invocation is actually running in.
 */
function credentials(): { url: string; token: string } {
  return {
    url: (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/+$/, ''),
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
  };
}

/** True when a real, shared datastore is configured. */
export function isPersistentStore(): boolean {
  const { url, token } = credentials();
  return Boolean(url && token);
}

/** Which env var pair is in use — surfaced by /api/health for debugging. */
export function storeBinding(): 'upstash' | 'vercel-kv' | 'memory' {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return 'upstash';
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) return 'vercel-kv';
  return 'memory';
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

/** Per-request timeout. Vercel functions cap at 60s; never hang that long. */
const REQUEST_TIMEOUT_MS = 5000;
/** One retry covers the occasional cold-start/transient network blip. */
const MAX_ATTEMPTS = 2;

async function command<T = unknown>(args: (string | number)[]): Promise<T | null> {
  const { url, token } = credentials();
  if (!url || !token) {
    warnMemory();
    return null;
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    // AbortSignal.timeout keeps a stalled datastore from eating the whole
    // function budget and turning into a user-visible timeout.
    const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args.map(String)),
        signal,
        cache: 'no-store',
      });

      // 4xx is a real error (bad token, malformed command) — retrying will not
      // help and would just burn free-plan quota. Only retry 5xx / network.
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`kv command rejected with status ${res.status}`);
      }
      if (!res.ok) {
        lastError = new Error(`kv command failed with status ${res.status}`);
        continue;
      }

      const payload = (await res.json()) as { result?: T; error?: string };
      // Never echo the datastore's message to the caller — it can contain the
      // endpoint, the key names and other infrastructure detail.
      if (payload.error) throw new Error('kv command returned an error');
      return (payload.result ?? null) as T | null;
    } catch (error) {
      const isAbort = (error as any)?.name === 'TimeoutError' || (error as any)?.name === 'AbortError';
      const isFatal = error instanceof Error && error.message.includes('rejected with status');
      if (isFatal) throw error;

      lastError = error;
      if (attempt === MAX_ATTEMPTS) break;
      if (isAbort) continue;
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('kv command failed');
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
