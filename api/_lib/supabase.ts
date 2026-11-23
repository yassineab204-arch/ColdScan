/**
 * Supabase Auth (GoTrue) — SERVER-ONLY client for email OTP.
 *
 * Why a hand-written REST client instead of @supabase/supabase-js:
 *   - the serverless functions need exactly two calls, so there is nothing to
 *     manage (no session storage, no token refresh, no realtime);
 *   - it keeps the dependency surface (and the bundle) unchanged;
 *   - it makes it obvious that the browser never talks to Supabase and never
 *     receives a Supabase token.
 *
 * Credentials:
 *   SUPABASE_URL          e.g. https://<project-ref>.supabase.co
 *   SUPABASE_ANON_KEY     the publishable/anon key (NOT the service-role key)
 *
 * Both are read lazily, per invocation, and are never logged or returned to the
 * browser. The service-role key is deliberately NOT supported here: OTP
 * verification only needs the public auth endpoints, and keeping a service key
 * out of the deployment removes the most dangerous secret entirely.
 */

const REQUEST_TIMEOUT_MS = 8000;
/** GoTrue issues 6-digit codes by default; this project is configured for 8. */
const TOKEN_RE = /^\d{4,10}$/;

export function isOtpTokenFormat(token: string): boolean {
  return TOKEN_RE.test(token);
}

function credentials(): { url: string; key: string } {
  return {
    url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    // New Supabase projects label the public key "publishable"; older ones use
    // "anon". Accept either name so the deployment does not break on naming.
    key: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '',
  };
}

/** True when both pieces of Supabase configuration are present. */
export function supabaseConfigured(): boolean {
  const { url, key } = credentials();
  return Boolean(url && key);
}

export type ProviderFailure =
  | 'not_configured'
  | 'invalid_email'
  | 'invalid_code'
  | 'rate_limited'
  | 'unavailable';

export type OtpRequestResult =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: ProviderFailure };

export type OtpVerifyResult =
  | { ok: true; userId: string; email: string; reason?: undefined }
  | { ok: false; reason: ProviderFailure };

interface AuthFetchResult {
  status: number;
  body: any;
}

/**
 * Performs one auth call. Errors are mapped to a small, vendor-neutral set so
 * no GoTrue message (which can reveal whether an address exists) ever reaches
 * the browser. Nothing is logged here either; callers log status codes only.
 */
async function authFetch(path: string, payload: Record<string, unknown>): Promise<AuthFetchResult> {
  const { url, key } = credentials();
  if (!url || !key) throw new Error('supabase_not_configured');

  const res = await fetch(`${url}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  return { status: res.status, body };
}

/** Asks Supabase to email a one-time code. Creates the user if needed. */
export async function requestEmailOtp(email: string): Promise<OtpRequestResult> {
  if (!supabaseConfigured()) return { ok: false, reason: 'not_configured' };

  try {
    const { status } = await authFetch('otp', {
      email,
      create_user: true,
      gotrue_meta_security: {},
    });

    if (status === 429) return { ok: false, reason: 'rate_limited' };
    // A provider-side 400/422 can mean many things (sign-ups disabled, sender
    // restriction, invalid domain). Our own regex already rejected malformed
    // addresses, so surface a neutral "could not send" rather than blaming the
    // user's address — and never echo the provider's message.
    if (status === 400 || status === 422) return { ok: false, reason: 'unavailable' };
    if (status < 200 || status >= 300) return { ok: false, reason: 'unavailable' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/**
 * Verifies the code with Supabase. On success we keep ONLY the user id and the
 * confirmed address; the returned access/refresh tokens are discarded.
 */
export async function verifyEmailOtp(email: string, token: string): Promise<OtpVerifyResult> {
  if (!supabaseConfigured()) return { ok: false, reason: 'not_configured' };

  try {
    const { status, body } = await authFetch('verify', { type: 'email', email, token });

    if (status === 429) return { ok: false, reason: 'rate_limited' };
    if (status === 400 || status === 401 || status === 403 || status === 422) {
      return { ok: false, reason: 'invalid_code' };
    }
    if (status < 200 || status >= 300) return { ok: false, reason: 'unavailable' };

    const userId = typeof body?.user?.id === 'string' ? body.user.id : '';
    const confirmedEmail = typeof body?.user?.email === 'string' ? body.user.email : '';

    // Defensive checks: the provider must confirm the same address we asked
    // about, and the subject must be a real UUID. Otherwise treat it as failed.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return { ok: false, reason: 'unavailable' };
    }
    if (confirmedEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      return { ok: false, reason: 'unavailable' };
    }

    return { ok: true, userId, email: confirmedEmail.trim().toLowerCase() };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
