# Placeholder Players Feature Plan

> **Status:** Planning
> **Created:** 2024-12-15
> **Last Updated:** 2024-12-15

## Problem Statement

Currently, for someone to be on a team they must be a registered member (create account, fill out full application). This creates friction because:
- Getting all team members to register is "like herding cats"
- Teams can't fully form until everyone registers
- Captains/operators can't plan lineups with missing players

## Solution Overview

Allow creation of "placeholder players" - real people who haven't registered yet but can:
- Be added to teams
- Appear in lineups
- Have games scored for them
- Accumulate wins/losses and stats

Later, when the real person registers, they claim their placeholder and it becomes their full member record.

## Key Concepts

### What is a Placeholder Player?

A `members` record where:
- `user_id = NULL` (no auth account linked)
- Has minimal required info: first_name, last_name, nickname, city, state
- Other fields (phone, email, address, zip_code, date_of_birth) are NULL
- Has a real `member_id` (UUID) used everywhere in the system

### Why This Works

The system already separates identity concerns:
- **`user_id`** (auth.users) = login/authentication only
- **`member_id`** (members.id) = used for all relationships:
  - `team_players.member_id`
  - `match_games.home_player_id`, `away_player_id`, `winner_player_id`
  - `match_lineups.player1_id` through `player5_id`

A placeholder has a valid `member_id`, so it works everywhere. It just can't log in.

### Connecting Placeholders to Real Users

Three methods - two invite flows (same token system) plus operator fallback:

#### Method 1a: Hand-Off Registration (In-Person)

Best for when the player is physically present (league night, bar, etc.):

1. Captain clicks placeholder name → "Register This Player"
2. System generates token tied to that `member_id`
3. Opens minimal registration form (email + password + confirm password only)
4. Captain hands phone to friend
5. Friend fills out just those 3 fields, hands phone back
6. **Captain stays logged in** - their session is unchanged
7. Friend goes to their own device, checks email, clicks confirmation link
8. Confirmation link logs them in on their device + connects to placeholder
9. Friend completes their profile (phone, address, etc.)

**Key insight:** Creating an auth account doesn't log anyone in. The email confirmation link does. So captain's session is never interrupted.

**Benefits:**
- Immediate - no waiting for friend to check a link later
- 30 seconds of hand-off time
- Captain never logs out, friend never sees captain's data

#### Method 1b: Send Invite Link (Remote)

Best for when the player isn't present:

1. Captain clicks placeholder name → "Send Invite Link"
2. System generates token tied to that `member_id`
3. Shows sharing options:
   - Copy link to clipboard
   - Share via SMS/text
   - Share via email
4. Captain sends link to friend
5. Friend opens link on their device → `/register?token=abc123`
6. Link shows: "You're registering as [Name] on [Team Name]"
7. Friend completes full registration on their device
8. Email confirmation, profile completion, done

**Benefits:**
- Works when player isn't physically present
- Player does entire flow on their own device
- Captain just initiates and shares

#### Method 2: Operator Manual Merge (Fallback)

If someone registers without an invite (normal registration) and needs to be connected:

1. Player registers normally (creates new member record)
2. Player or captain contacts league operator
3. Operator verifies identity (they know the players personally)
4. Operator uses admin tool to merge placeholder → registered member
5. All `member_id` references updated, placeholder archived

**Important:** Only league operators can perform manual merges. No self-service claiming.

**Why no self-service:**
- Security - prevents false claims
- Operators are trusted authority who know players personally
- Simpler system - no complex verification/wizard needed

---

## Database Changes

### Members Table Modifications

Make the following fields nullable:
```sql
ALTER TABLE members ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE members ALTER COLUMN email DROP NOT NULL;
ALTER TABLE members ALTER COLUMN address DROP NOT NULL;
ALTER TABLE members ALTER COLUMN zip_code DROP NOT NULL;
ALTER TABLE members ALTER COLUMN date_of_birth DROP NOT NULL;
```

**Note:** `city` and `state` remain NOT NULL (needed for placeholder matching).

### Optional: Add Helper Column

```sql
-- Makes querying placeholders easier
ALTER TABLE members ADD COLUMN is_placeholder BOOLEAN
  GENERATED ALWAYS AS (user_id IS NULL) STORED;

CREATE INDEX idx_members_placeholder ON members(is_placeholder) WHERE is_placeholder = TRUE;
```

**Alternative:** Just use `WHERE user_id IS NULL` in queries.

### Registration Invite Tokens Table

```sql
CREATE TABLE registration_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,  -- The unique token in the URL
  placeholder_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_by_member_id UUID NOT NULL REFERENCES members(id),  -- Captain/operator who created it
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- Token expiration
  used_at TIMESTAMP WITH TIME ZONE,  -- When token was used (NULL if unused)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_registration_tokens_token ON registration_tokens(token);
CREATE INDEX idx_registration_tokens_placeholder ON registration_tokens(placeholder_member_id);
```

**Token behavior:**
- Generated when captain/operator clicks "Invite to Register"
- Expires after X days (7? 30? TBD)
- Marked as `used_at` when registration completes
- Can regenerate new token if old one expires
- One active token per placeholder at a time? Or allow multiple?

### RLS Policy Updates

Current policies may need adjustment:
- Placeholders have no `user_id`, so "users can view their own records" won't apply
- Need policy for operators/captains to view/edit placeholders in their leagues
- Need policy for registration flow to claim unclaimed placeholders

---

## UI Components Needed

### 1. Placeholder Creation Form

**Location:** Team management / roster editing
**Access:** League operators, team captains
**Fields:**
- First Name (required)
- Last Name (required)
- Nickname (required - auto-generate if blank using existing function)
- City (required)
- State (required - dropdown)

**Behavior:**
- Creates member with `user_id = NULL`
- Immediately available for team assignment
- Shows visual indicator that this is a placeholder

### 2. Placeholder Player Display

Throughout the app, placeholder players should be visually distinguished:
- Badge/icon indicating "Not Registered" or "Placeholder"
- Possibly different color or styling
- Tooltip explaining they haven't created an account yet

**Locations to update:**
- Team roster views
- Lineup selectors
- Match/game results
- Player search/comboboxes
- Stats pages

### 3. Registration Invite Flow

**PlayerNameLink enhancement:**
- Detect if player is a placeholder (`user_id IS NULL`)
- Show two options in popover:
  - "Register This Player" (hand-off flow)
  - "Send Invite Link" (remote flow)

**Hand-Off Flow (in-person):**
- Opens modal with minimal form: email, password, confirm password
- On submit: creates auth account, generates token, sends confirmation email
- Captain's session unchanged
- Confirmation email link includes token
- When friend clicks email link → logs them in + connects to placeholder

**Send Invite Link Flow (remote):**
- Generates token, shows share modal:
  - Copyable link
  - "Share via SMS" button (uses native share on mobile)
  - "Share via Email" button
- Link format: `https://app.com/register?token=abc123`

**Registration with token (from link):**
- URL: `/register?token=abc123`
- Validate token exists, not expired, not used
- Show placeholder info: "You're registering as [Name] on [Team]"
- Normal auth flow (create account)
- On email confirmation: attach `user_id` to placeholder, mark token used
- Redirect to profile completion (fill missing fields)

**Registration without token:**
- Normal flow - creates new member record
- If they need to connect to placeholder later → contact operator

---

## Operator Tools

### Placeholder Management

Operators need ability to:
- View all placeholders in their league(s)
- Edit placeholder info
- Delete unused placeholders
- See pending invite tokens (who was invited, when, expired?)

### Manual Merge Tool (Operator Only)

When a player registers without using an invite link and needs to be connected:

**UI Flow:**
1. Operator selects the placeholder member
2. Operator searches for the registered member to merge into
3. System shows preview: "This will transfer X team assignments, Y games to [Registered Member]"
4. Operator confirms
5. System updates all `member_id` references
6. Placeholder marked as merged/archived (soft delete)

**What gets transferred:**
- `team_players` records
- `match_games` (home_player_id, away_player_id, winner_player_id)
- `match_lineups` (player1_id through player5_id)
- Any other tables referencing the placeholder

### Reporting

- List of placeholders by team
- Placeholders with pending invites vs no invite sent
- Placeholders with most games played (priority for recruitment)
- Recently connected placeholders

---

## Edge Cases & Questions

### Multiple Placeholders for Same Person

**Scenario:** John Smith plays in two different leagues, both operators create placeholders for him.

**Options:**
1. Allow multiple - user claims one, other stays placeholder
2. Detect duplicates during creation (by name + city/state)
3. Allow claiming multiple during registration

**Decision needed:** TBD

### Placeholder Created, Real Member Already Exists

**Scenario:** Captain creates placeholder for "Jane Doe" not knowing she already registered.

**Options:**
1. Prevent - search for existing members before allowing placeholder creation
2. Allow - operator can merge later
3. Warn - show potential matches, let captain choose

**Recommendation:** Option 3 - warn during creation

### Unclaimed Placeholders

**Scenario:** Placeholder created but person never registers.

**Options:**
1. Keep forever
2. Auto-archive after X time
3. Operator manually cleans up

**Decision needed:** TBD

### Handicap/Skill Level for Placeholders

**Question:** Can placeholders have handicaps assigned?

**Answer:** Yes - they're regular members, can have `starting_handicap_3v3`, `starting_handicap_5v5`, and `skill_level` on `team_players`.

---

## Implementation Phases

### Phase 1: Database Foundation
- [ ] Migration to make fields nullable (phone, email, address, zip_code, date_of_birth)
- [ ] Create `registration_tokens` table
- [ ] Update TypeScript types
- [ ] Update any validation that requires these fields
- [ ] Test that existing flows still work

### Phase 2: Placeholder Creation
- [ ] Create placeholder creation form component
- [ ] Add to team management UI (for captains/operators)
- [ ] Implement auto-nickname generation for placeholders
- [ ] Add placeholder visual indicators throughout app

### Phase 3: Display Updates
- [ ] Update `PlayerNameLink` to detect placeholders
- [ ] Add "Invite to Register" button for placeholders
- [ ] Update player search/comboboxes to show placeholder badge
- [ ] Update team rosters to indicate placeholder status
- [ ] Update lineup selectors
- [ ] Update stats displays

### Phase 4: Registration Invite Flow
- [ ] Generate token API endpoint
- [ ] **Hand-off flow:**
  - [ ] Modal with minimal registration form (email + passwords)
  - [ ] Create auth account without logging in
  - [ ] Send confirmation email with token
  - [ ] Email confirmation connects placeholder
- [ ] **Send link flow:**
  - [ ] Share modal with copy/SMS/email options
  - [ ] Native share integration for mobile
- [ ] **Token-based registration page:**
  - [ ] Detect and validate token from URL
  - [ ] Show placeholder context ("Registering as X on Team Y")
  - [ ] Full registration form
- [ ] **Email confirmation handling:**
  - [ ] Attach `user_id` to placeholder on confirmation
  - [ ] Mark token as used
  - [ ] Redirect to profile completion for missing fields

### Phase 5: Operator Tools
- [ ] Placeholder management view (list, edit, delete)
- [ ] Pending invites view
- [ ] Manual merge tool UI
- [ ] Merge preview (show affected records)
- [ ] Merge execution (update all references)
- [ ] Reporting/analytics

---

## Open Questions

1. **Token expiration** - How long should invite tokens be valid? 7 days? 30 days? Never expire?

2. **Multiple tokens** - Allow multiple active tokens per placeholder, or one at a time?

3. **Multiple league scenario** - How to handle same person as placeholder in multiple leagues? Each league's operator/captain sends their own invite?

4. **Existing member detection** - How aggressive should we be about preventing duplicate placeholders during creation? Warn if similar name exists?

5. **Cleanup policy** - What happens to unclaimed placeholders long-term? Auto-archive after season ends?

6. **Mobile app impact** - Does the React Native app need any changes? (Probably minimal since it's mostly score-keeping)

7. **Who can send invites?** - Captains and operators? Or operators only?

---

## Related Files

- [database/members.sql](../database/members.sql) - Members table schema
- [database/scoring3x3/create_substitute_members.sql](../database/scoring3x3/create_substitute_members.sql) - Existing substitute pattern
- [src/utils/lineup/substituteHelpers.ts](../src/utils/lineup/substituteHelpers.ts) - Substitute helpers (different concept)
- [src/newPlayer/NewPlayerForm.tsx](../src/newPlayer/NewPlayerForm.tsx) - Current registration form

---

## Notes

- This is different from the "substitute" system which uses fixed UUIDs for anonymous subs
- Placeholders are real, named individuals who just haven't registered
- The key insight is upgrading the placeholder in-place rather than merging two records
