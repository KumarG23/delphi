create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null unique,
  access_token text not null,
  institution_id text,
  institution_name text,
  status text not null default 'active' check (status in ('active','error','disconnected')),
  transactions_cursor text,
  last_synced_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

alter table public.plaid_items enable row level security;

create index if not exists idx_plaid_items_user_status
  on public.plaid_items (user_id, status);

create table if not exists public.plaid_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plaid_item_id uuid not null references public.plaid_items(id) on delete cascade,
  plaid_account_id text not null,
  delphi_account_id uuid references public.accounts(id) on delete set null,
  name text not null,
  official_name text,
  mask text,
  type text not null,
  subtype text,
  iso_currency_code text,
  current_balance numeric(14,2),
  available_balance numeric(14,2),
  last_balance_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plaid_account_id)
);

alter table public.plaid_accounts enable row level security;

create index if not exists idx_plaid_accounts_user_item
  on public.plaid_accounts (user_id, plaid_item_id);
create index if not exists idx_plaid_accounts_delphi_account
  on public.plaid_accounts (delphi_account_id)
  where delphi_account_id is not null;

create trigger set_plaid_items_updated_at
before update on public.plaid_items
for each row execute function public.set_updated_at();

create trigger set_plaid_accounts_updated_at
before update on public.plaid_accounts
for each row execute function public.set_updated_at();

comment on table public.plaid_items is
  'Server-only Plaid Item metadata and access tokens. No client RLS policies are intentionally defined.';
comment on table public.plaid_accounts is
  'Server-managed Plaid account metadata mapped to Delphi accounts. No client RLS policies are intentionally defined.';
