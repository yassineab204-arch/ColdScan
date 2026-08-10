/**
 * ColdScan free-trial access control.
 *
 * Every new visitor gets a 7-day free trial that starts the first time the app is
 * opened. When it ends, the app screens lock and the user is asked to contact the
 * ColdScan team for continued access; the team can hand out an access code that
 * unlocks the app again (or extends the trial).
 *
 * Honest limitation: this is a browser-side gate persisted in `localStorage`
 * (no backend / user accounts exist in ColdScan yet). It is a real product gate
 * for normal users, not a security boundary — a determined user can clear their
 * storage and start a new trial. Turning this into something enforceable needs
 * accounts + a server, which is a separate piece of work.
 */

export const TRIAL_DAYS = 7;
export const TRIAL_STORAGE_KEY = 'coldscan_trial';

export interface TrialState {
  /** ISO date when the trial clock started (first app open). */
  startedAt: string;
  /** Full access granted through an access code. */
  unlocked: boolean;
  /** Extra trial days granted through an extension code. */
  extraDays: number;
  /** The first-run tutorial has been completed or skipped. */
  tutorialSeen: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function createTrialState(now: Date = new Date()): TrialState {
  return {
    startedAt: now.toISOString(),
    unlocked: false,
    extraDays: 0,
    tutorialSeen: false,
  };
}

function sanitize(raw: unknown): TrialState | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<TrialState>;
  const started = typeof value.startedAt === 'string' ? Date.parse(value.startedAt) : NaN;
  if (Number.isNaN(started)) return null;

  // Guard against a clock set into the future making the trial last forever.
  const startedAt = new Date(Math.min(started, Date.now())).toISOString();

  return {
    startedAt,
    unlocked: value.unlocked === true,
    extraDays: typeof value.extraDays === 'number' && value.extraDays > 0 ? Math.floor(value.extraDays) : 0,
    tutorialSeen: value.tutorialSeen === true,
  };
}

/** Reads the stored trial, creating (and persisting) a fresh one on first open. */
export function loadTrialState(): TrialState {
  try {
    const saved = localStorage.getItem(TRIAL_STORAGE_KEY);
    const parsed = saved ? sanitize(JSON.parse(saved)) : null;
    if (parsed) return parsed;
  } catch {
    /* corrupted entry — fall through and start a new trial */
  }

  const fresh = createTrialState();
  saveTrialState(fresh);
  return fresh;
}

export function saveTrialState(state: TrialState): void {
  try {
    localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — the session simply won't persist */
  }
}

/** Total days the trial runs for, including any granted extensions. */
export function trialLengthDays(state: TrialState): number {
  return TRIAL_DAYS + state.extraDays;
}

export function trialEndsAt(state: TrialState): Date {
  return new Date(Date.parse(state.startedAt) + trialLengthDays(state) * DAY_MS);
}

/** Whole days left, rounded up. 0 means the trial is over. */
export function trialDaysLeft(state: TrialState, now: Date = new Date()): number {
  const remaining = trialEndsAt(state).getTime() - now.getTime();
  if (remaining <= 0) return 0;
  return Math.max(1, Math.ceil(remaining / DAY_MS));
}

/** True when the app screens should be locked behind the contact screen. */
export function isAccessLocked(state: TrialState, now: Date = new Date()): boolean {
  if (state.unlocked) return false;
  return trialDaysLeft(state, now) === 0;
}

/* ------------------------------------------------------------------ *
 * Access codes
 * ------------------------------------------------------------------ */

/**
 * Codes are compared by hash so they are not sitting in the bundle as plain
 * text. Again: client-side only, so treat them as convenience keys you hand out
 * after someone contacts you, not as secrets.
 */
function hashCode(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** hash -> what the code grants */
const ACCESS_CODES: Record<string, { type: 'unlock' } | { type: 'extend'; days: number }> = {
  // COLDSCAN-FULL-2026  → permanent full access
  [hashCode('COLDSCAN-FULL-2026')]: { type: 'unlock' },
  // COLDSCAN-PLUS7      → 7 more trial days
  [hashCode('COLDSCAN-PLUS7')]: { type: 'extend', days: 7 },
  // COLDSCAN-PLUS30     → 30 more trial days
  [hashCode('COLDSCAN-PLUS30')]: { type: 'extend', days: 30 },
};

export type RedeemResult =
  | { ok: true; state: TrialState; granted: 'unlock' | 'extend'; days?: number }
  | { ok: false };

/** Applies an access code to the trial state. Returns `{ ok: false }` if unknown. */
export function redeemAccessCode(code: string, state: TrialState, now: Date = new Date()): RedeemResult {
  const grant = ACCESS_CODES[hashCode(normalizeCode(code))];
  if (!grant) return { ok: false };

  if (grant.type === 'unlock') {
    return { ok: true, state: { ...state, unlocked: true }, granted: 'unlock' };
  }

  // Extending an already-expired trial restarts the clock from today so the
  // user really gets the full number of extra days.
  const expired = isAccessLocked(state, now);
  const next: TrialState = expired
    ? { ...state, startedAt: now.toISOString(), extraDays: Math.max(0, grant.days - TRIAL_DAYS) }
    : { ...state, extraDays: state.extraDays + grant.days };

  return { ok: true, state: next, granted: 'extend', days: grant.days };
}
