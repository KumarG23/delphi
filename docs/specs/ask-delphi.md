# Build Spec: Ask Delphi (Phase 2)

> Author: Claude (architect). Builder: Grok. Reviewer: Claude.
> Goal: turn the existing "Ask Delphi" CTA into a working chat with the
> encouraging-cat money coach, powered by a **local hermes3:8b** model running
> in Ollama on the Z420, reached over Tailscale.

## Architecture decisions (locked unless Neal overrides)

1. **Engine:** Ollama on the Z420, model `delphi-cat-coach` (Neal's existing
   Modelfile — persona already baked in and validated). We call it over
   Tailscale. The persona stays in the Modelfile for now; the app supplies a
   live **financial-context** system message at runtime.
   - *Tradeoff accepted:* persona text isn't in git yet. If we later want it
     versioned / portable to a cloud API, we lift it into `lib/askDelphi/persona.ts`.
2. **Transport:** Ollama native `POST /api/chat` (simple JSON). Base URL from
   `EXPO_PUBLIC_OLLAMA_URL` env var (Tailscale MagicDNS name or 100.x IP).
3. **No streaming for MVP.** Single request/response (`stream: false`). Show a
   typing indicator while awaiting. Streaming is a fast-follow.
4. **No persistence for MVP.** Conversation lives in component state while the
   sheet is open. A future `ai_conversations` / `ai_messages` Supabase table is
   a fast-follow; keep the message shape compatible (see §6).
5. **UI:** new `components/AskDelphiSheet.tsx` mirroring the existing sheet
   pattern (`AddAccountSheet.tsx`). Wire the existing `askDelphiEl` onPress in
   `app/(tabs)/index.tsx` (~line 587) to open it instead of the toast.

## Z420 setup (Neal does this once — NOT Grok)

Ollama only listens on localhost by default and blocks cross-origin browser
calls. The Expo **web** build will fail silently without this. On the Z420:

```bash
# Allow LAN/Tailscale binding + browser origins
sudo systemctl edit ollama
# add under [Service]:
#   Environment="OLLAMA_HOST=0.0.0.0"
#   Environment="OLLAMA_ORIGINS=*"
sudo systemctl restart ollama
```

Then confirm reachable from the Mac over Tailscale:
```bash
curl http://<z420-tailscale-name>:11434/api/tags   # should list delphi-cat-coach
```

Set in the app's `.env` (and EAS secrets later). **Confirmed working** —
`/api/tags` returns `delphi-cat-coach:latest` (hermes3 8B, Q4_0):
```
EXPO_PUBLIC_OLLAMA_URL=http://100.66.106.122:11434
```

## §1 — Client: `lib/askDelphi.ts`

Export a typed client + a TanStack mutation hook.

```ts
export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatMessage { role: ChatRole; content: string; }

const BASE = process.env.EXPO_PUBLIC_OLLAMA_URL;
const MODEL = 'delphi-cat-coach';

// Non-streaming call to Ollama /api/chat. Throws on network/HTTP error.
export async function chat(messages: ChatMessage[]): Promise<string> {
  if (!BASE) throw new Error('Delphi is not configured (no model URL).');
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, stream: false }),
  });
  if (!res.ok) throw new Error(`Delphi backend error (${res.status})`);
  const json = await res.json();
  return json.message?.content?.trim() ?? '';
}

// useAskDelphi(): useMutation wrapper around chat(), no query invalidation.
```

Error copy must stay in character but be honest, e.g. on failure surface:
"Meow — I can't reach my brain right now. Is the Z420 awake and on Tailscale?"

## §2 — Financial context: `lib/askDelphi/context.ts`

Build a compact, token-light text block from existing hooks. Do NOT dump raw
rows — summarize. Pull from `useAccounts`, `useNetWorthHistory`,
`useCurrentCashflow(currentMonth)`.

```
buildFinancialContext({ accounts, netWorthHistory, cashflow }): string
```

Include, as short labeled lines (omit any that are null/empty):
- Net worth (latest) and 30-day change (delta + %), from net-worth history.
- Totals by bucket: debt, cash, investments.
- Account count per bucket; name + balance of the largest debt and its APR if set.
- This month's cashflow (income, expense, net) if available.
- Today's date.

Keep it under ~150 tokens. Currency formatted whole-dollar. This string becomes
a `system` message appended after the persona (the persona is in the Modelfile,
so we send context as an extra system message, then the conversation turns).

## §3 — Message assembly

On each send, the `messages` array sent to `chat()` is:
1. `{ role: 'system', content: <financial context string> }` (rebuilt fresh each send so it reflects current data)
2. ...prior conversation turns (user/assistant), capped to last 10 turns
3. the new `{ role: 'user', content }`

The persona itself comes from the Modelfile — do **not** re-send persona text.

## §4 — UI: `components/AskDelphiSheet.tsx`

- Mirror `AddAccountSheet.tsx` structure (modal/sheet, header with close, themed
  via `constants/tokens`).
- A scrollable message list: user bubbles right-aligned, Delphi bubbles
  left-aligned with the `DelphiAvatar`. Render assistant text as plain text
  (no markdown lib needed for MVP).
- Input row pinned to bottom: `TextInput` + send button (disabled while pending
  or empty). Submit on send.
- Typing indicator (animated "Delphi is thinking…" or three dots) while the
  mutation is pending.
- Seed the conversation with one assistant greeting bubble on open, e.g.
  "Hi, I'm Delphi! 🐾 Ask me anything about your money." (local only, not sent
  to the model).
- Keyboard handling: wrap in `KeyboardAvoidingView` like the other sheets.

## §5 — Wire-up in `app/(tabs)/index.tsx`

- Add `const [askOpen, setAskOpen] = useState(false);`
- Change `askDelphiEl` onPress from the `infoDialog('Coming soon', …)` to
  `setAskOpen(true)`. Update the subtitle text from "Coming in Phase 2" to
  something live, e.g. "Your money coach".
- Render `<AskDelphiSheet open={askOpen} onClose={() => setAskOpen(false)} />`
  alongside the other sheets at the bottom of the screen.

## §6 — Future-compat note (do NOT build now)

When we add persistence: table `ai_conversations (id, user_id, created_at,
title)` and `ai_messages (id, conversation_id, role, content, created_at)` with
RLS keyed on `user_id`. The in-memory `ChatMessage` shape above maps 1:1 to
`ai_messages`. Keep that shape stable.

## Acceptance criteria (Claude reviews against these)

- [ ] Opening the CTA shows the chat sheet, not the toast.
- [ ] Sending a message returns an in-character reply from `delphi-cat-coach`.
- [ ] The reply demonstrably uses the user's real numbers (ask "how am I doing?"
      → it references actual net worth / debt totals).
- [ ] Network/down-model failures show the in-character error, never a raw crash.
- [ ] No secrets or full account rows are sent — only the summarized context.
- [ ] `npx tsc --noEmit` shows no NEW errors in the added files.
- [ ] Works on web (CORS configured) and on the phone over Tailscale.

## Out of scope for this task

Streaming, Supabase persistence, conversation list/history UI, markdown
rendering, voice. All fast-follows.
