/**
 * Shared fetch wrapper for the ColdScan API.
 *
 * Jobs:
 *   1. Always send the same-origin session cookie so the server can identify
 *      the account behind the trial.
 *   2. Notice the server's `402 Payment Required` responses:
 *        - `requiresEmailVerification` → the free preview tries are used up;
 *          open the email sheet, do NOT lock the whole app.
 *        - `trialExpired` → the legacy 48-hour trial is over; lock the product
 *          tabs behind the contact screen.
 *   3. Relay the preview counter from successful metered calls so the UI can
 *      say "1 free scan left" without a second round-trip.
 */

import type { TrialStatus } from './trial';

export const TRIAL_EXPIRED_EVENT = 'coldscan:trial-expired';
export const EMAIL_REQUIRED_EVENT = 'coldscan:email-required';
export const PREVIEW_USED_EVENT = 'coldscan:preview-used';

export interface TrialExpiredDetail {
  trial: TrialStatus | null;
}

export interface EmailRequiredDetail {
  trial: TrialStatus | null;
  feature?: string;
}

export interface PreviewUsedDetail {
  feature?: string;
  remaining: number;
}

export class TrialExpiredError extends Error {
  readonly trial: TrialStatus | null;
  constructor(trial: TrialStatus | null, message: string) {
    super(message);
    this.name = 'TrialExpiredError';
    this.trial = trial;
  }
}

/** The preview is over for one feature; verification unlocks the 48 hours. */
export class EmailVerificationRequiredError extends Error {
  readonly trial: TrialStatus | null;
  readonly feature?: string;
  constructor(trial: TrialStatus | null, message: string, feature?: string) {
    super(message);
    this.name = 'EmailVerificationRequiredError';
    this.trial = trial;
    this.feature = feature;
  }
}

/** Subscribe to server-side trial expiry. Returns an unsubscribe function. */
export function onTrialExpired(handler: (detail: TrialExpiredDetail) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<TrialExpiredDetail>).detail);
  window.addEventListener(TRIAL_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(TRIAL_EXPIRED_EVENT, listener);
}

/** Subscribe to "free tries used up; verify email". */
export function onEmailVerificationRequired(
  handler: (detail: EmailRequiredDetail) => void
): () => void {
  const listener = (event: Event) =>
    handler((event as CustomEvent<EmailRequiredDetail>).detail);
  window.addEventListener(EMAIL_REQUIRED_EVENT, listener);
  return () => window.removeEventListener(EMAIL_REQUIRED_EVENT, listener);
}

/** Subscribe to successful metered preview calls (used to refresh the banner). */
export function onPreviewUsed(handler: (detail: PreviewUsedDetail) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<PreviewUsedDetail>).detail);
  window.addEventListener(PREVIEW_USED_EVENT, listener);
  return () => window.removeEventListener(PREVIEW_USED_EVENT, listener);
}

/**
 * Calls a ColdScan API route.
 *
 * Throws `EmailVerificationRequiredError` when a feature's free tries are gone,
 * or `TrialExpiredError` when a legacy trial has actually ended. Callers can
 * stop their loading state without special-casing the status code.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });

  if (res.status === 402) {
    let trial: TrialStatus | null = null;
    let message = 'Your ColdScan free trial has ended.';
    let requiresEmailVerification = false;
    let feature: string | undefined;

    try {
      const data = await res.clone().json();
      if (data?.trial) trial = data.trial as TrialStatus;
      if (typeof data?.error === 'string') message = data.error;
      requiresEmailVerification = data?.requiresEmailVerification === true;
      if (typeof data?.feature === 'string') feature = data.feature;
    } catch {
      /* non-JSON body — keep the defaults */
    }

    if (requiresEmailVerification) {
      window.dispatchEvent(
        new CustomEvent<EmailRequiredDetail>(EMAIL_REQUIRED_EVENT, {
          detail: { trial, feature },
        })
      );
      throw new EmailVerificationRequiredError(trial, message, feature);
    }

    window.dispatchEvent(
      new CustomEvent<TrialExpiredDetail>(TRIAL_EXPIRED_EVENT, { detail: { trial } })
    );
    throw new TrialExpiredError(trial, message);
  }

  if (res.ok) {
    const remaining = res.headers.get('X-ColdScan-Preview-Remaining');
    if (remaining !== null && Number.isFinite(Number(remaining))) {
      window.dispatchEvent(
        new CustomEvent<PreviewUsedDetail>(PREVIEW_USED_EVENT, {
          detail: {
            feature: res.headers.get('X-ColdScan-Preview-Feature') ?? undefined,
            remaining: Number(remaining),
          },
        })
      );
    }
  }

  return res;
}
