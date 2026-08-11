/**
 * Server-only cryptographic helpers for the trial gate.
 *
 * The signing key comes from the `TRIAL_SECRET` environment variable and is
 * never hardcoded, never logged, and never sent to the browser. It is used to
 * (1) sign the session cookie, (2) derive opaque identifiers from emails and
 * device signals so no raw personal data is stored, and (3) hash access codes.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const IS_PRODUCTION =
  process.env.VERCEL_ENV === 'production' ||
  process.env.VERCEL_ENV === 'preview' ||
  process.env.NODE_ENV === 'production';

/**
 * Ephemeral development key. Generated per process so local dev works without
 * configuration; sessions simply do not survive a restart. Never used when the
 * code runs on Vercel — there a missing `TRIAL_SECRET` is a hard failure.
 */
let devSecret: string | null = null;
let warnedAboutDevSecret = false;

export function isTrialSecretConfigured(): boolean {
  return Boolean(process.env.TRIAL_SECRET && process.env.TRIAL_SECRET.length >= 16);
}

/** Throws when the deployment has no signing key, so the gate fails closed. */
function getSecret(): string {
  const configured = process.env.TRIAL_SECRET;
  if (configured && configured.length >= 16) return configured;

  if (IS_PRODUCTION) {
    throw new Error('TRIAL_SECRET is not configured');
  }

  if (!devSecret) {
    devSecret = randomBytes(32).toString('hex');
  }
  if (!warnedAboutDevSecret) {
    warnedAboutDevSecret = true;
    console.warn(
      '[trial] TRIAL_SECRET is not set. Using a random development key: sessions reset on ' +
        'every restart. Set TRIAL_SECRET in .env (and in Vercel) before deploying.'
    );
  }
  return devSecret;
}

/** Keyed hash, base64url encoded. `scope` domain-separates the different uses. */
export function hmac(scope: string, value: string): string {
  return createHmac('sha256', getSecret())
    .update(`${scope}:${value}`)
    .digest('base64url');
}

/** Short opaque identifier derived from a value (e.g. an email or device signal). */
export function derivedId(scope: string, value: string): string {
  return hmac(scope, value).slice(0, 32);
}

export function randomId(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

/** Length-safe, constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
