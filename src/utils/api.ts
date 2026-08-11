/**
 * Shared fetch wrapper for the ColdScan API.
 *
 * Two jobs:
 *   1. Always send the same-origin session cookie so the server can identify
 *      the account behind the trial.
 *   2. Notice the server's `402 Payment Required` trial-expired response and
 *      broadcast it, so the UI locks the moment the server says the trial is
 *      over — even if the client's own countdown disagreed.
 */

import type { TrialStatus } from './trial';

export const TRIAL_EXPIRED_EVENT = 'coldscan:trial-expired';

export interface TrialExpiredDetail {
  trial: TrialStatus | null;
}

export class TrialExpiredError extends Error {
  readonly trial: TrialStatus | null;
  constructor(trial: TrialStatus | null, message: string) {
    super(message);
    this.name = 'TrialExpiredError';
    this.trial = trial;
  }
}

/** Subscribe to server-side trial expiry. Returns an unsubscribe function. */
export function onTrialExpired(handler: (detail: TrialExpiredDetail) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<TrialExpiredDetail>).detail);
  window.addEventListener(TRIAL_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(TRIAL_EXPIRED_EVENT, listener);
}

/**
 * Calls a ColdScan API route.
 *
 * Throws `TrialExpiredError` on 402 so callers can stop their loading state
 * without having to special-case the status code themselves.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });

  if (res.status === 402) {
    let trial: TrialStatus | null = null;
    let message = 'Your ColdScan free trial has ended.';
    try {
      const data = await res.clone().json();
      if (data?.trial) trial = data.trial as TrialStatus;
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      /* non-JSON body — keep the defaults */
    }

    window.dispatchEvent(
      new CustomEvent<TrialExpiredDetail>(TRIAL_EXPIRED_EVENT, { detail: { trial } })
    );
    throw new TrialExpiredError(trial, message);
  }

  return res;
}
