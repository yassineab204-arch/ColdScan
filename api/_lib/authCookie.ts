/**
 * Signed, HttpOnly session cookie for email authentication.
 *
 * This cookie is deliberately separate from the trial identity cookie
 * (`coldscan_sid`):
 *
 *   - `coldscan_sid` identifies the ACCOUNT and the trial clock. It never
 *     depends on an email, and it must keep working when someone is signed out.
 *   - `coldscan_auth` records "this browser proved control of the email tied to
 *     this account". It can be cleared on sign-out without touching the trial,
 *     and clearing it never hands out a new trial.
 *
 * Nothing here is readable by page JavaScript, and no Supabase token or secret
 * is ever stored in it — only the account id, the Supabase user id and an
 * expiry, all covered by an HMAC keyed with `TRIAL_SECRET`.
 */

import { hmac, safeEqual } from './secrets.js';
import { isSecureRequest, parseCookies, setCookie } from './http.js';
import type { ApiRequest, ApiResponse } from './http.js';

export const AUTH_COOKIE_NAME = 'coldscan_auth';
const AUTH_COOKIE_VERSION = 'v1';
/** Sessions last 30 days; after that the user simply verifies their email again. */
const AUTH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuthSession {
  accountId: string;
  userId: string;
  /** Absolute expiry, milliseconds since epoch. */
  expiresAt: number;
}

export function isSupabaseUserId(value: string): boolean {
  return UUID_RE.test(value);
}

/** HMAC over every field, so none of them can be edited by the browser. */
function signature(accountId: string, userId: string, expiresAt: number): string {
  return hmac('auth-session', `${accountId}:${userId}:${expiresAt}`);
}

export function signAuthCookie(accountId: string, userId: string, now = Date.now()): string {
  const expiresAt = now + AUTH_MAX_AGE_SECONDS * 1000;
  return [
    AUTH_COOKIE_VERSION,
    accountId,
    userId,
    String(expiresAt),
    signature(accountId, userId, expiresAt),
  ].join('.');
}

export function verifyAuthCookieValue(value: string | undefined, now = Date.now()): AuthSession | null {
  if (!value) return null;

  const parts = value.split('.');
  if (parts.length !== 5) return null;

  const [version, accountId, userId, expiresRaw, provided] = parts;
  if (version !== AUTH_COOKIE_VERSION) return null;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(accountId!)) return null;
  if (!isSupabaseUserId(userId!)) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

  try {
    if (!safeEqual(provided!, signature(accountId!, userId!, expiresAt))) return null;
  } catch {
    return null;
  }

  return { accountId: accountId!, userId: userId!, expiresAt };
}

/** Reads the signed session from the request. Never trusts an unsigned value. */
export function readAuthSession(req: ApiRequest, now = Date.now()): AuthSession | null {
  const cookies = parseCookies(req);
  return verifyAuthCookieValue(cookies[AUTH_COOKIE_NAME], now);
}

export function setAuthCookie(
  req: ApiRequest,
  res: ApiResponse,
  accountId: string,
  userId: string
): void {
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(signAuthCookie(accountId, userId))}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${AUTH_MAX_AGE_SECONDS}`,
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  setCookie(res, parts.join('; '));
}

export function clearAuthCookie(req: ApiRequest, res: ApiResponse): void {
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  setCookie(res, parts.join('; '));
}
