# Delphi · Phase 1 Scope

> **The vision in one sentence:** A personal finance app that turns your full money picture — debt, cash, investments, and where your spending goes — into clear visual data so you can see what's happening, make changes, and see if those changes are working.

---

## The MVP magic moment

You sit down on the 1st of the month, get a notification from Delphi, open the app, log your account balances and the month's transactions in under five minutes, and immediately see:

- Your **net position** (or total debt) trending over time
- Your **cash flow** for the month — money in vs. money out
- A **breakdown of where your money went** — which categories are eating it, which months were tighter
- Your **highest-APR debt** flagged so you know what to tackle first

If a family member opens *their* phone and signs in, they see *their own* money picture — fully isolated, by database guarantee.

That's MVP. Everything else is layer-on.

---

## The stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Expo (React Native + Web)** | One codebase, mobile + desktop |
| Routing | **Expo Router** | File-based, works on both platforms |
| Backend | **Supabase** | Postgres + Auth + RLS in one |
| Database | **Postgres 15** (via Supabase) | Schema already defined |
| Auth | **Supabase Auth** (email/password for MVP) | Free, well-supported |
| Charts | **Victory Native XL** | Cross-platform, themeable |
| Notifications | **Expo Notifications** | Native push on iOS/Android |
| State | **TanStack Query + Zustand** | Server state + client state, no Redux ceremony |
| Styling | **Inline + tokens.ts** | Matches the dashboard prototype patterns |
| Type safety | **TypeScript** end to end | Generate types from Supabase schema |

---

## Phase 1 (MVP) — what gets built

### Onboarding & auth

- Email + password sign-up (Supabase Auth)
- Email + password sign-in
- Sign-out from settings
- Auto-creation of profile + default categories on sign-up *(already wired via DB trigger)*

### Accounts

- **Add account flow** — three-step bottom sheet (bucket → type → details), matches the prototype
- **Edit account** — change name, nickname, color
- **Archive account** — soft-delete (sets `is_active = false`)
- **List accounts** — grouped by category (Debt / Cash / Investment) with latest balance and freshness indicator

### Balance snapshots

- **Log balance** — pick an account, enter balance, optional APR/APY/min payment/due date, optional notes
- **Edit/delete** snapshot (soft delete)
- **Bulk log** flow for the monthly check-in — walks through every active account in sequence
- One snapshot per account per date (DB constraint already enforces this)

### Transactions

- **Quick-add transaction** — date, amount, kind (expense/income), merchant, category, optional account, optional notes
- **Transaction list** — filter by month, category, account, kind
- **Edit/delete** transaction (soft delete)
- **CSV import** — file picker, parse, preview, confirm, bulk insert. Format documented in schema. Match category and account by name; prompt user on misses.
- **Smart balance update nudge** — when a transaction is linked to an account, after entering, app reads `v_account_computed_balance` and offers "Update Chase Checking to $X?" with one-tap accept that creates a fresh snapshot

### Dashboard

- Hero number with **Wealth / Debt** mode toggle, animated transitions
- **Net worth area chart** with hover tooltips showing point-in-time values, time range pills (1W, 1M, 3M, 6M, 1Y, ALL)
- **Bucket totals strip** (Debt / Cash / Investment) — tap to switch the account list below
- **Account list** — color-coded rows with name, sub-line (APR/APY/YTD), balance, contextual subtext; flame icon on the highest-APR debt
- **"Ask Delphi" CTA placeholder** — visible but tapping shows "Coming soon" toast (Phase 2)
- **Reminder banner** — shows next scheduled check-in

### Spending dashboard *(promoted to Phase 1)*

- **Cash flow hero** — total income, total expense, net for the selected month
- **Spending breakdown** — category donut/bar chart with amounts and percentages
- **Month-over-month comparison** — this month's spend per category vs. last month's, with delta arrows
- **Cash flow trend** — bar chart showing income vs. expense per month over the last 6/12 months
- **Recent transactions list** — chronological, with quick filters (all / expenses / income)
- Tap a category → drills down to that category's transactions for the month

### Notifications

- User can configure: cadence (monthly/biweekly/weekly/off), day-of-month, hour-of-day, timezone
- Default: monthly on the 1st at 9am local time
- Tapping the notification deep-links into the bulk-log flow

### Settings

- Edit display name
- Toggle dark / light mode (manual; default = system)
- Reminder preferences (above)
- Sign out

### Visual & UX

- **Dashboard look locked** — the prototype we built is the spec
- **Tokens-driven** — every color, spacing value, font size pulls from `tokens.ts`
- **Delphi placeholder** — V1 geometric face on the dashboard avatar, "Delphi" wordmark elsewhere
- **Loading states** — skeleton rows while data loads, never blank screens
- **Empty states** — first-time user sees friendly prompts ("Add your first account to get started"), not empty grids
- **Light + dark mode** fully supported
- **Mobile-first**, but layouts respond up to tablet/desktop on web

---

## Phase 2 (next) — what's deferred

Listed here so Claude Code knows the schema needs to remain compatible with these:

- **Ask Delphi** — Anthropic API integration, conversation history table, the modal experience
- **Goals** — UI for creating, tracking, and seeing verdicts on payoff/accumulate/category goals
- **Events / annotations** — adding markers to charts ("Started snowball method")
- **Budgets** — per-category monthly budget targets and tracking
- **Family sharing / households** — multi-user accounts, parent-can-view-child mode
- **Plaid integration** — auto-syncing accounts, transactions, balances
- **Recurring obligations** — rent, subscriptions, auto-tracked
- **Account detail page** — drill into one account's full history with all charts
- **Custom Delphi mascot** — commissioned art replacing the placeholder
- **Loader animations** — the cat-themed scenes (umbrella, swat, coin, treasure stack)

---

## Phase 3+ — way out

- Crypto wallet integration (schema already supports the type)
- Multi-currency support (column already there, conversion table needed)
- Investment performance tracking with cost basis
- Tax document export
- Retirement projection calculator
- Couples / shared household finances

---

## Definition of done for Phase 1

The MVP ships when, on a fresh phone, you can:

1. Install the app
2. Sign up with email
3. Add at least one debt, one cash, one investment account
4. Enter starting balances for all three
5. Log a handful of transactions across categories
6. See the dashboard render correctly with all charts
7. See the spending breakdown render correctly
8. Receive the next monthly reminder
9. Sign out, sign back in, and find your data exactly as you left it

If your sister can do the same on her phone with her own login, and neither of you can see the other's data even briefly, family-safety is proven.

---

## Out-of-scope for MVP (explicitly)

- Pixel art or animated mascot — V1 geometric placeholder only
- Apple/Google sign-in — email/password is enough
- Push notifications beyond the monthly reminder
- In-app help, tooltips, onboarding tour
- Account detail page — covered in Phase 2
- Anything goal-related — covered in Phase 2
- Anything social — sharing screenshots, leaderboards, etc.
- Premium tier / paywall — this is a personal-use tool

---

## Success metric

You and at least one family member use it for two consecutive monthly check-ins without abandoning it. That's enough signal to invest in Phase 2.
