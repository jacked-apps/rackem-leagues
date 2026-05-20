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

## 18. Dark Mode Breaks Date Picker

**Moved from LIST_FOR_ED.md #20 on 2026-05-17** (was always tagged "For Jack")

**Discovered:** 2026-05-04 during unified-scoreboard smoke-testing
**Severity:** Medium (functionally usable but visually broken)

**Symptom:** In dark mode, the date picker is essentially unusable — the day numbers in the calendar grid are invisible against the background. Only a single date (presumably the currently-selected or hovered one) is visible at a time. User can't see which dates are available, weekends, today's marker, etc.

**Suspected cause:** the calendar component's text color likely hardcoded to a light value (or inherits a light theme color) without a dark-mode variant defined. Background-text contrast collapses in dark mode.

**Likely fix surface:** `src/components/ui/calendar.tsx` (the shadcn Calendar primitive) and/or any wrapper component that uses it. Audit the day-cell text color tokens — should use `text-foreground` / `text-muted-foreground` (theme-aware) rather than a hardcoded `text-gray-900` or similar.

**Adjacent dark-mode issue (worth folding into the same pass):** unified scoreboard's player-drawer name colors. Per Ed 2026-05-04 smoke-test: "in dark mode the away team player names in the drawer are invisible. and in light mode the home team is invisible." Same root cause likely — a hardcoded color that doesn't flip per theme.

---

*Last Updated: 2026-05-17*
## 16. Dark Mode — Messaging Composer Input Font Hard to Read

**Discovered:** 2026-05-16 during the Phase 1 messaging end-to-end test pass
**Severity:** Low-Medium — usable but the chat composer's text input
is visually muddy in dark mode (low contrast between the typed text
and the input background). Slows down composing messages.

**Where:** `src/components/messages/MessageInput.tsx` — the `<Input>`
inside the composer (and likely sibling components in the messaging
UI that use the shadcn `Input` with the same class set).

**Likely root cause:** the composer's `Input` uses `bg-card` for the
background but inherits the default text color. In dark mode that
combination yields a near-tone-on-tone result. Either an explicit
`text-foreground` is missing, OR `bg-card` resolves to a value too
close to the foreground in dark mode and the theme token needs a
tweak.

**Fix direction:**
1. Open the Messages page in light mode AND dark mode side-by-side
   to confirm the contrast gap.
2. In `src/components/messages/MessageInput.tsx`, give the `<Input>`
   an explicit foreground color that's high-contrast in both modes
   (shadcn standard is `text-foreground`; verify the theme tokens
   actually produce sufficient contrast).
3. Check other messaging text-input surfaces (the conversation
   search bar, the announcement modal composer, etc.) for the same
   pattern and fix consistently.

**Not blocking** the messaging-system-overhaul branch from merging
— styling polish only.

---

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

## 19. Form-control border tokens too light to see (radio, checkbox, etc.)

**Flagged 2026-05-20 by Ed during next-season wizard testing.** The
radio-button outer circles in the new "Same as last / Change" pickers
are so pale Ed initially thought they weren't there. Same issue
already surfaced multiple times before — there are inline overrides
sprinkled around to work around it (e.g. the Checkbox in
`PlayoffFormatStep.tsx` ships `className="size-5 border-2 border-gray-400"`
to force a visible edge). This is whack-a-mole; a global fix would
prevent it from happening again.

**Where the color comes from:**

- `src/components/ui/radio-group.tsx:28` — `RadioGroupItem` uses
  `border-input` (Tailwind class that resolves to `--color-input`
  from the theme).
- Same `--color-input` token is consumed by Checkbox, Input,
  SelectTrigger, Textarea, etc. Whatever fix lands here ripples to
  every form control.

**Possible fixes (your call):**

1. **Darken `--color-input` globally** (CSS variable in
   `src/index.css` / the theme block). Pros: one knob, fixes every
   form control, kills the inline `border-gray-400` workarounds.
   Cons: also affects dark-mode `--color-input` if you don't pin
   both modes explicitly.
2. **Component-level override** — change `border-input` →
   `border-gray-400` (or a darker semantic token) directly in
   `radio-group.tsx`, `checkbox.tsx`, etc. More surgical, but you
   touch every file and the next new shadcn primitive starts the
   problem again.
3. **New semantic token** like `--color-form-border` that's
   explicitly darker than `--color-input` (which is used for plain
   borders too). Form controls use the new token. Cleanest long
   term but a bigger refactor.

**Repro:** the new gate step on the next-season wizard
(`feat/new-season-from-previous` branch). Click "Start Next Season"
on League 2 → look at the radio circles. They're barely visible.
Same pattern in the start-date picker + season-length picker on
the same branch.

**Not blocking** anything Ed is shipping right now; he's working
around it inline (or just living with it) but flagged for a global
pass once you have a beat.

---

*Last Updated: 2026-05-20*
