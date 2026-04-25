---
date: 2026-04-25
topic: player-name-display
---

# Player Name Display

## Problem Frame

Player names appear all over the app — rosters, lineups, scoring, chat, leaderboards, admin views — and today their rendering is **inconsistent in five compounding ways**:

1. **No single component owns it.** The existing `PlayerNameLink` (`src/components/PlayerNameLink.tsx`, 559 lines, ~39 imports across 14+ files) is used in some places. Other places render names raw in JSX (`{p.first_name} {p.last_name}`). There is no enforcement that all name rendering goes through one path.
2. **No screen-size awareness.** On mobile, full names eat horizontal space we don't have. Nicknames (capped at 12 chars) were introduced specifically to solve this, but the app does not consistently use them on small screens. There is no `useIsMobile` / `useMediaQuery` hook in the codebase yet.
3. **Identity verification is awkward on mobile.** When two players share a nickname (or a player's nickname is ambiguous), the user has no quick way to verify "is this the Mike J I think it is?" The current popover requires a tap that may steal a click action when the name lives inside another button.
4. **Captain rendering is inconsistent.** Captain status appears as a blue pill in `TeamRosterList` and as plain `(C)` text in `PlayerRoster`. Same role, two visual treatments.
5. **Player number (#P / #BCA-) policy is informal.** Shown in some places, absent in others, with no consistent rule.

The goal: **uniform, accessible, mobile-aware name display everywhere a name appears**, with the existing PP and Captain badges normalized into a single visual language and a fast identity-verification path when a nickname alone isn't enough.

## Terminology

Throughout this document, **"full name"** refers to first + last name only (no badges, no number). The **complete rendered identity** (full name + badges + optional number) is referred to as the **"identity display."**

## Visual Aid: What the System Renders

Two components, both backed by the same internals:

| Component | Use when | Desktop default | Mobile default | Tap | Long-press |
|---|---|---|---|---|---|
| `<PlayerName>` | Standalone (lists, headers, body text) | Full name | Nickname | Open identity popover | Same as tap |
| `<PlayerNameInline>` | Nested inside a clickable parent (button, accordion header, action row) | Full name | Nickname | Bubbles to parent | Open identity popover |

Both render the player's **badges** by default and the **#P/#BCA number** only when explicitly requested. Both observe the same accessibility floor (text size, touch target, contrast).

```
Desktop standalone:                    Mobile standalone:
┌──────────────────────┐              ┌────────┐
│ Michael Johnson [PP] │              │ Mike J │
│ #BCA-123456 [C]      │              │ [PP][C]│
└──────────────────────┘              └────────┘
  (identity display:                     (identity display:
   full name + badges +                   nickname + badges,
   number-on-request)                     number behind verify)
```

Long-pressing on either reveals the **identity popover** — full name, number, active badges with descriptions, and the existing actions (Profile / Message / Report / Block / etc.).

## Requirements

**Component System Architecture**

- R1. The new system replaces `PlayerNameLink` as the single source of truth for name rendering. The system is composed of **small single-responsibility pieces**, not one monolith. Every individual file targets ~100 lines or fewer; the popover (which carries the full action set) is allowed to exceed this and is split into action sub-components if it grows past ~200 lines.
- R2. The system provides at minimum: `<PlayerName>` (standalone, interactive), `<PlayerNameInline>` (for nesting in clickable parents), a `useViewport` hook returning at least an `isMobile` boolean, the existing identity popover refactored out as `<PlayerIdentityPopover>` with an explicit prop API (see R8a), and one `<PlayerBadge type="PP"|"C">` component driven by a config object that holds short-label, full-label, and description per type.
- R3. Both `<PlayerName>` and `<PlayerNameInline>` accept the same props. The only behavioral difference between them is rendered HTML (button vs span) and the gesture that triggers the identity popover (tap vs long-press). Nested `<button>` inside `<button>` is invalid HTML and breaks accessibility, which is why the split exists.

**Display Logic**

- R4. Display form is **auto-with-override**. Default behavior: full name on desktop, nickname on mobile (viewport-detected). Callers can override via a `variant` prop (`"full"` | `"nickname"` | `"auto"`) for special cases like a profile header that wants the full name even on mobile.
- R4a. Viewport breakpoint: **640px** (Tailwind's `sm` breakpoint). Below this width, mobile rules apply. Detection uses `matchMedia` with a listener so orientation changes and window-resize transitions trigger a re-render. An open identity popover stays open across viewport flips and re-anchors to its trigger.
- R4b. **Missing-nickname fallback:** when `variant=auto` and `isMobile=true` but the player's nickname is null or empty, the component renders the player's full name instead. (Falling back to a runtime-derived short form would require infrastructure that does not exist; see R16.) The badge presence is unaffected by which form is shown.
- R5. Player number (#P-xxx for placeholders, #BCA-xxx for registered) is **default off**. Callers opt in via a `showNumber` prop where it makes sense (player dropdowns, admin tables). When shown, the number is full on desktop and abbreviated (`#…3456`) on mobile. The number is always visible inside the identity popover regardless of inline display.
- R6. The legacy `First "Nickname" Last` rendering pattern is not introduced anywhere in the new system. (Codebase recon confirmed no instances exist today; the requirement is "do not start.")

**Identity & Verification**

- R7. Tapping a `<PlayerName>` opens the identity popover. Long-pressing a `<PlayerNameInline>` opens the same popover. There is **one popover**, not two — the same component used in both interactions.
- R7a. **Long-press mechanism:** pointer-event timer started on `pointerdown`, fires after **500ms** hold. Cancelled by `pointerup`, `pointercancel`, or `pointermove` exceeding **10px** from start. On fire, the timer handler calls `event.preventDefault()` and `event.stopPropagation()` so the parent click does not also fire. The inline element receives `user-select: none` and `-webkit-touch-callout: none` to suppress iOS text-selection / context-menu interference.
- R7b. **Keyboard access:** `<PlayerName>` (a button) opens the popover on Enter/Space when focused — standard button behavior. `<PlayerNameInline>` (a span inside a parent button) does **not** have an independent keyboard trigger; keyboard users access the identity popover via the standalone `<PlayerName>` form available on profile pages, roster lists, and similar surfaces. This is an explicit accessibility decision: inline mode is mobile-touch-first; keyboard users have alternate paths to the same information.
- R7c. **Gesture suppression:** callers can pass `disableIdentityGesture` to fully suppress the long-press trigger. Required in scoring action buttons during active scoring, where a held finger during fast tap entry could pop the popover over the scoring UI mid-rack.
- R8. The identity popover always includes the player's full name and player number, regardless of what the calling site displays inline.
- R8a. **Popover prop API:** `<PlayerIdentityPopover>` accepts `playerId` (required), `open`/`onOpenChange`, optional `teamId`/`teamName`/`captainName`/`captainMemberId` (preserved from today's `PlayerNameLink` for invite context), and optional `customActions: CustomAction[]`. Operator-gated actions (Set Starting H/C, Mark Dues Paid, Register Placeholder) are surfaced via the same `useUserProfile` lookup `PlayerNameLink` uses today; no new role-resolution logic.
- R8b. **Popover states:** the popover fetches the player's full record on open (lazy load). While loading, render a skeleton showing the inline name + a spinner row where actions go. On fetch error, render the inline name + "Couldn't load details — try again" with a retry button. On success, render the full identity display + actions. The "under one second" success criterion (see Success Criteria) targets the open-to-render time on a warm cache; first-touch open during a cold session may be slower.
- R9. The popover gains an "Active badges" section listing each badge currently applied to the player with its full description (e.g., "PP — Placeholder Player; this player has not registered an account"). This replaces the desktop-only hover tooltip on `PlaceholderBadge` with a unified discovery mechanism that works on every device.

**Badges**

- R10. The system handles **two badge types in this branch**: **PP** (Placeholder Player) and **C** (Captain). Both are rendered by a single `<PlayerBadge type="PP"|"C">` component driven by a config object (one entry per type holding short-label for mobile, full-label for desktop, and description for the popover). LO (League Operator / Owner) and S (Staff) badges are deliberately **deferred to a follow-up branch** — see Scope Boundaries for rationale.
- R11. Captain rendering is standardized as `<PlayerBadge type="C">`. The current blue pill in `TeamRosterList` and the plain `(C)` in `PlayerRoster` are both replaced by the badge component during the migration in R20.
- R11a. **Badge stacking:** when multiple badges apply to one player, they render in a fixed order: **PP first, then C** (PP comes first because it changes the trust-level of the entire identity; role badges follow). On a 360px viewport with both badges present, no overflow is expected (`Mike J [PP][C]` ≈ 14 chars). When LO/S are added in the follow-up branch, the order extends to: **PP, LO, S, C**. Order is fixed in the badge config.
- R12. (Deferred — was "LO badge always shown." Removed from this branch's scope.)
- R13. Each badge has two visual modes: full label on desktop (e.g., "Captain"), short initial/icon on mobile (e.g., "C"). Long-press opens the identity popover where full descriptions live; per-badge tooltips are not introduced (one discovery path, not three).
- R14. The Sub (substitute player) concept gets no badge. Subs are scoring-only placeholders, not real people. They are also not rendered by this component system at all — the scoring UI's existing sub-rendering path is untouched.
- R15. Badges are **default on**. Callers opt out via `showBadges={false}` in tight contexts where role identification is irrelevant — most notably scoring action buttons. Note that `showBadges={false}` only hides the badges; suppressing the long-press gesture itself requires `disableIdentityGesture` (R7c).

**Collision Disambiguation (revised — display-side, no pipeline dependency)**

- R16. When two visible players in a tight context share a nickname, the system disambiguates by **automatically showing the player number on the colliding rows** (and only those rows). No new shortening logic is invented; no extraction of the existing `generateNickname` function is required. The player number already exists, is unique by construction, and is the simplest unambiguous distinguisher.
- R17. The mechanism is a **`peers` prop** on `<PlayerName>` / `<PlayerNameInline>`. Callers who render multiple players in a single visual context (lineup, scoring, scoreboard) pass the visible peer set; the component compares its own nickname to peers' nicknames and toggles the number on if a collision exists. Callers who render a single name (chat message header, profile page) pass nothing and disambiguation does not run.
- R17a. **Reactive behavior:** the `peers` prop is reactive — substitutions, additions, and removals to the visible set update collision detection on the next render.
- R17b. **All-strategies-collide fallback:** when two players have identical nicknames AND identical player numbers (data-impossible by current schema), the inline warning from R19 fires and the components render full names. This is a should-never-happen safety net, not an expected path.
- R18. Disambiguation is **purely display-side**. No data is written, no captain is asked to do anything, no nickname is "officially" changed.
- R19. The existing lineup-screen warning that tells users "two players have the same nickname; have one change it" is preserved untouched. It remains the user-facing nudge to fix the underlying data; the display-side fix in R16-R17 ensures correctness in the meantime.

**Migration & Discovery**

- R20. A one-time **audit pass** finds every site in the codebase that renders a player's name — including raw JSX renders that bypass `PlayerNameLink` today. The audit is part of the implementation, not a follow-up: a "uniform name display" goal is not met if 5 holdout sites still render names raw. Likely audit signals: JSX fragments containing `first_name` / `last_name` / `nickname`, direct usage of `getPlayerDisplayName` outside the new component, role-rendering helpers that include name strings.
- R21. Every site discovered in R20 is migrated to the new component during this branch. **Cutover safety:** `PlayerNameLink` is **not deleted in the same commit as the last migration**. Instead: (a) all migration commits land first, (b) a final commit deletes `PlayerNameLink` after a CI check (R26) confirms zero remaining imports/references in the tree, (c) if a holdout is discovered after merge, the file is restored from history rather than rewritten. No long-lived deprecation shim is introduced; the safety comes from staged cutover, not a parallel codebase.
- R22. The migration touches a large number of files (~39 known, plus an unknown number from R20). It is structured as reviewable batches by feature area (rosters, scoring, chat, admin, etc.). Batches are individually mergeable as long as they leave the codebase passing CI (R26 lint rule fires only on net-new raw renders, not pre-existing ones until that batch's area is reached).

**Enforcement**

- R26. A custom ESLint rule (or grep-based pre-commit + CI check) blocks new JSX expressions matching `{X.first_name}`, `{X.last_name}`, raw nickname rendering, and direct `getPlayerDisplayName` invocations in JSX outside the new component module. This is the guardrail that prevents the migration from rotting after merge. Without R26, "single source of truth" is aspirational; with it, the build stops drift at the PR level.

**Verification & QA**

- R23. A dev-only **catalog page** is built that renders every variant of the system in one place: `<PlayerName>` and `<PlayerNameInline>`, full and nickname variants, with and without badges, with and without number, every badge combination, with and without `peers` (collision triggered). The page lives at a `/dev/*` route gated by an env-var check; it 404s in production builds. The page is the primary visual review surface during development.
- R24. Each migrated batch is screenshotted via Playwright (already in the project from PR #78) for the user to review. Mobile-viewport screenshots require adding a mobile project to `playwright.config.ts` (Pixel 5 device or 360×640 viewport) — see Dependencies.
- R25. The system meets WCAG AA accessibility minimums: 16px minimum text size for the displayed name, 4.5:1 minimum contrast against background, 3:1 minimum contrast for badges against the surrounding name area.
- R25a. **Touch-target policy:** `<PlayerName>` (standalone, a button) meets the 44×44 minimum target. `<PlayerNameInline>` (nested span) does **not** carry an independent target — the parent component's hit area is the touch target for the parent's primary action, and the long-press gesture (R7a) fires on `pointerdown` anywhere within the parent. WCAG SC 2.5.5 (target size) applies to the user's intended primary action, which is the parent's. Inline mode is responsibility-of-parent for hit area.

## Success Criteria

- A new contributor reading a randomly-chosen page of the app cannot find a player name rendered without going through `<PlayerName>` or `<PlayerNameInline>`. **Operationalized:** the R26 lint rule passes in CI on every PR. (One-time grep audit, plus permanent enforcement.)
- On a 360-pixel-wide mobile viewport, a list of 10 same-team players with normal-length names and at least one collision and at least one captain renders without horizontal overflow, without truncation that obscures identity, and disambiguates the colliding names by showing the player number on those rows.
- A user looking at any name anywhere in the app can long-press (or tap, on a standalone name) and see the player's full name, player number, and badge meanings — typically in under one second from a warm-cache popover open.
- Captain status is rendered identically in every place a captain's name appears. Same for placeholder. **Operationalized:** the R26 lint rule additionally rejects the legacy "blue pill" classes and the `(C)` literal pattern in JSX outside the new badge module.
- Removing `PlayerNameLink.tsx` from the codebase does not break a single page (verified by the staged cutover in R21).

## Scope Boundaries

**Explicitly out of scope:**

- **LO and Staff (S) badges.** Originally proposed in scope; deferred to a follow-up branch. Rationale: they are net-new product features (no equivalent badges exist today), they require a data-lookup design decision that isn't yet resolved (denormalized column on `members` vs cached query), and the LO badge's "always-on vs context-aware" UX policy needs more thought after observing real cross-org usage. Bundling these into a display-normalization branch was scope creep. The follow-up branch will reuse the `<PlayerBadge>` component built here.
- **Nickname uniqueness validation at creation time.** The collision problem is solved at display in this branch (R16-R17). Preventing duplicate nicknames at the form level (org/league/team scoping decisions, validation UX, existing-duplicate cleanup) is separate work — captains do not have authority to change another player's nickname, so the form-time fix has its own product-policy questions.
- **Sub badge.** Subs are scoring-only and not real people. (R14)
- **The four nickname-shortening strategies themselves.** This branch does **not** call them at display time (the existing function is creation-only and would require extraction work that's out of scope). Refactoring or consolidating those strategies is separate.
- **Match-finalization branch.** A separate active branch handles "between lineup and scoring" finalization. This branch does not touch it.
- **The migration timestamp collision in `supabase/migrations/`** (`20260419000000_*` used by two files). Tracked as its own fix PR.
- **Mobile-friendly LO pages, player dropdown rework, BCA payment integration, LO BCA-number entry, inline placeholder handling on Teams settings.** All of these are existing backlog items adjacent to this work and stay separate.
- **Visual regression baseline tests.** R24 captures screenshots for human review. Setting up a baseline-comparison harness (Percy, Playwright snapshot diffs in CI, etc.) is a separate decision.

## Key Decisions

- **Auto-with-override viewport detection (R4).** Keeps ~39+ call sites simple while preserving an escape hatch for profile pages and similar exceptions.
- **One popover, not two (R7-R9).** DRY — the existing identity popover already has the action set we need. Adding a "lite verify" popover would mean two components to maintain and ambiguity about which to use when.
- **Badges in the identity popover, not per-badge tooltips (R13).** Single discovery path. Reduces interaction surface on mobile.
- **One `<PlayerBadge>` component config-driven, not per-type files (R10).** DRY. Adding LO/S in the follow-up branch is a one-line config addition.
- **PP + Captain only in this branch (R10, Scope Boundaries).** LO and S are net-new product features; bundling them with the display-normalization migration was scope creep. They will use the same `<PlayerBadge>` component when they're built.
- **`peers` prop, not `<PlayerNameScope>` context provider (R16-R17).** Simpler API. No new architectural primitive. Only the screens that actually need disambiguation pass the prop.
- **Show #P on collision, not extracted shortening strategies (R16).** The original plan to "request the next strategy in the chain" assumed a callable strategy chain that doesn't exist (the existing `generateNickname` is a single-shot function called only at member creation). Showing the player number is simpler, requires no new infrastructure, and is always unambiguous.
- **Staged cutover for `PlayerNameLink` deletion (R21).** Migration batches land first, then a final delete commit gated on CI verifying zero remaining references. No long-lived deprecation shim, but no atomic-with-last-migration delete either.
- **Long-press is mobile-touch-first; keyboard users use standalone form (R7b).** Inline mode does not have an independent keyboard trigger by design; the standalone `<PlayerName>` is available on profile/roster surfaces for keyboard access to identity details.
- **CI lint rule is the make-or-break (R26).** Without an enforced guardrail, the migration is a one-time cleanup that rots. With it, the "single source of truth" goal holds at the PR level.

## Dependencies / Assumptions

- **`PlaceholderBadge` is in flight in the placeholder-lifecycle branch** (`feat/placeholder-lifecycle-frontend`), not yet on main. **Resolved sequencing:** implementation work on this branch waits for `feat/placeholder-lifecycle-frontend` to merge to main first. Once merged, this branch absorbs `PlaceholderBadge` into the new `<PlayerBadge type="PP">` component during the R20 migration audit. The brainstorm and plan documents can be written before that merge; coding begins after.
- **No callable nickname-shortening pipeline exists.** Verified: `src/utils/nicknameGenerator.ts` exposes `generateNickname(first, last) → string`, called only at creation time. The original R17 design assumed otherwise; the revised R16-R17 above no longer depends on this.
- **Playwright is configured and runnable locally** for R24 screenshots. Verified — added by PR #78. **Caveat:** the current `playwright.config.ts` only configures desktop Chromium; a mobile project (e.g., `devices['Pixel 5']`, or a 360×640 viewport) must be added before R24 / R23 mobile screenshots can run.
- **`organization_staff` is the canonical source of truth for the S badge.** Verified — table exists in the schema. (Not used in this branch; relevant for the LO/S follow-up.)
- **`user_role` enum or equivalent identifies LO-tier (org owner / league operator).** Verified — `user_role` enum includes `league_operator`; org owner is identifiable from `organizations`/`organization_staff` data model. (Not used in this branch; relevant for the LO/S follow-up.)

## Outstanding Questions

### Resolve Before Planning

(None — sequencing decision resolved above in Dependencies. General policy: this branch and others like it wait for upstream branches to merge before implementation begins.)

### Deferred to Planning

- [Affects R26] [Technical] Whether the lint rule is implemented as a custom ESLint rule, a grep-based pre-commit hook, or both. Custom ESLint plays better with editor diagnostics; grep is simpler.
- [Affects R23] [Technical] Exact env-var mechanism for gating the dev catalog page out of production builds (Vite `define`, conditional route mount, etc.).
- [Affects R7a] [Technical] Whether iOS Safari's text-selection suppression (`-webkit-touch-callout: none`) interferes with screen-reader announcement of the inline name. Test with VoiceOver during planning.
- [Affects R20] [Needs research] The actual count of name-rendering sites. The 39 `PlayerNameLink` imports are a floor, not a ceiling; the audit will surface the real number and may reveal that batching needs adjustment.
- [Affects R8a] [Technical] The exact prop shape for `<PlayerIdentityPopover>` after extracting from the 559-line `PlayerNameLink`. The current component owns ~7 useState hooks and ~10 hooks; deciding which become props and which stay internal is a planning task.
- [Affects R17a] [Technical] Whether passing `peers` as a prop causes excessive re-renders in long lists (10-20 players visible at once). Memoization strategy decided in planning.

## Next Steps

`-> /ce:plan` for structured implementation planning. Implementation begins after `feat/placeholder-lifecycle-frontend` merges to main.
