/**
 * Minimal request/response shapes shared by the Vercel serverless runtime and the
 * local Express dev server. Both satisfy this structurally, so every handler in
 * `api/` runs unchanged in production (Vercel functions) and in `npm run dev`.
 */

export interface ApiRequest {
  method?: string;
  body?: any;
  query?: Record<string, any>;
  /** Lower-cased request headers. Vercel and Express both provide this. */
  headers?: Record<string, string | string[] | undefined>;
  /** Vercel parses cookies for us; Express does not (we parse the header instead). */
  cookies?: Record<string, string>;
  /** Express-only. Vercel exposes the client IP through `x-forwarded-for`. */
  socket?: { remoteAddress?: string };
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: any): any;
  setHeader(name: string, value: string | string[]): any;
  /** Both Express and Vercel's Node runtime provide this; optional for mocks. */
  getHeader?(name: string): string | string[] | number | undefined;
}

export type ApiHandler = (req: ApiRequest, res: ApiResponse) => Promise<any> | any;

/** Parses the Cookie header. Vercel also supplies `req.cookies`. */
export function parseCookies(req: ApiRequest): Record<string, string> {
  if (req.cookies && typeof req.cookies === 'object') return req.cookies;

  const header = req.headers?.cookie;
  const raw = Array.isArray(header) ? header.join('; ') : header;
  if (!raw) return {};

  const out: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

/** True when the request reached us over HTTPS (Vercel is always HTTPS). */
export function isSecureRequest(req: ApiRequest): boolean {
  if (process.env.VERCEL_ENV) return true;
  const proto = req.headers?.['x-forwarded-proto'];
  const value = Array.isArray(proto) ? proto[0] : proto;
  return value === 'https';
}

/**
 * Adds a Set-Cookie header without clobbering the others.
 *
 * A single response can legitimately carry both the trial cookie and the auth
 * cookie; `setHeader('Set-Cookie', value)` would replace the first one. Any
 * existing cookie with the same name is dropped so the last write wins cleanly.
 */
export function setCookie(res: ApiResponse, cookie: string): void {
  const nameEnd = cookie.indexOf('=');
  const name = nameEnd > 0 ? cookie.slice(0, nameEnd) : '';

  const previous = typeof res.getHeader === 'function' ? res.getHeader('Set-Cookie') : undefined;
  const list: string[] = Array.isArray(previous)
    ? previous.map(String)
    : previous === undefined
      ? []
      : [String(previous)];

  const kept = name ? list.filter((entry) => !entry.startsWith(`${name}=`)) : list;
  kept.push(cookie);
  res.setHeader('Set-Cookie', kept);
}

/** Rejects anything but the given method, so a stray GET can't burn API quota. */
export function methodGuard(req: ApiRequest, res: ApiResponse, allowed: string): boolean {
  if (req.method === allowed) return true;
  res.setHeader('Allow', allowed);
  res.status(405).json({ error: `Method ${req.method} not allowed` });
  return false;
}

/** Vercel gives us a parsed object for JSON bodies; be tolerant of raw strings. */
export function readBody(req: ApiRequest): Record<string, any> {
  const body = req.body;
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body as Record<string, any>;
}

/**
 * Returns a generic, vendor-neutral message to the browser while logging the
 * real error server-side (visible in the Vercel function logs). Upstream errors
 * embed the provider's name and endpoints, which must not surface in the UI.
 */
export function fail(res: ApiResponse, error: unknown, fallback: string) {
  console.error('[api] request failed:', (error as any)?.message || error);
  return res.status(500).json({ error: fallback });
}
