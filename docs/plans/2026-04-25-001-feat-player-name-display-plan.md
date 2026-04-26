---
title: "feat: Player Name Display System"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/player-name-display-requirements.md
---

# feat: Player Name Display System

## Overview

Replace the 549-line `src/components/PlayerNameLink.tsx` with a small, single-responsibility component system that renders player names uniformly across the app. The new system is **viewport-aware** (full name on desktop, nickname on mobile, 640px breakpoint), **badge-aware** (PP and Captain badges normalized into a single `<PlayerBadge>` component), **collision-aware** (`peers` prop disambiguates colliding nicknames by showing `#P`), and **CI-enforced** (a custom ESLint rule blocks raw `{p.first_name}` JSX outside the new module so the migration cannot rot).

This plan delivers in **6 phases across 14 implementation units**: foundation hooks → popover extraction → name components → tooling → migration batches → final cutover.

## Problem Frame

Player names appear all over the app — rosters, lineups, scoring, chat, leaderboards, admin views — and today their rendering is inconsistent in five compounding ways: no single component owns it, no screen-size awareness, awkward identity verification on mobile, captain rendered two different ways (blue pill vs `(C)` text), and informal player-number policy. (See origin: `docs/brainstorms/player-name-display-requirements.md`.)

## Requirements Trace

This plan satisfies every requirement R1–R26 from the origin document. Mapping by phase:

- **Foundations (Phase 1):** R2 (`useViewport`), R4a (640px matchMedia), R7a (long-press mechanism, 600ms threshold), R10/R11/R11a/R13 (`PlayerBadge`)
- **Popover extraction (Phase 2):** R8/R8a/R8b (popover prop API + states), R9 (Active badges section)
- **Name components (Phase 3):** R1/R2/R3 (system shape), R4/R4b (display logic + missing-nickname fallback), R5 (number policy), R6 (no `First "Nick" Last`), R7/R7b/R7c (popover triggers + keyboard policy + gesture suppression), R15 (`showBadges`), R16/R17/R17a/R17b/R18/R19 (collision via peers prop, folded into the same unit)
- **Tooling (Phase 4):** R23 + R24 (Playwright mobile screenshots of real migrated screens — replaces the originally-proposed dev catalog), R26 (ESLint rule)
- **Migration (Phase 5):** R20/R22 (audit + reviewable batches)
- **Cutover (Phase 6):** R21 (staged delete with CI-verified zero references)
- **Cross-cutting:** R25/R25a (accessibility + touch-target policy), R12 (LO badge always-on) **deliberately removed** from this branch — the originally-proposed "show LO badge everywhere" rule was deferred along with the LO/S badges to the follow-up branch (see Scope Boundaries), R14 (Sub gets no badge — verified by audit)

## Success Criteria

(Carried forward from origin `docs/brainstorms/player-name-display-requirements.md`. Restated here so the plan reads standalone.)

- A new contributor reading a randomly-chosen page of the app cannot find a player name rendered without going through `<PlayerName>` or `<PlayerNameInline>`. **Operationalized:** the R26 lint rule passes in CI on every PR. (One-time grep audit, plus permanent enforcement.)
- On a 360-pixel-wide mobile viewport, a list of 10 same-team players with normal-length names and at least one collision and at least one captain renders without horizontal overflow, without truncation that obscures identity, and disambiguates the colliding names by showing the player number on those rows.
- A user looking at any name anywhere in the app can long-press (or tap, on a standalone name) and see the player's full name, player number, and badge meanings — typically in under one second from a **warm-cache** popover open. Cold-cache opens (first session) may be slower; TanStack Query's 15-min staleTime ensures repeat opens are warm.
- Captain status is rendered identically in every place a captain's name appears. Same for placeholder. **Operationalized:** the R26 lint rule additionally rejects the legacy "blue pill" Tailwind class combination and the literal `(C)` JSX text pattern outside the new badge module.
- Removing `PlayerNameLink.tsx` from the codebase does not break a single page (verified by the staged cutover in Unit 14).

## Scope Boundaries

- **LO and Staff (S) badges.** Deferred to a follow-up branch; they are net-new product features and will reuse `<PlayerBadge>` config when built (see origin Scope Boundaries).
- **Nickname uniqueness validation at creation time.** Display-side fix only; form-time validation is separate work.
- **Sub badge.** Subs are scoring-only and not real people; no badge.
- **Match-finalization branch.** Untouched.
- **Visual regression baseline tests.** Manual screenshot review in this plan; baseline-comparison harness is separate.
- **The four nickname-shortening strategies.** Not invoked at display time; `generateNickname` is creation-only and not extracted here.

### Deferred to Separate Tasks

- **PlaceholderBadge initial implementation:** lives in `feat/placeholder-lifecycle-frontend`. This plan **starts coding only after that branch merges to main**; the brainstorm and plan documents can be authored beforehand (and this plan is being written now). Phase 1's `<PlayerBadge>` work will fold the merged `PlaceholderBadge` styling into its config.

## Context & Research

### Tech stack (verified)

- React 18.2.0, TypeScript 5.8.3, Vite 7.1.6, Tailwind 4.1.13
- Radix UI primitives via shadcn/ui — `@/components/ui/popover` is the existing wrapper
- TanStack Query 5.90.6 (cache: `useMemberById` runs at 15-min staleTime)
- Vitest 4.0.1 + `@testing-library/react` 16.3.0 + `happy-dom` 20 + `msw` 2.11.6
- ESLint 9.35.0 **flat config** (`eslint.config.js`) — supports inline custom plugins without a new dep
- Playwright 1.59.1 — currently desktop-Chromium only

### Relevant code and patterns

- `src/components/PlayerNameLink.tsx` (549 lines) — the file being replaced. 7 `useState`, 10+ hooks, 5 child modals (`ReportUserModal`, `InvitePlayerModal`, `RecordDuesModal`, two `ConfirmDialog`), shadcn `Popover` with content at lines 309–425. Operator-gated actions resolved via `useUserProfile().canAccessLeagueOperatorFeatures()`. Existing prop interface: `playerId`, `playerName`, `className`, `teamId`, `teamName`, `captainName`, `captainMemberId`, `onSendMessage`, `onReportUser`, `onBlockUser`, `customActions`.
- `src/components/TeamRosterList.tsx:56-60` — captain blue pill (`bg-blue-100 text-blue-700 px-2 py-0.5 rounded`).
- `src/components/PlayerRoster.tsx:145` — captain `(C)` text (`ml-1 text-blue-600 font-bold`).
- `src/components/PWAInstallPrompt.tsx:42` — only existing `matchMedia` usage (`(display-mode: standalone)`); no general viewport hook.
- `src/test/utils.tsx` — `renderWithProviders` wraps Query + Router + UserContext for tests.
- `src/__tests__/unit/copyLinkButton.test.tsx`, `src/__tests__/unit/houseRuleForm.test.tsx` — existing test patterns.
- `src/types/member.ts` — helpers `getPlayerDisplayName`, `getPlayerNickname`, `getPlayerDisplayNumber`, `formatPartialMemberNumber`. The new components use these (no rewriting them).

### PlayerNameLink importing files (17 distinct, source of migration batches)

Rosters: `AllPlayersRosterCard`, `PlayerRoster`, `TeamRosterList`, `RegisterPlayerModal`, `player/TeamCard`, `player/MyTeams`
Scoring: `scoring/TenSevenScoreboard`, `scoring/TeamStatsCard`, `TableSizeLabel`
Operator: `operator/PlayerManagement`, `operator/TeamEditorModal`, `components/operator/TableBadgePopover`
Pages: `pages/TopShooters`, `pages/FeatsOfExcellence`
Messaging: `components/messages/MessageBubble`
Team: `components/TeamNameLink` (verify usage — may be a leftover misuse of PlayerNameLink for team display)

### Institutional learnings

- `docs/solutions/` does not exist in this repo — no prior learning files apply.
- User memory carries relevant prior decisions: nicknames are mobile primary; PlaceholderBadge surfaces deferred to avoid scoring-branch conflicts; never render `First "Nick" Last`. These are baked into the brainstorm doc and inherit into this plan.

### Project constraints (from `CLAUDE.md`)

- shadcn/ui components for ALL UI (no raw `<button>`, `<input>`, etc.)
- `~100-line target` per file (popover allowed up to ~200 then split — per origin R1)
- `@fileoverview` + JSDoc on every new file/function
- `TABLE_OF_CONTENTS.md` must be updated for every new/moved file
- `pnpm run build`, `pnpm run lint` are pre-approved
- pnpm (not npm)

## Key Technical Decisions

- **Hook directory.** Place new hooks at `src/hooks/useViewport.ts` and `src/hooks/useLongPress.ts`. (`src/hooks/` may not exist yet — created if needed.) Rationale: standard React convention; keeps hooks discoverable separate from `src/utils/`.
- **`<PlayerBadge>` config-driven, not per-type files.** One file (`src/components/PlayerBadge.tsx`) plus a `BADGE_CONFIG` map keyed by type. Adding LO/S in the follow-up branch is a one-line config addition. (Origin Key Decision; confirmed during review.)
- **Popover extraction strategy.** Move popover content + child-modal triggers + state into `src/components/PlayerIdentityPopover.tsx` with an explicit prop API. The five child modals (`ReportUserModal`, `InvitePlayerModal`, `RecordDuesModal`, two `ConfirmDialog`) move with it. The lazy-on-open pattern (`useIsUserBlocked` is gated on `open`) is preserved. If the popover exceeds ~200 lines, split action surfaces into sub-components (`PlayerActionsMenu`, `OperatorActionsMenu`).
- **Long-press implementation: pointer-event timer with `onClickCapture` suppression.** `pointerdown` starts a 600ms timer; `pointerup` / `pointercancel` / `pointermove >10px` cancels; on fire, the callback runs and a `suppressNextClick` ref flag is set. The hook also returns an `onClickCapture` handler that swallows the subsequent click event (this is the actual cross-browser-reliable mechanism — `pointerdown` event-level `stopPropagation` does not suppress the synthesized `click`). This pattern works on iOS Safari + Android Chrome and avoids depending on Radix Popover's tap trigger inside an inline span. CSS `user-select: none` and `-webkit-touch-callout: none` only when the gesture is enabled.
- **Keyboard policy.** `<PlayerName>` is a button — Enter/Space already opens the popover (Radix default). `<PlayerNameInline>` does NOT have an independent keyboard trigger by design. Documented as an accessibility decision; keyboard users access identity details via the standalone form available in roster/profile views. (Origin R7b.)
- **ESLint rule via inline plugin in `eslint.config.js`.** No new devDep. The flat-config format supports an inline `plugins: { local: { rules: { ... } } }` object. Rule name: `local/no-raw-player-name`. Forbids JSX expressions referencing `first_name` / `last_name` / `nickname` properties on member-shaped objects in JSX text contexts, with an allowlist for files in `src/components/PlayerName.tsx`, `PlayerNameInline.tsx`, `PlayerIdentityPopover.tsx`, `PlayerBadge.tsx`, and the test setup.
- **Dev catalog dropped (was R23).** The user's underlying need — "see every place names are displayed" — is met by Unit 9 Playwright screenshots of real migrated screens with real prop combinations, which is more accurate than a synthetic fixture catalog would have been.
- **Playwright mobile project.** Add a second project to `playwright.config.ts` using `devices['Pixel 5']`. Screenshot capture wrapper script lives at `scripts/screenshot-name-display.ts`, callable from the test plan.
- **Cutover via final commit gated on CI.** R26 lint rule fires only on net-new raw renders during migration (file-level allowlist updated as batches land). After the audit batch (Unit 13), the allowlist is removed; the lint rule then reports zero remaining references; Unit 14 is the deletion commit.
- **Test conventions.** Component tests at `src/__tests__/unit/`; integration at `src/__tests__/integration/`. Use the existing `renderWithProviders` from `src/test/utils.tsx`. happy-dom should handle Radix Popover rendering; if focus-trap behavior fails in tests, fall back to mocking `Popover` to its open state (defer to implementation if needed).

## Open Questions

### Resolved During Planning

- **R26 mechanism: ESLint or grep?** Resolved as ESLint custom rule (inline plugin in `eslint.config.js`). Justification: better editor integration, no new devDep, fits existing flat config. Backup grep-based pre-commit retained as a fallback only if the inline plugin proves brittle.
- **R23 dev-route gating mechanism?** Resolved as `import.meta.env.DEV`. Catalog component returns a 404 in production builds.
- **R20 actual count of importing files?** Audit produced 17 distinct importing files (the brainstorm's "39" counted JSX occurrences across files). Migration batches sized to this count.
- **R8a popover prop shape?** Resolved by reviewing PlayerNameLink: shape inherits the existing prop interface plus an explicit `customActions` array. See Unit 4.
- **TeamNameLink usage of PlayerNameLink.** Verified: it imports PlayerNameLink and may be passing team data through it as a misuse. Treated as a Unit 12 audit-and-clean target rather than a refactor.

### Deferred to Implementation

- **iOS Safari `-webkit-touch-callout: none` interaction with VoiceOver.** Test on actual device during implementation; if VoiceOver announcement is suppressed, add `aria-label` to the inline span explicitly.
- **`peers` prop re-render performance** in long lists (10–20 visible names). The plan defaults to content-hash memoization (Unit 5) so callers don't have to `useMemo`. Real measurements happen during Unit 5 implementation against an actual scoring screen.
- **Whether `happy-dom` correctly renders Radix Popover in tests.** First popover test will reveal this; fallback is to mock the popover's open state directly.
- **Whether action sub-components are needed** to keep the popover under ~200 lines. Decided during Unit 4 implementation when actual line count is visible.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
                          ┌──────────────────────────────────┐
                          │ src/types/member.ts (existing)   │
                          │  getPlayerNickname               │
                          │  getPlayerDisplayName            │
                          │  getPlayerDisplayNumber          │
                          │  formatPartialMemberNumber       │
                          └────────────┬─────────────────────┘
                                       │ (consumed by)
                                       ▼
            ┌────────────────────────────────────────────────────┐
            │ Phase 1: Foundations                                │
            │   src/hooks/useViewport.ts  (Unit 1)                │
            │   src/hooks/useLongPress.ts (Unit 2)                │
            │   src/components/PlayerBadge.tsx (Unit 3)           │
            └────────────┬───────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────────────────────────────┐
            │ Phase 2: Popover extraction                          │
            │   src/components/PlayerIdentityPopover.tsx (Unit 4) │
            │   (extracts from existing PlayerNameLink)           │
            └────────────┬───────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────────────────────────────┐
            │ Phase 3: Name components                             │
            │   src/components/PlayerName.tsx       (Unit 5)      │
            │   src/components/PlayerNameInline.tsx (Unit 5)      │
            │   peers prop + collision logic        (Unit 5)      │
            └────────────┬───────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────────────────────────────┐
            │ Phase 4: Tooling (parallelizable)                    │
            │   eslint.config.js custom rule  (Unit 7)            │
            │   playwright.config.ts mobile +                      │
            │   real-screen screenshots       (Unit 9)            │
            └────────────┬───────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────────────────────────────┐
            │ Phase 5: Migration (batched)                         │
            │   Rosters       (Unit 10) — 6 files                 │
            │   Scoring       (Unit 11) — 3 files                 │
            │   Operator+Pages+Messaging (Unit 12) — 7 files      │
            │   Audit raw renders (Unit 13)                       │
            └────────────┬───────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────────────────────────────┐
            │ Phase 6: Cutover                                     │
            │   Delete PlayerNameLink.tsx (Unit 14)               │
            └────────────────────────────────────────────────────┘
```

## Implementation Units

### Phase 1 — Foundations

- [ ] **Unit 1: `useViewport` hook**

**Goal:** Provide a single source of truth for `isMobile` based on a 640px `matchMedia` listener that survives orientation changes and window resizes.

**Requirements:** R2, R4a

**Dependencies:** None (Phase 1 starts after `feat/placeholder-lifecycle-frontend` merges to main).

**Files:**
- Create: `src/hooks/useViewport.ts`
- Test: `src/__tests__/unit/useViewport.test.ts`

**Approach:**
- `matchMedia('(max-width: 639px)')` — below 640px is mobile (Tailwind `sm` breakpoint convention).
- Initialize from `window.matchMedia(...).matches`; subscribe via `.addEventListener('change', ...)` in `useEffect`; cleanup on unmount.
- Returns `{ isMobile: boolean }` (object so future fields can be added without breaking calls).
- SSR-safe: guard `typeof window === 'undefined'` and return `{ isMobile: false }` initially (Vite SSR is not used today, but cheap to be safe).
- **Test environment:** happy-dom does not provide a working `matchMedia` by default. Add a controllable `matchMedia` mock to `src/test/setup.ts` (returns a `MediaQueryList` stub with `addEventListener`/`removeEventListener` that test code can drive). Document the pattern in `src/test/utils.tsx` so future hooks can reuse it.

**Patterns to follow:**
- `src/components/PWAInstallPrompt.tsx:42` — existing `matchMedia` usage as a baseline.

**Test scenarios:**
- Happy path: when viewport is 360px wide, `isMobile === true`.
- Happy path: when viewport is 1024px wide, `isMobile === false`.
- Edge case: at exactly 640px, `isMobile === false` (boundary semantics: `max-width: 639px`).
- Edge case: at exactly 639px, `isMobile === true`.
- Reactivity: simulate a `matchMedia` change event from desktop → mobile; the hook re-renders consumers with the new value.
- Cleanup: unmounting the consumer removes the `change` listener (verify via mock).

**Verification:**
- A demo component using the hook flips its rendered text between "desktop" and "mobile" when the test resizes the viewport.
- `pnpm run lint` clean.

---

- [ ] **Unit 2: `useLongPress` hook**

**Goal:** Provide a reusable long-press detector for `<PlayerNameInline>` (and any future caller) that does not conflict with parent click handlers.

**Requirements:** R7a

**Dependencies:** None (parallelizable with Unit 1).

**Files:**
- Create: `src/hooks/useLongPress.ts`
- Test: `src/__tests__/unit/useLongPress.test.ts`

**Approach:**
- Hook signature: `useLongPress(callback, { thresholdMs = 600, movementCancelPx = 10, disabled = false })` returns pointer event handlers `{ onPointerDown, onPointerUp, onPointerCancel, onPointerMove, onClickCapture }`.
- **Threshold: 600ms** — gives substantial input-lag headroom for scorekeepers tapping rapidly during noisy bar matches. (500ms is the iOS context-menu standard but real-world taps regularly land near that boundary; 600ms is the safer floor for an app where mis-firing a popover during scoring is a real cost.)
- On `pointerdown`: capture start position, start a `setTimeout(thresholdMs)`. When the timer fires, invoke `callback()` and set a `suppressNextClick` ref flag to `true`.
- On `pointerup` / `pointercancel`: clear the timer.
- On `pointermove`: if `Math.hypot(deltaX, deltaY) > movementCancelPx`, clear the timer.
- **Click suppression:** `onClickCapture` checks the `suppressNextClick` flag. If set, it calls `event.stopPropagation()` + `event.preventDefault()` and resets the flag. **This is the actual mechanism that prevents the parent's click from firing after a long-press.** `pointerdown` event-level `stopPropagation` does not suppress the synthesized `click` event; only an `onClickCapture` handler observing the subsequent click can intercept it cross-browser.
- When `disabled === true`, return no-op handlers (used by `<PlayerNameInline>` when `enableIdentityGesture` is false — the default — so it does nothing on `pointerdown`).

**Patterns to follow:**
- No existing pointer-event patterns in the repo — this is the canonical implementation. Future long-press needs reuse this hook.

**Test scenarios:**
- Happy path: simulate `pointerdown`, advance fake timers 600ms, then `pointerup` — callback fires once.
- Happy path: simulate `pointerdown`, advance 599ms, then `pointerup` — callback does not fire.
- Edge case: `pointerdown` then `pointerup` after 100ms, then `click` — callback does not fire AND parent's onClick fires (verify suppression flag was not set).
- **Click suppression: simulate `pointerdown`, advance 600ms (timer fires, callback invoked), `pointerup`, then `click` — parent's onClick does NOT fire (the `onClickCapture` swallowed it).** This is the regression test for scoring-button accountability.
- Edge case: `pointerdown` at (0,0), `pointermove` to (15,0), advance 600ms — callback does not fire (movement cancel).
- Edge case: `pointerdown` at (0,0), `pointermove` to (5,5), advance 600ms — callback fires (under cancel threshold).
- Disabled: `disabled: true` — `pointerdown` then `pointerup` after 700ms — callback does not fire.
- Cleanup: unmount during a pending hold — no callback fires after unmount; no timer leaks (verify with timer mock).

**Verification:**
- `pnpm run lint` clean.

---

- [ ] **Unit 3: `<PlayerBadge>` component (config-driven)**

**Goal:** A single composable badge component that handles PP and Captain today and accepts new badge types (LO, S) by config addition only — no new files needed for future badge work.

**Requirements:** R10, R11, R11a, R13

**Dependencies:** Unit 1 (`useViewport`). **Blocked** until `feat/placeholder-lifecycle-frontend` merges to main (see Deferred to Separate Tasks). Until that merge, the `PlaceholderBadge` styling cannot be folded into `BADGE_CONFIG`.

**Files:**
- Create: `src/components/PlayerBadge.tsx`
- Test: `src/__tests__/unit/PlayerBadge.test.tsx`

**Approach:**
- One component: `<PlayerBadge type="PP" | "C">` (typed union).
- A `BADGE_CONFIG` map per type holding: `shortLabel` (mobile, e.g. `"PP"`, `"C"`), `fullLabel` (desktop, e.g. `"Placeholder Player"`, `"Captain"`), `description` (for the popover Active Badges section), and Tailwind class string for color/styling.
- Component reads `useViewport().isMobile` to choose `shortLabel` vs `fullLabel`.
- A separate `<PlayerBadgeRow badges={['PP', 'C']}>` helper renders multiple badges in fixed order — PP first, then C (R11a). Order encoded in the config order. (Future LO/S extend the same array.)
- shadcn-style: build on a `Badge` shadcn component if one exists; otherwise plain `<span>` with Tailwind classes consistent with the existing TeamRosterList blue-pill style.

**Patterns to follow:**
- `src/components/TeamRosterList.tsx:56-60` — reference Tailwind class palette (`bg-blue-100 text-blue-700 px-2 py-0.5 rounded`) for the Captain badge color baseline.
- The merged `PlaceholderBadge` (post-merge) for PP styling.

**Test scenarios:**
- Happy path: `<PlayerBadge type="PP" />` on desktop renders "Placeholder Player".
- Happy path: `<PlayerBadge type="PP" />` on mobile renders "PP".
- Happy path: `<PlayerBadge type="C" />` on desktop renders "Captain".
- Happy path: `<PlayerBadge type="C" />` on mobile renders "C".
- Stacking: `<PlayerBadgeRow badges={['C', 'PP']} />` renders PP first then C, regardless of input array order.
- Empty: `<PlayerBadgeRow badges={[]} />` renders nothing (no wrapper element).
- Accessibility: each badge has `aria-label` reading the full description (so screen readers announce "Placeholder Player" not "PP").

**Verification:**
- `pnpm run lint` clean. `pnpm run typecheck` clean.

---

### Phase 2 — Popover Extraction

- [ ] **Unit 4: Extract `<PlayerIdentityPopover>` from `PlayerNameLink`**

**Goal:** Move the popover content + child-modal triggers + state out of the 549-line `PlayerNameLink` into a reusable `<PlayerIdentityPopover>` with an explicit prop API.

**Requirements:** R8, R8a, R8b, R9

**Dependencies:** Unit 3 (`PlayerBadge` for the Active Badges section).

**Files:**
- Create: `src/components/PlayerIdentityPopover.tsx`
- Modify: `src/components/PlayerNameLink.tsx` (temporarily delegates to the new popover until Unit 14 deletes it)
- Test: `src/__tests__/integration/PlayerIdentityPopover.test.tsx`
- Possibly create (decided during implementation): `src/components/PlayerActionsMenu.tsx`, `src/components/OperatorActionsMenu.tsx` if the popover exceeds ~200 lines.

**Approach:**
- Prop API:
  - `playerId: string` (required)
  - `open: boolean`, `onOpenChange: (open: boolean) => void` — controlled by parent
  - `teamId?: string`, `teamName?: string`, `captainName?: string`, `captainMemberId?: string` — preserved invite-context props from current `PlayerNameLink`
  - `customActions?: CustomAction[]` — preserved
  - `trigger: ReactNode` — what the popover anchors to (the name itself)
- Internal state and hooks stay the same as today: `useState` for the five modal flags + handicap form, `useMemberById`, `useUserProfile`, `useIsUserBlocked` (still gated on `open` so it lazy-fetches), the mutation and conversation hooks. No data-flow changes — only relocation.
- Render structure:
  - shadcn `Popover` wrapping the `trigger`
  - On open, fetch / read player data via `useMemberById(playerId)`; while loading, render a skeleton (inline name + spinner row)
  - On error, render inline name + "Couldn't load details — try again" with retry button (re-trigger query)
  - On success, render header (full name, player number, **Active Badges** section using `<PlayerBadgeRow>`) + actions in the same order as today (Register, View Profile, Send Message, divider, Report, Block/Unblock, divider, operator actions, divider, custom actions)
- Operator gating preserved via `useUserProfile().canAccessLeagueOperatorFeatures()`.
- Existing child modals (`ReportUserModal`, `InvitePlayerModal`, `RecordDuesModal`, two `ConfirmDialog`) are imported and triggered from inside the popover, just as they are today inside `PlayerNameLink`.

**Patterns to follow:**
- Current `PlayerNameLink.tsx` lines 309–425 for the popover content structure.
- Current modal trigger pattern in `PlayerNameLink` for state-driven modal mounting.
- shadcn `Popover` pattern from `@/components/ui/popover`.

**Test scenarios:**
- Happy path: open=true, fetched player data renders full name + #BCA-xxx + active badges + standard actions.
- Loading: open=true with pending query, renders inline name + skeleton spinner row.
- Error: open=true with failed query, renders error message + retry button; clicking retry refetches.
- Lazy fetch: open=false, `useMemberById` is not invoked (verify via mock).
- Active badges: player with `is_placeholder=true` and `is_captain=true` renders both `PP` and `C` rows in the badge section.
- Operator gating: viewer with `canAccessLeagueOperatorFeatures()=true` sees Set Starting H/C and Mark Dues Paid; viewer without does not.
- Block flow: clicking "Block User" opens the confirm dialog; confirm calls `useBlockUser` mutation.
- Custom actions: passing `customActions={[{label: 'Test', icon, onClick}]}` renders the action and onClick fires when tapped.
- onOpenChange: closing the popover fires `onOpenChange(false)`.

**Verification:**
- All existing PlayerNameLink behaviors (profile nav, message, report, block, register, dues, handicap) work identically through the new popover.
- `PlayerNameLink` is now thinner (target: under 100 lines, just delegating to `<PlayerIdentityPopover>`).
- `pnpm run build` clean.

---

### Phase 3 — Name Components

- [ ] **Unit 5: `<PlayerName>` and `<PlayerNameInline>` components (with `peers` collision logic)**

**Goal:** Two components, shared internals, with the only behavioral difference being rendered HTML (button vs span) and the gesture that triggers the popover (tap vs long-press). Both compose `<PlayerBadge>` and `<PlayerIdentityPopover>`. The `peers` prop for collision disambiguation is part of the same prop interface — collision logic is not architecturally separable from display-form resolution. (Originally Units 5 and 6; merged because the two units share files and Unit 6 only added one prop to Unit 5's output.)

**Requirements:** R1, R2, R3, R4, R4b, R5, R6, R7, R7b, R7c, R15, R16, R17, R17a, R17b, R18, R19, R25, R25a

**Dependencies:** Units 1–4.

**Files:**
- Create: `src/components/PlayerName.tsx`
- Create: `src/components/PlayerNameInline.tsx`
- Test: `src/__tests__/unit/PlayerName.test.tsx`
- Test: `src/__tests__/unit/PlayerNameInline.test.tsx`
- Test: `src/__tests__/unit/playerNameCollision.test.tsx`
- Possibly create: `src/components/playerName/internal.ts` (shared helpers for badge resolution or display-form selection)
- Possibly create: `src/components/playerName/usePeerCollision.ts` (shared collision hook if logic crosses both components)

**Approach:**
- Shared prop interface (one type, both components):
  - `playerId: string` (required)
  - `variant?: 'auto' | 'full' | 'nickname'` (default: `'auto'`)
  - `showBadges?: boolean` (default: `true`)
  - `showNumber?: boolean` (default: `false`)
  - `peers?: string[]` (player IDs in the same visible context for collision disambiguation; ignored if undefined or empty)
  - `enableIdentityGesture?: boolean` — **only meaningful on `<PlayerNameInline>`. Default `false`.** When omitted, inline mode does NOT trigger the popover via long-press. Callers who want long-press identity verification (chat message bubble's sender name, an inline name in a non-action context) opt in by passing `enableIdentityGesture={true}`. **Inverted from the originally-proposed `disableIdentityGesture` opt-out** so that scoring contexts — the highest-cost mis-fire surface — fail safe by default. Forgetting to set the prop produces "no popover" (low cost), not "popover during scoring" (high cost). `<PlayerName>` (standalone button) always opens on tap; this prop has no effect on it.
  - `className?: string`
  - `isCaptain?: boolean` — caller-supplied (see Badge Resolution below)
- Plus passthrough props for the popover (`teamId`, `teamName`, `captainName`, `captainMemberId`, `customActions`)
- `<PlayerName>`: renders a shadcn `Button variant="ghost"` (or equivalent) with `<PlayerIdentityPopover>` triggered by tap. 44×44 minimum touch target. Enter/Space opens the popover automatically (Radix default for button triggers).
- `<PlayerNameInline>`: renders a `<span>`. When `enableIdentityGesture` is `true`, attaches `useLongPress` from Unit 2 (including `onClickCapture` for click suppression) and the span gets `user-select: none` + `-webkit-touch-callout: none`. When `enableIdentityGesture` is `false` (default), the span is plain text — no gesture, no popover, no special CSS.
- Display-form resolution (R4):
  - If `variant === 'full'` → full name
  - If `variant === 'nickname'` → nickname (or full name if nickname is null/empty per R4b)
  - If `variant === 'auto'` → nickname if `useViewport().isMobile`, else full name (with R4b fallback if nickname missing)
- **Badge resolution:**
  - **PP** is derived from `member.user_id === null` via the existing `isPlaceholderMember(member)` helper in `src/types/member.ts`. The component reads this internally from `useMemberById` data.
  - **Captain (C)** is **caller-supplied via the `isCaptain` prop**. Rationale: `is_captain` lives on `team_players` (per-team-membership), not on `members` — `useMemberById` cannot resolve it without a team context. Existing call sites (`TeamRosterList`, `PlayerRoster`) already have team context and currently render captain inline; they pass `isCaptain={tp.is_captain}` (or equivalent) explicitly. This keeps the new component data-source-free while preserving correctness. When `isCaptain` is omitted (no team context), no Captain badge is rendered — same as today's behavior.
  - Badge list passed to `<PlayerBadgeRow badges={['PP', 'C']}>` if `showBadges`.
- **Collision disambiguation (formerly Unit 6, now folded in):**
  - `peers` prop accepts an array of player IDs in the current visible scope (lineup, scoring, scoreboard).
  - **Bulk fetch via `useMembersByIds(peers)`** — a single hook call for all peers (Rules of Hooks compliant). The hook exists at `src/api/hooks/useCurrentMember.ts:193` and reuses TanStack Query's cache.
  - When the component is rendering nickname form (not full name), it derives a collision set from the resolved peers and checks for a match against its own nickname.
  - On collision, `showNumber` is forced `true` for this render only (the prop is not mutated; the internal logic just always renders the number on collision).
  - **Loading-state behavior:** while any peer's data is still resolving, treat that peer's nickname as unknown (do not flag a collision based on incomplete data). Once all peers resolve, the collision check runs definitively.
  - **Reference stability:** the component memoizes the collision computation by content-hash (sorted joined peer IDs), not by array reference. Callers do not need to `useMemo` the peers array.
  - R17b safety net: if two peers have identical nicknames AND identical numbers (data-impossible by current schema), fall back to full name; the existing R19 lineup warning still fires.
  - **Self-exclusion:** if `peers` contains the current component's own `playerId`, it is filtered out before collision detection.
- Number resolution (R5): if `showNumber` is true, append `getPlayerDisplayNumber(member)` (full on desktop) or `formatPartialMemberNumber(member)` (mobile) after the name.
- The legacy `First "Nickname" Last` pattern is not introduced (R6).

**Test scenarios for `PlayerName`:**
- Happy path: `<PlayerName playerId="..." />` on desktop renders full name + badges.
- Happy path: same component on mobile renders nickname + short badges.
- Variant override: `variant="full"` on mobile renders full name.
- Variant override: `variant="nickname"` on desktop renders nickname.
- Missing nickname (R4b): `variant="auto"` + mobile + `nickname=null` renders full name.
- showBadges false: `<PlayerName showBadges={false} />` does not render any badge.
- showNumber true: appends abbreviated number on mobile, full number on desktop.
- Tap: clicking the name opens the popover.
- Keyboard: Tab to the name, press Enter, popover opens.

**Test scenarios for `PlayerNameInline`:**
- Happy path: renders as a `<span>`, not a `<button>`.
- Default (gesture off): clicking does NOT open the popover; long-press does NOT open the popover. Parent click handler still fires.
- Opt-in: with `enableIdentityGesture={true}`, long-press 600ms opens the popover.
- Tap with gesture enabled: clicking it (short tap, no hold) does NOT open the popover (parent click should fire).
- Movement-cancel with gesture enabled: hold + move >10px does not open the popover.
- Click suppression with gesture enabled: 600ms hold + click sequence — popover opens AND parent click does NOT fire.
- Keyboard: focus on the parent button, press Enter — parent fires; the inline span has no independent keyboard trigger (R7b).
- Visual: when gesture enabled, `user-select: none` is applied; when disabled, normal text-selection works.

**Test scenarios for `peers` collision logic:**
- No collision: `peers=['p1', 'p2']` with unique nicknames → renders nickname only, no number.
- Collision (mobile): `peers=['p1', 'p2', 'p3']` with `p1.nickname === p2.nickname` → both p1 and p2 render with `#P` appended; p3 does not.
- No peers: `peers=undefined` → no collision logic runs.
- Empty peers: `peers=[]` → no collision logic runs.
- Reactivity: render with `peers=[A, B]`; sub in C with same nickname as A → next render shows A and C with `#P`.
- Reference stability: peers array changes reference but contains same IDs → collision result does not change, no extra re-renders of unaffected names.
- Loading state: `peers=[p1, p2]` where p2 data is still loading → no collision indicator until p2 resolves.
- Self-exclusion: `peers=[A, B, self]` where self.id is in the array → self is filtered before collision check.
- Variant override: `variant="full"` → collision logic does not run (full name is already unambiguous).
- Triple-tie data-impossible safety net: stub two players with identical nickname AND number → both render full name.

**Verification:**
- Both components meet WCAG AA: 16px minimum text, 4.5:1 contrast (visual review on real screens via Unit 9 screenshots).
- `pnpm run lint` clean. `pnpm run typecheck` clean.

---

- [ ] **Unit 6: REMOVED — merged into Unit 5**

The `peers` collision logic was originally a standalone unit but it modifies the same files Unit 5 creates and adds a single prop to the same interface. Merged for SRP coherence (one component = one unit). All R16/R17/R17a/R17b/R18/R19 requirements are now covered by Unit 5.

---

### Phase 4 — Tooling

- [ ] **Unit 7: ESLint custom rule blocking raw name renders (R26)**

**Goal:** Prevent the migration from rotting. Block new JSX expressions that render `first_name` / `last_name` / `nickname` directly outside the new component module.

**Requirements:** R26

**Dependencies:** Unit 5 (the rule's allowlist references the new files).

**Files:**
- Modify: `eslint.config.js` (add inline plugin object)
- Possibly create: `eslint-rules/no-raw-player-name.js` (extracted rule definition)
- Test: `src/__tests__/unit/eslintRule.test.ts` (or run rule unit tests via ESLint's `RuleTester` API)

**Approach:**
- Inline plugin in `eslint.config.js`:
  ```
  plugins: { local: { rules: { 'no-raw-player-name': require('./eslint-rules/no-raw-player-name') } } }
  rules: { 'local/no-raw-player-name': 'error' }
  ```
- **Rule logic (AST visitors) — broadened heuristic:** Flag any of the following inside a `JSXExpressionContainer` (or template literal embedded in JSX): (a) `MemberExpression` with `property.name` of `first_name`, `last_name`, or `nickname` (regardless of the object identifier name); (b) `MemberExpression` with computed access where the literal is one of those names (`member['first_name']`); (c) bare `Identifier` references to a destructured `first_name` / `last_name` / `nickname` whose declarator's init is a `MemberExpression` or function-call result (covers `const { first_name } = member; <div>{first_name}</div>`). The heuristic deliberately fires broadly; the file allowlist absorbs legitimate cases.
- **Honest limit (documented as a comment in the rule file):** the rule does NOT trace identifiers across function or file boundaries (e.g., `const x = member.first_name; passToHelper(x); helperRendersIt`). For cross-boundary aliasing, code review is the backstop. The rule covers the dominant ~95% of direct-render patterns.
- **Allowlist via a separate flat-config object** in `eslint.config.js` (the canonical way to scope rules in flat config — not a runtime parameter):
  ```
  // permanent allowlist for the new module
  { files: ['src/components/PlayerName.tsx', 'src/components/PlayerNameInline.tsx',
            'src/components/PlayerIdentityPopover.tsx', 'src/components/PlayerBadge.tsx',
            'src/types/member.ts', 'src/dev/**', 'src/__tests__/**'],
    rules: { 'local/no-raw-player-name': 'off' } }
  ```
- **`migration-pending` allowlist** is a second flat-config object initialized with the 17 known importing files (enumerated in the Research section above) plus any test fixtures. As each migration batch (Units 10–13) lands, files are removed from this allowlist. After Unit 13, the allowlist is empty; the next lint run must be clean before Unit 14 deletes `PlayerNameLink`.
- **Legacy-pattern enforcement (carried from origin Success Criteria):** the rule additionally flags the literal JSX text `(C)` and the Tailwind class combination `bg-blue-100 text-blue-700 px-2 py-0.5 rounded` (the legacy captain pill), outside the allowlist. Captures the "captain rendered identically" success criterion at the lint level.

**Patterns to follow:**
- ESLint flat-config inline plugin pattern (no existing examples in repo; first of its kind).

**Test scenarios:**
- Rule unit test: JSX `{member.first_name}` outside an allowlisted file → reports.
- Rule unit test: JSX `{member.first_name}` inside `src/components/PlayerName.tsx` → does not report.
- Rule unit test: JSX `{member.first_name + ' ' + member.last_name}` outside allowlist → reports both.
- Rule unit test: `const x = member.first_name; return <div>{x}</div>;` outside allowlist → reports the `MemberExpression` (rule traces the variable).
- Rule unit test: `<PlayerName playerId={member.id} />` does not report (prop value, not displayed text).
- Integration: run `pnpm run lint` against a deliberately-broken file → CI fails.

**Verification:**
- `pnpm run lint` passes with all current allowlist entries.
- `pnpm run lint` fails when a temporary test file outside the allowlist contains a raw render.

---

- [ ] **Unit 8: REMOVED — dev catalog dropped**

A dedicated dev catalog page was originally proposed (R23) to render every variant in one place. **Dropped** during plan review: the user's underlying goal — "see every place a name is displayed so I can verify it looks OK" — is better served by Playwright screenshots of *actual migrated screens with real data* (Unit 9), which already cover the migration surfaces and don't require building a synthetic fixture page. Real screens catch prop-combination bugs that a static catalog misses. R23 is satisfied by Unit 9 instead.

---

- [ ] **Unit 9: Playwright mobile project + per-batch screenshot helper**

**Goal:** Enable mobile-viewport screenshots of real migrated screens (R23 + R24) for per-batch user review.

**Requirements:** R23, R24

**Dependencies:** Unit 5 (components must exist to be screenshotted).

**Files:**
- Modify: `playwright.config.ts` (add second project)
- Create: `scripts/screenshot-name-display.ts` (callable wrapper that captures key migrated routes at both viewports)
- Create: `tests/e2e/name-display-real-screens.spec.ts` (captures real authenticated screens — rosters, scoring, leaderboards, etc. — and writes screenshots to `tests/e2e/screenshots/`)

**Approach:**
- Add to `playwright.config.ts`:
  - Second project: `name: 'mobile-chrome'`, uses `devices['Pixel 5']` (393×851 viewport).
  - Both projects must `dependencies: ['setup']` and `storageState: 'tests/e2e/.auth/user.json'` for auth parity (matches the existing chromium project's setup).
- The new spec navigates to actual migrated routes (a roster page, a scoring page, a leaderboard) in both projects, takes full-page screenshots, and writes to `tests/e2e/screenshots/{desktop,mobile}/<route-slug>.png`.
- The wrapper script (`scripts/screenshot-name-display.ts`) accepts a batch label (e.g., `rosters`, `scoring`) and runs only the relevant subset, so each migration batch produces its own focused screenshot set.
- **Per-batch usage:** after Units 10–12 land (each migration batch), the helper produces screenshots for user review *before* the batch merges to main. The screenshots cover real prop combinations because they hit real screens with real data.

**Test scenarios:**
- Test expectation: the screenshot test itself is the test. Verify it produces the expected file paths and non-zero PNG output for both desktop and mobile projects.

**Verification:**
- Running `pnpm exec playwright test name-display-real-screens.spec.ts` produces `tests/e2e/screenshots/{desktop,mobile}/<route>.png` for each covered route.
- The wrapper script with `--batch=rosters` produces only the roster-route screenshots.

---

### Phase 5 — Migration

- [ ] **Unit 10: Migration batch 1 — Rosters and team displays**

**Goal:** Replace `PlayerNameLink` usage in the 6 roster-related files.

**Requirements:** R20, R22

**Dependencies:** Units 5, 6, 7, 8.

**Files (modify):**
- `src/components/AllPlayersRosterCard.tsx`
- `src/components/PlayerRoster.tsx` (also remove the inline `(C)` rendering at line 145 — handled by `<PlayerName>`'s badge logic)
- `src/components/TeamRosterList.tsx` (also remove the inline blue Captain pill at lines 56-60)
- `src/components/RegisterPlayerModal.tsx`
- `src/components/player/TeamCard.tsx`
- `src/player/MyTeams.tsx`

**Approach:**
- For each file, replace the `PlayerNameLink` import with `PlayerName` (or `PlayerNameInline` if the name lives inside a clickable parent).
- Pass `playerId` and any preserved invite-context props (`teamId`, `teamName`, etc.).
- Remove the now-obsolete inline captain rendering (PlayerName handles it via badges).
- After this batch, the R26 ESLint rule's `migration-pending` allowlist drops these 6 files.
- Take desktop + mobile screenshots via Unit 9 helper for user review before the next batch.

**Patterns to follow:**
- Existing `PlayerNameLink` call sites in these files for prop-passing.

**Test scenarios:**
- Smoke: each migrated file's existing tests (if present) still pass.
- Rendering: visual regression via Unit 9 screenshots — diff old/new at desktop and mobile.
- Captain badge: a captain on a roster renders with `[C]` badge (no inline `(C)` or blue pill).
- Mobile: nickname renders, not full name (verify via `getPlayerNickname` returning the expected value).

**Verification:**
- `pnpm run build` clean. `pnpm run lint` clean (no new violations).
- All 6 files removed from the lint rule's `migration-pending` allowlist.
- User reviews the screenshots before approving merge of this batch.

---

- [ ] **Unit 11: Migration batch 2 — Scoring**

**Goal:** Replace `PlayerNameLink` usage in the 3 scoring files. These are the most gesture-sensitive (active scoring during play).

**Requirements:** R20, R22, R7c, R15

**Dependencies:** Unit 10.

**Files (modify):**
- `src/components/scoring/TenSevenScoreboard.tsx`
- `src/components/scoring/TeamStatsCard.tsx`
- `src/components/TableSizeLabel.tsx`

**Approach:**
- Identify which usages are inside scoring action buttons (`PlayerNameInline` + `showBadges={false}`, **default-no-gesture is automatic** — see R7c inversion in Unit 5) vs. which are passive labels (`PlayerName` standalone).
- Scoring buttons get `<PlayerNameInline>` with no gesture-related props — the new `enableIdentityGesture` defaults to `false`, so the popover cannot mis-fire during fast tapping. Scorekeeper accountability is preserved automatically (memory: scorekeeper accountability — vacate-and-rescore is the only fix path).

**Patterns to follow:**
- Same as Unit 10.

**Test scenarios:**
- Smoke: scoring tests in `src/__tests__/integration/` (if they cover these surfaces) still pass.
- Gesture: a scoring action button with `<PlayerNameInline>` (no `enableIdentityGesture` prop) — long-press does NOT open the popover (regression test for the active-scoring scenario, validating the inverted default).
- Captain badge: a captain shown in `TeamStatsCard` renders with `[C]` badge.
- Visual review: Unit 9 screenshots at both viewports.

**Verification:**
- Active-scoring flow on the dev server — rapid score entry does not pop the identity popover unintentionally.
- `pnpm run build` clean.

---

- [ ] **Unit 12: Migration batch 3 — Operator, pages, messaging, team-name**

**Goal:** Replace `PlayerNameLink` usage in the remaining 7 files. Includes verifying `TeamNameLink.tsx` (research flagged it may be a misuse of `PlayerNameLink`).

**Requirements:** R20, R22

**Dependencies:** Unit 11.

**Files (modify):**
- `src/operator/PlayerManagement.tsx`
- `src/operator/TeamEditorModal.tsx`
- `src/components/operator/TableBadgePopover.tsx`
- `src/pages/TopShooters.tsx`
- `src/pages/FeatsOfExcellence.tsx`
- `src/components/messages/MessageBubble.tsx`
- `src/components/TeamNameLink.tsx` — verify usage; if it's misusing `PlayerNameLink` for team display, refactor to use proper team-rendering (separate from player names) and remove the `PlayerNameLink` dependency.

**Approach:**
- Same migration pattern as batches 1 and 2.
- For `TeamNameLink`: read its current implementation; if it passes a non-player ID into `PlayerNameLink`, refactor it to use a team-appropriate component or plain text (not in the new `PlayerName` system).

**Test scenarios:**
- Smoke: existing tests in each file still pass.
- `TeamNameLink`: if refactored, write a test confirming team navigation still works.
- Visual review: Unit 9 screenshots.

**Verification:**
- `pnpm run build` clean. `pnpm run lint` clean.
- `migration-pending` allowlist is now empty.

---

- [ ] **Unit 13: Audit pass for raw-name renders**

**Goal:** Find and migrate any remaining sites that render `first_name` / `last_name` / `nickname` raw in JSX without going through the new components. The R26 lint rule is the enforcement mechanism going forward; this unit is the one-time backfill.

**Requirements:** R20

**Dependencies:** Unit 12.

**Files:**
- Audit the full `src/` tree.
- Modify: any file with raw renders.

**Approach:**
- Run the R26 lint rule with the `migration-pending` allowlist removed entirely.
- Each violation is a site to migrate.
- Migrate each to `<PlayerName>` or `<PlayerNameInline>` with appropriate props.
- Repeat until lint passes clean.

**Test scenarios:**
- After migration, `pnpm run lint` reports zero violations of `local/no-raw-player-name`.
- `pnpm run build` clean.
- A spot-check screenshot comparison on 2-3 of the discovered surfaces confirms no visual regression.

**Verification:**
- Lint clean across the repo.
- Surfaced count of additional sites is documented in the PR description (so the user can see how much "iceberg below the waterline" the audit found).

---

### Phase 6 — Cutover

- [ ] **Unit 14: Delete `PlayerNameLink`**

**Goal:** Remove `src/components/PlayerNameLink.tsx` and confirm the new system is the sole name-rendering path.

**Requirements:** R21

**Dependencies:** Units 4, 10, 11, 12, 13.

**Files:**
- Delete: `src/components/PlayerNameLink.tsx`
- Modify: any leftover internal references (Unit 4's temporary delegation shim is removed).
- Update: `TABLE_OF_CONTENTS.md` (remove the deleted file's entry, update Last Updated).

**Approach:**
- Run `grep -r PlayerNameLink src/` — must return zero hits before deletion.
- Run `pnpm run build` and `pnpm run lint` — both must be clean.
- Delete the file in a standalone commit (so revert is one commit if a holdout is discovered post-merge).

**Test scenarios:**
- `pnpm run build` succeeds with the file deleted.
- `pnpm run test` passes with the file deleted.
- `grep -r PlayerNameLink src/` returns zero hits.

**Verification:**
- File is gone. `pnpm run build` clean. `pnpm run lint` clean. All tests pass.
- Final desktop + mobile screenshots captured (Unit 9 helper) demonstrate the system rendering across all migrated surfaces.

---

## System-Wide Impact

- **Interaction graph:** the migration touches every screen that renders a player name — rosters, scoring, chat, leaderboards, admin, profile cards. The new components are drop-in replacements; the popover behavior is preserved. No callbacks, middleware, or observers are affected.
- **Error propagation:** the popover's lazy-fetch pattern (Unit 4) introduces a new error state (R8b retry). Existing code catches errors at the modal level; the new popover surfaces fetch errors inline with retry rather than failing silently.
- **State lifecycle risks:** Radix Popover state stays in the parent of `<PlayerIdentityPopover>` (it's a controlled component). No new global state. The `peers` prop's collision detection runs on every render of a name; memoization protects long lists.
- **API surface parity:** none — internal refactor, no external API changes.
- **Integration coverage:** Unit 4's integration test covers the popover end-to-end (open, fetch, render badges, fire actions); Unit 5's collision tests cover the peers logic; Unit 9 captures visual coverage of real migrated surfaces with real prop combinations.
- **Unchanged invariants:** `src/types/member.ts` helpers (`getPlayerNickname`, `getPlayerDisplayName`, etc.) are unchanged. The data model is unchanged. The existing lineup-screen "two players have the same nickname" warning (R19) is preserved untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `feat/placeholder-lifecycle-frontend` doesn't merge in a timely fashion. | Brainstorm and plan documents are written; coding waits but is unblocked the moment that merge lands. The plan does not depend on any specific timing. |
| `happy-dom` cannot render Radix Popover correctly in tests. | First-popover test in Unit 4 is the discovery point. Fallback: mock the Popover open state directly; document the mock pattern in test/utils.tsx for future Radix tests. |
| ESLint custom rule heuristic produces false positives in unrelated code. | Allowlist is file-path-based; if the heuristic is too broad, narrow it to specific identifier names (`member`, `player`, `captain`) and document the limitation. The rule is configurable; tightening is a one-line change. |
| The 549-line `PlayerNameLink` extraction surfaces non-obvious coupling (a hook the popover assumed was always available, etc.). | Unit 4 is sequenced before name components specifically so this risk is isolated. If the popover cannot be cleanly extracted, fall back to keeping the popover internal to the new components and decompose later. |
| Migration audit (Unit 13) surfaces significantly more raw-render sites than expected (e.g., 30+). | The R26 lint rule's `migration-pending` allowlist accommodates this — each batch shrinks the allowlist. If the audit is enormous, split Unit 13 into multiple sub-batches in the PR. |
| iOS Safari `-webkit-touch-callout: none` interferes with VoiceOver. | Defer to implementation testing; mitigation is to add explicit `aria-label` to the inline span. Documented as a deferred-to-impl question. |
| `peers` prop performance in long lists (>20 names visible). | `React.memo` + stable peers reference (caller `useMemo`s). If real-world measurements show jank, fall back to memoizing the collision computation at the scope-provider level. Documented as deferred-to-impl. |
| Merge conflicts with adjacent branches (BCA payment, mobile-friendly LO pages, dropdown rework). | The brainstorm explicitly defers all of these. This branch's surface is name display only; conflict surface area is bounded. |

## Documentation / Operational Notes

- `TABLE_OF_CONTENTS.md` requires updates for: 4 new component files (Unit 3, 4, 5×2), 2 new hook files (Unit 1, 2), screenshot test spec (Unit 9), possibly action sub-components (Unit 4), possibly internal helpers (`src/components/playerName/internal.ts`, `usePeerCollision.ts`), and the deletion of `PlayerNameLink.tsx` (Unit 14).
- Each new file carries `@fileoverview` + JSDoc per project convention.
- No production rollout concerns (this is internal refactor + UI-only change). No feature flag needed.
- Final PR description should include the desktop + mobile screenshots from Unit 9 inline.

## Sources & References

- **Origin document:** [docs/brainstorms/player-name-display-requirements.md](../brainstorms/player-name-display-requirements.md)
- Source code being replaced: `src/components/PlayerNameLink.tsx`
- Inconsistent captain renders being normalized: `src/components/TeamRosterList.tsx:56-60`, `src/components/PlayerRoster.tsx:145`
- Existing helpers consumed unchanged: `src/types/member.ts`
- Test conventions referenced: `src/test/utils.tsx`, `src/__tests__/unit/copyLinkButton.test.tsx`
- ESLint config to extend: `eslint.config.js`
- Playwright config to extend: `playwright.config.ts`
- Adjacent branch this plan waits for: `feat/placeholder-lifecycle-frontend`
