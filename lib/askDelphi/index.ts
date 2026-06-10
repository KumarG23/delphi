import { useMutation } from '@tanstack/react-query';

export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatMessage { role: ChatRole; content: string; }

const OLLAMA_BASE = process.env.EXPO_PUBLIC_OLLAMA_URL;          // local dev only
const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? '';         // '' = same-origin (web)

// Branch the transport; keep everything else identical.
// Local dev: talk to Ollama directly if configured.
// Production: same-origin proxy → OpenRouter.
export async function chat(messages: ChatMessage[]): Promise<string> {
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

// useAskDelphi(): useMutation wrapper around chat(), no query invalidation.
export function useAskDelphi() {
  return useMutation({
    mutationFn: (messages: ChatMessage[]) => chat(messages),
  });
}
