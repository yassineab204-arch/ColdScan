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
}

export type ApiHandler = (req: ApiRequest, res: ApiResponse) => Promise<any> | any;

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
