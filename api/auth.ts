/**
 * Passwordless email authentication (Supabase OTP) — server-side only.
 *
 *   GET  /api/auth                        -> { authenticated, trial }
 *   POST /api/auth { action: 'start',  email }
 *   POST /api/auth { action: 'verify', email, token }
 *   POST /api/auth { action: 'sign-out' }
 *
 * Security model:
 *   - The browser never talks to Supabase and never sees an API key or token.
 *   - `start` only asks Supabase to email a code. It grants nothing, and its
 *     response is identical for known and unknown addresses (no enumeration).
 *   - `verify` is the ONLY place an email becomes trusted, and it happens only
 *     after Supabase confirms the one-time code for that exact address.
 *   - A successful verification sets a signed, HttpOnly session cookie. The
 *     FIRST verification of a preview account starts its 48-hour clock; later
 *     verifications never reset or shorten it. Verification alone does not
 *     unlock premium access — the feature gates remain authoritative.
 *   - Rate limits are fail-closed: if the limiter cannot be consulted, codes are
 *     not sent and codes are not verified.
 */

import { ApiRequest, ApiResponse, readBody } from './_lib/http.js';
import {
  clientIpId,
  linkVerifiedEmail,
  normalizeEmail,
  rateLimit,
  resolveTrial,
  toStatus,
  type TrialSession,
} from './_lib/trial.js';
import { derivedId } from './_lib/secrets.js';
import { clearAuthCookie, readAuthSession, setAuthCookie } from './_lib/authCookie.js';
import {
  isOtpTokenFormat,
  requestEmailOtp,
  supabaseConfigured,
  verifyEmailOtp,
} from './_lib/supabase.js';

/** Per-IP and per-address ceilings. Tight enough to protect the mail quota. */
const START_PER_IP_PER_HOUR = 6;
const START_PER_EMAIL_PER_HOUR = 4;
const VERIFY_PER_IP_PER_15_MIN = 20;
const VERIFY_PER_EMAIL_PER_15_MIN = 10;

const GENERIC_SEND_ERROR = 'We could not send the code right now. Please try again shortly.';
const GENERIC_CODE_ERROR = 'That code is invalid or has expired.';
const GENERIC_RATE_ERROR = 'Too many attempts. Please try again later.';

function noStore(res: ApiResponse): void {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

function unavailable(res: ApiResponse) {
  return res.status(503).json({ error: 'Email sign-in is not available right now.' });
}

/** Shared limiter response: degraded store, denied bucket, or allowed. */
async function limited(
  res: ApiResponse,
  buckets: { key: string; limit: number; windowSeconds: number }[]
): Promise<boolean> {
  for (const bucket of buckets) {
    const result = await rateLimit(bucket.key, bucket.limit, bucket.windowSeconds, {
      failClosed: true,
    });

    if (result.degraded) {
      console.error('[api/auth] rate limiter unavailable; refusing the request');
      unavailable(res);
      return true;
    }
    if (!result.allowed) {
      res.status(429).json({ error: GENERIC_RATE_ERROR });
      return true;
    }
  }
  return false;
}

async function postStart(req: ApiRequest, res: ApiResponse) {
  const { email } = readBody(req);
  const normalized = normalizeEmail(String(email ?? ''));
  if (!normalized) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (!supabaseConfigured()) {
    console.error('[api/auth] SUPABASE_URL / SUPABASE_ANON_KEY are not configured');
    return unavailable(res);
  }

  const emailBucket = derivedId('otp-email', normalized);
  const ipId = clientIpId(req);

  if (
    await limited(res, [
      { key: `otp:ip:${ipId}`, limit: START_PER_IP_PER_HOUR, windowSeconds: 60 * 60 },
      {
        key: `otp:email:${emailBucket}`,
        limit: START_PER_EMAIL_PER_HOUR,
        windowSeconds: 60 * 60,
      },
    ])
  ) {
    return;
  }

  const result = await requestEmailOtp(normalized);

  if (result.ok) {
    // Same answer whether or not this address already has an account.
    return res.status(200).json({ success: true, sent: true });
  }

  switch (result.reason) {
    case 'not_configured':
      console.error('[api/auth] Supabase is not configured');
      return unavailable(res);
    case 'invalid_email':
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    case 'rate_limited':
      return res.status(429).json({ error: GENERIC_RATE_ERROR });
    default:
      console.error('[api/auth] OTP request failed upstream');
      return res.status(502).json({ error: GENERIC_SEND_ERROR });
  }
}

async function postVerify(req: ApiRequest, res: ApiResponse, session: TrialSession) {
  const { email, token } = readBody(req);
  const normalized = normalizeEmail(String(email ?? ''));
  const code = String(token ?? '').replace(/\s+/g, '');

  if (!normalized || !isOtpTokenFormat(code)) {
    return res.status(400).json({ error: GENERIC_CODE_ERROR });
  }

  if (!supabaseConfigured()) {
    console.error('[api/auth] SUPABASE_URL / SUPABASE_ANON_KEY are not configured');
    return unavailable(res);
  }

  const emailBucket = derivedId('otp-email', normalized);
  const ipId = clientIpId(req);

  if (
    await limited(res, [
      {
        key: `otp-verify:ip:${ipId}`,
        limit: VERIFY_PER_IP_PER_15_MIN,
        windowSeconds: 15 * 60,
      },
      {
        key: `otp-verify:email:${emailBucket}`,
        limit: VERIFY_PER_EMAIL_PER_15_MIN,
        windowSeconds: 15 * 60,
      },
    ])
  ) {
    return;
  }

  const verified = await verifyEmailOtp(normalized, code);

  if (!verified.ok) {
    if (verified.reason === 'rate_limited') {
      return res.status(429).json({ error: GENERIC_RATE_ERROR });
    }
    if (verified.reason === 'not_configured' || verified.reason === 'unavailable') {
      console.error('[api/auth] OTP verification failed upstream');
      return res.status(503).json({ error: 'Verification is unavailable right now. Please try again.' });
    }
    return res.status(400).json({ error: GENERIC_CODE_ERROR });
  }

  const linked = await linkVerifiedEmail(req, res, session, normalized, verified.userId);

  if (!linked.ok) {
    // Supabase already validated both the address and the UUID, so this is an
    // internal inconsistency rather than a user mistake. Never leak detail.
    console.error('[api/auth] verified identity could not be linked:', linked.reason);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  setAuthCookie(req, res, linked.record.accountId, verified.userId);

  return res.status(200).json({
    success: true,
    verified: true,
    adopted: linked.adopted,
    // The status is recomputed from the stored clock; verification itself
    // cannot add or remove time.
    trial: toStatus(linked.record),
  });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Auth responses must never be cached: a stale 200 could look like a session.
  noStore(res);

  if (req.method === 'POST') {
    const { action } = readBody(req);

    // `start` deliberately does not resolve or create a trial session: asking
    // for a code must have no effect on access.
    if (action === 'start') return postStart(req, res);

    let session: TrialSession;
    try {
      session = await resolveTrial(req, res);
    } catch (error) {
      console.error('[api/auth] failed to resolve trial:', (error as any)?.message || error);
      return res.status(503).json({ error: 'Could not verify your session. Please try again shortly.' });
    }

    try {
      switch (action) {
        case 'verify':
          return await postVerify(req, res, session);

        case 'sign-out':
          // Clears this browser's email session only. The trial identity, its
          // clock, and the verified email binding all stay exactly as they were.
          clearAuthCookie(req, res);
          return res.status(200).json({ success: true, trial: session.status });

        default:
          return res.status(400).json({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[api/auth] action failed:', (error as any)?.message || error);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }

  let session: TrialSession;
  try {
    session = await resolveTrial(req, res);
  } catch (error) {
    console.error('[api/auth] failed to resolve trial:', (error as any)?.message || error);
    return res.status(503).json({ error: 'Could not verify your session. Please try again shortly.' });
  }

  const auth = readAuthSession(req);
  // A valid cookie for a different account, or for a different Supabase user
  // than the one this account last verified with, is ignored.
  const authenticated = Boolean(
    auth &&
      auth.accountId === session.accountId &&
      session.record.authUserId === auth.userId
  );

  return res.status(200).json({
    success: true,
    authenticated,
    trial: session.status,
  });
}
