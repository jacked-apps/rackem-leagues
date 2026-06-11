# Task List for Jack

## ~~1. Revamp Navigation Bar~~ ✅ CLOSED 2026-05-17 (Jack shipped)

> **Closed 2026-05-17** — Jack already revamped the navigation bar. Original entry preserved below.

### Original entry
- Review and update the navigation bar design and functionality
- Ensure consistent styling and user experience

## ~~2. Fix App.tsx Navigation~~ ✅ CLOSED 2026-05-17 (Jack shipped — landed with #1)

> **Closed 2026-05-17** — same rework that closed #1 also cleaned up the App.tsx navigation issues. Original entry preserved below.

### Original entry
- Remove or properly implement the commented-out `NavigationWrapper` component in `src/App.tsx`
- Clean up unused imports: `useLocation`, `NavBar`, `OperatorNavBar`
- This is causing TypeScript errors for unused declarations

## 3. Type System Architecture Review
- **Issue**: Over-abstraction with Pick<> types for single-record fetches
- **Context**: Using `Pick<Member, 'id' | 'name' | ...>` for individual member queries adds maintenance overhead without performance benefit
- **Question**: Should we grab full records (`select *`) for single-entity fetches and only use selective fetching for list queries where it matters?
- **Trade-off**: Simplicity vs explicit dependencies. At current scale, simplicity likely wins.
- **Files affected**: Message components (MemberForMessaging), various single-entity hooks
- **Decision needed**: Establish pattern for when to use selective vs full fetching

## ~~4. InfoButton Responsive Positioning~~ ✅ CLOSED 2026-05-17 (universal fix already in InfoButton.tsx, PR #67)

> **Closed 2026-05-17** — `src/components/InfoButton.tsx` already has the
> universal viewport-clamping fix this entry asked for, landed in PR #67
> ("Wizard 2.0", commit `2c1bf8a`). Specifically:
>
> - `position: fixed` so the popup escapes any parent container's clipping
> - `useLayoutEffect` measures the popup AFTER mount, clamps `left` so the
>   popup never spills off either viewport edge (`VIEWPORT_MARGIN = 8`)
> - Auto-flips above the button when there's not enough room below
> - Recomputes on resize/scroll while open
> - Honors `align="left"|"right"|"center"` as a preference hint, but the
>   clamp still runs AFTER and pulls the popup back if the hint would
>   spill off-screen
>
> Two `align="right"` usages exist (`PlayerManagement.tsx:244`,
> `SelectableCard.tsx:67`) — leftover hints from before the universal
> fix landed. Harmless (the clamp runs after the hint), could be
> cleaned up sometime but no bug.
>
> One known edge case not covered by the clamp: if the InfoButton lives
> inside a CSS-transformed/scaled/animated ancestor, `position: fixed`
> becomes relative to that ancestor instead of the viewport, and the
> math can be off. Fix when actually needed: render the popup through
> a React portal (5-line change). Not adding preemptively per Ed
> (2026-05-17) — "if there is a fix then close it."
>
> Original entry preserved below for reference.

### Original entry
- **Issue**: InfoButton popups get cut off on small screens
- **Context**: The popup positioning logic in `/src/components/InfoButton.tsx` needs improvement for mobile
- **Problem**: On narrow screens, the popup can extend beyond viewport edges, causing horizontal scrolling or cut-off content
- **Solution needed**:
  - Make popups stay fully within viewport at all screen widths
  - At small widths, consider full-width or anchored-to-edge positioning
  - At larger widths, keep centered positioning
  - Prevent any content cutoff regardless of screen size
- **File**: `/src/components/InfoButton.tsx`

## 5. Add RLS Policies Before Production
- **CRITICAL**: Database currently has NO Row Level Security policies enabled
- **Risk**: Any authenticated user can access/modify any data
- **Tables affected**:
  - `organizations` - No RLS policies
  - `organization_staff` - No RLS policies
  - All other tables need review
- **Action needed**:
  - Add RLS policies to `organizations` table (staff can only see their orgs)
  - Add RLS policies to `organization_staff` table (staff management permissions)
  - Review all existing tables for proper RLS implementation
  - Test RLS policies thoroughly before production deployment
- **Status**: RLS intentionally disabled during development/testing
- **Priority**: MUST be completed before any production deployment

## 6. Remove .env from Git History
- **Issue**: `.env` file was previously committed to git before being added to `.gitignore`
- **Risk**: Secrets remain in git history even after adding to `.gitignore`
- **Action needed**:
  ```bash
  git rm --cached .env
  git commit -m "Remove .env from tracking"
  ```
- **Note**: This removes the file from git without deleting it locally
- **Priority**: Should be done before pushing to any public/shared repository

## 12. MemberCombobox Invite Status Badge Integration
- **Context**: When operators edit teams, placeholder players (PPs) with pending/expired invites should show a status badge
- **Current State**: Badge floats outside the combobox (between combobox and X clear button), looks awkward
- **Problem**: MemberCombobox has internal layout with combobox + clear button, no slot for badge between them
- **Desired Behavior**: Badge should appear inline with the selected value, between the name and the clear X button
- **Options**:
  1. Add a `suffix` prop to MemberCombobox to render content between combobox and clear button
  2. Modify the trigger button to accept a badge element after the selected name
  3. Show badge inside the combobox trigger (after selected member name, before chevron)
- **Files involved**:
  - `src/components/MemberCombobox.tsx` - needs suffix slot or trigger modification
  - `src/operator/TeamEditorModal.tsx` - passes badge to combobox
  - `src/components/InviteStatusBadge.tsx` - existing badge component
- **Note**: Captain view already works well (static row with PlayerNameLink + Badge + Manage button)
- **Priority**: Low - visual polish only

## 13. League Creation Wizard Step 4 - Radio Choice Styling
- **Issue**: Selected radio button choice div is too busy and congested
- **Context**: Step 4 "What team format will this league use?" has two choices (5-Man and 8-Man)
- **Problem**: When a choice is selected, the expanded card with description becomes visually cluttered
- **File**: `/src/components/forms/SimpleRadioChoice.tsx` (lines 91-149 handle selected state)
- **Design Request**: Refine the look of the selected choice cards to be cleaner and less congested
- **Priority**: Low - visual polish

## 14. Complete Profile Page - Info Button Refinement
- **Issue**: Info button on the "Complete Your Profile" page needs refinement
- **Context**: Nickname field has an info button that shows explanation of how nicknames work
- **File**: `/src/completeProfile/CompleteProfileForm.tsx` uses `nicknameInfo` from `/src/constants/infoContent/profileInfoContent.tsx`
- **Request**: Review the info button styling/placement and make it look cleaner
- **Priority**: Low - visual polish

## 15. League Creation Wizard - Overall UX Refinement
- **Issue**: Several UI/UX elements feel wonky and could use refinement
- **Cancel/Clear Form redundancy**:
  - "Cancel" button appears in the navigation buttons at each step (bottom of wizard)
  - "Clear Form" link appears at the top of the page in the header
  - Both essentially do the same thing (abandon wizard progress)
  - Cancel: Shows confirmation dialog, clears localStorage, navigates to operator dashboard
  - Clear Form: Shows confirmation dialog, clears localStorage, reloads the page
  - **Request**: Decide on the best UX approach - keep one, combine them, or redesign how users exit the wizard
- **General UI polish**: Some elements look a little wonky - walk through the wizard and refine as needed
- **Files**:
  - `/src/operator/LeagueCreationWizard.tsx` (main wizard component)
  - `/src/components/forms/RadioChoiceStep.tsx` (renders Cancel button)
  - `/src/components/forms/SimpleRadioChoice.tsx` (choice cards)
  - `/src/components/forms/QuestionStep.tsx` (input steps)
- **Priority**: Low - UX polish

## 11. Navbar Invite Indicator
- **Context**: When navbar is implemented, add an invite notification indicator
- **Design**: Similar to messages - icon with badge showing count of pending invites
- **Functionality**:
  - Shows number of pending (unclaimed) invites for the logged-in user
  - Clicking opens dropdown with list of pending invites
  - Each invite shows: Team name, Captain name, "Claim" button
  - Expired invites show "Ask captain to resend" message
- **Backend ready**: `get_my_pending_invites()` function returns pending/expired invites
- **Integration**: When user claims, badge count decrements
- **Related**: Pairs with login modal notification (implemented separately)

## 18. Dark Mode — Hardcoded-Color Readability Audit (ONE pass, multiple surfaces)

**Surfaced piecemeal 2026-05-04 → 2026-06-07 (Ed, across smoke tests). Consolidated 2026-06-07** — these are all the SAME root cause, so fix them in one sweep rather than one-off items.

**Severity:** Low/Medium — each is functional but visually broken / unreadable in dark mode.

**Shared root cause:** components use hardcoded light values (e.g. `text-gray-900`, a light bg) or inherit a light color with no dark variant, so text/background contrast collapses in dark mode. **Fix = switch to theme-aware tokens** (`text-foreground` / `text-muted-foreground` / `bg-card` / `bg-muted`) and verify contrast in BOTH modes. Many of these likely share a couple of primitives (Calendar, Input, Dialog, Badge) — fixing the primitive may knock out several at once.

**Surfaces to audit + fix (open each in light + dark side-by-side):**
- **Calendar / date picker** — day numbers invisible in dark; only the selected date shows. `src/components/ui/calendar.tsx` (shadcn Calendar) + any wrapper.
- **Unified scoreboard player drawer** — away-team names invisible in dark, home-team invisible in light (Ed 2026-05-04). Hardcoded per-side name color that doesn't flip per theme.
- **Messaging composer input** — typed text muddy / low-contrast in dark. `src/components/messages/MessageInput.tsx` `<Input>` + sibling inputs (conversation search, announcement composer).
- **Scoring confirm/vacate modal** — text/contrast collapses in dark. `src/components/scoring/ConfirmationDialog.tsx` + the dialog primitives it uses.
- **Manage Players placeholder dropdown** — placeholder entries unreadable in dark. `src/components/PlayerCombobox.tsx` + `src/components/PlaceholderBadge.tsx`. (Player pickers are being consolidated on `fix/player-picker-smarter` — coordinate; may get swept up there.)

**Going forward:** add any new dark-mode readability bug to THIS list, not a new item.

---

*Last Updated: 2026-06-07*

## 17. PageHeader — Profile-Avatar Position Inconsistent Across Pages

**Discovered:** 2026-05-16 during the Phase 1 messaging end-to-end
test pass, after `2d562b0` adjusted PageHeader to fix the empty-
stripe bug on `/messages`.
**Severity:** Low — purely visual / consistency concern, no
functional break.

**Where:** `src/components/PageHeader.tsx`.

**The inconsistency:** the profile-circle avatar position now
depends on which page you're looking at:

- Pages that pass `subtitle`, `organizationId`, or `children` to
  PageHeader (Dashboard, most operator pages) → avatar renders
  **below** the sticky bar (in the `SubHeader` row, right-aligned).
- Pages that pass only `title` (`/messages` and similar) → avatar
  now renders **inside** the sticky bar (right of the title, before
  the hamburger).

The reason for the split: pages with no SubHeader content had an
empty vertical stripe under the sticky bar containing just the
floating avatar — visually ugly especially on `/messages` which
uses `h-screen overflow-hidden` (no scroll to absorb it). The fix
in commit `2d562b0` moved the avatar into the sticky bar in that
case. Solves the empty-stripe bug but creates the inconsistency
you're now seeing.

**Design call for Jack:** pick ONE of the following and apply
consistently:

1. **Always in sticky bar.** Simpler. Avatar visible at all times
   (doesn't scroll away). Matches chat-app / iMessage convention.
   Cost: drop the IdentitySlot from SubHeader; remove the
   `hasSubHeaderLeftContent` branch in PageHeader. Pages that
   currently have avatar in SubHeader will move the avatar up.
2. **Always in SubHeader.** Avatar scrolls away with content,
   reclaims sticky-bar real estate. Matches the original PageHeader
   intent. Cost: need a different fix for the empty-stripe bug —
   either pass a real subtitle on every page (chore) or change the
   SubHeader to render at 0-height when its left side is empty so
   the floating-avatar stripe doesn't look wasted.
3. **Hybrid (current).** Avatar goes where it best fits per-page.
   Accept the inconsistency as a design feature. Document the rule
   in a comment so future maintainers don't "fix" it by accident.

My intuition leans toward option 1 (always in sticky bar) since
the chat-app norm is to have the user's identity always reachable
without scrolling, and the SubHeader's "scrolls away to reclaim
height" payoff is small on most pages anyway. But this is your
call — UX design isn't my strength.

**Not blocking** messaging-system-overhaul branch from merging.
The current behavior is a clear improvement over the pre-fix state
(empty stripe gone on `/messages`); the inconsistency is a
follow-on polish.

---

## 19. Scoring Screen — No Theme Toggle (dark-mode escape hatch)

**Discovered:** 2026-05-25 during live-scoring resilience testing (Ed)
**Severity:** Low — mainly a workaround gap until the dark-mode color audit
(#18) lands; the modal-color half of this item folded into #18.

`src/player/ScoreMatch.tsx` renders a custom full-screen scoring layout with
its own header (back / team name / auto-confirm) and does NOT surface the app's
theme toggle. A scorer stuck in dark mode can't flip to light to dodge
readability issues without leaving the match. **Once #18 makes the scoring
surfaces fully theme-aware this is moot;** until then, consider exposing the
toggle on the scoring screen.

---

*Last Updated: 2026-06-07*
