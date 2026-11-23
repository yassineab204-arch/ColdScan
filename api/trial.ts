/**
 * Trial status + actions endpoint.
 *
 *   GET  /api/trial                        -> current status (starts the clock on first call)
 *   POST /api/trial { action: 'redeem-code',   code  }
 *   POST /api/trial { action: 'tutorial-seen' }
 *
 * Email binding is NOT here any more. It moved to `POST /api/auth` so that an
 * address can only be bound after Supabase has verified a one-time code. The
 * old `link-email` action is refused explicitly, which also protects users on a
 * cached older build from silently claiming an address they do not own.
 *
 * Every response reports the status computed from the SERVER's stored start
 * time and the SERVER's clock. Nothing the client sends can move the deadline.
 */

import { ApiRequest, ApiResponse, readBody } from './_lib/http.js';
import {
  markTutorialSeen,
  rateLimit,
  redeemCode,
  resolveTrial,
  toStatus,
  type TrialSession,
} from './_lib/trial.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Status must never be cached — a stale 200 could keep an expired trial alive.
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  let session: TrialSession;
  try {
    session = await resolveTrial(req, res);
  } catch (error) {
    console.error('[api/trial] failed to resolve trial:', (error as any)?.message || error);
    return res.status(503).json({ error: 'Could not verify your trial. Please try again shortly.' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, trial: session.status });
  }

  const { action, code } = readBody(req);

  try {
    switch (action) {
      case 'link-email':
        return res.status(410).json({
          success: false,
          error: 'Verify your email with a one-time code to link it.',
          requiresEmailVerification: true,
          trial: session.status,
        });

      case 'redeem-code': {
        const result = await redeemCode(req, session, String(code ?? ''));

        if (result.ok) {
          return res.status(200).json({
            success: true,
            granted: result.granted,
            hours: result.hours,
            trial: toStatus(result.record),
          });
        }

        if (result.reason === 'rate_limited') {
          return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
        }
        // 'not_configured' is an operator problem, not the user's — do not
        // reveal it to the browser, just log it and behave like a bad code.
        if (result.reason === 'not_configured') {
          console.warn('[api/trial] TRIAL_ACCESS_CODES is not configured; no code can be redeemed.');
        }
        return res.status(400).json({
          success: false,
          error: 'That code is not valid.',
          trial: session.status,
        });
      }

      case 'tutorial-seen': {
        const record = await markTutorialSeen(session);
        return res.status(200).json({ success: true, trial: toStatus(record) });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('[api/trial] action failed:', (error as any)?.message || error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
