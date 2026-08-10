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
- **State:** React state persisted to `localStorage` (keys prefixed `coldscan_*`). No backend database.
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
  utils/
    i18n.ts                   # UI translations (9 languages) + localized name helpers
    currency.ts               # Currency conversion/formatting
    image.ts                  # Client-side downscale to 1280px/JPEG before upload
    geminiLiveClient.ts       # Browser -> Gemini Live WebSocket (uses ephemeral token)
    speechSync.ts             # TTS playback sync
api/
  _lib/genai.ts               # getGenAI(), TEXT_MODEL, TTS_MODEL, languageMandate()
  _lib/http.ts                # methodGuard, readBody, fail, ApiRequest/ApiResponse
  _lib/livePersona.ts         # SINGLE SOURCE OF TRUTH for Live voice model/voice/persona
  health.ts                   # GET, reports geminiKeyConfigured
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
7. **No secrets in the browser.** `GEMINI_API_KEY` stays server-side only.
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

Only one env var is required: `GEMINI_API_KEY` (set in `.env` locally and in
Vercel -> Settings -> Environment Variables for all environments). See
`.env.example`. Verify deployment with `/api/health` — `geminiKeyConfigured`
should be `true`.

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
