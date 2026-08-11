import { GoogleGenAI, Modality } from '@google/genai';
import { ApiRequest, ApiResponse, fail, readBody } from './_lib/http.js';
import { requireActiveTrial } from './_lib/trial.js';
import {
  DEFAULT_VOICE,
  LIVE_MODEL,
  buildLiveSystemInstruction,
} from './_lib/livePersona.js';

/**
 * Mints a short-lived, single-use ephemeral token for the Gemini Live API.
 *
 * Vercel runs serverless functions, which cannot host the long-lived WebSocket
 * proxy the AI Studio build relied on. Instead the browser connects directly to
 * Gemini using this token: GEMINI_API_KEY never leaves the server, and the whole
 * session config is locked into the token so the client cannot override it.
 *
 * Ephemeral tokens are Gemini Developer API only and require apiVersion v1alpha.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Server-side trial gate. This one matters most: without it an expired user
  // could still mint Gemini Live tokens and burn real API quota.
  if (!(await requireActiveTrial(req, res))) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        'GEMINI_API_KEY is not configured. Set it in Vercel > Settings > Environment Variables.',
    });
  }

  try {
    const { inventory = [], recipe = null, voiceName, language = 'en' } = readBody(req);
    const voice = typeof voiceName === 'string' && voiceName ? voiceName : DEFAULT_VOICE;

    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
    const now = Date.now();

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        // Session may run for up to 30 minutes...
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        // ...but must be started within 2 minutes of minting.
        newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
        // Setting constraints locks every field below for any session using this
        // token, so a tampered client cannot swap the model, voice or persona.
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: buildLiveSystemInstruction({ inventory, recipe, language }),
            // Deliberately no temperature: temperature on the native-audio live
            // model is associated with silent-output / 1011 disconnect bugs.
          },
        },
      },
    });

    return res.status(200).json({ token: token.name, model: LIVE_MODEL });
  } catch (error: any) {
    console.error('Error in /api/live-token:', error);
    return fail(res, error, 'Failed to start the voice session');
  }
}
