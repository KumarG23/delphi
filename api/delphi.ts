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
