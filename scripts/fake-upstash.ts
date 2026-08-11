/**
 * Minimal stand-in for the Upstash Redis REST API, for local testing only.
 *
 * It implements just the commands `api/_lib/kv.ts` uses (GET, SET with NX/EX,
 * INCR, EXPIRE) with the same request/response shape Upstash uses:
 *
 *   POST /            body: ["SET","key","value","NX","EX","60"]
 *   POST /pipeline    body: [[...],[...]]
 *   -> { "result": ... }  |  { "error": "..." }
 *
 * This lets the trial self-test exercise the real HTTP transport instead of
 * the in-memory fallback. It is never imported by the app.
 */

import { createServer, type Server } from 'node:http';

interface Entry {
  value: string;
  expiresAt: number | null;
}

export interface FakeUpstash {
  url: string;
  token: string;
  server: Server;
  /** Number of commands received, to keep an eye on free-plan usage. */
  commandCount: number;
  keys(): string[];
  close(): Promise<void>;
}

export function startFakeUpstash(token = 'fake-token'): Promise<FakeUpstash> {
  const store = new Map<string, Entry>();

  const read = (key: string): string | null => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.value;
  };

  const state = { commandCount: 0 };

  function runCommand(args: string[]): { result: unknown } | { error: string } {
    state.commandCount += 1;
    const op = String(args[0] ?? '').toUpperCase();

    switch (op) {
      case 'GET':
        return { result: read(args[1]!) };

      case 'SET': {
        const [, key, value, ...rest] = args;
        const flags = rest.map((f) => String(f).toUpperCase());

        const nx = flags.includes('NX');
        if (nx && read(key!) !== null) return { result: null };

        const exIndex = flags.indexOf('EX');
        const ttl = exIndex >= 0 ? Number(rest[exIndex + 1]) : null;

        store.set(key!, {
          value: String(value),
          expiresAt: ttl ? Date.now() + ttl * 1000 : null,
        });
        return { result: 'OK' };
      }

      case 'INCR': {
        const key = args[1]!;
        const next = Number(read(key) ?? 0) + 1;
        const existing = store.get(key);
        store.set(key, { value: String(next), expiresAt: existing?.expiresAt ?? null });
        return { result: next };
      }

      case 'EXPIRE': {
        const key = args[1]!;
        const entry = store.get(key);
        if (!entry) return { result: 0 };
        entry.expiresAt = Date.now() + Number(args[2]) * 1000;
        return { result: 1 };
      }

      default:
        return { error: `unsupported command ${op}` };
    }
  }

  const server = createServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      let payload: any;
      try {
        payload = JSON.parse(body || '[]');
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'bad json' }));
        return;
      }

      const isPipeline = req.url === '/pipeline';
      const out = isPipeline
        ? (payload as string[][]).map(runCommand)
        : runCommand(payload as string[]);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        token,
        server,
        get commandCount() {
          return state.commandCount;
        },
        keys: () => [...store.keys()],
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}
