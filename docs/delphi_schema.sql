-- ═══════════════════════════════════════════════════════════════════════════
--  DELPHI · MVP DATABASE SCHEMA  (v2 — adds transactions + categories)
--  Postgres / Supabase
-- ───────────────────────────────────────────────────────────────────────────
--  Design principles:
--    1. Snapshots are the source of truth for balances. Accounts hold metadata.
--    2. Transactions are the source of truth for cash flow. Categories tag them.
--    3. Soft delete everywhere — history is the asset.
--    4. Row-Level Security is the family-safety mechanism. Every table has it.
--    5. Views encapsulate frequently-used math.
--    6. USD-only for MVP, but currency_code columns reserved for later.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  EXTENSIONS
-- ───────────────────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- ───────────────────────────────────────────────────────────────────────────
--  ENUMS
-- ───────────────────────────────────────────────────────────────────────────

create type account_category as enum (
  'debt',
  'cash',
  'investment'
);

create type account_type as enum (
  -- debt
  'credit_card', 'personal_loan', 'mortgage', 'auto_loan', 'student_loan', 'other_debt',
  -- cash
  'checking', 'savings', 'hysa', 'money_market', 'cash_other',
  -- investment
  '401k', 'traditional_ira', 'roth_ira', 'brokerage', 'crypto', 'investment_other'
);

create type goal_kind as enum (
  'payoff',
  'accumulate',
  'category_target'
);

create type goal_status as enum (
  'active', 'achieved', 'missed', 'abandoned'
);

create type reminder_cadence as enum (
  'monthly', 'biweekly', 'weekly', 'off'
);

create type transaction_kind as enum (
  'expense',
  'income',
  'transfer'        -- moving money between own accounts; reserved for later use
);

create type transaction_source as enum (
  'manual',
  'csv_import',
  'plaid'           -- reserved for later
);

create type category_type as enum (
  'expense',
  'income'
);


-- ───────────────────────────────────────────────────────────────────────────
--  PROFILES
--  One row per Supabase auth user. Holds display info and notification prefs.
-- ───────────────────────────────────────────────────────────────────────────

create table profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  display_name          text not null,
  reminder_cadence      reminder_cadence not null default 'monthly',
  reminder_day_of_month smallint check (reminder_day_of_month between 1 and 31),
  reminder_hour_local   smallint not null default 9 check (reminder_hour_local between 0 and 23),
  timezone              text not null default 'UTC',
  default_currency      text not null default 'USD',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table  profiles is 'User-facing profile and notification preferences. One row per auth user.';
comment on column profiles.reminder_day_of_month is 'For monthly cadence — which day of the month to send the check-in reminder. Null falls back to the 1st.';
comment on column profiles.timezone is 'IANA timezone string like "America/New_York". Used to schedule reminders correctly.';


-- ───────────────────────────────────────────────────────────────────────────
--  ACCOUNTS
--  Metadata wrapper for a real-world financial account.
-- ───────────────────────────────────────────────────────────────────────────

create table accounts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  nickname      text,
  category      account_category not null,
  type          account_type not null,
  institution   text,
  currency      text not null default 'USD',
  display_color text,
  is_active     boolean not null default true,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint chk_archived_consistency
    check ((is_active and archived_at is null) or (not is_active and archived_at is not null))
);

create index idx_accounts_user_active on accounts(user_id, is_active);
create index idx_accounts_user_category on accounts(user_id, category) where is_active;


-- ───────────────────────────────────────────────────────────────────────────
--  BALANCE SNAPSHOTS
--  Time-series of every balance reading. Freeform — not constrained to monthly.
-- ───────────────────────────────────────────────────────────────────────────

create table balance_snapshots (
  id                uuid primary key default uuid_generate_v4(),
  account_id        uuid not null references accounts(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  snapshot_date     date not null,
  balance           numeric(14, 2) not null,
  apr               numeric(6, 3),
  apy               numeric(6, 3),
  min_payment       numeric(12, 2),
  payment_due_date  date,
  notes             text,
  entered_at        timestamptz not null default now(),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),

  constraint uq_snapshot_account_date unique (account_id, snapshot_date)
);

create index idx_snapshots_account_date on balance_snapshots(account_id, snapshot_date desc) where is_active;
create index idx_snapshots_user_date on balance_snapshots(user_id, snapshot_date desc) where is_active;


-- ───────────────────────────────────────────────────────────────────────────
--  CATEGORIES
--  Tags for transactions. System defaults seeded on signup; user can add own.
-- ───────────────────────────────────────────────────────────────────────────

create table categories (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  type        category_type not null,
  parent_id   uuid references categories(id) on delete set null,   -- for subcategories later
  icon        text,                                                 -- lucide icon name
  color       text,                                                 -- hex
  is_system   boolean not null default false,                       -- true = seeded default
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint uq_category_user_name_type unique (user_id, name, type)
);

create index idx_categories_user_type on categories(user_id, type) where is_active;

comment on table categories is 'Tags for transactions. System categories seeded on signup; user can rename/delete/add their own.';


-- ───────────────────────────────────────────────────────────────────────────
--  TRANSACTIONS
--  Every expense/income event. Drives the spending dashboard, cash flow chart,
--  and "where is my money going" analysis. Account linkage is OPTIONAL —
--  manual entry shouldn't require remembering which card you used.
-- ───────────────────────────────────────────────────────────────────────────
--
--  CSV import format (recommended):
--    transaction_date , merchant      , amount , kind    , category   , account_name    , notes
--    2026-04-04       , Walmart       , 185.00 , expense , Groceries  , Chase Sapphire  ,
--    2026-04-15       , Acme Payroll  , 2400.00, income  , Salary     , Chase Checking  , Bi-weekly
--
--  Amounts are always positive. The "kind" column tells direction.
--  The importer matches account_name and category by name to the user's
--  existing rows; unmatched names create new rows or prompt the user.
-- ───────────────────────────────────────────────────────────────────────────

create table transactions (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  account_id        uuid references accounts(id) on delete set null,
  category_id       uuid references categories(id) on delete set null,
  transaction_date  date not null,
  amount            numeric(12, 2) not null check (amount >= 0),    -- always positive
  kind              transaction_kind not null,
  merchant          text,                                            -- "Walmart", "Acme Payroll"
  description       text,
  notes             text,
  source            transaction_source not null default 'manual',
  external_id       text,                                            -- for Plaid dedup later
  is_active         boolean not null default true,
  entered_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_tx_user_date            on transactions(user_id, transaction_date desc) where is_active;
create index idx_tx_user_kind_date       on transactions(user_id, kind, transaction_date desc) where is_active;
create index idx_tx_user_category_date   on transactions(user_id, category_id, transaction_date desc) where is_active;
create index idx_tx_account_date         on transactions(account_id, transaction_date desc) where is_active and account_id is not null;

comment on table transactions is 'Every expense/income event. Account linkage optional. amount is always positive; kind tells direction.';
comment on column transactions.amount is 'Always positive. Direction is determined by kind (expense / income / transfer).';


-- ───────────────────────────────────────────────────────────────────────────
--  GOALS
--  Formal targets. Without these, the app shows trends; with these, verdicts.
-- ───────────────────────────────────────────────────────────────────────────

create table goals (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          goal_kind not null,
  account_id    uuid references accounts(id) on delete cascade,
  category      account_category,
  name          text not null,
  start_value   numeric(14, 2) not null,
  target_value  numeric(14, 2) not null,
  target_date   date,
  status        goal_status not null default 'active',
  achieved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint chk_goal_scope
    check (
      (kind in ('payoff','accumulate') and account_id is not null and category is null) or
      (kind = 'category_target' and category is not null and account_id is null)
    )
);

create index idx_goals_user_status on goals(user_id, status);


-- ───────────────────────────────────────────────────────────────────────────
--  EVENTS
--  Timeline annotations. Render as markers on charts.
-- ───────────────────────────────────────────────────────────────────────────

create table events (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_date  date not null,
  label       text not null,
  note        text,
  account_id  uuid references accounts(id) on delete cascade,
  category    account_category,
  created_at  timestamptz not null default now()
);

create index idx_events_user_date on events(user_id, event_date desc);


-- ═══════════════════════════════════════════════════════════════════════════
--  VIEWS
-- ═══════════════════════════════════════════════════════════════════════════

-- Latest active snapshot per account.
create or replace view v_latest_snapshot_per_account as
select distinct on (s.account_id)
  s.account_id, s.user_id, s.snapshot_date, s.balance, s.apr, s.apy,
  s.min_payment, s.payment_due_date, s.entered_at
from balance_snapshots s
where s.is_active
order by s.account_id, s.snapshot_date desc, s.entered_at desc;


-- Net worth history per user.
create or replace view v_net_worth_history as
with all_dates as (
  select distinct user_id, snapshot_date from balance_snapshots where is_active
),
latest_per_account_per_date as (
  select
    ad.user_id, ad.snapshot_date, a.id as account_id, a.category,
    (
      select s.balance from balance_snapshots s
      where s.account_id = a.id and s.is_active and s.snapshot_date <= ad.snapshot_date
      order by s.snapshot_date desc, s.entered_at desc limit 1
    ) as balance
  from all_dates ad
  join accounts a on a.user_id = ad.user_id and a.is_active
)
select
  user_id, snapshot_date,
  coalesce(sum(balance) filter (where category = 'cash'), 0)       as total_cash,
  coalesce(sum(balance) filter (where category = 'investment'), 0) as total_investment,
  coalesce(sum(balance) filter (where category = 'debt'), 0)       as total_debt,
  coalesce(sum(balance) filter (where category in ('cash','investment')), 0)
    - coalesce(sum(balance) filter (where category = 'debt'), 0)   as net_worth
from latest_per_account_per_date
where balance is not null
group by user_id, snapshot_date;


-- Account summary with latest reading.
create or replace view v_account_summary as
select
  a.id, a.user_id, a.name, a.nickname, a.category, a.type, a.institution,
  a.display_color, a.is_active,
  ls.snapshot_date as last_snapshot_date,
  ls.balance       as latest_balance,
  ls.apr, ls.apy, ls.min_payment, ls.payment_due_date,
  case when ls.entered_at is null then null
       else (now()::date - ls.entered_at::date) end as days_since_last_entry
from accounts a
left join v_latest_snapshot_per_account ls on ls.account_id = a.id;


-- ── NEW · Monthly spending breakdown by category ──
-- Powers the "where did my money go this month" pie/bar chart.
create or replace view v_monthly_spending_by_category as
select
  t.user_id,
  date_trunc('month', t.transaction_date)::date as month,
  c.id    as category_id,
  c.name  as category_name,
  c.type  as category_type,
  c.color as category_color,
  c.icon  as category_icon,
  count(*)         as transaction_count,
  sum(t.amount)    as total
from transactions t
left join categories c on c.id = t.category_id
where t.is_active and t.kind in ('expense', 'income')
group by t.user_id, date_trunc('month', t.transaction_date),
         c.id, c.name, c.type, c.color, c.icon;

comment on view v_monthly_spending_by_category is 'Per-month, per-category totals. One row per (user, month, category). Drives the spending breakdown.';


-- ── NEW · Monthly cash flow (income minus expense) ──
-- Powers the "are you net positive this month" hero number on the spending tab.
create or replace view v_monthly_cashflow as
select
  user_id,
  date_trunc('month', transaction_date)::date as month,
  coalesce(sum(amount) filter (where kind = 'income'),  0) as total_income,
  coalesce(sum(amount) filter (where kind = 'expense'), 0) as total_expense,
  coalesce(sum(amount) filter (where kind = 'income'),  0)
    - coalesce(sum(amount) filter (where kind = 'expense'), 0) as net_cashflow
from transactions
where is_active and kind in ('expense', 'income')
group by user_id, date_trunc('month', transaction_date);

comment on view v_monthly_cashflow is 'Income, expense, and net per month per user. Drives the cash flow chart.';


-- ── NEW · Computed balance from snapshots + transactions ──
-- Says: "based on your last reported balance plus transactions since,
-- what should this account read right now?"
-- Powers the one-tap "update balance" nudge in the UI so the user
-- doesn't have to enter the same number twice. Sign handling differs:
--   debt accounts:        expense → balance UP   (you owe more)
--                         income  → balance DOWN (you paid down debt)
--   cash / investment:    expense → balance DOWN (money left)
--                         income  → balance UP   (money in)
create or replace view v_account_computed_balance as
with tx_outflow as (
  select
    t.account_id,
    sum(
      case t.kind
        when 'expense' then  t.amount
        when 'income'  then -t.amount
        else 0
      end
    ) as net_outflow
  from transactions t
  join v_latest_snapshot_per_account ls on ls.account_id = t.account_id
  where t.is_active
    and t.transaction_date > ls.snapshot_date
  group by t.account_id
)
select
  a.id              as account_id,
  a.user_id,
  a.name,
  a.category,
  ls.balance        as last_reported_balance,
  ls.snapshot_date  as last_reported_date,
  coalesce(tx.net_outflow, 0) as net_change_since_last,
  case a.category
    when 'debt' then ls.balance + coalesce(tx.net_outflow, 0)   -- debt grows on expense
    else             ls.balance - coalesce(tx.net_outflow, 0)   -- cash shrinks on expense
  end as computed_balance
from accounts a
left join v_latest_snapshot_per_account ls on ls.account_id = a.id
left join tx_outflow tx on tx.account_id = a.id
where a.is_active;

comment on view v_account_computed_balance is 'Suggests current balance per account based on last snapshot + transactions since. Drives the one-tap update nudge.';


-- ═══════════════════════════════════════════════════════════════════════════
--  TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_profiles_updated_at      before update on profiles      for each row execute function set_updated_at();
create trigger trg_accounts_updated_at      before update on accounts      for each row execute function set_updated_at();
create trigger trg_categories_updated_at    before update on categories    for each row execute function set_updated_at();
create trigger trg_transactions_updated_at  before update on transactions  for each row execute function set_updated_at();
create trigger trg_goals_updated_at         before update on goals         for each row execute function set_updated_at();


-- Default category seeding for new users.
create or replace function seed_default_categories(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (user_id, name, type, icon, color, is_system, sort_order) values
    -- Expense
    (target_user_id, 'Groceries',       'expense', 'shopping-cart',  '#00D964', true, 1),
    (target_user_id, 'Dining',          'expense', 'utensils',       '#FF8FA8', true, 2),
    (target_user_id, 'Rent / Mortgage', 'expense', 'home',           '#ECC97D', true, 3),
    (target_user_id, 'Utilities',       'expense', 'zap',            '#5B8DEF', true, 4),
    (target_user_id, 'Transportation',  'expense', 'car',            '#9C7CFF', true, 5),
    (target_user_id, 'Subscriptions',   'expense', 'repeat',         '#FF8C5A', true, 6),
    (target_user_id, 'Healthcare',      'expense', 'heart-pulse',    '#FF4747', true, 7),
    (target_user_id, 'Entertainment',   'expense', 'film',           '#E8C77E', true, 8),
    (target_user_id, 'Shopping',        'expense', 'shopping-bag',   '#FF99B5', true, 9),
    (target_user_id, 'Travel',          'expense', 'plane',          '#00B5D9', true, 10),
    (target_user_id, 'Personal Care',   'expense', 'sparkles',       '#FFB347', true, 11),
    (target_user_id, 'Gifts',           'expense', 'gift',           '#C77DFF', true, 12),
    (target_user_id, 'Other Expense',   'expense', 'circle-dollar-sign', '#888888', true, 99),
    -- Income
    (target_user_id, 'Salary',          'income',  'briefcase',      '#00D964', true, 1),
    (target_user_id, 'Side Income',     'income',  'plus-circle',    '#ECC97D', true, 2),
    (target_user_id, 'Refund',          'income',  'rotate-ccw',     '#9C7CFF', true, 3),
    (target_user_id, 'Investment Income','income', 'trending-up',    '#00B5D9', true, 4),
    (target_user_id, 'Other Income',    'income',  'circle-dollar-sign', '#888888', true, 99);
end $$;

comment on function seed_default_categories is 'Inserts the starter set of expense/income categories for a new user. Called from handle_new_user().';


-- Auto-create a profile + seed categories when an auth user is created.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  perform public.seed_default_categories(new.id);

  return new;
end $$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- Auto-stamp archived_at when account is soft-deleted.
create or replace function sync_archived_at()
returns trigger language plpgsql as $$
begin
  if new.is_active = false and old.is_active = true then
    new.archived_at := now();
  elsif new.is_active = true and old.is_active = false then
    new.archived_at := null;
  end if;
  return new;
end $$;

create trigger trg_accounts_archived_at
  before update of is_active on accounts
  for each row execute function sync_archived_at();


-- ═══════════════════════════════════════════════════════════════════════════
--  ROW-LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

alter table profiles          enable row level security;
alter table accounts          enable row level security;
alter table balance_snapshots enable row level security;
alter table categories        enable row level security;
alter table transactions      enable row level security;
alter table goals             enable row level security;
alter table events            enable row level security;


-- profiles
create policy "profiles: read own"   on profiles for select using (auth.uid() = id);
create policy "profiles: update own" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- accounts
create policy "accounts: read own"   on accounts for select using (auth.uid() = user_id);
create policy "accounts: insert own" on accounts for insert with check (auth.uid() = user_id);
create policy "accounts: update own" on accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "accounts: delete own" on accounts for delete using (auth.uid() = user_id);

-- balance_snapshots
create policy "snapshots: read own"   on balance_snapshots for select using (auth.uid() = user_id);
create policy "snapshots: insert own" on balance_snapshots for insert with check (auth.uid() = user_id);
create policy "snapshots: update own" on balance_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "snapshots: delete own" on balance_snapshots for delete using (auth.uid() = user_id);

-- categories
create policy "categories: read own"   on categories for select using (auth.uid() = user_id);
create policy "categories: insert own" on categories for insert with check (auth.uid() = user_id);
create policy "categories: update own" on categories for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories: delete own" on categories for delete using (auth.uid() = user_id);

-- transactions
create policy "transactions: read own"   on transactions for select using (auth.uid() = user_id);
create policy "transactions: insert own" on transactions for insert with check (auth.uid() = user_id);
create policy "transactions: update own" on transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions: delete own" on transactions for delete using (auth.uid() = user_id);

-- goals
create policy "goals: read own"   on goals for select using (auth.uid() = user_id);
create policy "goals: insert own" on goals for insert with check (auth.uid() = user_id);
create policy "goals: update own" on goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals: delete own" on goals for delete using (auth.uid() = user_id);

-- events
create policy "events: read own"   on events for select using (auth.uid() = user_id);
create policy "events: insert own" on events for insert with check (auth.uid() = user_id);
create policy "events: update own" on events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "events: delete own" on events for delete using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
--  END OF SCHEMA
--  Run this file in the Supabase SQL editor in order. After it succeeds:
--    1. Sign up a test user — confirm a profiles row + ~17 categories appear.
--    2. Insert an account + a snapshot + a transaction — confirm views compute.
--    3. Sign in as a second user — confirm RLS isolates their data completely.
-- ═══════════════════════════════════════════════════════════════════════════
