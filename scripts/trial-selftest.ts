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
  linkEmail,
  redeemCode,
  requireActiveTrial,
  resolveTrial,
  TRIAL_MS,
  type TrialRecord,
} from '../api/_lib/trial.js';
import type { ApiRequest, ApiResponse } from '../api/_lib/http.js';

process.env.TRIAL_SECRET ||= 'selftest-secret-0123456789abcdefghijklmno';
process.env.TRIAL_ACCESS_CODES ||= 'TEST-UNLOCK:unlock,TEST-EXTEND:extend:24';

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
  await kvSet(key, JSON.stringify(record));
}

/* ---------------- tests ---------------- */

async function runSuite(label: string, tag: string) {
  passTag = tag;
  console.log(`\n${'='.repeat(60)}\n  ${label}\n  store: ${storeBinding()}  persistent: ${isPersistentStore()}\n${'='.repeat(60)}`);

  // 1 — first contact starts the clock and issues an HttpOnly cookie
  console.log('1. First contact');
  const res1 = mockRes();
  const s1 = await resolveTrial(mockReq(), res1);
  const setCookie = String(res1.captured.headers['Set-Cookie']);

  check('trial starts active', s1.status.active);
  check('expiry is exactly 48h after start', s1.status.trialHours === 48);
  check(
    'expiry is computed from the stored start time',
    Date.parse(s1.status.expiresAt) - Date.parse(s1.status.startedAt) === TRIAL_MS
  );
  check('cookie is HttpOnly', setCookie.includes('HttpOnly'));
  check('cookie is SameSite=Lax', setCookie.includes('SameSite=Lax'));

  const cookie = cookieFrom(res1);

  // 2 — returning with the cookie resumes the same trial
  console.log('\n2. Returning visit');
  const s2 = await resolveTrial(mockReq({ cookie }), mockRes());
  check('same account', s2.accountId === s1.accountId);
  check('same start time', s2.status.startedAt === s1.status.startedAt);

  // 3 — clearing browser storage must not restart the trial
  console.log('\n3. Cleared browser storage (no cookie, same device)');
  const s3 = await resolveTrial(mockReq(), mockRes());
  check('device fingerprint re-links to the original account', s3.accountId === s1.accountId);
  check('start time is unchanged', s3.status.startedAt === s1.status.startedAt);

  // 4 — forged / tampered cookies are rejected
  console.log('\n4. Cookie tampering');
  const forged = await resolveTrial(
    mockReq({ cookie: 'coldscan_sid=attacker-chosen-account-id.deadbeef' }),
    mockRes()
  );
  check('bad signature is not honoured', forged.accountId !== 'attacker-chosen-account-id');
  check('falls back to the real account for this device', forged.accountId === s1.accountId);

  // 5 — a genuinely different device does get its own trial
  console.log('\n5. Different device');
  const other = await resolveTrial(
    mockReq({ ip: '198.51.100.77', ua: 'Mozilla/5.0 (other device)' }),
    mockRes()
  );
  check('separate account', other.accountId !== s1.accountId);

  // 6 — expiry after 48 hours, computed server-side
  console.log('\n6. After 48 hours');
  await rewind(s1.accountId, TRIAL_MS + 60_000);
  const expired = await resolveTrial(mockReq({ cookie }), mockRes());
  check('trial reports expired', expired.status.expired);
  check('trial is no longer active', !expired.status.active);
  check('no time remaining', expired.status.msRemaining === 0);

  // 7 — premium endpoints refuse the work
  console.log('\n7. Premium gate');
  const gateRes = mockRes();
  const allowed = await requireActiveTrial(mockReq({ cookie }), gateRes);
  check('gate denies access', allowed === null);
  check('responds 402', gateRes.captured.statusCode === 402, `got ${gateRes.captured.statusCode}`);
  check('flags trialExpired', gateRes.captured.body?.trialExpired === true);

  // 8 — clearing storage after expiry still cannot buy more time
  console.log('\n8. Clearing storage after expiry');
  const afterClear = await resolveTrial(mockReq(), mockRes());
  check('still expired', afterClear.status.expired);
  const gate2 = mockRes();
  check('premium still denied', (await requireActiveTrial(mockReq(), gate2)) === null);

  // 9 — access codes
  console.log('\n9. Access codes');
  const badCode = await redeemCode(mockReq({ cookie }), expired, 'NOT-A-REAL-CODE');
  check('unknown code rejected', !badCode.ok);

  const extend = await redeemCode(mockReq({ cookie }), expired, 'test-extend');
  check('extension code accepted (case-insensitive)', extend.ok && extend.granted === 'extend');

  const afterExtend = await resolveTrial(mockReq({ cookie }), mockRes());
  check('access restored by extension', afterExtend.status.active);
  // The start time is never rewritten — extensions only add time on top of it.
  check(
    'original start time preserved',
    afterExtend.status.startedAt === expired.status.startedAt,
    `${afterExtend.status.startedAt} vs ${expired.status.startedAt}`
  );
  const grantedHours = Math.round(afterExtend.status.msRemaining / 3_600_000);
  check('roughly 24 hours granted', grantedHours === 24, `got ${grantedHours}h`);

  const unlock = await redeemCode(mockReq({ cookie }), afterExtend, 'TEST-UNLOCK');
  check('unlock code accepted', unlock.ok && unlock.granted === 'unlock');
  const unlocked = await resolveTrial(mockReq({ cookie }), mockRes());
  check('permanent access', unlocked.status.unlocked && unlocked.status.active);

  // 10 — email binding makes the trial portable and non-resettable
  console.log('\n10. Email binding');
  const fresh = await resolveTrial(
    mockReq({ ip: '192.0.2.55', ua: 'Mozilla/5.0 (email test)' }),
    mockRes()
  );
  await linkEmail(mockReq({ ip: '192.0.2.55' }), mockRes(), fresh, `user-${passTag}@example.com `);
  await rewind(fresh.accountId, TRIAL_MS / 2);

  // Brand new browser AND new device: normally a fresh trial...
  const strangerRes = mockRes();
  const stranger = await resolveTrial(
    mockReq({ ip: '192.0.2.99', ua: 'Mozilla/5.0 (brand new phone)' }),
    strangerRes
  );
  check('unrelated device starts fresh', stranger.accountId !== fresh.accountId);

  // ...until the same email is supplied, which re-adopts the original account.
  const relinkRes = mockRes();
  const relinked = await linkEmail(
    mockReq({ ip: '192.0.2.99', ua: 'Mozilla/5.0 (brand new phone)' }),
    relinkRes,
    stranger,
    `USER-${passTag}@EXAMPLE.COM`
  );
  check('email lookup is normalized', relinked.ok);
  check(
    'same email resumes the original trial',
    relinked.ok && relinked.record.accountId === fresh.accountId
  );
  check(
    'original clock is kept (about 24h used)',
    relinked.ok && Math.round((Date.now() - relinked.record.startedAt) / 3_600_000) === 24
  );
  check('session cookie re-pointed to the original account', cookieFrom(relinkRes).includes(fresh.accountId));

  const invalid = await linkEmail(mockReq(), mockRes(), fresh, 'not-an-email');
  check('invalid email rejected', !invalid.ok);

  // 11 — no raw personal data is stored
  console.log('\n11. Data hygiene');
  const stored = (await kvGet(`coldscan:trial:account:${fresh.accountId}`)) as string;
  check('no raw email in the stored record', !stored.toLowerCase().includes(`user-${passTag}@example.com`));
  check('no IP address in the stored record', !stored.includes('192.0.2.55'));
  check('no secret in the stored record', !stored.includes(process.env.TRIAL_SECRET!));

  check('store reports the expected backend', isPersistentStore() === (storeBinding() !== 'memory'));
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
