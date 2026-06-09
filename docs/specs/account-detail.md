# Build Spec #1: Account Detail Page (Phase 2)

> Author: Claude (architect). Builder: Grok. Reviewer: Claude.
> Goal: tap an account → a full detail screen with its balance history chart,
> stats, and snapshot list. Also extract a reusable `TrendChart` component (the
> dashboard chart) so it can be shared here and annotated later (Events feature).
> No new database tables — uses existing hooks.

## Architecture decisions (locked unless Neal overrides)

1. **Route:** new Expo Router screen `app/account/[id].tsx` (a stack screen,
   pushed over the tabs). Add it to the router so `router.push('/account/<id>')`
   works. Use the existing `app/_layout.tsx` Stack — register the route there if
   needed (match how `modal`/`+not-found` are registered).
2. **Entry point:** tapping an account row navigates to the detail page.
   - In `app/(tabs)/index.tsx`, the dashboard sidebar account rows currently call
     `setLogBalanceAccount(...)` (opens the log sheet). Change the row tap to
     `router.push('/account/' + account.id)` instead. Logging a balance moves
     *into* the detail page (see §3, "Log balance" button). Do the same for the
     account list on `app/(tabs)/accounts.tsx` if rows are tappable there.
3. **Extract `components/TrendChart.tsx`** from the dashboard's existing
   `AreaChart` block (currently inline in `app/(tabs)/index.tsx`, the
   `chartData.length >= 2` branch incl. the gradient, custom Tooltip, hover
   wiring). The dashboard MUST look and behave identically after extraction.
   Props: `{ data: {value:number; date:string}[]; color: string;
   onActiveValueChange?: (v: number | null) => void; height?: number }`.
   The dashboard keeps its hero-scrub behavior via `onActiveValueChange`.
4. **No new tables.** Reuse `useAccountSnapshots`, `useLogBalance`,
   `useDeleteSnapshot` (lib/snapshots.ts), `useAccounts`, `EditAccountSheet`,
   `useArchiveAccount`.

## §1 — `components/TrendChart.tsx`

- Move the dashboard AreaChart (gradient defs, custom value+date Tooltip,
  `activeDot`, cursor) into this component verbatim, parameterized by the props
  above. Keep `fmtCurrencyFull` / `fmtTooltipDate` — move them to a shared spot
  (e.g. `lib/format.ts`) and import in both places, OR keep them in TrendChart
  and have the dashboard import from there. Don't duplicate the functions.
- Wrap in the existing `ChartErrorBoundary` inside TrendChart so both callers get
  the guard for free.
- `onActiveValueChange(v)` fires the hovered value on mousemove, `null` on
  mouseleave. Dashboard uses it to drive `heroDisplayValue` / `chartIsActive`.

### Dashboard refactor (same PR)
- Replace the inline chart with `<TrendChart data={chartData} color={modeColor}
  onActiveValueChange={...} />`. Behavior must be unchanged: hero number still
  scrubs on hover, change line still hides during scrub.
- Acceptance: dashboard chart + tooltip + hero-scrub work exactly as before.

## §2 — `app/account/[id].tsx`

Use `useLocalSearchParams()` for `id`. Resolve the account from `useAccounts()`
(find by id); show a graceful "Account not found" if missing.

Layout (themed via `constants/tokens`, dark theme like the rest):
- **Header:** back button, account name (nickname || name), institution,
  category badge/pill (reuse `CATEGORY_LABELS` + `categoryColor`).
- **Current balance** (large), using `latest_balance`.
- **Balance history:** `<TrendChart>` fed from `useAccountSnapshots(id)` mapped to
  `{ value: balance, date: snapshot_date }`, oldest→newest. Color = category
  color (debt = danger, else primary, matching the dashboard convention).
  - If <2 snapshots, show the same "log more to see a trend" placeholder copy
    pattern the dashboard uses.
- **Stats row:** total change since first snapshot (Δ + %); APR or APY if set;
  for debt, min payment + payment due date if present.
- **Snapshots list:** recent snapshots (date + balance), newest first. Each row
  has a delete affordance → `useDeleteSnapshot({ id, accountId })` with a
  confirm dialog (use the existing dialog helpers in `lib/dialog`).
- **Actions:** "Log balance" button → opens `LogBalanceSheet` for this account
  (reuse the component, pass the account). "Edit" → opens `EditAccountSheet`.
  Archive can live behind the edit sheet or an overflow — keep it reachable but
  not prominent.

## §3 — Navigation wiring

- `app/_layout.tsx`: ensure `account/[id]` is a registered Stack screen with a
  reasonable header (or `headerShown: false` and a custom in-screen back row —
  match the app's existing pattern; the tabs use custom headers, so prefer
  `headerShown: false` + an in-screen back button).
- Dashboard + accounts list: row tap → `router.push('/account/' + id)`.

## Acceptance criteria (Claude reviews against these)

- [ ] Tapping an account (dashboard sidebar AND accounts tab) opens its detail page.
- [ ] Detail page shows name, balance, category, history chart, stats, snapshots.
- [ ] The chart is the extracted `<TrendChart>`, and the **dashboard chart still
      behaves identically** (hover tooltip + hero scrub + change line).
- [ ] `fmtCurrencyFull` / `fmtTooltipDate` exist in exactly one place (no dupes).
- [ ] "Log balance" and "Edit" work from the detail page and refresh the view
      (existing hooks already invalidate `ACCOUNTS_KEY` + `NET_WORTH_KEY`).
- [ ] Deleting a snapshot updates the chart + list.
- [ ] `npx tsc --noEmit` adds no new errors in the changed/added files.

## Out of scope (later features)

- Goals (#2) and chart annotations/Events (#3). Do NOT add markers to TrendChart
  yet — but keep the component clean enough that a future `markers?` prop is easy.
