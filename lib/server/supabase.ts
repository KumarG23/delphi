import type { VercelRequest } from '@vercel/node';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

export async function requireUser(req: VercelRequest): Promise<AuthenticatedUser> {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }

  const response = await fetch(`${required(supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL')}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: required(supabaseAnonKey, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
    },
  });

  if (!response.ok) throw new Error('UNAUTHORIZED');
  const user = (await response.json()) as AuthenticatedUser;
  if (!user?.id) throw new Error('UNAUTHORIZED');
  return user;
}

export async function supabaseAdmin<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const key = required(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${required(supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase admin request failed (${response.status}): ${detail}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
