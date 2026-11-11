# Placeholder Players Feature Branch

## Overview

This branch implements **Placeholder Players (PP)** - member records that represent real people who haven't registered yet. League operators and captains can add these players to teams, track their stats, wins, and match history without requiring a registered user account.

## Core Concept

- **Placeholder Player**: A member record with `user_id = NULL`
- Players can be on teams, play matches, accumulate stats - all without being registered
- Only league operators can remove placeholder players from teams
- When clicking a PP's name, the menu shows "Unregistered" badge and "Register Player" option

## Registration Methods

### 1. Device Handoff
Captain hands their device to the player for in-person registration:
1. Captain clicks "Register Player" → opens `RegisterPlayerModal`
2. Player enters email + password (twice) on captain's device
3. `supabase.auth.signUp()` creates auth account (does NOT log anyone in)
4. New `user_id` is immediately written to the placeholder's member record
5. Player confirms email later on their own device

### 2. Link / QR Code
Player registers remotely via shared link or QR scan:
1. Link format: `/register?claim={memberId}`
2. `Register.tsx` detects the `claim` parameter
3. Shows "Claiming profile for: {name}" banner
4. On registration, links `user_id` to placeholder member record
5. OAuth and "Already have account?" links are hidden in claim mode

## Key Files

### Components
| File | Purpose |
|------|---------|
| `src/components/RegisterPlayerModal.tsx` | Modal with 3 registration options (handoff, link, QR) |
| `src/components/CreatePlaceholderModal.tsx` | Form to create new placeholder players |
| `src/components/PlayerNameLink.tsx` | Shows "Unregistered" badge, "Register Player" menu item |
| `src/components/MemberCombobox.tsx` | Updated with `preventClearPlaceholders` prop |
| `src/login/Register.tsx` | Modified to handle `?claim={memberId}` flow |

### API Layer
| File | Purpose |
|------|---------|
| `src/api/mutations/members.ts` | `createPlaceholderMember()` function |
| `src/api/queries/members.ts` | Member queries (unchanged but relevant) |

### Types
| File | Purpose |
|------|---------|
| `src/types/member.ts` | `isPlaceholderMember()` helper, `PartialMember` type |

### Database
| File | Purpose |
|------|---------|
| `supabase/migrations/20251215165551_allow_nullable_member_fields.sql` | Makes member fields nullable for placeholders |

## Key Functions

### `RegisterPlayerModal.tsx`
- `handleHandoffSubmit()` - Creates auth account, links user_id to member
- `handleCopyLink()` - Copies registration link to clipboard
- `getEnvironment()` - Detects local/staging/production for warnings

### `Register.tsx`
- `useEffect` with `claimId` - Fetches and validates placeholder data
- `handleRegister()` - Modified to link user_id when `claimData?.isValid`

### `src/types/member.ts`
- `isPlaceholderMember(member)` - Returns true if `user_id === null`

## Edge Cases (Deferred to Future Branch)

1. **Already logged in user clicks claim link** - Need to show message or handle merge
2. **Member merge requests** - When registered user wants to claim a placeholder with existing data
3. **Race condition** - Two people try to claim same placeholder simultaneously
4. **UI refresh** - Optimistic update after successful registration

## Database Schema Note

Placeholder players have:
- `user_id = NULL` (key identifier)
- `first_name`, `last_name` required
- `email`, `phone`, etc. can be NULL until claimed

## Testing Notes

- Device handoff works in local dev (tested)
- Link/QR requires staging/production (localhost links don't work on other devices)
- To manually confirm email in local Supabase:
  ```sql
  UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = '{user_id}';
  ```

---

## TODO: PP Manual Merge & Registration Flow

This TODO list covers the remaining work for this branch: detecting when a registering user might be a placeholder player, and allowing merge requests.

### Phase 1: Public Home Page
- [x] **1.1** Redesign `/` (Home.tsx) to show public content
  - Simple landing page with app description
  - "Browse Leagues" link (can be placeholder for now)
  - "Sign Up" and "Login" CTAs
  - Logged-in users redirect to `/dashboard`

### Phase 2: Short Registration Form
- [x] **2.1** Create new short profile form (`/complete-profile`)
  - Fields: First Name, Last Name, Nickname, City, State
  - Migration: `20251216140000_allow_nullable_member_fields.sql`
  - Schema: `src/schemas/shortProfileSchema.ts`
  - Component: `src/profile/complete/CompleteProfileForm.tsx`
  - ProtectedRoute now redirects to `/complete-profile`
- [ ] **2.2** Add "Are you already on a team in our system?" (Yes/No) question
- [ ] **2.3** If "Yes" → trigger PP detection flow

### Phase 3: PP Detection During Registration
- [ ] **3.1** Run fuzzy search using `searchPlaceholderMatches()` (already built)
- [ ] **3.2** Show matching candidates as cards for user to confirm
  - Display: Name, City/State, System Number (P-#####)
  - "That's me" button → creates merge request
  - "None of these" → continue with fresh registration
- [ ] **3.3** Add "Know your player number?" fallback input
  - Uses `lookupPlaceholderBySystemNumber()` (already built)
  - Direct lookup if fuzzy search fails

### Phase 4: Merge Request Creation
- [ ] **4.1** Create TypeScript types for `MergeRequest`
- [ ] **4.2** Create mutation: `createMergeRequest()`
- [ ] **4.3** After merge request created, show confirmation message
  - "Request sent to league operator for approval"
  - User still gets a member record (fresh) and can use the app
  - Merge happens later when LO approves

### Phase 5: LO Merge Request Management (Future)
- [ ] **5.1** Add "Pending Merge Requests" section to LO dashboard
- [ ] **5.2** Create merge request review UI
- [ ] **5.3** Implement actual merge logic (transfer data, delete duplicate)

### Completed Items
- [x] Database migration for fuzzy matching extensions (fuzzystrmatch, pg_trgm)
- [x] `search_placeholder_matches()` Postgres function
- [x] `lookup_placeholder_by_system_number()` Postgres function
- [x] TypeScript queries: `searchPlaceholderMatches()`, `lookupPlaceholderBySystemNumber()`
- [x] `merge_requests` table schema
- [x] RLS policies documented (not yet applied)
- [x] Performance indexes for fuzzy search
