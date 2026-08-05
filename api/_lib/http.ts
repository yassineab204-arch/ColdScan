/**
 * Minimal request/response shapes shared by the Vercel serverless runtime and the
 * local Express dev server. Both satisfy this structurally, so every handler in
 * `api/` runs unchanged in production (Vercel functions) and in `npm run dev`.
 */

export interface ApiRequest {
  method?: string;
  body?: any;
  query?: Record<string, any>;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: any): any;
  setHeader(name: string, value: string): any;
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

export function fail(res: ApiResponse, error: unknown, fallback: string) {
  const message = (error as any)?.message || fallback;
  return res.status(500).json({ error: message });
}
