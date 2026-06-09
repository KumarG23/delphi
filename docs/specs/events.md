# Build Spec #3: Events / Chart Annotations (Phase 2)

> Author: Claude (architect). Builder: Grok. Reviewer: Claude.
> Goal: add dated milestone markers ("Started snowball", "New job") to the
> net-worth trend chart, with a simple add/list/delete UI. The `events` table
> ALREADY EXISTS — build against it, no CREATE.

## IMPORTANT: use the existing schema (do NOT create/alter the table)

The live `events` table — and a generated `Event` type already exported from
`types/database.ts`, so IMPORT it (don't hand-define):

```ts
import type { Event } from '@/types/database';
// Event = { id, user_id, event_date, label, note: string|null,
//           account_id: string|null, category: AccountCategory|null, created_at }
```

| column      | type                  | v1 usage |
|-------------|-----------------------|----------|
| id          | uuid                  | |
| user_id     | uuid                  | RLS key |
| event_date  | date ('YYYY-MM-DD')   | where the marker sits on the x-axis |
| label       | text                  | short marker text |
| note        | text \| null          | optional longer note |
| account_id  | uuid \| null          | **v1: always null** (global events) |
| category    | enum \| null          | **v1: always null** |
| created_at  | timestamptz           | |

**Verify RLS first (Neal, in Supabase SQL editor):**
```sql
select polname from pg_policy where polrelid = 'public.events'::regclass;
```
Expect `events: …own` style policies. If NONE come back, apply the same
idempotent RLS block we used for goals (enable RLS + 4 own-policies on user_id).

## v1 scope (kept tight on purpose)

- **Global events only** (`account_id`/`category` = null) — life/strategy
  milestones on the net-worth journey.
- Markers render on the **dashboard net-worth chart** only.
- Add / list / delete via one sheet.
- Per-account markers on the account-detail chart = fast-follow (the schema
  already supports it via `account_id`; just out of scope here).

## §1 — `lib/events.ts`

Mirror `lib/accounts.ts` style. Import the generated `Event` type.
- `EVENTS_KEY = ['events'] as const`
- `useEvents()` — select all, `order by event_date asc`.
- `useCreateEvent()` — insert `{ user_id (from session), event_date, label,
  note, account_id: null, category: null }`; invalidate `EVENTS_KEY`.
- `useDeleteEvent()` — delete by id; invalidate `EVENTS_KEY`.

## §2 — `components/TrendChart.tsx` (extend, don't break)

Add an OPTIONAL prop — existing callers (account detail) pass nothing and must
render identically:
```ts
markers?: { date: string; label: string }[];
```
Rendering:
- Add a hidden category axis so reference lines can key on date:
  `<XAxis dataKey="date" hide />` (the chart currently has no XAxis; adding a
  hidden one must NOT change the visual layout — verify the area still fills width).
- For each marker, **snap its date to the nearest data point's date** (events
  rarely fall exactly on a snapshot date). Compute the closest `data[i].date`.
- Render a `<ReferenceLine x={snappedDate} stroke={T.textDim}
  strokeDasharray="2 4" />` with a small top label (`label`, truncated ~14 chars,
  `fontSize: 10`, fill `T.textDim`). Keep it subtle — these are background context,
  not the focus.
- Markers are **visual only** (no tap/hit-testing on SVG). Management is in §3.
- If `markers` is empty/undefined, render exactly as today.

## §3 — `components/EventsSheet.tsx`

Mirror `AddAccountSheet.tsx`. One sheet does both list + add:
- **List** existing events (`useEvents`), newest first: `event_date` (via
  `fmtTooltipDate`) + `label` + `note`, each with a delete affordance →
  `useDeleteEvent` behind a `confirmDialog`.
- **Add form**: `event_date` (default today, same date input style as
  `LogBalanceSheet`), `label` (required), `note` (optional). On submit →
  `useCreateEvent` with `account_id: null`.
- Empty state: "Mark a milestone on your timeline."

## §4 — Dashboard wire-up (`app/(tabs)/index.tsx`)

- `useEvents()`; map to `markers = events.map(e => ({ date: e.event_date,
  label: e.label }))` and pass to the dashboard `<TrendChart … markers={markers} />`.
- Add an "Add event" affordance near the chart — a small button/icon
  (`Ionicons "flag-outline"` or "add") in the chart header area. Opens
  `EventsSheet`. Add `const [eventsOpen, setEventsOpen] = useState(false)` and
  render `<EventsSheet visible={eventsOpen} onClose={…} />` with the other sheets.
- Only show markers when `chartData.length >= 2` (same gate as the chart).

## Acceptance criteria (Claude reviews against these)

- [ ] Dashboard net-worth chart shows a dashed marker + label at each event's
      (snapped) date.
- [ ] Add event → marker appears after save (query invalidates, no reload).
- [ ] Delete event (with confirm) → marker disappears.
- [ ] Account-detail chart and any other `TrendChart` caller look UNCHANGED
      (markers optional; hidden XAxis doesn't alter layout).
- [ ] Markers are visually subtle and don't obscure the line/tooltip.
- [ ] No new `tsc` errors in changed/added files; no unused imports.

## Out of scope

- Per-account event markers on the account-detail chart (fast-follow).
- Editing events (delete + re-add for v1).
- Feeding events into Ask Delphi's context (possible later — narrative milestones
  could enrich coaching).
- `category`-scoped events.
```
