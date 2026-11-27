/** Offline regression test: npx tsx scripts/recipe-videos-selftest.ts */
import assert from 'node:assert/strict';
import handler from '../api/generate-recipes.js';
import type { ApiRequest, ApiResponse } from '../api/_lib/http.js';

process.env.TRIAL_SECRET = 'selftest-secret-0123456789abcdefghijklmno';
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
const suffix = `${Date.now()}-${Math.random()}`;
let calls = 0;
let fail = false;
let empty = false;
let lastParams: URLSearchParams | null = null;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.host, 'www.googleapis.com');
  assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], 'test-key');
  lastParams = url.searchParams;
  calls++;
  if (fail) return new Response('{}', { status: 500 });
  return Response.json({ items: empty ? [] : [
    { id: { videoId: 'abcdefghijk' }, snippet: { title: 'Real recipe', channelTitle: 'A real channel', thumbnails: { medium: { url: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg' } } } },
    { id: { videoId: 'bad' }, snippet: { title: 'Invalid', channelTitle: 'X', thumbnails: { default: { url: 'https://example.com/not-youtube' } } } },
  ] });
};
function response() {
  const captured = { status: 200, body: null as any, headers: {} as Record<string, string | string[]> };
  const res: ApiResponse = {
    status(code) { captured.status = code; return res; },
    json(body) { captured.body = body; return body; },
    setHeader(name, value) { captured.headers[name] = value; },
    getHeader(name) { return captured.headers[name]; },
  };
  return { res, captured };
}
async function request(name: string, language = 'fr') {
  const req: ApiRequest = { method: 'POST', body: { action: 'recipe-videos', name, cuisine: 'Moroccan', language }, headers: { 'user-agent': `video-test-${suffix}` }, socket: { remoteAddress: '127.0.0.10' } };
  const { res, captured } = response();
  await handler(req, res);
  return captured;
}
try {
  delete process.env.YOUTUBE_API_KEY;
  const missing = await request(`missing ${suffix}`);
  assert.equal(missing.status, 503);
  assert.equal(missing.body.code, 'not_configured');
  assert.equal(calls, 0);
  process.env.YOUTUBE_API_KEY = 'test-key';
  const recipe = `Harira ${suffix}`;
  const first = await request(recipe);
  assert.equal(first.status, 200);
  assert.equal(first.body.videos.length, 1);
  assert.equal(first.body.videos[0].url, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.ok(first.body.expiresAt > Date.now() + 23 * 60 * 60 * 1000);
  const params = lastParams as URLSearchParams | null;
  assert.equal(params?.get('relevanceLanguage'), 'fr');
  assert.ok(params?.get('q')?.includes(`${recipe} Moroccan recette cuisine`));
  await request(recipe);
  assert.equal(calls, 1, 'cache must avoid another YouTube request');
  await request(recipe, 'en');
  assert.equal(calls, 2, 'language must distinguish cached searches');
  empty = true;
  const noResults = await request(`empty ${suffix}`);
  assert.deepEqual(noResults.body.videos, []);
  await request(`empty ${suffix}`);
  assert.equal(calls, 3, 'empty successful results are cached');
  empty = false; fail = true;
  const error = await request(`error ${suffix}`);
  assert.equal(error.status, 502);
  fail = false;
  await request(`error ${suffix}`);
  assert.equal(calls, 5, 'provider failures must not be cached');
  const now = Date.now;
  try {
    Date.now = () => now() + 24 * 60 * 60 * 1000 + 1000;
    await request(recipe);
    assert.equal(calls, 6, 'cache expires after 24 hours');
  } finally { Date.now = now; }
  console.log('Recipe videos: missing key, search, validation, language, cache, empty and error checks passed.');
} finally {
  globalThis.fetch = originalFetch;
}
