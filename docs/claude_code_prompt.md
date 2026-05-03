# Delphi · Claude Code Kickoff Prompt

> **How to use this:** Save this file alongside `delphi_schema.sql`, `tokens.ts`, and `scope.md`. Open Claude Code in your project folder, paste the contents of this file as your first message, and attach (or reference the paths to) the other three files when prompted.

---

## Project: Delphi

You are helping me build **Delphi**, a personal finance app I'll use to track my money and share with family. I've already:

- Designed the visual style (a Robinhood-inspired dashboard prototype)
- Locked the data schema (running in Supabase)
- Locked the design tokens (single source of truth for the visual system)
- Scoped Phase 1 (MVP) explicitly

The four files you should read first, in this order:

1. **`scope.md`** — what we're building, what's deferred, definition of done
2. **`delphi_schema.sql`** — the Supabase database (already deployed; don't run this, just reference it for table shapes and view names)
3. **`tokens.ts`** — colors, spacing, typography, motion, component sizes — every UI value pulls from this
4. **This file** — operating instructions

## Stack (locked, do not propose alternatives)

- **Expo SDK (latest stable)** with React Native + React Native Web
- **Expo Router** for file-based routing
- **Supabase** for backend (auth, database, RLS)
- **TypeScript** end-to-end
- **TanStack Query** for server state, **Zustand** for client state
- **Victory Native XL** for charts (works on both web and native)
- **Expo Notifications** for the monthly reminder
- **expo-document-picker** + **papaparse** for CSV import

## Project conventions

- **No hardcoded values.** Every color, spacing number, radius, font size, shadow — pulls from `tokens.ts`. If a value isn't in tokens and you need it, add it to tokens first.
- **Schema is the source of truth.** Generate TypeScript types from the Supabase schema (`supabase gen types typescript`). Don't hand-write database types.
- **Use the views.** Dashboard data comes from `v_account_summary`, `v_net_worth_history`, `v_monthly_spending_by_category`, `v_monthly_cashflow`, `v_account_computed_balance` — not from joins in app code.
- **RLS handles auth.** Don't filter by `user_id` in app queries; the database does it. Querying `select * from accounts` returns only the current user's accounts automatically.
- **Soft delete only.** Never `DELETE` from `accounts`, `balance_snapshots`, `categories`, `transactions`. Set `is_active = false`.
- **All amounts positive.** Transaction direction comes from the `kind` column, not signed amounts. Balance changes for debt vs cash flip sign in app logic, but the underlying numbers are always positive.
- **Mobile-first layout, responsive up.** Use the `dashboardMaxWidth` token (420) as the primary content column; expand gracefully on tablet/desktop.
- **Dark mode is default**, but light mode must be fully supported via the theme function in tokens.

## Code style

- Functional components with hooks; no class components
- Named exports for components, default export only for screens (Expo Router convention)
- Co-locate component-specific styles inline using the tokens
- Avoid premature abstraction — write inline first, extract once a pattern repeats 3+ times
- Comments explain *why*, not *what*

## Environment setup

I need you to walk me through this when we start:

1. Install Node.js, Expo CLI, EAS CLI if missing
2. `npx create-expo-app delphi --template tabs` (or whatever current best practice is)
3. Add Supabase env vars (`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
4. Install all stack dependencies in one shot
5. Set up the supabase client at `lib/supabase.ts`
6. Generate types from the schema
7. Drop `tokens.ts` into `constants/`
8. Drop `scope.md` and `delphi_schema.sql` into `docs/`

## How we'll work

- **One feature at a time, end to end.** Don't scaffold every screen at once — build sign-in fully (UI + auth wiring + error states + dark mode), then move to accounts, then snapshots, then transactions, then dashboard, then spending dashboard.
- **Show me the result.** After each meaningful chunk, run the dev server and show me the output (screenshot or "open this URL"). Don't write 500 lines without me seeing them rendered.
- **Ask before installing new packages.** If something requires a dependency not on the stack list above, propose it and explain why before adding.
- **Match the prototype.** I'll send you the dashboard prototype JSX as a reference for visual fidelity. Match it pixel-close where reasonable; deviations require a quick "I'd suggest X instead because Y" pitch first.
- **Generate test data when useful.** A seed script that inserts a fake user + 5 accounts + 60 days of snapshots + 100 transactions makes development much faster. Build it early.

## Specific things to get right

- **Notifications scheduling.** When a user changes `reminder_cadence` / `reminder_day_of_month` / `reminder_hour_local` / `timezone`, cancel any pending Expo notification and schedule a new one. The schedule must respect the user's timezone, not the device's.
- **CSV import resilience.** When parsing, validate dates, amounts, and category names. On a category miss, prompt: "Create new category 'X' or pick existing?" Don't silently drop rows.
- **The smart balance nudge.** After a transaction with an `account_id` is created, query `v_account_computed_balance` for that account and show a banner: "Based on this transaction, [Account] should be ~$X. Update?" Tap → insert new snapshot at today's date with that balance. User can dismiss without updating.
- **Chart hover values feeding the hero.** On the dashboard, the chart's `onMouseMove` (web) and pan gesture (native) update a state value that the hero number reads from. This is the Robinhood pattern — the big number changes as you scrub the chart. When the user lifts off, hero returns to the latest value.

## Your first task

Once you've read all four files, do exactly this:

1. **Confirm understanding.** Summarize back to me, in your own words: the app's purpose, the stack, the four most important things in the schema, and what Phase 1 includes.
2. **Walk me through environment setup.** Step-by-step commands I'll run on my machine. Pause after each step.
3. **Set up the Supabase client** at `lib/supabase.ts`, with proper env var handling.
4. **Generate TypeScript types** from the schema.
5. **Drop in `tokens.ts`** at `constants/tokens.ts`.
6. **Build a "hello world" screen** that confirms the Supabase connection works — query `select count(*) from categories` for the current session and display the result. (Will return 0 until I sign up.)

Then stop and we'll go from there. Build sign-in next.

---

## A note on me

I'm not a professional developer. I can read code, follow instructions, and run commands, but I'll need you to explain non-obvious things as you go. When you make architectural choices, tell me *why* in plain English so I learn. Treat this like pair programming with someone enthusiastic but junior.

Let's build it.
