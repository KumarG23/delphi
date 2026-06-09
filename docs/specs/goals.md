# Build Spec #2: Goals (Phase 2)

> Author: Claude (architect). Builder: Grok. Reviewer: Claude.
> Goal: create, track, and see verdicts on financial goals. Three types:
> **debt payoff**, **savings/accumulate**, **net-worth target**. New `goals`
> table. Active goals also feed Ask Delphi's context so she can coach toward them.

## Architecture decisions (locked unless Neal overrides)

1. **New tab:** `app/(tabs)/goals.tsx`, registered in `app/(tabs)/_layout.tsx`
   as a 5th tab (icon: `Ionicons "flag-outline"`, title "Goals"). Place it
   between "Spending" and "Settings".
2. **Progress is computed client-side** from current data (account
   `latest_balance` / net-worth history) vs a stored baseline. The table stores
   only the goal definition + the baseline captured at creation — never derived
   progress.
3. **Types:** define a hand-written `Goal` interface in `lib/goals.ts` (do NOT
   edit the generated `types/database.ts`; Neal regenerates that separately). A
   `// TODO: switch to generated Database['public']['Tables']['goals'] type`
   comment is fine.
4. **Goals feed Ask Delphi** — extend `lib/askDelphi/context.ts` to include a
   compact "Goals" section, and pass goals from `AskDelphiSheet`.

## §0 — Database (Neal runs this in the Supabase SQL editor — NOT Grok)

```sql
create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null check (type in ('debt_payoff','savings','net_worth')),
  title         text not null,
  account_id    uuid references public.accounts(id) on delete cascade, -- null for net_worth
  start_amount  numeric,            -- baseline captured at creation (for progress %)
  target_amount numeric not null,
  target_date   date,               -- optional deadline
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);
create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = user_id);
create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id);
create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = user_id);
```

(This mirrors the existing `accounts` / `balance_snapshots` user_id + RLS pattern.)

## §1 — `lib/goals.ts`

```ts
export type GoalType = 'debt_payoff' | 'savings' | 'net_worth';

export interface Goal {
  id: string;
  user_id: string;
  type: GoalType;
  title: string;
  account_id: string | null;
  start_amount: number | null;
  target_amount: number;
  target_date: string | null;   // 'YYYY-MM-DD'
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const GOALS_KEY = ['goals'] as const;
```

Hooks (TanStack), mirroring `lib/accounts.ts` style:
- `useGoals()` — select active goals, newest first.
- `useCreateGoal()` — insert; sets `user_id` from session; invalidates `GOALS_KEY`.
- `useUpdateGoal()` — update title/target/date; invalidates `GOALS_KEY`.
- `useDeleteGoal()` — hard delete (or set `is_active=false` — pick delete for
  simplicity); invalidates `GOALS_KEY`.

**Progress helper (pure, exported):**
```ts
export interface GoalProgress {
  current: number;            // current value (balance or net worth)
  progress: number;           // 0..1, clamped
  pct: number;                // progress * 100, for display
  achieved: boolean;
  status: 'achieved' | 'on_track' | 'behind' | 'no_deadline';
  remaining: number;          // amount still to go (>= 0)
}

export function computeGoalProgress(
  goal: Goal,
  ctx: { accounts?: AccountSummary[] | null; netWorthHistory?: NetWorthPoint[] | null }
): GoalProgress
```

Rules:
- **current**: debt_payoff/savings → matching account's `latest_balance ?? 0`;
  net_worth → latest `net_worth` from history (0 if none).
- **start** = `goal.start_amount ?? current` (fallback if baseline missing).
- debt_payoff: `progress = (start - current) / (start - target)`; achieved when
  `current <= target`. (Paying DOWN, so lower is better.)
- savings / net_worth: `progress = (current - start) / (target - start)`;
  achieved when `current >= target`.
- Guard divide-by-zero (denominator 0 → progress 1 if achieved else 0). Clamp
  progress to [0,1].
- **status**: `achieved` if achieved; else if no `target_date` → `no_deadline`;
  else compare actual progress to time-elapsed fraction
  `elapsed = (today - created) / (target_date - created)` →
  `on_track` if `progress >= elapsed - 0.05`, else `behind`.
- **remaining**: `Math.max(0, |target - current|)`.

## §2 — UI: `app/(tabs)/goals.tsx`

- Header (custom, like other tabs) "Goals" + a "+" / "New goal" button opening
  the create sheet.
- List of `GoalCard`s. Each card:
  - Title + a type chip (Debt payoff / Savings / Net worth).
  - For account-linked goals, the account name.
  - **Progress bar** (filled to `pct`, colored: debt=danger track→primary fill is
    fine, or use category color; keep it readable on dark theme).
  - `current` → `target` line, e.g. "$12,400 → $0" with `remaining` ("$12,400 to go").
  - Status badge: ✅ Achieved / On track / Behind / (none if no deadline), plus
    target date if set.
  - Tap a card → edit sheet (title/target/date); include a delete with confirm.
- Empty state: friendly "Set your first goal" prompt + button.

## §3 — Create/Edit sheet: `components/GoalSheet.tsx`

Mirror `AddAccountSheet.tsx` structure/theming. Fields:
- **Type** selector (3 pills): Debt payoff / Savings / Net worth.
- **Title** text input.
- **Account** picker — shown only for debt_payoff (filter `useAccounts` to
  `category === 'debt'`) and savings (filter to `cash` + `investment`). Hidden
  for net_worth.
- **Target amount** — numeric. For debt_payoff default `0` (pay it off); editable.
- **Target date** — optional (a simple date input/picker consistent with how
  `LogBalanceSheet` handles `snapshot_date`).
- On create, **capture the baseline**: `start_amount` =
  the selected account's `latest_balance` (debt/savings) or current net worth
  (net_worth) at creation time. Compute it in the sheet from the loaded hooks and
  pass into `useCreateGoal`.
- Validation: require title, target_amount, and (for account types) an account.

## §4 — Ask Delphi integration

In `lib/askDelphi/context.ts`:
- Extend `FinancialContextInput` with `goals?: { goal: Goal; progress: GoalProgress }[]`.
- Add a "Goals" section to the output (omit if empty), e.g.:
  `- Pay off PayPal: $12,400 → $0, 18% there, behind (due 2026-12-31)`
  Keep it to one short line per goal, cap at ~5 goals.

In `components/AskDelphiSheet.tsx`:
- `useGoals()`, compute `computeGoalProgress` per goal with the accounts +
  netWorthHistory already loaded, pass the array into `buildFinancialContext`.

## Acceptance criteria (Claude reviews against these)

- [ ] Goals tab appears and lists goals; empty state shows when none.
- [ ] Can create each of the 3 goal types; baseline `start_amount` is captured.
- [ ] Progress bar + status reflect real current balances / net worth.
- [ ] Debt payoff counts DOWN correctly (progress rises as balance falls).
- [ ] Edit + delete (with confirm) work and refresh the list.
- [ ] Ask Delphi references an active goal when asked (e.g. "how are my goals?").
- [ ] Only summarized goal lines are sent to Delphi (no raw rows).
- [ ] `npx tsc --noEmit` adds no new errors in changed/added files.
- [ ] Watch for unused imports (recurring nit) — none in the new files.

## Out of scope

- Category spending caps (that's the separate "Budgets" item).
- Goal annotations on charts (that's Events, spec #3).
- Notifications/reminders for goals.
```
