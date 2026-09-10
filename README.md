# Delphi 🐈💰

**An AI-powered personal financial companion that understands your actual financial picture.**

Delphi brings cash, debt, investments, spending, goals, and financial history into one place — then lets you **talk to that data** through a conversational financial advisor with a slightly judgmental cat personality.

Ask questions like:

> **“How am I doing compared with last month?”**  
> **“What debt should I focus on?”**  
> **“Where is my money going?”**  
> **“Am I on track for my goal?”**

Delphi answers using structured financial context calculated from the user’s own data rather than treating the language model as the source of truth for balances and financial metrics.

And yes, Delphi occasionally says things like **“right meow.”**

The app is named after my cat, Delphi — the project’s extremely qualified Chief Financial Officer.

## Why I’m building it

I wanted a finance app that did more than show me a collection of balances and charts.

The question I actually care about is:

> **Is my financial position improving, what changed, and what should I pay attention to next?**

Delphi is designed around that idea. The underlying app tracks the numbers; the Delphi advisor helps turn those numbers into something useful and understandable.

This is currently a personal-use, early-stage project rather than a commercial financial product.

## Ask Delphi

The conversational advisor is the feature at the center of the project.

Before a question is sent to the model, Delphi builds a structured financial snapshot from application data. Today that context can include:

- Current net worth
- 30-day net-worth change
- Total cash, investments, and debt
- Largest debt and available APR information
- Monthly income, expenses, and net cash flow
- Financial goals and progress

The model receives those calculated facts along with Delphi’s persona and the recent conversation.

This separation is intentional:

```text
Financial data
      ↓
Deterministic calculations
      ↓
Structured financial context
      ↓
Delphi / LLM reasoning
      ↓
Conversational explanation
```

The language model is used for reasoning, explanation, and conversation — not as the accounting engine.

## What the app does today

- Tracks cash, debt, and investment accounts
- Stores historical balance snapshots for net-worth and account trends
- Tracks income and expenses by category
- Shows monthly cash flow and spending analysis
- Tracks financial goals and progress
- Supports statement/transaction imports with duplicate protection
- Highlights debt information such as balances and APRs
- Provides scheduled financial check-in reminders
- Supports Android, iOS, and web from one codebase
- Isolates each user’s financial data with PostgreSQL Row Level Security
- Provides the **Ask Delphi** conversational financial-advisor experience

## Where it’s going next

### Automatic financial data with Plaid

Manual balance entry and statement imports work, but they create too much friction for something meant to be used regularly.

Plaid integration is the next major product direction. Delphi’s data model already anticipates Plaid as a transaction source.

The planned ingestion model is:

```text
Plaid sync       → preferred automatic source
Statement import → fallback
Manual entry     → universal fallback
```

The goal is for opening Delphi to become less about **entering financial data** and more about **reviewing what changed and talking to Delphi about it**.

Planned Plaid work includes account linking, balance/transaction synchronization, institution mapping, incremental sync, webhooks, duplicate protection, data freshness, and reconciliation.

### A smarter Delphi

As the data layer becomes more automatic, the advisor can gain richer deterministic context such as:

- Highest-APR debt and payoff priorities
- Month-over-month category changes
- Spending compared with recent averages
- Debt reduction over time
- Savings rate and cash-flow trends
- Recurring charges and subscriptions
- Unusual spending
- Upcoming obligations
- Account-data freshness

Longer term, Delphi should be able to turn conversations into useful actions — for example creating a goal, exploring a payoff scenario, or displaying a requested spending trend.

## Tech stack

- **TypeScript**
- **React Native + Expo** — Android, iOS, and web
- **Expo Router** — file-based routing
- **Supabase** — PostgreSQL, authentication, and Row Level Security
- **TanStack Query** — server-state management
- **Zustand** — client-state management
- **React Native / SVG charting** — financial visualizations
- **Expo Notifications** — scheduled check-in reminders
- **LLM integration** — conversational Delphi advisor
- **GitHub Actions** — automated CI
- **Node test runner + TypeScript + ESLint + Expo Doctor** — verification

## Architecture highlights

### Financial data isolation

Supabase Row Level Security scopes financial records to the authenticated user at the PostgreSQL layer rather than relying only on frontend filtering.

### Historical state instead of overwritten balances

Balances are stored as snapshots. This preserves history and allows Delphi to show how net worth, debt, cash, investments, and individual accounts change over time.

### Transactions and balances remain separate

Transactions drive spending and cash-flow analysis, while balance snapshots represent confirmed point-in-time account values. This lets Delphi reason about activity without silently treating transaction arithmetic as an authoritative institution balance.

### Deterministic finance before AI

Important financial values are calculated by application/database logic before being supplied to the advisor. This keeps the conversational layer focused on interpretation instead of asking an LLM to invent or independently calculate the user’s financial state.

### Cross-platform product

Expo allows one TypeScript/React codebase to support Android, iOS, and web while still using native capabilities such as notifications and document picking.

## Data model

The Supabase/PostgreSQL model currently includes concepts for:

- Accounts
- Balance snapshots
- Transactions
- Categories
- Budgets
- Goals
- Events/annotations
- Monthly spending
- Monthly cash flow
- Net-worth history
- Computed balances

Supabase-generated TypeScript definitions are kept in the repository so application code can stay aligned with the live database schema.

## Verification and CI

Pull requests and changes to the main branch are automatically checked with GitHub Actions.

```bash
npm test
npm run typecheck
npm run lint
npx expo-doctor

# combined local gate
npm run check
```

Database types can be regenerated from Supabase with:

```bash
npm run db:types
```

## Development approach

Delphi is built with an AI-assisted engineering workflow. I own the product direction, requirements, financial logic, architecture decisions, validation criteria, and final review while tools such as Claude and Codex accelerate implementation, testing, debugging, and documentation.

That workflow is intentional: AI provides implementation leverage, while deterministic tests, CI, and human review remain the gate for accepting changes.

## Project philosophy

I’ve always been interested in both technology and finance, including several years of hands-on market trading and analysis. Delphi combines those interests into a product built around a problem I actually have in my own life.

The goal is not to build another complicated budgeting system.

It’s to build a financial companion that can answer:

> **Where am I? What changed? What matters next?**

Preferably with the occasional cat pun.

## Repository notes

- Real financial records and credentials should never be committed.
- Local environment values belong in ignored environment files.
- Sensitive provider tokens belong server-side rather than in the mobile client.
- The detailed original product definition lives in [`docs/scope.md`](docs/scope.md).
