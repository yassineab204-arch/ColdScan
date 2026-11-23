/**
 * Client for passwordless email authentication.
 *
 * There is no auth logic here: the browser asks the ColdScan server to email a
 * code and then to verify it. It never talks to Supabase, never sees an API key
 * or token, and never decides that an address is verified.
 *
 * The resulting session lives in an HttpOnly cookie this code cannot read; the
 * only state kept in React is whether the server says the browser is signed in.
 */

import type { TrialStatus } from './trial';

export type AuthErrorCode =
  | 'invalid_email'
  | 'invalid_code'
  | 'rate_limited'
  | 'unavailable'
  | 'network';

export interface AuthAction {
  ok: boolean;
  trial?: TrialStatus | null;
  error?: AuthErrorCode;
}

function isTrial(value: unknown): value is TrialStatus {
  return Boolean(value) && typeof (value as TrialStatus).expiresAt === 'string';
}

async function authRequest(init: RequestInit): Promise<Response> {
  return fetch('/api/auth', {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
}

function errorFromStatus(status: number, action: 'start' | 'verify'): AuthErrorCode {
  if (status === 429) return 'rate_limited';
  if (status === 400) return action === 'start' ? 'invalid_email' : 'invalid_code';
  if (status === 502 || status === 503) return 'unavailable';
  return 'unavailable';
}

/** Reads whether this browser currently has an email session. */
export async function fetchAuthState(): Promise<boolean | null> {
  try {
    const res = await authRequest({ method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.authenticated === true;
  } catch {
    return null;
  }
}

async function postAuth(body: Record<string, unknown>): Promise<AuthAction> {
  try {
    const res = await authRequest({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);

    return {
      ok: res.ok && data?.success === true,
      trial: isTrial(data?.trial) ? data.trial : null,
      error: res.ok ? undefined : errorFromStatus(res.status, body.action === 'start' ? 'start' : 'verify'),
    };
  } catch {
    return { ok: false, error: 'network' };
  }
}

/** Asks the server to email a one-time code. Grants no access by itself. */
export function startEmailCode(email: string): Promise<AuthAction> {
  return postAuth({ action: 'start', email });
}

/** Sends the code the user received. Only the server can verify it. */
export function verifyEmailCode(email: string, token: string): Promise<AuthAction> {
  return postAuth({ action: 'verify', email, token });
}

/** Clears this browser's email session. The trial and its clock are untouched. */
export function signOutEmail(): Promise<AuthAction> {
  return postAuth({ action: 'sign-out' });
}
