# ColdScan — AI Agent Guide

This file is the operating manual for any AI coding agent (or developer) working
on ColdScan. Read it before making changes. When instructions here conflict with
a request, flag the conflict before proceeding.

## What ColdScan is

ColdScan is a smart food-tech web app that helps people manage their refrigerator,
reduce food waste, save money, and decide what to cook. The user scans a photo of
their fridge/food; ColdScan recognizes ingredients, suggests recipes based on what
is available, tracks freshness, builds a costed shopping list of missing items,
and offers an AI voice sous-chef.

- Production site: https://cold-scan.vercel.app/
- Instagram: @cold.scan
- Brand messaging: **"Scan. Cook. Save."** / core hook: *"Your fridge has a secret."*
- Promise: **Less waste. Less spending. More meals.**

Treat ColdScan as an evolving startup product, not a school project. Every change
should make it feel more like a serious real-world product.

## Tech stack

- **Frontend:** React 19 + TypeScript, Vite 6, Tailwind CSS v4 (`@import "tailwindcss"` in `src/index.css`, `@tailwindcss/vite` plugin).
- **Icons:** `lucide-react`. Animations: `motion`.
- **Backend:** Vercel serverless functions — every file in `api/` is its own endpoint. No framework.
- **Local dev server:** `server.ts` (Express + Vite middleware) is **development only**. It mounts the same `api/` handlers on one origin so `fetch('/api/...')` works identically locally and on Vercel. It is NOT used in production.
- **AI:** Google Gemini via `@google/genai`. Server-side client in `api/_lib/genai.ts`.
- **Auth:** passwordless email OTP via Supabase Auth (GoTrue). The browser never
  talks to Supabase; `api/auth.ts` proxies both calls and issues a signed
  HttpOnly session cookie — see "Email authentication" below.
- **State:** App data (inventory, recipes, settings) is React state persisted to
  `localStorage` (keys prefixed `coldscan_*`). The **free trial is the exception**:
  it is server-authoritative, stored in Redis and keyed to an account — see below.
- **Path alias:** `@` → repo root (see `vite.config.ts`).
- **Type check:** `npm run lint` runs `tsc --noEmit`. Run it before finishing.

### Architecture map

```
src/
  App.tsx                     # Root: tabs, state, localStorage, API orchestration
  types.ts                    # Shared domain types (FoodItem, Recipe, ShoppingItem...)
  index.css                   # Tailwind import
  components/
    Header.tsx, Navigation.tsx
    screens/                  # One component per tab (Home, Scan, Inventory, Recipes, ShoppingList, CostEstimate, Settings)
    *Modal.tsx                # LiveVoiceModal, RecipeVoiceBotModal, CookingWizardModal, ItemModal, Settings
  data/mockData.ts            # Seed/default inventory, recipes, shopping list, settings
  data/cuisines.ts            # Cuisine catalog for personalization (keep ids in sync with api/_lib/cuisines.ts)
  components/auth/
    EmailOtpSheet.tsx         # Two-step email -> code sign-in sheet
  hooks/
    useTrial.ts               # Mirrors /api/trial, polls + rechecks on focus and on 402
    useAuth.ts                # Mirrors /api/auth (email session) and feeds status into useTrial
  utils/
    api.ts                    # apiFetch(): sends the cookie; splits 402 into email-required vs expired
    auth.ts                   # Thin client for /api/auth — no verification logic lives here
    trial.ts                  # Thin client for /api/trial — NO trial logic lives here
    i18n.ts                   # UI translations (9 languages) + localized name helpers
    currency.ts               # Currency conversion/formatting
    image.ts                  # Client-side downscale to 1280px/JPEG before upload
    geminiLiveClient.ts       # Browser -> Gemini Live WebSocket (uses ephemeral token)
    speechSync.ts             # TTS playback sync
api/
  _lib/genai.ts               # getGenAI(), TEXT_MODEL, TTS_MODEL, languageMandate()
  _lib/cuisines.ts            # Server-side cuisine catalog + payload sanitizer (twin of src/data/cuisines.ts)
  _lib/http.ts                # methodGuard, readBody, fail, ApiRequest/ApiResponse
  _lib/livePersona.ts         # SINGLE SOURCE OF TRUTH for Live voice model/voice/persona
  _lib/kv.ts                  # Redis-over-HTTP client (Upstash / Vercel KV), in-memory dev fallback
  _lib/secrets.ts             # HMAC helpers keyed with TRIAL_SECRET (never hardcoded)
  _lib/supabase.ts            # SERVER-ONLY GoTrue client for OTP request/verify (no SDK)
  _lib/authCookie.ts          # Signed HttpOnly coldscan_auth session cookie
  _lib/trial.ts               # SINGLE SOURCE OF TRUTH for preview limits, the 48h trial and feature gates
  health.ts                   # GET, reports which env vars are configured (booleans only)
  auth.ts                     # GET session; POST start / verify / sign-out (email OTP)
  trial.ts                    # GET status; POST redeem-code / tutorial-seen
  live-token.ts               # Mints single-use Gemini Live ephemeral token
  scan-fridge.ts              # POST, vision analysis of a fridge photo
  generate-recipes.ts         # POST, recipes from inventory
  generate-shopping-list.ts   # POST, costed shopping list (MAD default)
  geocode.ts                  # POST, manual map-area geocoding via Nominatim
  nearby-stores.ts            # POST, nearby real food shops via Overpass
  ai-chat.ts                  # POST, text assistant (JSON: reply + detectedLanguage)
  recipe-voice-bot.ts         # POST, cooking sous-chef turns + step/timer actions
  tts.ts                      # POST, speech synthesis WAV
```

## How to work

1. **Understand before changing.** Read the relevant file(s) and trace how data
   flows through `App.tsx`. Do not blindly write code.
2. **Reuse, don't recreate.** Use existing components, `types.ts`, `utils/`, and
   i18n helpers. Do not create duplicate components.
3. **Smallest correct change.** Fix the actual cause; don't rewrite working
   features or the whole project to land one feature.
4. **Don't add dependencies** without a clear reason. Prefer the existing stack.
5. **Mobile-first.** Everything is designed around a `max-w-md` phone column that
   centers on larger screens. Test the narrow viewport first.
6. **No fake functionality.** No invented APIs, credentials, or env vars. No
   hardcoded "AI" data where a real call is expected. If a feature can't really
   work (e.g. maps without an API key), say so and provide a fallback.
7. **No secrets in the browser.** `GEMINI_API_KEY`, `TRIAL_SECRET`, the Redis
   credentials and `TRIAL_ACCESS_CODES` are server-side only. Never hardcode a
   secret or an access code, and never prefix any of them with `VITE_`.
8. **Test it.** Run `npm run lint` and, for UI changes, `npm run dev` and click
   through the flow. Don't claim it works if it isn't tested.
9. **Don't break what exists.** Verify existing tabs and modals still work.

## Conventions

- **TypeScript:** type all props and shared objects via `src/types.ts`. Avoid
  `any` except where the API boundary genuinely needs it (and isolate it).
- **API handlers:** use `methodGuard(req, res, 'POST')`, `readBody(req)`, and
  `fail(res, error, 'User-facing message')` from `api/_lib/http.ts`. Never leak
  provider error details to the browser. Return `{ success: true, ... }` on
  success.
- **Multilingual:** all model output must obey the language mandate from
  `languageMandate(language, subject)` in `api/_lib/genai.ts`. The assistant
  auto-detects Darija (Arabic or Arabizi), French, English, and the other
  supported languages. UI strings go through `t(key, lang)` in `utils/i18n.ts` —
  add a key to **all** language tables when you add user-facing copy.
- **Currency:** default is Moroccan Dirhams (`DH`/`MAD`). Use `convertCurrency` /
  `formatCurrencyAmount` from `utils/currency.ts`.
- **Images:** downscale in the browser (see `utils/image.ts`) to stay under
  Vercel's request body limit. The dev server allows 15 MB JSON bodies.
- **Brand:** ColdScan emerald/green (`emerald-600` family), white/light surfaces,
  rounded cards (`rounded-2xl`/`rounded-3xl`), `font-black` tight-tracking
  headings, subtle shadows. Avoid clutter, excessive gradients, and generic
  dashboard looks. Do not change the visual identity without asking.

## Gemini Live / voice architecture (important)

Gemini Live needs a long-lived WebSocket. Vercel functions are short-lived, so the
browser connects **directly** to Google using a single-use ephemeral token:

```
browser -> POST /api/live-token   (server holds GEMINI_API_KEY)
        <- single-use token with session config locked inside
browser -> wss://...google...     (mic PCM16 16kHz <-> model audio PCM16 24kHz)
```

- To change the model, voice, greeting, or persona, edit
  **`api/_lib/livePersona.ts`** — it is the single source of truth. The persona is
  locked into the token so a modified client can't change it.
- The token is single-use, expires 2 minutes after minting if unused, and caps the
  session at 30 minutes. Never put the API key in client code.


## Preview + free trial (server-enforced — do not weaken)

New accounts start in a **preview**: no clock, no expiry, and **two tries per
feature** (scanning, recipes, voice). Verifying an email starts **48 hours** of
full access from that moment. The rules:

- **`api/_lib/trial.ts` is the single source of truth.** Preview limits, trial
  length, activation, expiry, access codes and the account model all live there.
  Change it there, nowhere else.
- **The client decides nothing.** `src/utils/trial.ts` and `src/hooks/useTrial.ts`
  only mirror what `/api/trial` reports. Never reintroduce a `localStorage`-based
  trial, a client-side countdown that grants access, or a hardcoded access code.
- **Metered features use their own gate.** `scan-fridge` calls
  `requireFeatureAccess(req, res, 'scan')`, `generate-recipes` uses `'recipe'`,
  `live-token` (and `recipe-voice-bot`) uses `'voice'`. The gate allows an active
  or unlocked trial; in preview it atomically increments that feature's Redis
  counter (limit 2), sets `X-ColdScan-Preview-Remaining`, and on the third try
  returns `402 { requiresEmailVerification: true, preview: true, feature }`.
  Never meter a new feature without giving it its own counter and gate.
- **Support routes use `requireSupportAccess`** (`tts`, `geocode`,
  `nearby-stores`) and do not consume a featured try. Premium non-metered routes
  (`ai-chat`, `generate-shopping-list`) use `requireActiveTrial`.
- **Every client call to `/api/*` must go through `apiFetch`** (`src/utils/api.ts`)
  so the session cookie is sent. A `402` becomes `EmailVerificationRequiredError`
  (open the OTP sheet) when `requiresEmailVerification` is set, otherwise
  `TrialExpiredError` (contact/access-code UI).
- **No demo-data fallback on any 402.** If a call is refused, show the email sheet
  or the contact screen — never fake a successful result (see `ScanScreen.tsx`).
- The identity cookie is `HttpOnly` + signed; preview counters live in Redis and
  are keyed by `accountId`, never by IP or browser storage. Refresh or clearing
  storage cannot refill them; only a genuinely new account gets new previews.
- **Verification is the only activation.** Preview records have
  `activatedAt: null`; `linkVerifiedEmail()` sets `activatedAt = now` on the
  first verification, which is what starts the 48 hours. Creating an account,
  browsing, or `GET /api/trial` must never start the clock.
- **Never shorten a running trial.** Records created before the preview model
  have no `activatedAt`; `sanitizeRecord()` migrates them to
  `activatedAt = startedAt`. Signing out or re-verifying must not reset it.
- **Email bindings are only created after OTP verification.** `linkVerifiedEmail()`
  is called exclusively by `/api/auth` with the user id Supabase returned. There
  is no endpoint that binds an address typed by the browser; `link-email` on
  `/api/trial` now answers 410. Never add one back.
- **Legacy bindings are untrusted.** Records with `emailId` but no
  `emailVerifiedAt` are treated as unbound and are revoked the first time the
  real owner verifies the address.
- **Owner emails bypass the trial, but only when verified.** An account bound to
  the founder's address (`OWNER_EMAILS` in `api/_lib/trial.ts`) or to any address
  in `TRIAL_OWNER_EMAILS` is unlocked on every device only after `emailVerifiedAt`
  is set. Keep the list in `trial.ts`/env only; never on the client.
- **Signing out** clears `coldscan_auth` only. It never restores preview tries,
  resets the clock, or removes the verified email binding.

## Email authentication (Supabase OTP)

```
browser -> POST /api/auth { action: 'start', email }
server  -> Supabase POST /auth/v1/otp        (apikey = publishable key)
browser <- generic 200 "code sent"

browser -> POST /api/auth { action: 'verify', email, token }
server  -> Supabase POST /auth/v1/verify
server  -> linkVerifiedEmail() + signed HttpOnly `coldscan_auth` cookie
browser <- { verified: true, trial }         (first verification starts the 48h clock)
```

- **Server-only credentials.** `SUPABASE_URL` + `SUPABASE_ANON_KEY` are read in
  `api/_lib/supabase.ts`. Never prefix them with `VITE_`, never expose them in
  client code, and **never add a service-role key** — it is not needed.
- **No Supabase tokens in the browser.** The access/refresh tokens returned by
  `/verify` are discarded. The session is ColdScan's own signed cookie
  (`coldscan_auth`, HttpOnly, SameSite=Lax, 30 days), keyed with `TRIAL_SECRET`.
- **`start` grants nothing.** It does not resolve or create a trial, its response
  is identical for known and unknown addresses, and it is rate-limited per IP and
  per address with a fail-closed limiter.
- **`verify` is the only path to a trusted email.** It checks that Supabase
  confirmed the same address that was submitted, then adopts an existing
  verified account (keeping its original clock) or revokes an unverified claim.
- **Signing out** clears `coldscan_auth` only. The trial identity, its clock and
  the verified binding are untouched.
- **Provider setup (dashboard, not code):** email provider + sign-ups enabled;
  Magic Link template must include `{{ .Token }}`; custom SMTP for production;
  Site URL and redirect allow-list set. `/api/health` reports
  `auth.supabaseConfigured` as a boolean only.

Verify changes with `npx tsx scripts/trial-selftest.ts` — 236 checks (118 per pass)
that run the whole suite twice, once on the in-memory fallback and once over the
real Redis REST transport. Supabase calls are mocked, so no email is sent. Add
`--real` to run pass 2 against the live Upstash database.
The store is provisioned by the Vercel + Upstash Marketplace integration, which
injects `UPSTASH_REDIS_REST_*` (or `KV_REST_API_*`) into every environment;
`api/_lib/kv.ts` reads whichever pair is present, lazily, per invocation.

## Product principles

Prioritize in this order: **working functionality -> UX -> reliability ->
performance -> visual quality -> extra features.**

When asked for a feature, weigh: retention, usefulness, simplicity, trust, speed,
food-waste reduction, money saved, and cooking discovery. A cool feature that
doesn't help the user should be challenged — give an honest recommendation
instead of just agreeing.

AI should accomplish a real task. Prefer practical answers ("I found tomatoes,
eggs, cheese, and lettuce — you could make these 3 recipes; you're only missing
olive oil for #2") over generic detection lists.

### Maps / location features

Nearby stores, directions, and real-time location require a maps API and key,
user permission, and a privacy story. Identify the service, state whether a key
is needed, never present fake locations as real, and always provide a fallback.
Don't claim such a feature works unless it genuinely does.

## Environment

Set these in `.env` locally and in Vercel -> Settings -> Environment Variables
(all environments). See `.env.example` for the full explanation of each.

| Name                        | Required | Purpose                                    |
| --------------------------- | -------- | ------------------------------------------ |
| `GEMINI_API_KEY`            | yes      | All Gemini calls                            |
| `TRIAL_SECRET`              | yes      | Signs trial + auth sessions, derives ids    |
| `UPSTASH_REDIS_REST_URL`    | yes      | Stores server-side trial start times        |
| `UPSTASH_REDIS_REST_TOKEN`  | yes      | ^                                           |
| `SUPABASE_URL`              | yes      | Supabase Auth endpoint for email OTP        |
| `SUPABASE_ANON_KEY`         | yes      | Public/publishable auth key (server-only)   |
| `TRIAL_ACCESS_CODES`        | no       | Codes handed out after the trial ends       |
| `TRIAL_OWNER_EMAILS`        | no       | Extra emails with permanent full access     |

`SUPABASE_PUBLISHABLE_KEY` is accepted as an alias for `SUPABASE_ANON_KEY`.
Never set a Supabase service-role key for this app.

`KV_REST_API_URL` / `KV_REST_API_TOKEN` work in place of the Upstash pair.

Verify with `/api/health`: `geminiKeyConfigured`, `trial.secretConfigured`,
`trial.storeConfigured` and `auth.supabaseConfigured` should all be `true`.
Without the store the trial is not enforceable in production — each serverless
instance would keep its own copy. Without Supabase config, the app still runs and
the trial still works, but email sign-in reports itself unavailable.

## Deploy

Vercel auto-detects Vite (`vercel.json`): build `npm run build`, output `dist/`,
each `api/**/*.ts` is a serverless function (60s max), and all non-`/api` routes
rewrite to `index.html` for the SPA.

## Communication

Be professional but plain-spoken. When explaining a change, cover: what was wrong,
why, what changed, and how to test it. Keep it concise unless detail is requested.
For informal asks ("make this better", "fix this"), infer intent from the codebase
and proceed; ask one concise question only when there are materially different
interpretations.
