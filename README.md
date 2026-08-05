# ColdScan

Mobile-first AI app that scans your fridge, tracks freshness, suggests recipes from
what you already have, builds a costed shopping list, and offers a real-time
trilingual (Darija / French / English) voice sous-chef powered by Gemini Live.

## Deploying to Vercel

1. Import the repo in Vercel. The settings in `vercel.json` are picked up
   automatically (Vite build → `dist/`, everything in `api/` → serverless functions).
2. Add **one** environment variable in **Settings → Environment Variables**, for all
   environments:

   | Name             | Value                |
   | ---------------- | -------------------- |
   | `GEMINI_API_KEY` | your Gemini API key   |

3. Deploy. Redeploy after adding the key if the first build ran without it.

Check `https://<your-app>.vercel.app/api/health` — `geminiKeyConfigured` should be `true`.

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

## API routes

| Route                        | Purpose                                   |
| ---------------------------- | ----------------------------------------- |
| `/api/health`                | Health + key-configured check             |
| `/api/live-token`            | Mints the Gemini Live ephemeral token     |
| `/api/scan-fridge`           | Vision scan of a fridge photo             |
| `/api/generate-recipes`      | Recipes from current inventory            |
| `/api/generate-shopping-list`| Costed shopping list (MAD)                |
| `/api/ai-chat`               | Text assistant                            |
| `/api/recipe-voice-bot`      | Cooking sous-chef turns + step/timer actions |
| `/api/tts`                   | Speech synthesis (WAV)                    |

Uploaded photos are downscaled in the browser to 1280px/JPEG before upload
(see `src/utils/image.ts`) to stay under Vercel's 4.5 MB request body limit.
