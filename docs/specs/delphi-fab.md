# Build Spec: Floating Ask Delphi launcher

> Author: Claude (architect). Builder: Grok. Reviewer: Claude.
> Goal: make Ask Delphi reachable from every main screen via a floating cat-face
> button with a periodic rotating tip bubble. Unify the chat sheet behind a
> global store so there's a single instance.

## Architecture (locked unless Neal overrides)

1. **Global open-state store:** `store/askDelphi.ts` (Zustand, mirror
   `store/auth.ts` style):
   ```ts
   import { create } from 'zustand';
   interface AskDelphiState { open: boolean; setOpen: (v: boolean) => void; }
   export const useAskDelphiStore = create<AskDelphiState>((set) => ({
     open: false,
     setOpen: (open) => set({ open }),
   }));
   ```
2. **Single global mount + FAB in `app/(tabs)/_layout.tsx`:** wrap the existing
   `<Tabs>` so the FAB and sheet overlay all tabs:
   ```tsx
   return (
     <>
       <Tabs ...>{/* unchanged */}</Tabs>
       <DelphiFab />
       <AskDelphiSheet
         visible={open}
         onClose={() => setOpen(false)}
       />
     </>
   );
   ```
   (Read `open`/`setOpen` from `useAskDelphiStore`.) The sheet's hooks share the
   TanStack cache, so mounting it once globally is free.
3. **Dashboard uses the store:** in `app/(tabs)/index.tsx`, remove the local
   `askOpen` state and the local `<AskDelphiSheet>` at the bottom; change the
   `askDelphiEl` card's onPress to `useAskDelphiStore.getState().setOpen(true)`
   (or pull `setOpen` from the hook). One sheet instance only.

## Component: `components/DelphiFab.tsx`

- A circular floating button, ~56px, pinned `position: absolute`, bottom-right,
  **above the tab bar** (bottom offset ≈ tab bar height + safe area, e.g. ~88;
  right ≈ 16). Contains `<DelphiAvatar size={40} />` on a `T.card` circle with a
  subtle border + shadow and a gold accent ring (palette.gold).
- Tap → `useAskDelphiStore` `setOpen(true)`.
- **Hide the FAB while the sheet is open** (read `open` from the store) so they
  don't overlap.
- **Tip bubble:** a small rounded bubble to the LEFT of the FAB showing a short
  rotating message. Behavior (keep it subtle, not naggy):
  - Pick from a static list (define in the file), e.g.:
    `"How am I doing? Ask me! 🐾"`, `"Got a money question? 😸"`,
    `"Let's check your goals! 💰"`, `"Paw-se for a money check-in? 🐱"`,
    `"Curious about your spending? 😼"`.
  - Show one ~6s, then hide ~50s, then show the next (rotate). Fade in/out.
  - Tapping the bubble also opens the chat. Bubble is non-blocking (doesn't
    capture touches outside itself).
- Theme via `constants/tokens` (T = themeDark), match the app's sheet styling.
- Web + native friendly (absolute positioning + a `setInterval` timer cleaned up
  on unmount).

## Scope notes

- Appears on the 5 main tab screens (it's in the tabs layout). The account-detail
  stack screen (`app/account/[id]`) is a drill-in and does NOT need it in v1.
- Do not show during the route-transition loader if it would overlap awkwardly —
  if it's an issue, leave it; the loader is a full-screen overlay above it anyway.

## Acceptance criteria (Claude reviews)

- [ ] Floating cat button shows on Dashboard, Accounts, Spending, Goals, Settings.
- [ ] Tapping it opens the same Ask Delphi chat (single sheet instance; no
      duplicate sheets, dashboard card still works and opens the same one).
- [ ] Tip bubble rotates messages, appears/auto-hides on a gentle timer, and is
      tappable to open chat.
- [ ] FAB hides while the chat is open; reappears on close.
- [ ] Sits above the tab bar, doesn't block the bottom nav or content.
- [ ] `npx tsc --noEmit` adds no new errors; no unused imports.

## Out of scope

- FAB on the account-detail page, drag-to-reposition, unread/notification badges,
  proactive AI-generated quotes (the rotating list is static for v1).
