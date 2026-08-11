/**
 * ColdScan free-trial CLIENT.
 *
 * This file holds NO trial logic. The trial start time, the 48-hour expiry and
 * the access decision all live on the server (`api/_lib/trial.ts`), keyed to
 * the user's account and stored in a shared datastore. This module only:
 *
 *   - asks the server what the current status is,
 *   - sends the three user actions (link email, redeem code, tutorial seen),
 *   - caches the last answer in memory so the UI can render immediately.
 *
 * Nothing here is authoritative. Clearing localStorage does not restart the
 * trial, because there is nothing here to clear: the identity lives in an
 * HttpOnly cookie the page cannot touch, and the clock lives on the server.
 * Editing this file in devtools also achieves nothing — every premium API
 * endpoint re-checks the trial server-side and returns 402 when it is over.
 */

export const TRIAL_HOURS = 48;
export const TRIAL_DAYS = 2;

export interface TrialStatus {
  accountId: string;
  /** ISO start time, from the server. */
  startedAt: string;
  /** ISO expiry, computed by the server. */
  expiresAt: string;
  msRemaining: number;
  hoursRemaining: number;
  daysRemaining: number;
  active: boolean;
  expired: boolean;
  unlocked: boolean;
  emailLinked: boolean;
  tutorialSeen: boolean;
  trialHours: number;
  /** Server clock at the time of the response. */
  serverTime: string;
}

/** Status used before the first server response arrives. */
export const UNKNOWN_STATUS: TrialStatus = {
  accountId: '',
  startedAt: '',
  expiresAt: '',
  msRemaining: 0,
  hoursRemaining: TRIAL_HOURS,
  daysRemaining: TRIAL_DAYS,
  // Optimistic until we know: avoids a lock-screen flash on a slow network.
  // The server still refuses any premium call, so this cannot leak access.
  active: true,
  expired: false,
  unlocked: false,
  emailLinked: false,
  tutorialSeen: true,
  trialHours: TRIAL_HOURS,
  serverTime: '',
};

/** `credentials: 'same-origin'` so the HttpOnly session cookie is sent. */
async function trialRequest(init?: RequestInit): Promise<Response> {
  return fetch('/api/trial', {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
}

function isStatus(value: unknown): value is TrialStatus {
  return Boolean(value) && typeof (value as TrialStatus).expiresAt === 'string';
}

/** Fetches the current status. Starts the clock on the very first call. */
export async function fetchTrialStatus(): Promise<TrialStatus | null> {
  try {
    const res = await trialRequest({ method: 'GET' });
    const data = await res.json();
    return isStatus(data?.trial) ? data.trial : null;
  } catch {
    return null;
  }
}

async function postAction(body: Record<string, unknown>): Promise<{
  ok: boolean;
  trial: TrialStatus | null;
  granted?: 'unlock' | 'extend';
  hours?: number;
  error?: string;
}> {
  try {
    const res = await trialRequest({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return {
      ok: res.ok && data?.success === true,
      trial: isStatus(data?.trial) ? data.trial : null,
      granted: data?.granted,
      hours: data?.hours,
      error: typeof data?.error === 'string' ? data.error : undefined,
    };
  } catch {
    return { ok: false, trial: null };
  }
}

/**
 * Binds the trial to an email so it follows the person across browsers and
 * devices — and so a cleared browser resumes the SAME clock rather than
 * getting a new trial.
 */
export function linkTrialEmail(email: string) {
  return postAction({ action: 'link-email', email });
}

export function redeemAccessCode(code: string) {
  return postAction({ action: 'redeem-code', code });
}

export function markTutorialSeen() {
  return postAction({ action: 'tutorial-seen' });
}

/* ------------------------------------------------------------------ *
 * Display helpers (presentation only — never access decisions)
 * ------------------------------------------------------------------ */

/**
 * Remaining time recomputed locally between polls, anchored to the server's
 * expiry and its clock offset so a wrong device clock cannot add time.
 */
export function remainingMs(status: TrialStatus, clockSkewMs: number): number {
  if (status.unlocked) return Number.POSITIVE_INFINITY;
  const expires = Date.parse(status.expiresAt);
  if (Number.isNaN(expires)) return status.msRemaining;
  return Math.max(0, expires - (Date.now() + clockSkewMs));
}

/** serverTime - deviceTime, so local countdowns follow the server's clock. */
export function clockSkew(status: TrialStatus): number {
  const server = Date.parse(status.serverTime);
  return Number.isNaN(server) ? 0 : server - Date.now();
}

/** Compact countdown: "1d 4h", "7h 12m", "9m". */
export function formatRemaining(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}
