import { useMutation } from '@tanstack/react-query';

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
export function useAskDelphi() {
  return useMutation({
    mutationFn: (messages: ChatMessage[]) => chat(messages),
  });
}
