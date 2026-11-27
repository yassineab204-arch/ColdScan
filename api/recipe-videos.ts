import { createHash } from 'node:crypto';
import { methodGuard, readBody, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { kvGet, kvSet } from './_lib/kv.js';
import { rateLimit, requireSupportAccess } from './_lib/trial.js';

const TTL_SECONDS = 24 * 60 * 60;
const terms: Record<string, string> = {
  en: 'recipe cooking', fr: 'recette cuisine', 'ar-MA': 'وصفة طبخ', ar: 'وصفة طبخ',
  es: 'receta cocina', de: 'Rezept kochen', it: 'ricetta cucina', pt: 'receita culinária', ja: 'レシピ 作り方',
};
const inFlight = new Map<string, Promise<Video[]>>();
type Video = { id: string; title: string; channel: string; thumbnail: string; url: string };

function safeThumbnail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'ytimg.com' || url.hostname.endsWith('.ytimg.com')) ? url.href : null;
  } catch { return null; }
}

async function searchYouTube(name: string, cuisine: string, language: string, key: string): Promise<Video[]> {
  const params = new URLSearchParams({
    part: 'snippet', type: 'video', maxResults: '3', order: 'relevance', safeSearch: 'moderate',
    q: [name, cuisine, terms[language]].filter(Boolean).join(' '),
    relevanceLanguage: language === 'ar-MA' ? 'ar' : language,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('YouTube search unavailable');
  const payload = await response.json();
  if (!Array.isArray(payload.items)) throw new Error('Invalid YouTube response');
  return payload.items.flatMap((item: any) => {
    const id = item?.id?.videoId;
    const title = item?.snippet?.title;
    const channel = item?.snippet?.channelTitle;
    const thumbnail = safeThumbnail(item?.snippet?.thumbnails?.medium?.url) || safeThumbnail(item?.snippet?.thumbnails?.default?.url);
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(id) || typeof title !== 'string' || !title.trim() || typeof channel !== 'string' || !channel.trim() || !thumbnail) return [];
    return [{ id, title, channel, thumbnail, url: `https://www.youtube.com/watch?v=${id}` }];
  }).slice(0, 3);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const session = await requireSupportAccess(req, res, { bucket: 'preview-video-support' });
  if (!session) return;
  const body = readBody(req);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const cuisine = typeof body.cuisine === 'string' ? body.cuisine.trim() : '';
  const language = typeof body.language === 'string' && Object.hasOwn(terms, body.language) ? body.language : 'en';
  if (!name || name.length > 200 || cuisine.length > 100) return res.status(400).json({ error: 'Invalid recipe search.' });
  const cacheKey = 'coldscan:recipe-videos:v1:' + createHash('sha256').update(JSON.stringify([name, cuisine, language])).digest('hex');
  try {
    const cached = await kvGet(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed.videos) && typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()) return res.status(200).json({ success: true, ...parsed });
    }
  } catch { /* A cache outage must not break recipe suggestions. */ }
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(503).json({ error: 'Video suggestions are not configured.', code: 'not_configured' });
  const limit = await rateLimit(`recipe-videos:${session.accountId}`, 60, 3600, { failClosed: true });
  if (limit.degraded) return res.status(503).json({ error: 'Video suggestions are temporarily unavailable.' });
  if (!limit.allowed) return res.status(429).json({ error: 'Too many searches. Please try again later.' });
  try {
    let pending = inFlight.get(cacheKey);
    if (!pending) {
      pending = searchYouTube(name, cuisine, language, key);
      inFlight.set(cacheKey, pending);
    }
    const videos = await pending;
    const expiresAt = Date.now() + TTL_SECONDS * 1000;
    try { await kvSet(cacheKey, JSON.stringify({ videos, expiresAt }), TTL_SECONDS); } catch { /* Best effort. */ }
    return res.status(200).json({ success: true, videos, expiresAt });
  } catch {
    return res.status(502).json({ error: 'Video suggestions are temporarily unavailable.' });
  } finally {
    inFlight.delete(cacheKey);
  }
}
