# Task List for Jack

## 1. Revamp Navigation Bar
- Review and update the navigation bar design and functionality
- Ensure consistent styling and user experience

## 2. Fix App.tsx Navigation
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

## 4. InfoButton Responsive Positioning
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

---

*Last Updated: 2025-12-18*
