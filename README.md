# ColdScan

Mobile-first AI app that scans your fridge, tracks freshness, suggests recipes from
what you already have, builds a costed shopping list, and offers a real-time
trilingual (Darija / French / English) voice sous-chef powered by Gemini Live.

## Deploying to Vercel

1. Import the repo in Vercel. The settings in `vercel.json` are picked up
   automatically (Vite build → `dist/`, everything in `api/` → serverless functions).
2. Add the environment variables in **Settings → Environment Variables**, for all
   environments:

   | Name                      | Required | Set by                                          |
   | ------------------------- | -------- | ------------------------------------------------ |
   | `GEMINI_API_KEY`          | yes      | you                                               |
   | `YOUTUBE_API_KEY`         | no       | you (YouTube Data API v3; recipe videos)          |
   | `TRIAL_SECRET`            | yes      | you (see below)                                   |
   | `UPSTASH_REDIS_REST_URL`  | yes      | **Upstash integration, automatically**            |
   | `UPSTASH_REDIS_REST_TOKEN`| yes      | **Upstash integration, automatically**            |
   | `SUPABASE_URL`            | yes      | you (Supabase → Project Settings → API)           |
   | `SUPABASE_ANON_KEY`       | yes      | you (publishable/anon key, **never** service role) |
   | `TRIAL_ACCESS_CODES`      | no       | you, e.g. `AB12-CD34:unlock`                      |

   **Redis:** connecting an Upstash database from the Vercel Marketplace injects
   its credentials into every environment for you — nothing to copy. The app
   accepts either `UPSTASH_REDIS_REST_*` (native Upstash resource) or
   `KV_REST_API_*` (Vercel KV-style binding); `/api/health` reports which pair it
   found. Keys are namespaced `coldscan:trial:*`, so one database can be shared
   with other apps.

   **Trial secret:** generate and install it without ever copying a value:

   ```bash
   npx vercel login && npx vercel link
   bash scripts/setup-trial-env.sh
   ```

   That writes a 256-bit key to `.env` for local dev and adds a *separate* one to
   Production and Preview, so a leaked preview value cannot forge production
   sessions. To do it by hand instead, generate with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

   See [`.env.example`](.env.example) for what each variable does.

3. Deploy. Redeploy after adding the keys if the first build ran without them.

Check `https://<your-app>.vercel.app/api/health`:

```jsonc
{
  "geminiKeyConfigured": true,
  "trial": {
    "hours": 48,
    "secretConfigured": true,   // TRIAL_SECRET is set
    "storeConfigured": true,    // Redis reachable  <-- must be true
    "storeBinding": "upstash",  // or "vercel-kv"
    "environment": "production"
  },
  "auth": {
    "provider": "supabase",
    "supabaseConfigured": true, // SUPABASE_URL + SUPABASE_ANON_KEY are set
    "emailOtpEnabled": true
  }
}
```

**If `trial.storeConfigured` is `false` the trial is not enforced**: each
serverless instance falls back to its own in-memory copy, so the clock restarts
unpredictably. Check both a production URL and a preview URL — they are
configured independently.

## Recipe video suggestions

Enable YouTube Data API v3 in Google Cloud and add a server-side `YOUTUBE_API_KEY`
to Vercel (and `.env` for local development). Restrict the key to YouTube Data
API v3. Without it, recipe generation still works and video search shows an
unavailable message. Searches use YouTube's search API and may consume quota;
results are cached for 24 hours in the existing Redis/KV store (or process
memory in local development) and on the user's device. Cached videos are links
to YouTube, not downloads. The Settings toggle controls automatic searches for
newly generated recipes; manual searches are always available.

## Local development

```bash
cp .env.example .env    # then paste your GEMINI_API_KEY
npm install
npm run dev             # http://localhost:3000
```

`server.ts` is a **development-only** server. It serves Vite and mounts the same
`api/` handlers on the same origin, so `fetch('/api/...')` behaves identically in
dev and in production. It is not used by Vercel.

## How the live voice session works

Gemini Live needs a long-lived WebSocket. Vercel functions are short-lived and
cannot hold one open, so the browser connects **directly** to Google instead of
proxying through this app:

```
browser → POST /api/live-token   (serverless, holds GEMINI_API_KEY)
        ← single-use ephemeral token, session config locked inside
browser → wss://…google… (direct)  mic PCM16 16kHz ⇄ model audio PCM16 24kHz
```

`GEMINI_API_KEY` never reaches the browser. The token is single-use, expires 2
minutes after minting if unused, and caps the session at 30 minutes. Because the
model, voice, persona and transcription settings are locked into the token via
`liveConnectConstraints`, a modified client cannot change them.

To change the assistant's persona, model, or voice, edit
[`api/_lib/livePersona.ts`](api/_lib/livePersona.ts) — it is the single source of truth.


## Try first, then verify (2 free tries per feature)

New accounts start in a **preview** with no clock and no expiry. Each premium
feature can be used **twice** — scanning, recipe generation and the voice helper
are counted separately, on the server, per account. On the third try that
feature answers `402 { requiresEmailVerification: true }` and the app opens the
email sheet.

Verifying an email with a one-time code starts **48 hours of full access from
that moment**. Preview use never eats into the 48 hours, and the clock is never
started by browsing or by `GET /api/trial`.

```
browser → GET /api/trial
        ← { preview: true, previewRemaining: { scan: 2, recipe: 2, voice: 2 } }

browser → POST /api/scan-fridge            (feature: 'scan')
        ← X-ColdScan-Preview-Remaining: 1
        ← X-ColdScan-Preview-Remaining: 0
        ← 402 { requiresEmailVerification: true, feature: 'scan' }

browser → POST /api/auth { action: 'verify', email, token }
        ← { verified: true, trial: { active: true, expiresAt: activatedAt + 48h } }
```

**Where the state lives**

| What                 | Where                                                             |
| -------------------- | ----------------------------------------------------------------- |
| Account identity     | signed **HttpOnly** cookie `coldscan_sid` (JS cannot read it)      |
| Preview tries        | Redis, `coldscan:trial:rate:preview:<feature>:<accountId>`, max 2  |
| Trial start          | Redis `activatedAt`, written on the first verified email           |
| Expiry               | computed on the server as `activatedAt + 48h`                      |
| Legacy records       | migrated to `activatedAt = startedAt`, so no running trial shrinks |
| Email link           | only after OTP; stored as an HMAC — never in the clear             |
| Email session        | signed **HttpOnly** cookie `coldscan_auth` (30 days)               |
| Device link          | salted hash of IP + User-Agent — never stored in the clear         |

Browsing (home, map, geocode, settings) is not metered and does not consume a
try. Support routes such as `/api/tts` and `/api/nearby-stores` have their own
daily limit instead of a preview counter.

## Email sign-in (passwordless OTP)

An email address is **only** linked after Supabase Auth confirms a one-time code
for it. Typing an address grants nothing. Verification starts the 48-hour clock
for an account that has not started one yet, and signing out never touches the
clock, the preview counters or the verified binding.

```
browser → POST /api/auth { action: 'start', email }
server  → Supabase POST /auth/v1/otp          (server-held publishable key)
browser ← generic 200 “code sent”             (identical for known/unknown)

browser → POST /api/auth { action: 'verify', email, token }
server  → Supabase POST /auth/v1/verify
server  → adopts the verified account (or binds this one) + sets coldscan_auth
browser ← { verified: true, trial }           (status from the stored clock)
```

- The browser never receives a Supabase key or token. `api/_lib/supabase.ts` is
  server-only and the returned access/refresh tokens are discarded.
- Sessions are ColdScan's own signed HttpOnly cookie, HMAC-ed with `TRIAL_SECRET`.
- Rate limits are applied per IP and per address, and fail closed.
- A previously squatted, unverified binding is revoked when the real owner
  verifies the address; it can never be inherited.

### Supabase dashboard setup (one-time)

1. **Authentication → Providers → Email:** enabled, sign-ups allowed.
2. **Authentication → Email Templates → Magic Link:** include `{{ .Token }}`.
   Without it the email only contains a link and the user never sees a code.
3. **Authentication → SMTP:** configure a real provider. Supabase's built-in
   sender is for testing only and is heavily rate-limited.
4. **Authentication → URL Configuration:** Site URL = `https://cold-scan.vercel.app`,
   and add preview/localhost origins to the redirect allow-list.
5. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Vercel for **Production,
   Preview and Development**. Never add a service-role key.

`/api/health` reports `auth.supabaseConfigured` as a boolean (never the values).

No database migration is required. Supabase manages `auth.users` itself, and the
trial stays in the existing Redis/Vercel KV store keyed to the account. The only
one-time data behaviour change is that email bindings created by the old
unauthenticated flow are treated as unverified until the real owner proves
control with a code.

**Why clearing browser storage doesn't restart it**

1. Nothing about the trial is kept in `localStorage`, so there is nothing to clear.
2. The account id lives in an `HttpOnly` cookie that page scripts cannot read or delete.
3. Preview tries are incremented on the server per feature and per account, so they cannot be refilled.
4. If the cookie *is* cleared, a hashed device fingerprint re-links the browser to the same account.
5. The `activatedAt` time is written once, on the first verified email; a second verification cannot reset it.
6. Once the user verifies their email, the trial follows the person across browsers and devices.
7. Editing the front-end changes nothing: every premium route re-checks the gate and returns `402`.

Honest limitation: a determined user on a *different* device with a *different*
IP, who never verifies an email, can still get a new preview. Verified accounts
are portable and cannot be reset by clearing anything. Closing the remaining gap
fully requires payments and stronger identity, which do not exist yet.

Signing in is **not** a bypass: an expired trial stays expired after
verification, and every premium endpoint keeps returning `402`. Only a redeemed
access code or a verified owner email unlocks access. A code redeemed during
preview starts the clock at redemption and adds its bonus time on top.

**Handing out access after the trial**

The contact screen accepts an access code. Codes are configured through
`TRIAL_ACCESS_CODES` (never hardcoded), compared as HMACs keyed with
`TRIAL_SECRET`, and rate limited to 10 attempts per account per 15 minutes:

```
TRIAL_ACCESS_CODES="8FJ2-QW71:unlock,K93M-2RTX:extend:48"
                     └ permanent access   └ 48 extra hours
```

Run the gate's self-test with:

```bash
npx tsx scripts/trial-selftest.ts          # 236 checks, no Redis needed
npx tsx scripts/trial-selftest.ts --real   # same suite against the real Upstash DB
```

The suite runs twice: once against the in-memory fallback, once over the actual
Redis REST transport (against a local stand-in, or your real database with
`--real` after `vercel env pull`). It also covers the failure modes — a bad
token or an unreachable database makes the gate **fail closed** with a 503
rather than silently granting access.

## API routes

| Route                        | Purpose                                   |
| ---------------------------- | ----------------------------------------- |
| `/api/health`                | Health + key-configured check             |
| `/api/live-token`            | Mints the Gemini Live ephemeral token     |
| `/api/scan-fridge`           | Vision scan of a fridge photo             |
| `/api/generate-recipes`      | Recipes from current inventory            |
| `/api/generate-shopping-list`| Costed shopping list (MAD)                |
| `/api/geocode`               | Manual map-area geocoding fallback        |
| `/api/nearby-stores`         | Real nearby food shops from OpenStreetMap |
| `/api/ai-chat`               | Text assistant                            |
| `/api/recipe-voice-bot`      | Cooking sous-chef turns + step/timer actions |
| `/api/tts`                   | Speech synthesis (WAV)                    |
| `/api/auth`                  | Email OTP start/verify, session, sign-out  |
| `/api/trial`                 | Trial status, access codes, tutorial flag  |

Uploaded photos are downscaled in the browser to 1280px/JPEG before upload
(see `src/utils/image.ts`) to stay under Vercel's 4.5 MB request body limit.
