import { methodGuard, readBody, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { requireActiveTrial } from './_lib/trial.js';

interface NominatimResult {
  lat?: string;
  lon?: string;
  display_name?: string;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  // Server-side trial gate: refuses the work once the 48 hours are up,
  // regardless of anything the client claims.
  if (!(await requireActiveTrial(req, res))) return;

  const body = readBody(req);
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (query.length < 2 || query.length > 160) {
    return res.status(400).json({ error: 'Enter a valid city or address.' });
  }

  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      q: query,
      limit: '1',
      addressdetails: '1',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': typeof body.language === 'string' ? body.language : 'en',
        'User-Agent': 'ColdScan/0.1 (https://cold-scan.vercel.app/)',
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      throw new Error(`Geocoder returned ${response.status}`);
    }

    const results = (await response.json()) as NominatimResult[];
    const first = results[0];
    const lat = Number(first?.lat);
    const lon = Number(first?.lon);

    res.setHeader('Cache-Control', 'private, no-store');
    if (!first || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(200).json({ success: true, location: null });
    }

    return res.status(200).json({
      success: true,
      location: { lat, lon, label: first.display_name || query },
    });
  } catch (error) {
    console.error('[geocode] provider request failed:', (error as Error)?.message || error);
    return res.status(502).json({ error: 'Location search could not be loaded right now.' });
  }
}
