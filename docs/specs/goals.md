# Build Spec #2: Goals (Phase 2)

> Author: Claude (architect). Builder: Grok. Reviewer: Claude.
> Goal: create, track, and see verdicts on financial goals. The `goals` table
> ALREADY EXISTS in Supabase (original project design) — we build against it, no
> CREATE needed. Active goals also feed Ask Delphi's context.

## IMPORTANT: use the existing schema (do NOT create/alter the table)

The live `goals` table and its enums (confirmed in Supabase):

| column        | type                         | notes |
|---------------|------------------------------|-------|
| id            | uuid (pk)                    | |
| user_id       | uuid not null                | RLS keyed on this (policies already exist) |
| kind          | enum `goal_kind`             | `payoff` \| `accumulate` \| `category_target` |
| account_id    | uuid null                    | the target account (null for net-worth goals) |
| category      | enum (nullable)              | only for `category_target` — we leave it null |
| name          | text not null                | the goal title |
| start_value   | numeric not null             | baseline captured at creation |
| target_value  | numeric not null             | the target |
| target_date   | date null                    | optional deadline |
| status        | enum `goal_status` not null  | `active` \| `achieved` \| `missed` \| `abandoned` |
| achieved_at   | timestamptz null             | set when achieved |
| created_at    | timestamptz not null         | |
| updated_at    | timestamptz not null         | |

RLS is already enabled with `goals: read/insert/update/delete own` policies.

### How our 3 user-facing goal types map onto `kind`
- **Debt payoff** → `kind='payoff'`, `account_id` = a debt account. Counts DOWN
  (lower balance = more progress); `target_value` usually `0`.
- **Savings** → `kind='accumulate'`, `account_id` = a cash/investment account.
- **Net-worth target** → `kind='accumulate'`, `account_id = null`. (Accumulate
  not tied to an account = grow overall net worth.)
- `category_target` is OUT of scope for v1 (belongs to Budgets). Don't build it.

## Architecture decisions (locked unless Neal overrides)

1. **New tab:** `app/(tabs)/goals.tsx`, registered in `app/(tabs)/_layout.tsx`
   (icon `Ionicons "flag-outline"`, title "Goals", placed before "Settings").
2. **Progress/verdict computed client-side** from current data vs `start_value`.
   The stored `status`/`achieved_at` track lifecycle (see §1).
3. **Types:** hand-define `Goal` + enums in `lib/goals.ts` (do NOT edit generated
   `types/database.ts`). `// TODO: switch to generated type after regen` is fine.
4. **Goals feed Ask Delphi** — extend `lib/askDelphi/context.ts` + pass goals
   from `AskDelphiSheet`.

## §1 — `lib/goals.ts`

```ts
export type GoalKind = 'payoff' | 'accumulate' | 'category_target';
export type GoalStatus = 'active' | 'achieved' | 'missed' | 'abandoned';

export interface Goal {
  id: string;
  user_id: string;
  kind: GoalKind;
  account_id: string | null;
  category: string | null;     // unused for v1 (category_target only)
  name: string;
  start_value: number;
  target_value: number;
  target_date: string | null;  // 'YYYY-MM-DD'
  status: GoalStatus;
  achieved_at: string | null;
  created_at: string;
  updated_at: string;
}

export const GOALS_KEY = ['goals'] as const;
```

Hooks (TanStack, mirror `lib/accounts.ts`):
- `useGoals()` — select `status in ('active','achieved')`, newest first. (Hide
  abandoned/missed for now.)
- `useCreateGoal()` — insert with `user_id` from session, `status='active'`;
  caller supplies `kind`, `account_id`, `name`, `start_value`, `target_value`,
  `target_date`. Invalidate `GOALS_KEY`.
- `useUpdateGoal()` — patch name/target_value/target_date (+ `updated_at`).
- `useAbandonGoal()` — soft-delete via `status='abandoned'` (our "delete").
- `useMarkAchieved()` — set `status='achieved'`, `achieved_at=now()`. Used by the
  optional auto-achieve in §2.

**Progress helper (pure, exported):**
```ts
export interface GoalProgress {
  current: number;
  progress: number;   // 0..1 clamped
  pct: number;        // progress*100 for display
  achieved: boolean;
  verdict: 'achieved' | 'on_track' | 'behind' | 'no_deadline';
  remaining: number;  // >= 0
}

export function computeGoalProgress(
  goal: Goal,
  ctx: { accounts?: AccountSummary[] | null; netWorthHistory?: NetWorthPoint[] | null }
): GoalProgress
```

Rules:
- **current**: `payoff` or `accumulate` WITH `account_id` → that account's
  `latest_balance ?? 0`. `accumulate` with `account_id == null` → latest
  `net_worth` from history (0 if none).
- `payoff`: `progress = (start_value - current) / (start_value - target_value)`;
  achieved when `current <= target_value`.
- `accumulate`: `progress = (current - start_value) / (target_value - start_value)`;
  achieved when `current >= target_value`.
- Guard divide-by-zero (denominator 0 → progress 1 if achieved else 0). Clamp [0,1].
- **verdict**: `achieved` if achieved; else no `target_date` → `no_deadline`;
  else `elapsed = (today - created_at) / (target_date - created_at)`,
  `on_track` if `progress >= elapsed - 0.05`, else `behind`.
- **remaining**: `Math.max(0, Math.abs(target_value - current))`.

## §2 — UI: `app/(tabs)/goals.tsx`

- Custom header "Goals" + "New goal" button → opens `GoalSheet`.
- List of goal cards (use `useGoals` + `useAccounts` + `useNetWorthHistory`,
  compute `computeGoalProgress` per goal). Each card:
  - `name` + a kind chip ("Debt payoff" / "Savings" / "Net worth" — derive label
    from kind + whether account_id is set).
  - Account name for account-linked goals.
  - **Progress bar** filled to `pct` (readable on dark theme).
  - `current → target_value` with `remaining` ("$12,400 to go").
  - Verdict badge: ✅ Achieved / On track / Behind / (hidden if no_deadline),
    plus the target date if set.
  - Tap → edit sheet; include "Abandon goal" with a confirm.
- Empty state: friendly "Set your first goal" + button.
- **Optional auto-achieve:** if a goal computes `achieved` but stored
  `status === 'active'`, call `useMarkAchieved` once (best-effort). Keep it simple
  and idempotent; skip if it complicates the render.

## §3 — Create/Edit sheet: `components/GoalSheet.tsx`

Mirror `AddAccountSheet.tsx`. Fields:
- **Goal type** selector (3 pills): Debt payoff / Savings / Net worth. This maps
  to `kind` + account requirement:
  - Debt payoff → `kind='payoff'`, account picker filtered to `category==='debt'`.
  - Savings → `kind='accumulate'`, account picker filtered to `cash`+`investment`.
  - Net worth → `kind='accumulate'`, NO account picker (`account_id=null`).
- **Name** text input.
- **Target amount** → `target_value`. Debt payoff defaults to `0` (editable).
- **Target date** (optional) — same input style as `LogBalanceSheet`'s date field.
- On create, **capture `start_value`**: selected account's `latest_balance`
  (payoff/savings) or current net worth (net worth goal), computed in the sheet
  from loaded hooks. `start_value` is NOT NULL — always set it.
- Validation: require name, target_value, and (for payoff/savings) an account.

## §4 — Ask Delphi integration

`lib/askDelphi/context.ts`:
- Extend `FinancialContextInput` with
  `goals?: { goal: Goal; progress: GoalProgress }[]`.
- Add a "Goals" section (omit if empty), one short line each, cap ~5:
  `- Pay off PayPal: $12,400 → $0, 18% there, behind (due 2026-12-31)`

`components/AskDelphiSheet.tsx`:
- `useGoals()`, compute progress per goal with the accounts + netWorthHistory
  already loaded, pass into `buildFinancialContext`.

## Acceptance criteria (Claude reviews against these)

- [ ] Goals tab lists goals; empty state when none.
- [ ] Can create all 3 types; `kind`/`account_id` set correctly; `start_value`
      captured; `status='active'`.
- [ ] Net-worth goal is `accumulate` with `account_id=null` and tracks net worth.
- [ ] `payoff` progress counts DOWN correctly (rises as balance falls).
- [ ] Progress bar + verdict reflect real current balances / net worth.
- [ ] Edit + abandon (with confirm) work and refresh the list.
- [ ] Ask Delphi references an active goal when asked ("how are my goals?").
- [ ] Only summarized goal lines sent to Delphi (no raw rows).
- [ ] No new `tsc` errors in changed/added files; no unused imports.

## Out of scope

- `category_target` goals (Budgets item). Net-worth uses `accumulate`, not a new kind.
- Goal markers on charts (Events, spec #3). Notifications/reminders for goals.
