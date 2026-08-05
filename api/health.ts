import { ApiRequest, ApiResponse } from './_lib/http.js';

export default function handler(_req: ApiRequest, res: ApiResponse) {
  return res.status(200).json({
    status: 'ok',
    app: 'ColdScan AI',
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
}
