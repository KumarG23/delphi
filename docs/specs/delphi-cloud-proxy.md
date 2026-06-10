# Build Spec: Ask Delphi cloud proxy (make it work for family)

> Author: Claude (architect). Builder: Grok. Reviewer: Claude.
> Problem: family aren't on the tailnet, so the local Z420 model is unreachable
> for them, and the deployed HTTPS site can't call the http:// Ollama URL
> (mixed content). Fix: a same-origin Vercel serverless proxy that calls a cheap
> cloud model via OpenRouter, keeping the API key server-side.

## Architecture (locked unless Neal overrides)

- **Host:** Vercel project `delphi` (framework: null, Node 24, deploys from git).
- **Proxy:** a standalone Vercel serverless function at `api/delphi.ts` (repo
  root `/api`, NOT inside Expo's `app/`). Vercel auto-builds `/api/*` as Node
  functions for framework-null projects. Same-origin → no CORS, no mixed content.
- **Provider:** OpenRouter (OpenAI-compatible). Model `deepseek/deepseek-v4-flash`
  (cheapest; swap via env `DELPHI_MODEL`). Key in `OPENROUTER_API_KEY` (server env).
- **Client stays the same** otherwise: persona + financial-context + goals are
  still assembled CLIENT-side (they depend on Supabase-auth'd data) and POSTed to
  the proxy. The proxy is a dumb forwarder that only adds the key + model.
- **Keep the local Ollama path for local dev:** if `EXPO_PUBLIC_OLLAMA_URL` is
  set, the client calls Ollama directly (today's behavior); otherwise it calls
  `/api/delphi`. Production Vercel env will NOT set `EXPO_PUBLIC_OLLAMA_URL`, so
  prod uses the proxy; local `.env` keeps it, so local dev keeps the free model.

## §1 — `api/delphi.ts` (Vercel serverless function)

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.DELPHI_MODEL || 'deepseek/deepseek-v4-flash';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: 'Delphi is not configured.' });

  const { messages } = (req.body ?? {}) as { messages?: unknown };
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  try {
    const r = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // OpenRouter attribution headers (optional but nice):
        'HTTP-Referer': 'https://delphi.sharma-house.com',
        'X-Title': 'Delphi',
      },
      body: JSON.stringify({ model: MODEL, messages, stream: false }),
    });
    if (!r.ok) {
      return res.status(502).json({ error: `Upstream error (${r.status})` });
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content?.trim() ?? '';
    return res.status(200).json({ content });
  } catch {
    return res.status(502).json({ error: 'Could not reach Delphi.' });
  }
}
```

- Add `@vercel/node` to `devDependencies` for the types.
- Do NOT log `messages` (financial summary) or the key.

## §2 — Client: `lib/askDelphi/index.ts`

Branch the transport; keep everything else identical.

```ts
const OLLAMA_BASE = process.env.EXPO_PUBLIC_OLLAMA_URL;          // local dev only
const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? '';         // '' = same-origin (web)

export async function chat(messages: ChatMessage[]): Promise<string> {
  // Local dev: talk to Ollama directly if configured.
  if (OLLAMA_BASE) {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'delphi-cat-coach', messages, stream: false }),
    });
    if (!res.ok) throw new Error(`Delphi backend error (${res.status})`);
    const json = await res.json();
    return json.message?.content?.trim() ?? '';
  }

  // Production: same-origin proxy → OpenRouter.
  const res = await fetch(`${API_BASE}/api/delphi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`Delphi backend error (${res.status})`);
  const json = await res.json();
  return (json.content ?? '').trim();
}
```

The in-character error handling in `AskDelphiSheet` already covers thrown errors —
no UI change needed. `EXPO_PUBLIC_API_BASE` exists only for a future native build
(set it to the full domain then); for the web app it stays empty (relative).

## §3 — Routing / vercel.json (only if needed — verify on preview FIRST)

The app is a SPA (Expo web `output: "single"`). Vercel should serve `/api/*` as
functions and the static app for everything else. **Deploy the branch as a
preview and test before adding any vercel.json**:
- `POST <preview-url>/api/delphi` returns JSON.
- Client routes still work on refresh (e.g. `/goals`).

If `/api/delphi` 404s or the SPA fallback swallows it, add `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/((?!api/).*)", "destination": "/" }
  ]
}
```
⚠️ Adding `vercel.json` can override dashboard rewrite settings — only add it if
the preview proves it's necessary, and confirm client routing still works after.

## §4 — Env / deployment (Neal does these in Vercel)

- Set `OPENROUTER_API_KEY` in the Vercel `delphi` project (Production + Preview).
- Optionally set `DELPHI_MODEL` (defaults to `deepseek/deepseek-v4-flash`).
- Do NOT set `EXPO_PUBLIC_OLLAMA_URL` in Vercel (so prod uses the proxy).
- Keep `EXPO_PUBLIC_OLLAMA_URL` in local `.env` (local dev keeps the free model).

## Acceptance criteria (Claude reviews; verify on the PREVIEW deploy)

- [ ] Local dev (`expo start`, `.env` has OLLAMA_URL): Delphi still uses the Z420.
- [ ] On the Vercel **preview** (no OLLAMA_URL, key set): asking Delphi returns a
      real in-character reply via OpenRouter — from a browser NOT on the tailnet.
- [ ] No mixed-content/CORS errors (same-origin call).
- [ ] The OpenRouter key never appears in the client bundle / network payloads.
- [ ] Financial summary still flows (ask "how am I doing?" → real numbers).
- [ ] `npx tsc --noEmit` adds no new errors (the function is Node-typed via
      `@vercel/node`; it lives outside the Expo app).

## Out of scope

- Streaming, auth on the proxy (same-origin + Supabase-gated app is enough for
  family v1), rate limiting, native-app API base wiring.
