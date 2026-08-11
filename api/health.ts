import { ApiRequest, ApiResponse } from './_lib/http.js';
import { isTrialSecretConfigured } from './_lib/secrets.js';
import { storeBinding } from './_lib/kv.js';
import { storeConfigured, TRIAL_HOURS } from './_lib/trial.js';

/**
 * Reports whether each required piece of configuration is present. It only ever
 * returns booleans — never the values themselves.
 */
export default function handler(_req: ApiRequest, res: ApiResponse) {
  return res.status(200).json({
    status: 'ok',
    app: 'ColdScan AI',
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    trial: {
      hours: TRIAL_HOURS,
      // Signing key for session cookies and derived identifiers.
      secretConfigured: isTrialSecretConfigured(),
      // Shared datastore holding the server-side trial start times.
      storeConfigured: storeConfigured(),
      // Which credential pair the Upstash/KV integration provided.
      storeBinding: storeBinding(),
      // Which Vercel environment this function is running in.
      environment: process.env.VERCEL_ENV || 'development',
      // At least one access code is available for the contact-to-continue flow.
      accessCodesConfigured: Boolean(process.env.TRIAL_ACCESS_CODES),
    },
    timestamp: new Date().toISOString(),
  });
}
