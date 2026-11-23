/**
 * ColdScan 2-day free trial — SERVER-SIDE SOURCE OF TRUTH.
 *
 * Design goals (all enforced here, not in the browser):
 *
 *  1. The trial start time is stored server-side, in the shared datastore.
 *  2. It is associated with an account: an anonymous account created on first
 *     use, which can later be bound to an email so it survives any browser.
 *  3. The expiry is computed on the server from the stored start time. The
 *     client's clock, localStorage and request body are never trusted.
 *  4. Clearing browser storage cannot restart the trial:
 *       - the account id lives in a signed, HttpOnly cookie the page's
 *         JavaScript cannot read or delete;
 *       - the start time is keyed to the account, not the browser;
 *       - `SET NX` means a start time is only ever written once per account;
 *       - a device fingerprint (hashed IP + User-Agent) is remembered, so a
 *         cleared/incognito browser on the same device is re-linked to the
 *         SAME account instead of getting a fresh trial;
 *       - a *verified* email binding makes the account portable and permanent.
 *
 * Email bindings are only ever created by `linkVerifiedEmail`, which the auth
 * endpoint calls after Supabase has confirmed a one-time code. Typing an address
 * grants nothing: unverified bindings are treated as absent, and they are
 * revoked as soon as the real owner proves control.
 *
 * No secret is hardcoded: the signing key comes from `TRIAL_SECRET`, and the
 * access codes are compared as HMACs of values held in `TRIAL_ACCESS_CODES`.
 *
 * One deliberate exception to the 48-hour rule: accounts bound to an owner
 * email always have full access, no code needed — see "Owner accounts" below.
 */

import { kvGet, kvSet, kvSetIfAbsent, kvIncrWithTtl, isPersistentStore } from './kv.js';
import { derivedId, hmac, randomId, safeEqual } from './secrets.js';
import { isSecureRequest, parseCookies, setCookie } from './http.js';
import type { ApiRequest, ApiResponse } from './http.js';
import { isSupabaseUserId } from './authCookie.js';

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

export const TRIAL_HOURS = 48;
export const TRIAL_MS = TRIAL_HOURS * 60 * 60 * 1000;

/**
 * Features that can be tried a couple of times before an email is required.
 * Each one has its OWN counter, so a visitor gets two scans, two recipe
 * generations and two voice-helper connections.
 */
export type PreviewFeature = 'scan' | 'recipe' | 'voice';
export const PREVIEW_FEATURES: PreviewFeature[] = ['scan', 'recipe', 'voice'];
export const PREVIEW_LIMIT = 2;

export interface PreviewUses {
  scan: number;
  recipe: number;
  voice: number;
}

export const ZERO_PREVIEW_USES: PreviewUses = { scan: 0, recipe: 0, voice: 0 };

const COOKIE_NAME = 'coldscan_sid';
/** Cookie outlives the trial by a wide margin so it keeps identifying the account. */
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
/** Trial records are kept well past expiry — deleting them would hand out a new trial. */
const RECORD_TTL_SECONDS = 400 * 24 * 60 * 60;
/** Preview counters live as long as the account, so a cleared cookie cannot refill them. */
const PREVIEW_TTL_SECONDS = RECORD_TTL_SECONDS;

const KEY_ACCOUNT = (id: string) => `coldscan:trial:account:${id}`;
const KEY_DEVICE = (fingerprint: string) => `coldscan:trial:device:${fingerprint}`;
const KEY_EMAIL = (emailId: string) => `coldscan:trial:email:${emailId}`;
const KEY_RATE = (bucket: string) => `coldscan:trial:rate:${bucket}`;
const KEY_PREVIEW = (feature: PreviewFeature, accountId: string) =>
  KEY_RATE(`preview:${feature}:${accountId}`);

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export interface TrialRecord {
  /** Account id this trial belongs to. */
  accountId: string;
  /**
   * Server timestamp (ms) when the account was created (or, for records made by
   * the old flow, when the 48-hour clock started). Kept for audit and for the
   * legacy migration; the live clock now runs from `activatedAt`.
   */
  startedAt: number;
  /**
   * Server timestamp (ms) when the 48-hour trial was activated by a verified
   * email, or null while the account is still in anonymous preview mode.
   *
   * Records created before the preview flow existed have no `activatedAt`; they
   * are migrated to `activatedAt = startedAt` and keep their original clock.
   */
  activatedAt: number | null;
  /**
   * True while this account is in the anonymous preview: no 48-hour clock and
   * only the per-feature free tries. Flips to false the moment a trial starts
   * or an access code unlocks the account.
   */
  preview: boolean;
  /** Extra milliseconds granted by an extension code. */
  extraMs: number;
  /** Permanent access granted by an unlock code. */
  unlocked: boolean;
  /** HMAC of the bound email, or null. The raw email is never stored. */
  emailId: string | null;
  /**
   * Server timestamp (ms) when the email was proven with a Supabase OTP, or
   * null. A binding without this is untrusted: it was created by the old,
   * unauthenticated "type an email" flow, so it neither unlocks owner access
   * nor identifies the account.
   */
  emailVerifiedAt: number | null;
  /** Supabase auth user id that last verified this account, or null. */
  authUserId: string | null;
  /** First-run tutorial completed. Kept here so it follows the account. */
  tutorialSeen: boolean;
  /** Bookkeeping. */
  createdAt: number;
  updatedAt: number;
}

export interface TrialStatus {
  accountId: string;
  /** ISO account-creation time, from the server. */
  startedAt: string;
  /** ISO time the 48-hour clock was activated, or null in preview. */
  activatedAt: string | null;
  /** ISO expiry, computed on the server. Empty string while in preview. */
  expiresAt: string;
  /** Whole milliseconds left, server-computed. 0 when over or in preview. */
  msRemaining: number;
  hoursRemaining: number;
  daysRemaining: number;
  /** True while premium features are allowed (trial active or unlocked). */
  active: boolean;
  /** True once the 48 hours are up and no code has been redeemed. */
  expired: boolean;
  /** True while the account is in the anonymous preview. */
  preview: boolean;
  unlocked: boolean;
  /** True only when an email was proven with an OTP, not merely typed. */
  emailLinked: boolean;
  emailVerified: boolean;
  /** Free tries used so far, per feature. */
  previewUses: PreviewUses;
  /** Free tries left, per feature (never negative). */
  previewRemaining: PreviewUses;
  tutorialSeen: boolean;
  trialHours: number;
  /** Server time, so the client can count down without trusting its own clock. */
  serverTime: string;
}

/* ------------------------------------------------------------------ *
 * Cookies
 * ------------------------------------------------------------------ */

/** Cookie value is `<accountId>.<hmac>` so a forged id is rejected. */
function signAccountId(accountId: string): string {
  return `${accountId}.${hmac('session', accountId)}`;
}

function verifyAccountCookie(value: string | undefined): string | null {
  if (!value) return null;
  const idx = value.lastIndexOf('.');
  if (idx <= 0) return null;

  const accountId = value.slice(0, idx);
  const signature = value.slice(idx + 1);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(accountId)) return null;

  try {
    return safeEqual(signature, hmac('session', accountId)) ? accountId : null;
  } catch {
    return null;
  }
}

function setSessionCookie(req: ApiRequest, res: ApiResponse, accountId: string): void {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(signAccountId(accountId))}`,
    'Path=/',
    // HttpOnly: page scripts cannot read or clear it, so "clear localStorage"
    // (or any devtools poking at document.cookie) does not reset the trial.
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  // Appends, so the auth cookie set in the same response survives.
  setCookie(res, parts.join('; '));
}

/* ------------------------------------------------------------------ *
 * Device fingerprint
 * ------------------------------------------------------------------ */

function clientIp(req: ApiRequest): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (value) return value.split(',')[0]!.trim();

  const real = req.headers?.['x-real-ip'];
  const realValue = Array.isArray(real) ? real[0] : real;
  if (realValue) return realValue.trim();

  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Coarse device signal used ONLY to re-link a wiped browser to its existing
 * account. It is a salted hash — no IP or User-Agent is ever stored in clear.
 *
 * Honest limitation: shared/NAT'd IPs mean two people behind one connection
 * with the same browser build can share an account. That is deliberately the
 * conservative direction (it can deny a second free trial, never extend one).
 */
/**
 * Stable, salted identifier for the caller's IP. Used for auth rate limits:
 * unlike the device fingerprint it cannot be varied by changing the User-Agent
 * header, which is exactly what an OTP-spam script would try.
 */
export function clientIpId(req: ApiRequest): string {
  return derivedId('ip', clientIp(req));
}

export function deviceFingerprint(req: ApiRequest): string {
  const ua = req.headers?.['user-agent'];
  const uaValue = Array.isArray(ua) ? ua[0] : ua || 'unknown';
  const lang = req.headers?.['accept-language'];
  const langValue = Array.isArray(lang) ? lang[0] : lang || '';
  return derivedId('device', `${clientIp(req)}|${uaValue}|${langValue}`);
}

/* ------------------------------------------------------------------ *
 * Record helpers
 * ------------------------------------------------------------------ */

function sanitizeRecord(raw: string | null, accountId: string): TrialRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TrialRecord>;
    if (typeof parsed.startedAt !== 'number' || !Number.isFinite(parsed.startedAt)) return null;

    // Migration rule:
    //   - a record with `activatedAt` uses it;
    //   - a record that explicitly says `preview: true` and has no activation
    //     time is still in preview;
    //   - every other record predates the preview flow, so its original
    //     `startedAt` was the live trial clock. Treat it as activated, which
    //     keeps existing users on exactly the clock they already had.
    const hasActivation =
      typeof parsed.activatedAt === 'number' && Number.isFinite(parsed.activatedAt);
    const activatedAt = hasActivation
      ? (parsed.activatedAt as number)
      : parsed.preview === true
        ? null
        : parsed.startedAt;
    const preview = parsed.preview === true && activatedAt === null;

    return {
      accountId,
      startedAt: parsed.startedAt,
      activatedAt,
      preview,
      extraMs: typeof parsed.extraMs === 'number' && parsed.extraMs > 0 ? parsed.extraMs : 0,
      unlocked: parsed.unlocked === true,
      emailId: typeof parsed.emailId === 'string' ? parsed.emailId : null,
      emailVerifiedAt:
        typeof parsed.emailVerifiedAt === 'number' && Number.isFinite(parsed.emailVerifiedAt)
          ? parsed.emailVerifiedAt
          : null,
      authUserId:
        typeof parsed.authUserId === 'string' && isSupabaseUserId(parsed.authUserId)
          ? parsed.authUserId
          : null,
      tutorialSeen: parsed.tutorialSeen === true,
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : parsed.startedAt,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : parsed.startedAt,
    };
  } catch {
    return null;
  }
}

async function readRecord(accountId: string): Promise<TrialRecord | null> {
  return sanitizeRecord(await kvGet(KEY_ACCOUNT(accountId)), accountId);
}

async function writeRecord(record: TrialRecord): Promise<void> {
  await kvSet(
    KEY_ACCOUNT(record.accountId),
    JSON.stringify({ ...record, updatedAt: Date.now() }),
    RECORD_TTL_SECONDS
  );
}

/**
 * Creates the trial record for an account if — and only if — none exists.
 * `SET NX` is what makes "clear storage and start over" impossible: once the
 * account has a start time, every later attempt reads the original one.
 */
async function ensureRecord(accountId: string): Promise<TrialRecord> {
  const existing = await readRecord(accountId);
  if (existing) return existing;

  const now = Date.now();
  const fresh: TrialRecord = {
    accountId,
    // Account creation is recorded, but it no longer starts the trial clock.
    // New accounts begin in preview mode; the 48 hours start on the first
    // successful email verification (see linkVerifiedEmail).
    startedAt: now,
    activatedAt: null,
    preview: true,
    extraMs: 0,
    unlocked: false,
    emailId: null,
    emailVerifiedAt: null,
    authUserId: null,
    tutorialSeen: false,
    createdAt: now,
    updatedAt: now,
  };

  const created = await kvSetIfAbsent(
    KEY_ACCOUNT(accountId),
    JSON.stringify(fresh),
    RECORD_TTL_SECONDS
  );
  if (created) return fresh;

  // Lost the race — another concurrent request created it first. Use theirs.
  return (await readRecord(accountId)) ?? fresh;
}

/* ------------------------------------------------------------------ *
 * Status computation (server clock only)
 * ------------------------------------------------------------------ */

export function toStatus(
  record: TrialRecord,
  now = Date.now(),
  previewUses: PreviewUses = ZERO_PREVIEW_USES
): TrialStatus {
  // An owner email is equivalent to a redeemed unlock code: full access — but
  // only once that address has been proven with an OTP (see isOwnerAccount).
  const unlocked = record.unlocked || isOwnerAccount(record);
  const emailVerified = Boolean(record.emailId && record.emailVerifiedAt);

  // Preview means: not unlocked, no activation time, still flagged as preview.
  // It deliberately has no deadline — the per-feature counters are the limit.
  const preview = record.preview && record.activatedAt === null && !unlocked;

  // Legacy records have activatedAt == startedAt after sanitising, so their
  // original countdown is preserved exactly.
  const activatedAt = record.activatedAt ?? record.startedAt;
  const endsAt = activatedAt + TRIAL_MS + record.extraMs;
  const finite = Math.max(0, endsAt - now);

  const clamp = (used: number) => Math.max(0, PREVIEW_LIMIT - (Number.isFinite(used) ? used : 0));

  return {
    accountId: record.accountId,
    startedAt: new Date(record.startedAt).toISOString(),
    activatedAt: record.activatedAt === null ? null : new Date(record.activatedAt).toISOString(),
    expiresAt: preview ? '' : new Date(endsAt).toISOString(),
    msRemaining: unlocked || preview ? 0 : finite,
    hoursRemaining: unlocked || preview ? 0 : Math.ceil(finite / (60 * 60 * 1000)),
    daysRemaining: unlocked || preview ? 0 : Math.ceil(finite / (24 * 60 * 60 * 1000)),
    active: unlocked || (!preview && finite > 0),
    expired: !unlocked && !preview && finite <= 0,
    preview,
    unlocked,
    emailLinked: emailVerified,
    emailVerified,
    previewUses: {
      scan: Math.max(0, previewUses.scan),
      recipe: Math.max(0, previewUses.recipe),
      voice: Math.max(0, previewUses.voice),
    },
    previewRemaining: {
      scan: clamp(previewUses.scan),
      recipe: clamp(previewUses.recipe),
      voice: clamp(previewUses.voice),
    },
    tutorialSeen: record.tutorialSeen,
    trialHours: TRIAL_HOURS,
    serverTime: new Date(now).toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * Preview counters
 * ------------------------------------------------------------------ */

/**
 * Reads the per-feature preview counters WITHOUT incrementing them.
 *
 * The counters are the same Redis keys the atomic limiter increments, so the
 * number shown in the UI is the number the gate enforces. Three small reads
 * only happen for accounts that are actually in preview.
 */
export async function previewUsesFor(accountId: string): Promise<PreviewUses> {
  const read = async (feature: PreviewFeature): Promise<number> => {
    try {
      const raw = await kvGet(KEY_PREVIEW(feature, accountId));
      const value = Number(raw ?? 0);
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch {
      // Status is presentation; the gate still fails closed if the store is
      // unavailable. Reporting zero used is the conservative display value.
      return 0;
    }
  };

  const [scan, recipe, voice] = await Promise.all([
    read('scan'),
    read('recipe'),
    read('voice'),
  ]);
  return { scan, recipe, voice };
}

/** Fresh status, including the preview counters. */
export async function statusFor(record: TrialRecord, now = Date.now()): Promise<TrialStatus> {
  const uses = record.preview ? await previewUsesFor(record.accountId) : ZERO_PREVIEW_USES;
  return toStatus(record, now, uses);
}

/* ------------------------------------------------------------------ *
 * Session resolution
 * ------------------------------------------------------------------ */

export interface TrialSession {
  record: TrialRecord;
  status: TrialStatus;
  accountId: string;
}

/**
 * Resolves the caller's account and trial, creating them on first contact.
 *
 * Resolution order — the first hit wins, and each one is *older* evidence than
 * the next, which is what prevents a reset:
 *   1. signed HttpOnly session cookie
 *   2. device fingerprint → previously issued account (cookie was cleared)
 *   3. brand new account
 *
 * Always refreshes the cookie so a returning device keeps its account.
 */
export async function resolveTrial(req: ApiRequest, res: ApiResponse): Promise<TrialSession> {
  const cookies = parseCookies(req);
  const fingerprint = deviceFingerprint(req);

  let accountId = verifyAccountCookie(cookies[COOKIE_NAME]);

  if (!accountId) {
    // Cookie missing or tampered with: fall back to the device link.
    const linked = await kvGet(KEY_DEVICE(fingerprint));
    if (linked && /^[A-Za-z0-9_-]{8,64}$/.test(linked)) accountId = linked;
  }

  if (!accountId) {
    accountId = randomId(18);
  }

  const record = await ensureRecord(accountId);

  // Remember the device → account link (first writer wins, so an existing
  // account on this device is never overwritten by a newer one).
  await kvSetIfAbsent(KEY_DEVICE(fingerprint), accountId, RECORD_TTL_SECONDS);

  setSessionCookie(req, res, accountId);

  const previewUses = record.preview
    ? await previewUsesFor(record.accountId)
    : ZERO_PREVIEW_USES;

  return { record, status: toStatus(record, Date.now(), previewUses), accountId };
}

/* ------------------------------------------------------------------ *
 * Email binding
 * ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(email: string): string | null {
  const value = String(email || '').trim().toLowerCase();
  if (value.length > 254 || !EMAIL_RE.test(value)) return null;
  return value;
}

// Note: every variant lists every property (the absent ones as `?: undefined`)
// so the union narrows correctly under this project's non-strict tsconfig.
export type LinkVerifiedEmailResult =
  | { ok: true; record: TrialRecord; adopted: boolean; reason?: undefined }
  | {
      ok: false;
      record?: undefined;
      adopted?: undefined;
      reason: 'invalid_email' | 'invalid_identity';
    };

/**
 * Binds the session to an email AFTER Supabase has verified a one-time code.
 *
 * This is the only function that may create a trusted email binding. It is
 * called from `/api/auth` with the user id Supabase returned; the browser can
 * never reach it directly, so typing an address still grants nothing.
 *
 * Rules that keep the trial intact:
 *   - Never touches `extraMs` or `unlocked`.
 *   - A NEW preview account starts its 48-hour clock at this exact moment.
 *     Visiting the app (or using free preview tries) does not consume trial
 *     time before verification.
 *   - A legacy account whose clock already started keeps its original
 *     `activatedAt`, so verification can never hand out a fresh 48 hours.
 *   - If the address already belongs to an account that was itself verified,
 *     adopt that ORIGINAL account so a new device resumes the old clock.
 *   - If the existing binding was never verified (the old, unauthenticated
 *     flow could create those), REVOKE it instead of inheriting its account.
 *     This is what stops email squatting: an attacker who typed the founder's
 *     address before verification existed does not keep owner access, and the
 *     verified browser is not silently pointed at the attacker's account.
 *     A legacy clock is carried over so the repair cannot reset a legitimate
 *     trial; a preview-only account has no clock to carry.
 *
 * The raw email is never stored: only `HMAC(TRIAL_SECRET, email)`.
 */
export async function linkVerifiedEmail(
  req: ApiRequest,
  res: ApiResponse,
  session: TrialSession,
  rawEmail: string,
  authUserId: string
): Promise<LinkVerifiedEmailResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, reason: 'invalid_email' };
  if (!isSupabaseUserId(authUserId)) return { ok: false, reason: 'invalid_identity' };

  const emailId = derivedId('email', email);
  const now = Date.now();
  const existingAccountId = await kvGet(KEY_EMAIL(emailId));
  /** The account that proves control keeps the OLDEST clock it can be shown. */
  let startedAt = session.record.startedAt;
  /** null means this account is still in preview and may start its clock now. */
  let activatedAt = session.record.activatedAt;

  if (existingAccountId && existingAccountId !== session.accountId) {
    const existing = await readRecord(existingAccountId);

    // A verified binding is the real owner returning: adopt the older account
    // so its clock (and any owner entitlement) is the one that counts.
    if (existing && existing.emailId === emailId && existing.emailVerifiedAt) {
      const adopted: TrialRecord = {
        ...existing,
        authUserId,
        // Defensive: a verified record should already be activated, but a
        // preview record can never be adopted into a fresh trial by accident.
        preview: false,
        activatedAt: existing.activatedAt ?? now,
      };
      await writeRecord(adopted);
      setSessionCookie(req, res, adopted.accountId);
      // This device now belongs to the adopted account, so a cleared cookie
      // re-links to it rather than to the throwaway account created just now.
      await kvSet(KEY_DEVICE(deviceFingerprint(req)), adopted.accountId, RECORD_TTL_SECONDS);
      return { ok: true, record: adopted, adopted: true };
    }

    // An unverified claim cannot be inherited: it could belong to a squatter,
    // and adopting its account would hand that browser any verified owner
    // entitlement. Revoke it, then bind the address to the account that just
    // proved control.
    //
    // A legacy clock, however, is still evidence: carrying the earlier
    // activation over prevents this repair from becoming a one-time trial reset
    // for people who used the old "type an email" flow. Grants (`extraMs`,
    // `unlocked`) are NOT inherited — only the fact that the clock began
    // earlier. A preview-only claim has no clock, so nothing is carried.
    if (existing && !existing.emailVerifiedAt) {
      if (Number.isFinite(existing.startedAt)) {
        startedAt = Math.min(startedAt, existing.startedAt);
      }
      if (!existing.preview && existing.activatedAt !== null) {
        activatedAt =
          activatedAt === null
            ? existing.activatedAt
            : Math.min(activatedAt, existing.activatedAt);
      }
      await writeRecord({
        ...existing,
        emailId: null,
        emailVerifiedAt: null,
        authUserId: null,
      });
    }
  }

  // First verification of a preview account starts the 48 hours NOW. Legacy
  // accounts already have an activation time and keep it untouched.
  if (activatedAt === null) activatedAt = now;

  const updated: TrialRecord = {
    ...session.record,
    startedAt,
    activatedAt,
    preview: false,
    emailId,
    emailVerifiedAt: now,
    authUserId,
  };
  await writeRecord(updated);
  // Overwrite (not NX): a verified claim always wins over an unverified one.
  await kvSet(KEY_EMAIL(emailId), session.accountId, RECORD_TTL_SECONDS);
  return { ok: true, record: updated, adopted: false };
}

/* ------------------------------------------------------------------ *
 * Owner accounts — permanent full access
 * ------------------------------------------------------------------ */

/**
 * Emails with permanent full access: once an account is bound to one of these
 * addresses AND that binding has been verified with an OTP, its status reports
 * `unlocked` on every device, forever — no access code, no countdown. The owner
 * still passes through the normal trial UI until the email is verified.
 *
 * The verification requirement is not cosmetic: without it, anyone who knew
 * the public business address could type it and grant themselves full access.
 *
 * The built-in address is the app's public business contact (already shown to
 * every user on the contact screen), so this file exposes nothing new; matches
 * are computed as derived IDs, the same form stored on the trial record, so
 * nothing raw is ever written to the datastore either.
 *
 * Additional addresses can be granted at deploy time with the server-only
 * `TRIAL_OWNER_EMAILS` env var (comma-separated) — no code change needed.
 */
const OWNER_EMAILS = ['yassineab2014@gmail.com'];

/** Derived ID of every owner email: the built-in list plus TRIAL_OWNER_EMAILS. */
export function ownerEmailIds(): Set<string> {
  const ids = new Set<string>();
  const extras = (process.env.TRIAL_OWNER_EMAILS || '').split(',');
  for (const candidate of [...OWNER_EMAILS, ...extras]) {
    const email = normalizeEmail(candidate);
    if (email) ids.add(derivedId('email', email));
  }
  return ids;
}

/** True when an address carries owner-level access (built-in or env-listed). */
export function isOwnerEmail(rawEmail: string): boolean {
  const email = normalizeEmail(rawEmail);
  return Boolean(email) && ownerEmailIds().has(derivedId('email', email!));
}

/**
 * True when the account is bound to a VERIFIED owner email -> permanent access.
 * An unverified legacy binding never counts.
 */
export function isOwnerAccount(record: TrialRecord): boolean {
  return (
    Boolean(record.emailId) &&
    Boolean(record.emailVerifiedAt) &&
    ownerEmailIds().has(record.emailId as string)
  );
}

/* ------------------------------------------------------------------ *
 * Access codes — configured, never hardcoded
 * ------------------------------------------------------------------ */

interface Grant {
  type: 'unlock' | 'extend';
  hours: number;
}

/**
 * Codes come from `TRIAL_ACCESS_CODES`, a comma-separated list of
 * `CODE:unlock` or `CODE:extend:<hours>` entries, e.g.
 *
 *   TRIAL_ACCESS_CODES="AB12-CD34:unlock,EF56-GH78:extend:48"
 *
 * Nothing is baked into the bundle or this file, the value is read only on the
 * server, and comparison is done over HMACs in constant time.
 */
function loadGrants(): Map<string, Grant> {
  const raw = process.env.TRIAL_ACCESS_CODES || '';
  const grants = new Map<string, Grant>();

  for (const entry of raw.split(',')) {
    const parts = entry.trim().split(':');
    if (parts.length < 2) continue;

    const code = normalizeCode(parts[0]!);
    const kind = parts[1]!.trim().toLowerCase();
    if (!code) continue;

    if (kind === 'unlock') {
      grants.set(hmac('code', code), { type: 'unlock', hours: 0 });
    } else if (kind === 'extend') {
      const hours = Number(parts[2]);
      if (Number.isFinite(hours) && hours > 0) {
        grants.set(hmac('code', code), { type: 'extend', hours });
      }
    }
  }
  return grants;
}

function normalizeCode(code: string): string {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

export type RedeemResult =
  | { ok: true; record: TrialRecord; granted: 'unlock' | 'extend'; hours?: number; reason?: undefined }
  | {
      ok: false;
      record?: undefined;
      granted?: undefined;
      hours?: undefined;
      reason: 'invalid_code' | 'not_configured' | 'rate_limited';
    };

/** Applies an access code. Rate limited per account to stop brute forcing. */
export async function redeemCode(
  req: ApiRequest,
  session: TrialSession,
  rawCode: string
): Promise<RedeemResult> {
  const grants = loadGrants();
  if (grants.size === 0) return { ok: false, reason: 'not_configured' };

  const attempts = await rateLimit(`code:${session.accountId}`, 10, 15 * 60);
  if (!attempts.allowed) return { ok: false, reason: 'rate_limited' };

  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, reason: 'invalid_code' };

  const grant = grants.get(hmac('code', code));
  if (!grant) return { ok: false, reason: 'invalid_code' };

  if (grant.type === 'unlock') {
    const now = Date.now();
    const updated: TrialRecord = {
      ...session.record,
      unlocked: true,
      preview: false,
      // Unlock is permanent, but record when access began for completeness.
      activatedAt: session.record.activatedAt ?? now,
    };
    await writeRecord(updated);
    return { ok: true, record: updated, granted: 'unlock' };
  }

  // Extending an already-expired trial measures the extra time from now, so
  // the user really gets the full grant. Redeeming a code while still in
  // preview starts the 48-hour clock at redemption, then adds the grant.
  const now = Date.now();
  const activatedAt = session.record.activatedAt ?? now;
  const currentEnd = activatedAt + TRIAL_MS + session.record.extraMs;
  const base = Math.max(currentEnd, now);
  const extraMs = base + grant.hours * 60 * 60 * 1000 - (activatedAt + TRIAL_MS);

  const updated: TrialRecord = {
    ...session.record,
    activatedAt,
    preview: false,
    extraMs: Math.max(0, extraMs),
  };
  await writeRecord(updated);
  return { ok: true, record: updated, granted: 'extend', hours: grant.hours };
}

/* ------------------------------------------------------------------ *
 * Misc mutations
 * ------------------------------------------------------------------ */

export async function markTutorialSeen(session: TrialSession): Promise<TrialRecord> {
  if (session.record.tutorialSeen) return session.record;
  const updated: TrialRecord = { ...session.record, tutorialSeen: true };
  await writeRecord(updated);
  return updated;
}

/* ------------------------------------------------------------------ *
 * Rate limiting
 * ------------------------------------------------------------------ */

export async function rateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
  options: { failClosed?: boolean } = {}
): Promise<{ allowed: boolean; count: number; degraded?: boolean }> {
  try {
    const count = await kvIncrWithTtl(KEY_RATE(bucket), windowSeconds);
    return { allowed: count <= limit, count };
  } catch {
    // Trial code redemption stays available during a datastore hiccup. Auth is
    // different: if the limiter cannot be consulted, sending mail is refused.
    return { allowed: options.failClosed !== true, count: 0, degraded: true };
  }
}

/* ------------------------------------------------------------------ *
 * Premium gate for API handlers
 * ------------------------------------------------------------------ */

/**
 * Resolves the account and refuses closed-loop failures. Shared by the gates.
 */
async function gateSession(req: ApiRequest, res: ApiResponse): Promise<TrialSession | null> {
  try {
    return await resolveTrial(req, res);
  } catch (error) {
    console.error('[trial] failed to resolve trial:', (error as any)?.message || error);
    // Fail closed: if the gate cannot be evaluated, premium work is refused.
    res.status(503).json({ error: 'Access could not be verified. Please try again shortly.' });
    return null;
  }
}

function denyTrialExpired(res: ApiResponse, session: TrialSession): null {
  res.status(402).json({
    error: 'Your ColdScan free trial has ended. Contact us to keep your access.',
    trialExpired: true,
    trial: session.status,
  });
  return null;
}

function denyPreviewNeedsEmail(
  res: ApiResponse,
  status: TrialStatus,
  feature?: PreviewFeature
): null {
  res.status(402).json({
    error: feature
      ? 'You have used your free tries for this feature. Verify your email to unlock 48 hours.'
      : 'Verify your email to unlock 48 hours of full access.',
    requiresEmailVerification: true,
    preview: true,
    ...(feature ? { feature } : {}),
    trial: status,
  });
  return null;
}

/**
 * Gate for the three preview-metered features: scanning, recipes and the live
 * voice helper. Each has its own counter, so a visitor gets two of EACH.
 *
 * The counter is incremented atomically with Redis INCR before the expensive
 * work runs, so two simultaneous requests cannot both consume the last try.
 * Once a trial is active (or the account is unlocked) the counters are ignored.
 *
 * Returns the session when allowed; otherwise it has already written a 402/429
 * and the handler must return immediately.
 */
export async function requireFeatureAccess(
  req: ApiRequest,
  res: ApiResponse,
  feature: PreviewFeature
): Promise<TrialSession | null> {
  const session = await gateSession(req, res);
  if (!session) return null;

  if (session.status.active) return session;

  // A legacy account whose 48 hours are over is expired, not in preview. It
  // must not get preview tries again by simply waiting past its deadline.
  if (!session.status.preview) return denyTrialExpired(res, session);

  const result = await rateLimit(
    `preview:${feature}:${session.accountId}`,
    PREVIEW_LIMIT,
    PREVIEW_TTL_SECONDS,
    { failClosed: true }
  );

  if (result.degraded) {
    console.error('[trial] preview limiter unavailable; refusing the request');
    res.status(503).json({ error: 'Access could not be verified. Please try again shortly.' });
    return null;
  }

  const uses = await previewUsesFor(session.accountId);
  const status = toStatus(session.record, Date.now(), uses);

  if (!result.allowed) {
    return denyPreviewNeedsEmail(res, status, feature);
  }

  // Let the browser show "1 free scan left" without another round-trip.
  // Same-origin only, so no CORS exposure is needed.
  res.setHeader('X-ColdScan-Preview-Feature', feature);
  res.setHeader(
    'X-ColdScan-Preview-Remaining',
    String(Math.max(0, PREVIEW_LIMIT - Math.max(0, result.count)))
  );

  return { ...session, status };
}

/**
 * Gate for cheap supporting endpoints (geocoding, nearby stores, TTS) that
 * should keep working during the preview so the app does not feel broken.
 * They do not consume a feature try, but they are rate limited per account.
 */
export async function requireSupportAccess(
  req: ApiRequest,
  res: ApiResponse
): Promise<TrialSession | null> {
  const session = await gateSession(req, res);
  if (!session) return null;

  if (session.status.active) return session;
  if (!session.status.preview) return denyTrialExpired(res, session);

  const support = await rateLimit(`preview-support:${session.accountId}`, 80, 24 * 60 * 60);
  if (!support.allowed) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return null;
  }

  return session;
}

/**
 * Wrap a premium endpoint that is NOT part of the free preview (AI chat,
 * shopping-list generation, etc.). Returns the session when access is allowed;
 * otherwise it has already written a 402 response and the handler must return
 * immediately.
 *
 * This is the real gate. The front-end lock screen is only presentation — the
 * server refuses the work regardless of what the client believes.
 */
export async function requireActiveTrial(
  req: ApiRequest,
  res: ApiResponse
): Promise<TrialSession | null> {
  const session = await gateSession(req, res);
  if (!session) return null;

  if (session.status.active) return session;
  if (session.status.preview) return denyPreviewNeedsEmail(res, session.status);
  return denyTrialExpired(res, session);
}

export function storeConfigured(): boolean {
  return isPersistentStore();
}
