import { methodGuard, readBody, type ApiRequest, type ApiResponse } from './_lib/http.js';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function numberInRange(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

async function queryOverpass(query: string): Promise<Record<string, unknown>> {
  let lastError: unknown;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'ColdScan/0.1 (https://cold-scan.vercel.app/)',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(14_000),
      });

      if (!response.ok) {
        throw new Error(`Store provider returned ${response.status}`);
      }

      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No store provider was available');
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const body = readBody(req);
  const lat = numberInRange(body.lat, -90, 90);
  const lon = numberInRange(body.lon, -180, 180);
  const radius = numberInRange(body.radius, 250, 10_000);

  if (lat === null || lon === null || radius === null) {
    return res.status(400).json({ error: 'A valid location and search radius are required.' });
  }

  const roundedRadius = Math.round(radius);
  const query = `[out:json][timeout:20];
(
  nwr["brand"~"^(Carrefour|BIM|Supeco|Marjane|Aswak Assalam|Atacadao|Kazyon|Acima)$",i](around:${roundedRadius},${lat},${lon});
  nwr["operator"~"^(Carrefour|BIM|Supeco|Marjane|Aswak Assalam|Atacadao|Kazyon|Acima)$",i](around:${roundedRadius},${lat},${lon});
  nwr["name"~"^(Carrefour|BIM|Supeco|Marjane|Aswak Assalam|Atacadao|Kazyon|Acima)( |$)",i](around:${roundedRadius},${lat},${lon});
)->.chains;
.chains out center;
(
  nwr["shop"~"^(supermarket|grocery|convenience|greengrocer|bakery|pastry|butcher|deli|dairy|cheese|farm|seafood|general|food|beverages|wholesale)$"](around:${roundedRadius},${lat},${lon});
  nwr["amenity"="marketplace"](around:${roundedRadius},${lat},${lon});
)->.foodStores;
.foodStores out center 160;`;

  try {
    const data = await queryOverpass(query);
    const elements = Array.isArray(data.elements) ? data.elements : [];

    // Coordinates are used only for this request. Do not allow shared caches to
    // retain a response associated with a user's precise location.
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ success: true, elements });
  } catch (error) {
    console.error('[nearby-stores] provider request failed:', (error as Error)?.message || error);
    return res.status(502).json({
      error: 'Nearby stores could not be loaded right now. Please try again.',
    });
  }
}
