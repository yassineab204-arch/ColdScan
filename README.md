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
   | `TRIAL_SECRET`            | yes      | you (see below)                                   |
   | `UPSTASH_REDIS_REST_URL`  | yes      | **Upstash integration, automatically**            |
   | `UPSTASH_REDIS_REST_TOKEN`| yes      | **Upstash integration, automatically**            |
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
  }
}
```

**If `trial.storeConfigured` is `false` the trial is not enforced**: each
serverless instance falls back to its own in-memory copy, so the clock restarts
unpredictably. Check both a production URL and a preview URL — they are
configured independently.

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


## The 2-day free trial

Every new user gets **48 hours** of full access. The trial is enforced entirely
on the server — the browser is never trusted with the clock.

```
browser → GET /api/trial
        ← { startedAt, expiresAt, active, … }   ← computed from the stored
                                                   start time + server clock

browser → POST /api/scan-fridge (or any premium route)
        ← 402 { trialExpired: true }            once the 48 hours are up
```

**Where the state lives**

| What                | Where                                                        |
| ------------------- | ------------------------------------------------------------ |
| Account identity    | signed **HttpOnly** cookie `coldscan_sid` (JS cannot read it) |
| Trial start time    | Redis, keyed to the account, written once with `SET NX`       |
| Expiry              | computed on the server as `startedAt + 48h`                   |
| Email link          | stored as an HMAC — the raw address is never persisted        |
| Device link         | salted hash of IP + User-Agent — never stored in the clear    |

**Why clearing browser storage doesn't restart it**

1. Nothing about the trial is kept in `localStorage`, so there is nothing to clear.
2. The account id lives in an `HttpOnly` cookie that page scripts cannot read or delete.
3. The start time is written with `SET NX`, so an account can never get a second one.
4. If the cookie *is* cleared, a hashed device fingerprint re-links the browser to the same account.
5. Once the user adds their email, the trial follows the person across browsers and devices.
6. Editing the front-end changes nothing: every premium route re-checks the trial and returns `402`.

Honest limitation: a determined user on a *different* device with a *different*
IP, who never linked an email, can start a new trial. Closing that fully requires
real authenticated accounts. Everything short of that — devtools, incognito,
clearing storage, editing the bundle, forging the cookie — is covered.

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
npx tsx scripts/trial-selftest.ts          # 74 checks, no Redis needed
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
| `/api/trial`                 | Trial status, email binding, access codes |

Uploaded photos are downscaled in the browser to 1280px/JPEG before upload
(see `src/utils/image.ts`) to stay under Vercel's 4.5 MB request body limit.
