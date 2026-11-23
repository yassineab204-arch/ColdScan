/**
 * Self-test for the server-side trial gate.
 *
 *   npx tsx scripts/trial-selftest.ts
 *
 * The whole suite runs TWICE:
 *   1. against the in-memory fallback store, and
 *   2. against a local stand-in for the Upstash REST API, which exercises the
 *      real HTTP transport in `api/_lib/kv.ts` (SET NX, EX, INCR, EXPIRE).
 *
 * Pass --real to run pass 2 against the actual Upstash database instead, using
 * whatever UPSTASH_REDIS_REST_* / KV_REST_API_* credentials are in the
 * environment (e.g. after `vercel env pull`). Keys are namespaced and cleaned
 * up, but it does consume free-plan command quota.
 *
 * It verifies the behaviours that matter: the clock is server-owned, it cannot
 * be restarted by clearing browser state, forged cookies are rejected, and
 * premium endpoints return 402 once the 48 hours are up.
 */

import { kvGet, kvSet, isPersistentStore, storeBinding } from '../api/_lib/kv.js';
import { startFakeUpstash } from './fake-upstash.js';
import {
  isOwnerAccount,
  isOwnerEmail,
  linkVerifiedEmail,
  previewUsesFor,
  redeemCode,
  requireActiveTrial,
  requireFeatureAccess,
  requireSupportAccess,
  resolveTrial,
  statusFor,
  toStatus,
  TRIAL_MS,
  type TrialRecord,
} from '../api/_lib/trial.js';
import { derivedId } from '../api/_lib/secrets.js';
import {
  AUTH_COOKIE_NAME,
  signAuthCookie,
  verifyAuthCookieValue,
} from '../api/_lib/authCookie.js';
import {
  requestEmailOtp,
  supabaseConfigured,
  verifyEmailOtp,
} from '../api/_lib/supabase.js';
import type { ApiRequest, ApiResponse } from '../api/_lib/http.js';

process.env.TRIAL_SECRET ||= 'selftest-secret-0123456789abcdefghijklmno';
process.env.TRIAL_ACCESS_CODES ||= 'TEST-UNLOCK:unlock,TEST-EXTEND:extend:24';

/** Stable fake Supabase user id used by the verification tests. */
const AUTH_USER = '11111111-1111-4111-8111-111111111111';

/* ---------------- test doubles ---------------- */

interface Captured {
  statusCode: number;
  body: any;
  headers: Record<string, string | string[]>;
}

function mockRes(): ApiResponse & { captured: Captured } {
  const captured: Captured = { statusCode: 200, body: null, headers: {} };
  const res: any = {
    captured,
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    json(body: any) {
      captured.body = body;
      return body;
    },
    setHeader(name: string, value: string | string[]) {
      captured.headers[name] = value;
    },
  };
  return res;
}

/**
 * Namespaces every device signal for the current pass, so the two runs never
 * share a fingerprint (a stale device->account link from pass 1 would point at
 * an account that does not exist in pass 2's store).
 */
let passTag = 'p0';
// Unique per run: the Redis-backed pass persists between runs, so fixed test
// emails would otherwise adopt accounts (and clocks) from an earlier run.
const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function mockReq(opts: { cookie?: string; ip?: string; ua?: string } = {}): ApiRequest {
  return {
    method: 'POST',
    body: {},
    headers: {
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      'x-forwarded-for': opts.ip ?? '203.0.113.10',
      'user-agent': `${opts.ua ?? 'Mozilla/5.0 (selftest)'} ${passTag}`,
      'accept-language': 'en-US',
    },
  };
}

function cookieFrom(res: ApiResponse & { captured: Captured }): string {
  const raw = res.captured.headers['Set-Cookie'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value ?? '').split(';')[0]!;
}

/* ---------------- assertions ---------------- */

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Rewinds an account's stored start time to simulate the passage of time. */
async function rewind(accountId: string, ms: number) {
  const key = `coldscan:trial:account:${accountId}`;
  const record = JSON.parse((await kvGet(key)) as string) as TrialRecord;
  record.startedAt -= ms;
  if (typeof record.activatedAt === 'number') record.activatedAt -= ms;
  await kvSet(key, JSON.stringify(record));
}

/* ---------------- tests ---------------- */

async function runSuite(label: string, tag: string) {
  passTag = `${tag}-${RUN_ID}`;
  // Namespaced per pass (unique per run under --real), so the owner tests below
  // never collide with keys left by a previous run of the suite.
  process.env.TRIAL_OWNER_EMAILS = `owner-${passTag}@example.com`;
  console.log(`\n${'='.repeat(60)}\n  ${label}\n  store: ${storeBinding()}  persistent: ${isPersistentStore()}\n${'='.repeat(60)}`);

  // 1 — first contact creates a PREVIEW account, not a running trial
  console.log('1. First contact (preview)');
  const res1 = mockRes();
  const s1 = await resolveTrial(mockReq(), res1);
  const setCookie = String(res1.captured.headers['Set-Cookie']);
  const cookie = cookieFrom(res1);

  check('first contact is a preview', s1.status.preview);
  check('preview does not start the 48-hour clock', !s1.status.active && !s1.status.expired);
  check('preview reports no expiry', s1.status.expiresAt === '');
  check('account creation time is still recorded', Boolean(s1.status.startedAt));
  check(
    'each feature starts with two free tries',
    s1.status.previewRemaining.scan === 2 &&
      s1.status.previewRemaining.recipe === 2 &&
      s1.status.previewRemaining.voice === 2
  );
  check('cookie is HttpOnly', setCookie.includes('HttpOnly'));
  check('cookie is SameSite=Lax', setCookie.includes('SameSite=Lax'));

  // 2 — returning with the cookie resumes the same preview account
  console.log('\n2. Returning visit');
  const s2 = await resolveTrial(mockReq({ cookie }), mockRes());
  check('same account', s2.accountId === s1.accountId);
  check('still a preview', s2.status.preview);
  check('account creation time unchanged', s2.status.startedAt === s1.status.startedAt);

  // 3 — each feature is metered independently, server-side
  console.log('\n3. Preview tries');
  const scan1 = mockRes();
  const scan1Session = await requireFeatureAccess(mockReq({ cookie }), scan1, 'scan');
  check('first scan allowed', scan1Session !== null);
  check('one scan left', scan1.captured.headers['X-ColdScan-Preview-Remaining'] === '1');

  const scan2 = mockRes();
  const scan2Session = await requireFeatureAccess(mockReq({ cookie }), scan2, 'scan');
  check('second scan allowed', scan2Session !== null);
  check('zero scans left', scan2.captured.headers['X-ColdScan-Preview-Remaining'] === '0');

  const scan3 = mockRes();
  check(
    'third scan denied',
    (await requireFeatureAccess(mockReq({ cookie }), scan3, 'scan')) === null
  );
  check('denied with 402', scan3.captured.statusCode === 402, `got ${scan3.captured.statusCode}`);
  check(
    'asks for email verification, not a trial purchase',
    scan3.captured.body?.requiresEmailVerification === true
  );
  check('names the exhausted feature', scan3.captured.body?.feature === 'scan');
  check(
    'reports zero scans left in the status',
    scan3.captured.body?.trial?.preview === true &&
      scan3.captured.body?.trial?.previewRemaining?.scan === 0
  );

  const recipe1 = mockRes();
  check(
    'recipes have their own two tries',
    (await requireFeatureAccess(mockReq({ cookie }), recipe1, 'recipe')) !== null &&
      recipe1.captured.headers['X-ColdScan-Preview-Remaining'] === '1'
  );
  check(
    'voice has its own two tries',
    (await previewUsesFor(s1.accountId)).voice === 0
  );

  // 4 — clearing the cookie must not refill the counters
  console.log('\n4. Cleared browser storage');
  const cleared = await resolveTrial(mockReq(), mockRes());
  check('device fingerprint re-links to the original account', cleared.accountId === s1.accountId);
  check('used scans are still used', cleared.status.previewRemaining.scan === 0);
  const scan4 = mockRes();
  check(
    'third scan still denied after clearing',
    (await requireFeatureAccess(mockReq(), scan4, 'scan')) === null
  );

  // 5 — a genuinely different device gets its own preview
  console.log('\n5. Different device');
  const other = await resolveTrial(
    mockReq({ ip: '198.51.100.77', ua: 'Mozilla/5.0 (other device)' }),
    mockRes()
  );
  check('separate account', other.accountId !== s1.accountId);
  check('fresh preview tries', other.status.previewRemaining.scan === 2);
  const otherScan = mockRes();
  check(
    'new device can use its first scan',
    (await requireFeatureAccess(
      mockReq({ ip: '198.51.100.77', ua: 'Mozilla/5.0 (other device)' }),
      otherScan,
      'scan'
    )) !== null
  );

  // 6 — premium is gated behind email, support endpoints keep the preview usable
  console.log('\n6. Gate behaviour');
  const premium = mockRes();
  check(
    'premium endpoint denied in preview',
    (await requireActiveTrial(mockReq({ cookie }), premium)) === null
  );
  check(
    'premium 402 asks for email verification',
    premium.captured.body?.requiresEmailVerification === true
  );
  check(
    'premium 402 is not reported as trialExpired',
    premium.captured.body?.trialExpired !== true
  );

  const scansBeforeSupport = (await previewUsesFor(s1.accountId)).scan;
  const support = mockRes();
  check(
    'support endpoint allowed during preview',
    (await requireSupportAccess(mockReq({ cookie }), support)) !== null
  );
  check(
    'support does not consume a scan try',
    (await previewUsesFor(s1.accountId)).scan === scansBeforeSupport
  );

  // 7 — records created before the preview flow keep their original clock
  console.log('\n7. Legacy records (pre-preview)');
  const legacyDevice = { ip: '192.0.2.10', ua: 'Mozilla/5.0 (legacy active)' };
  const legacy = await resolveTrial(mockReq(legacyDevice), mockRes());
  const legacyKey = `coldscan:trial:account:${legacy.accountId}`;
  const legacyRaw = JSON.parse((await kvGet(legacyKey)) as string) as TrialRecord;
  const legacyActive: any = {
    ...legacyRaw,
    startedAt: Date.now() - TRIAL_MS / 2,
  };
  delete legacyActive.activatedAt;
  delete legacyActive.preview;
  await kvSet(legacyKey, JSON.stringify(legacyActive));

  const legacyAfter = await resolveTrial(mockReq(legacyDevice), mockRes());
  check('legacy record is active', legacyAfter.status.active);
  check('legacy record is not preview', !legacyAfter.status.preview);
  check(
    'legacy clock is preserved (about 24h left)',
    Math.round(legacyAfter.status.msRemaining / 3_600_000) === 24,
    `${Math.round(legacyAfter.status.msRemaining / 3_600_000)}h`
  );

  const expiredDevice = { ip: '192.0.2.11', ua: 'Mozilla/5.0 (legacy expired)' };
  const legacyExpiredAccount = await resolveTrial(mockReq(expiredDevice), mockRes());
  const legacyExpiredKey = `coldscan:trial:account:${legacyExpiredAccount.accountId}`;
  const legacyExpiredRaw = JSON.parse((await kvGet(legacyExpiredKey)) as string) as TrialRecord;
  const legacyExpired: any = {
    ...legacyExpiredRaw,
    startedAt: Date.now() - TRIAL_MS - 60_000,
  };
  delete legacyExpired.activatedAt;
  delete legacyExpired.preview;
  await kvSet(legacyExpiredKey, JSON.stringify(legacyExpired));

  const legacyExpiredAfter = await resolveTrial(mockReq(expiredDevice), mockRes());
  check('expired legacy record stays expired', legacyExpiredAfter.status.expired);
  check('expired legacy record is not preview', !legacyExpiredAfter.status.preview);
  const legacyGate = mockRes();
  check(
    'expired legacy feature call gets trialExpired',
    (await requireFeatureAccess(mockReq(expiredDevice), legacyGate, 'scan')) === null &&
      legacyGate.captured.body?.trialExpired === true
  );

  // 8 — verification is what starts the 48-hour clock
  console.log('\n8. Email verification activates the 48h trial');
  const beforeVerify = Date.now();
  const linked = await linkVerifiedEmail(
    mockReq({ cookie }),
    mockRes(),
    s1,
    `user-${passTag}@example.com`,
    AUTH_USER
  );
  check('verification linked the email', linked.ok);
  check('account left preview', linked.ok && !linked.record.preview);
  check('account has an activation time', linked.ok && linked.record.activatedAt !== null);
  check(
    'clock started at verification, not first visit',
    linked.ok && (linked.record.activatedAt as number) >= beforeVerify
  );
  check(
    'account creation was earlier than activation',
    linked.ok && linked.record.startedAt <= (linked.record.activatedAt as number)
  );

  const activatedStatus = linked.ok ? toStatus(linked.record) : null;
  check(
    'trial runs for exactly 48h from activation',
    Boolean(activatedStatus?.active) &&
      Date.parse(activatedStatus!.expiresAt) - Date.parse(activatedStatus!.activatedAt!) === TRIAL_MS
  );
  check(
    'preview usage did not reset on verification',
    (await previewUsesFor(s1.accountId)).scan > 2
  );
  const postVerifyScan = mockRes();
  check(
    'active trial can scan',
    (await requireFeatureAccess(mockReq({ cookie }), postVerifyScan, 'scan')) !== null
  );
  check(
    'active scan does not touch the preview counter',
    (await previewUsesFor(s1.accountId)).scan > 2
  );

  // 9 — expiry 48 hours after activation
  console.log('\n9. After 48 hours');
  await rewind(s1.accountId, TRIAL_MS + 60_000);
  const expired = await resolveTrial(mockReq({ cookie }), mockRes());
  check('trial reports expired', expired.status.expired);
  check('trial is no longer active', !expired.status.active);
  check('trial is not preview', !expired.status.preview);
  check('no time remaining', expired.status.msRemaining === 0);

  const expiredFeature = mockRes();
  check(
    'feature call is refused',
    (await requireFeatureAccess(mockReq({ cookie }), expiredFeature, 'scan')) === null
  );
  check(
    'expired feature call is not offered preview tries',
    expiredFeature.captured.body?.trialExpired === true &&
      expiredFeature.captured.body?.requiresEmailVerification !== true
  );

  const gateRes = mockRes();
  const allowed = await requireActiveTrial(mockReq({ cookie }), gateRes);
  check('premium gate denies access', allowed === null);
  check('responds 402', gateRes.captured.statusCode === 402, `got ${gateRes.captured.statusCode}`);
  check('flags trialExpired', gateRes.captured.body?.trialExpired === true);

  // 10 — clearing storage after expiry still cannot buy more time
  console.log('\n10. Clearing storage after expiry');
  const afterClear = await resolveTrial(mockReq(), mockRes());
  check('still expired', afterClear.status.expired);
  const gate2 = mockRes();
  check('premium still denied', (await requireActiveTrial(mockReq(), gate2)) === null);

  // 11 — access codes
  console.log('\n11. Access codes');
  const badCode = await redeemCode(mockReq({ cookie }), expired, 'NOT-A-REAL-CODE');
  check('unknown code rejected', !badCode.ok);

  const extend = await redeemCode(mockReq({ cookie }), expired, 'test-extend');
  check('extension code accepted (case-insensitive)', extend.ok && extend.granted === 'extend');

  const afterExtend = await resolveTrial(mockReq({ cookie }), mockRes());
  check('access restored by extension', afterExtend.status.active);
  check(
    'activation time preserved by extension',
    afterExtend.status.activatedAt === expired.status.activatedAt,
    `${afterExtend.status.activatedAt} vs ${expired.status.activatedAt}`
  );
  const grantedHours = Math.round(afterExtend.status.msRemaining / 3_600_000);
  check('roughly 24 hours granted', grantedHours === 24, `got ${grantedHours}h`);

  const unlock = await redeemCode(mockReq({ cookie }), afterExtend, 'TEST-UNLOCK');
  check('unlock code accepted', unlock.ok && unlock.granted === 'unlock');
  const unlocked = await resolveTrial(mockReq({ cookie }), mockRes());
  check('permanent access', unlocked.status.unlocked && unlocked.status.active);

  // A code redeemed during preview starts the clock at redemption.
  const codeDevice = { ip: '192.0.2.33', ua: 'Mozilla/5.0 (code preview)' };
  const codePreview = await resolveTrial(mockReq(codeDevice), mockRes());
  check('code test account starts in preview', codePreview.status.preview);
  const codeExtend = await redeemCode(mockReq(codeDevice), codePreview, 'TEST-EXTEND');
  check('extension code accepted in preview', codeExtend.ok && codeExtend.granted === 'extend');
  const codeStatus = codeExtend.ok ? await statusFor(codeExtend.record) : null;
  check(
    'preview code grants 48h plus the extension',
    Boolean(codeStatus?.active) && Math.round(codeStatus!.msRemaining / 3_600_000) === 72,
    codeStatus ? `${Math.round(codeStatus.msRemaining / 3_600_000)}h` : 'no status'
  );

  // 12 — email binding makes the trial portable and non-resettable
  console.log('\n12. Email binding');
  const freshDevice = { ip: '192.0.2.55', ua: 'Mozilla/5.0 (email test)' };
  // Distinct from the address used in section 8: that account already exists.
  const portableEmail = `portable-${passTag}@example.com`;
  const fresh = await resolveTrial(mockReq(freshDevice), mockRes());
  check('email test account starts in preview', fresh.status.preview);
  const freshLink = await linkVerifiedEmail(
    mockReq(freshDevice),
    mockRes(),
    fresh,
    `${portableEmail} `,
    AUTH_USER
  );
  await rewind(fresh.accountId, TRIAL_MS / 2);

  // Brand new browser AND new device: normally a fresh preview...
  const strangerRes = mockRes();
  const stranger = await resolveTrial(
    mockReq({ ip: '192.0.2.99', ua: 'Mozilla/5.0 (brand new phone)' }),
    strangerRes
  );
  check('unrelated device starts fresh', stranger.accountId !== fresh.accountId);
  check('unrelated device is in preview', stranger.status.preview);

  // ...until the same email is supplied, which re-adopts the original account.
  const relinkRes = mockRes();
  const relinked = await linkVerifiedEmail(
    mockReq({ ip: '192.0.2.99', ua: 'Mozilla/5.0 (brand new phone)' }),
    relinkRes,
    stranger,
    portableEmail.toUpperCase(),
    AUTH_USER
  );
  check('email lookup is normalized', relinked.ok);
  check(
    'same email resumes the original trial',
    relinked.ok && relinked.record.accountId === fresh.accountId
  );
  check(
    'original activation is kept (about 24h used)',
    relinked.ok &&
      relinked.record.activatedAt !== null &&
      Math.round((Date.now() - relinked.record.activatedAt) / 3_600_000) === 24
  );
  check('session cookie re-pointed to the original account', cookieFrom(relinkRes).includes(fresh.accountId));
  check(
    're-adoption is marked as verified',
    relinked.ok && relinked.adopted && Boolean(relinked.record.emailVerifiedAt)
  );

  const invalid = await linkVerifiedEmail(mockReq(), mockRes(), fresh, 'not-an-email', AUTH_USER);
  const invalidIdentity = await linkVerifiedEmail(
    mockReq(),
    mockRes(),
    fresh,
    portableEmail,
    'not-a-uuid'
  );
  check('invalid email rejected', !invalid.ok);
  check('invalid auth identity rejected', !invalidIdentity.ok);

  // 13 — no raw personal data is stored
  console.log('\n13. Data hygiene');
  const stored = (await kvGet(`coldscan:trial:account:${fresh.accountId}`)) as string;
  check('no raw email in the stored record', !stored.toLowerCase().includes(portableEmail));
  check('no IP address in the stored record', !stored.includes('192.0.2.55'));
  check('no secret in the stored record', !stored.includes(process.env.TRIAL_SECRET!));
  check('store reports the expected backend', isPersistentStore() === (storeBinding() !== 'memory'));

  // 14 — owner emails have full access, but ONLY after OTP verification
  console.log('\n14. Owner email (verified only)');
  check('the founder address is recognised as owner', isOwnerEmail('yassineab2014@gmail.com'));
  check('an unknown address is not owner', !isOwnerEmail(`someone-${passTag}@example.com`));

  const ownerDevice = { ip: '198.51.100.200', ua: 'Mozilla/5.0 (owner test)' };
  const ownerStart = await resolveTrial(mockReq(ownerDevice), mockRes());
  check('owner account starts in preview, not an active trial', ownerStart.status.preview && !ownerStart.status.active);
  check('owner preview is not expired', !ownerStart.status.expired);

  // A binding created by the old, unauthenticated flow must unlock NOTHING.
  const ownerEmailId = derivedId('email', `owner-${passTag}@example.com`);
  const legacyOwnerDevice = { ip: '198.51.100.201', ua: 'Mozilla/5.0 (legacy owner binding)' };
  const legacyOwner = await resolveTrial(mockReq(legacyOwnerDevice), mockRes());
  const legacyOwnerKey = `coldscan:trial:account:${legacyOwner.accountId}`;
  const legacyOwnerRaw = JSON.parse((await kvGet(legacyOwnerKey)) as string) as TrialRecord;
  await kvSet(
    legacyOwnerKey,
    JSON.stringify({ ...legacyOwnerRaw, emailId: ownerEmailId, emailVerifiedAt: null })
  );
  const legacyOwnerAfter = await resolveTrial(mockReq(legacyOwnerDevice), mockRes());
  check(
    'an unverified owner-email binding does not unlock access',
    legacyOwnerAfter.status.preview && !legacyOwnerAfter.status.unlocked
  );
  check(
    'an unverified binding is not reported as linked or verified',
    !legacyOwnerAfter.status.emailLinked && !legacyOwnerAfter.status.emailVerified
  );

  const ownerLink = await linkVerifiedEmail(
    mockReq(ownerDevice),
    mockRes(),
    ownerStart,
    `  OWNER-${passTag}@EXAMPLE.COM  `,
    AUTH_USER
  );
  check('owner email link accepted (case/whitespace normalised)', ownerLink.ok);
  check(
    'verifying the owner email grants permanent access',
    ownerLink.ok && toStatus(ownerLink.record).unlocked && toStatus(ownerLink.record).active
  );

  const ownerGateRes = mockRes();
  const ownerGate = await requireActiveTrial(mockReq(ownerDevice), ownerGateRes);
  check(
    'premium gate admits the owner',
    ownerGate !== null && ownerGate.status.unlocked && ownerGate.status.active
  );

  const ownerPhone = { ip: '192.0.2.222', ua: 'Mozilla/5.0 (owner new phone)' };
  const freshPhone = await resolveTrial(mockReq(ownerPhone), mockRes());
  const phoneLink = await linkVerifiedEmail(
    mockReq(ownerPhone),
    mockRes(),
    freshPhone,
    `owner-${passTag}@example.com`,
    AUTH_USER
  );
  check(
    'full access follows the owner email to a new device',
    phoneLink.ok && phoneLink.record.accountId === ownerStart.accountId && toStatus(phoneLink.record).unlocked
  );

  // 15 — an unverified claim cannot be inherited (email squatting)
  console.log('\n15. Email squatting');
  const squatEmail = `squat-${passTag}@example.com`;
  const squatEmailId = derivedId('email', squatEmail);

  const attackerDevice = { ip: '198.51.100.77', ua: 'Mozilla/5.0 (squatter)' };
  const attacker = await resolveTrial(mockReq(attackerDevice), mockRes());
  const attackerKey = `coldscan:trial:account:${attacker.accountId}`;
  const attackerRaw = JSON.parse((await kvGet(attackerKey)) as string) as TrialRecord;
  const squatterActivatedAt = Date.now() - TRIAL_MS / 2;
  await kvSet(
    attackerKey,
    JSON.stringify({
      ...attackerRaw,
      startedAt: squatterActivatedAt,
      activatedAt: squatterActivatedAt,
      preview: false,
      emailId: squatEmailId,
      emailVerifiedAt: null,
    })
  );
  await kvSet(`coldscan:trial:email:${squatEmailId}`, attacker.accountId);

  const victimDevice = { ip: '198.51.100.78', ua: 'Mozilla/5.0 (real address owner)' };
  const victim = await resolveTrial(mockReq(victimDevice), mockRes());
  const victimLink = await linkVerifiedEmail(
    mockReq(victimDevice),
    mockRes(),
    victim,
    squatEmail,
    AUTH_USER
  );
  check(
    'verification binds the real owner instead of inheriting the claim',
    victimLink.ok && victimLink.record.accountId === victim.accountId && !victimLink.adopted
  );
  check(
    'verification carries over the older activation (no trial reset)',
    victimLink.ok && victimLink.record.activatedAt === squatterActivatedAt
  );
  check(
    'the verified account keeps roughly the remaining trial',
    victimLink.ok &&
      Math.round((Date.now() - (victimLink.record.activatedAt as number)) / 3_600_000) === 24
  );
  check(
    'verification marks the binding as verified',
    victimLink.ok && Boolean(victimLink.record.emailVerifiedAt)
  );

  const attackerAfter = JSON.parse((await kvGet(attackerKey)) as string) as TrialRecord;
  check('the squatter loses the email claim', attackerAfter.emailId === null);
  check('the squatter is no longer an owner account', !isOwnerAccount(attackerAfter));

  const later = await resolveTrial(
    mockReq({ ip: '198.51.100.79', ua: 'Mozilla/5.0 (third device)' }),
    mockRes()
  );
  const laterLink = await linkVerifiedEmail(
    mockReq({ ip: '198.51.100.79', ua: 'Mozilla/5.0 (third device)' }),
    mockRes(),
    later,
    squatEmail,
    AUTH_USER
  );
  check(
    'a later sign-in adopts the verified account and its clock',
    laterLink.ok && laterLink.adopted && laterLink.record.accountId === victim.accountId
  );

  const plebDevice = { ip: '203.0.113.88', ua: 'Mozilla/5.0 (non-owner)' };
  const pleb = await resolveTrial(mockReq(plebDevice), mockRes());
  const plebLink = await linkVerifiedEmail(
    mockReq(plebDevice),
    mockRes(),
    pleb,
    `someone-${passTag}@example.com`,
    AUTH_USER
  );
  const plebStatus = plebLink.ok ? toStatus(plebLink.record) : null;
  check(
    'a non-owner email activates the trial but never unlocks it',
    plebStatus !== null && !plebStatus.unlocked && plebStatus.active && !plebStatus.preview
  );

  // 13 — the email session cookie is signed, scoped and tamper-proof
  console.log('\n13. Email session cookie');
  const signed = signAuthCookie(s1.accountId, AUTH_USER);
  const parsed = verifyAuthCookieValue(signed);
  check(
    'signed session round-trips',
    parsed?.accountId === s1.accountId && parsed?.userId === AUTH_USER
  );

  const parts = signed.split('.');
  const lastChar = parts[4]!.slice(-1);
  const tamperedSig = [...parts.slice(0, 4), parts[4]!.slice(0, -1) + (lastChar === 'A' ? 'B' : 'A')].join('.');
  check('tampered signature rejected', verifyAuthCookieValue(tamperedSig) === null);

  const tamperedAccount = [...parts];
  tamperedAccount[1] = 'attacker-account-01'; // valid shape, wrong signature
  check('tampered account id rejected', verifyAuthCookieValue(tamperedAccount.join('.')) === null);

  const expiredCookie = signAuthCookie(s1.accountId, AUTH_USER, Date.now() - 31 * 24 * 60 * 60 * 1000);
  check('expired session rejected', verifyAuthCookieValue(expiredCookie) === null);
  check(
    'invalid user id is never accepted',
    verifyAuthCookieValue(signAuthCookie(s1.accountId, 'not-a-uuid')) === null
  );
  check('session cookie name is stable', AUTH_COOKIE_NAME === 'coldscan_auth');

  // 14 — Supabase REST client (mocked; no email is ever sent)
  console.log('\n14. Supabase OTP client');
  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_ANON_KEY;
  const savedPublishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;

  check('missing configuration is reported', !supabaseConfigured());
  const unconfigured = await requestEmailOtp('person@example.com');
  check('OTP request refuses without configuration', !unconfigured.ok && unconfigured.reason === 'not_configured');

  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-publishable-key';
  check('configuration is detected', supabaseConfigured());

  const realFetch = globalThis.fetch;
  const calls: { url: string; init: any }[] = [];
  let responses: { status: number; body: any }[] = [];

  globalThis.fetch = (async (input: any, init: any) => {
    calls.push({ url: String(input), init });
    const next = responses.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    responses = [{ status: 200, body: {} }];
    const sent = await requestEmailOtp('Person@Example.com');
    const sentBody = JSON.parse(calls[0]!.init.body);
    check('OTP request succeeds', sent.ok);
    check('OTP call targets /auth/v1/otp', calls[0]!.url.endsWith('/auth/v1/otp'));
    check('OTP call allows creating the user', sentBody.create_user === true);
    check('only the publishable key is sent', calls[0]!.init.headers.apikey === 'test-publishable-key');

    responses = [{ status: 429, body: {} }];
    const throttled = await requestEmailOtp('person@example.com');
    check('provider rate limit is mapped', !throttled.ok && throttled.reason === 'rate_limited');

    responses = [
      {
        status: 200,
        body: {
          access_token: 'must-not-leak',
          refresh_token: 'must-not-leak',
          user: { id: AUTH_USER, email: 'person@example.com' },
        },
      },
    ];
    const verified = await verifyEmailOtp('person@example.com', '12345678');
    check('verification returns the provider user id', verified.ok && verified.userId === AUTH_USER);
    check(
      'provider tokens are discarded',
      !('access_token' in verified) && !JSON.stringify(verified).includes('must-not-leak')
    );

    responses = [{ status: 200, body: { user: { id: AUTH_USER, email: 'other@example.com' } } }];
    const mismatch = await verifyEmailOtp('person@example.com', '12345678');
    check('a mismatched confirmed address is rejected', !mismatch.ok);

    responses = [{ status: 400, body: {} }];
    const badCode = await verifyEmailOtp('person@example.com', '12345678');
    check('invalid code is mapped', !badCode.ok && badCode.reason === 'invalid_code');
  } finally {
    globalThis.fetch = realFetch;
    for (const [name, value] of [
      ['SUPABASE_URL', savedUrl],
      ['SUPABASE_ANON_KEY', savedKey],
      ['SUPABASE_PUBLISHABLE_KEY', savedPublishable],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

async function main() {
  console.log('\nColdScan trial gate self-test');

  // ---- Pass 1: in-memory fallback ----
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  await runSuite('PASS 1 — in-memory fallback (no Redis configured)', 'p1');
  const afterPass1 = { passed, failed };

  // ---- Pass 2: over the Redis REST transport ----
  const useReal = process.argv.includes('--real');
  let fake: Awaited<ReturnType<typeof startFakeUpstash>> | null = null;

  if (useReal) {
    if (!isPersistentStore()) {
      console.error('\n--real given but no Upstash credentials in the environment.');
      console.error('Run `vercel env pull .env.local` (or export them) first.\n');
      process.exit(1);
    }
    console.log('\nUsing the REAL Upstash database from the environment.');
  } else {
    fake = await startFakeUpstash();
    process.env.UPSTASH_REDIS_REST_URL = fake.url;
    process.env.UPSTASH_REDIS_REST_TOKEN = fake.token;
  }

  await runSuite(
    useReal
      ? 'PASS 2 — real Upstash Redis over REST'
      : 'PASS 2 — Redis REST transport (local Upstash stand-in)',
    // Unique per run so a --real pass never reuses keys from a previous run.
    useReal ? `real-${Date.now()}` : 'p2'
  );

  if (fake) {
    console.log(`\n  (${fake.commandCount} REST commands issued, ${fake.keys().length} keys written)`);
    await fake.close();
  }

  const pass2 = { passed: passed - afterPass1.passed, failed: failed - afterPass1.failed };
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  pass 1 (memory): ${afterPass1.passed} passed, ${afterPass1.failed} failed`);
  console.log(`  pass 2 (redis):  ${pass2.passed} passed, ${pass2.failed} failed`);
  console.log(`  TOTAL:           ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
