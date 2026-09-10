# Delphi

**Personal finance, made easier to understand.**

Delphi is an early-stage personal finance app I’m building to make the full money picture—cash, debt, investments, spending, and progress—easy to see in one place.

The name comes from my cat, Delphi, who is considerably less interested in budgeting than I am.

## What Delphi is trying to solve

Most finance apps are very good at showing transactions and balances, but I wanted something focused on a simpler question:

> **Is my financial position actually improving over time, and what should I pay attention to next?**

The Phase 1 product is centered around a monthly financial check-in. Users can record account balances and transactions, then immediately see net worth/debt trends, monthly cash flow, spending categories, and which high-interest debt deserves attention first.

## Current status

**Active early-stage project.** The architecture and core product scope are defined and implementation is underway. This is a personal/family project rather than a commercial product.

## Core product goals

- Track cash, debt, and investment accounts in one place
- Record historical balance snapshots and visualize progress over time
- Track income and expenses with category-based spending analysis
- Highlight higher-APR debt to support payoff decisions
- Import transaction data from CSV
- Provide monthly/weekly reminders for financial check-ins
- Keep each user’s data isolated at the database level
- Support mobile and web from one codebase

Future phases are designed to add goals, richer financial analysis, account detail views, AI-assisted insights, and potentially Plaid-based account syncing.

## Tech stack

- **TypeScript**
- **React Native + Expo** — mobile and web
- **Expo Router** — file-based routing
- **Supabase** — PostgreSQL, authentication, and row-level security
- **TanStack Query** — server-state management
- **Zustand** — client-state management
- **React Native / SVG charting** — financial visualizations
- **Expo Notifications** — scheduled check-in reminders
- **Node test runner + TypeScript checks + ESLint** — verification workflow

## Architecture highlights

### Data isolation

The application is designed around Supabase Row Level Security so financial data is scoped to the authenticated user in PostgreSQL rather than relying only on frontend filtering.

### Historical financial state

Balances are stored as snapshots instead of simply overwriting the latest number. That makes it possible to build meaningful net-worth, debt, and account-history charts over time.

### Transactions and balances are separate concepts

Transactions power cash-flow and spending analysis, while balance snapshots represent the authoritative point-in-time value of an account. Delphi can use transaction activity to suggest updated balances without silently changing them.

### Cross-platform product

Expo allows the same TypeScript/React codebase to support Android, iOS, and web while still providing native capabilities such as notifications and document picking.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npx expo-doctor

# combined gate
npm run check
```

## Development approach

Delphi is built with an AI-assisted engineering workflow. I own the product direction, requirements, financial logic, architecture decisions, validation criteria, and final review while tools such as Claude and Codex accelerate implementation, testing, debugging, and documentation.

That workflow is intentional: AI provides implementation leverage, while deterministic tests and human review remain the gate for accepting changes.

## Why I’m building it

I’ve always been interested in both technology and finance, including several years of hands-on market trading and analysis. Delphi is a way to combine those interests into a product I would actually use myself and with family.

The goal is not to build another complicated budgeting system. It’s to make financial progress visible enough that someone can quickly understand where they stand and whether the decisions they’re making are working.

## Repository notes

- This repository contains application code and development/test configuration only.
- Real financial records and credentials should never be committed.
- Local environment values belong in ignored environment files.
- The detailed Phase 1 product definition lives in [`docs/scope.md`](docs/scope.md).
