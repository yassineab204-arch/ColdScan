/**
 * LOCAL DEVELOPMENT SERVER ONLY.
 *
 * Production runs on Vercel, where each file in `api/` is deployed as its own
 * serverless function and `dist/` is served statically — this file is not used
 * there. It exists so `npm run dev` serves the Vite app and the exact same API
 * handlers on one origin, meaning `fetch('/api/...')` behaves identically in
 * development and production.
 */

import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';

import aiChat from './api/ai-chat.js';
import generateRecipes from './api/generate-recipes.js';
import generateShoppingList from './api/generate-shopping-list.js';
import health from './api/health.js';
import liveToken from './api/live-token.js';
import recipeVoiceBot from './api/recipe-voice-bot.js';
import scanFridge from './api/scan-fridge.js';
import tts from './api/tts.js';
import type { ApiHandler } from './api/_lib/http.js';

const PORT = Number(process.env.PORT) || 3000;
const app = express();

// High payload limit for base64 photo uploads.
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

const routes: Record<string, ApiHandler> = {
  '/api/health': health,
  '/api/live-token': liveToken,
  '/api/scan-fridge': scanFridge,
  '/api/generate-recipes': generateRecipes,
  '/api/generate-shopping-list': generateShoppingList,
  '/api/ai-chat': aiChat,
  '/api/recipe-voice-bot': recipeVoiceBot,
  '/api/tts': tts,
};

// Express req/res structurally satisfy the ApiRequest/ApiResponse contract that
// the Vercel handlers are written against, so they mount as-is.
for (const [path, handler] of Object.entries(routes)) {
  app.all(path, async (req, res, next) => {
    try {
      await handler(req as any, res as any);
    } catch (err) {
      next(err);
    }
  });
}

async function start() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ColdScan dev server running on http://localhost:${PORT}`);
    if (!process.env.GEMINI_API_KEY) {
      console.warn('WARNING: GEMINI_API_KEY is not set. Create a .env file with your key.');
    }
  });
}

start();
