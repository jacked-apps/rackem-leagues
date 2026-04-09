# Database Schema Design

> ## ⚠️ CRITICAL CASCADE WARNING — TEAM DELETION
>
> The `matches` table has `ON DELETE CASCADE` on both `home_team_id` and
> `away_team_id`. **Deleting a team row destroys all of that team's matches**,
> which can break other teams' weekly schedules and orphan season standings.
>
> Until a real fix lands, code that deletes teams must:
> 1. Show an honest confirmation warning that mentions match destruction
> 2. Reference the TODO in `src/operator/TeamManagement.tsx` → `handleDeleteTeam`
> 3. See `memory-bank/edsPlan.md` → "CRITICAL: Team Deletion Cascade Issue" for
>    the full context and possible fixes
>
> **Discovered:** 2026-04-09 during wizard 2.0 planning.

---

## Database File Organization Pattern

### File Structure
All database schema files follow this pattern for version control and migrations:

```
database/
├── [table]_complete.sql          ← Current production-ready schema (source of truth)
├── [table]_unfinished.sql        ← Original schema (archived for reference)
├── [table]_unfinished_update1.sql ← Migration step 1 (ALTER TABLE commands)
├── [table]_unfinished_update2.sql ← Migration step 2 (if needed)
└── rebuild_all_tables.sql        ← Uses all *_complete.sql files
```

### Benefits
- ✅ **Clear progression**: Can see schema evolution over time
- ✅ **Rollback capability**: If update breaks, previous version available
- ✅ **Production-ready**: `*_complete.sql` always has latest working schema
- ✅ **Safe testing**: Test migrations on copy database first
- ✅ **Documentation**: Each update file shows what changed and why
- ✅ **Flexible updates**: Make subtle database changes without full rebuild

### Usage
1. **Development (full rebuild)**: Run `rebuild_all_tables.sql` - uses all `*_complete.sql` files
2. **Production (incremental updates)**: Run `[table]_unfinished_updateN.sql` files in order
3. **New schema changes**: Create new `_updateN.sql` file, update `_complete.sql`, update `rebuild_all_tables.sql`

### Example: Matches Table Migration
```
database/
├── matches_complete.sql          ← Uses round_number (latest schema)
├── matches_unfinished.sql        ← Uses season_week_id (old schema)
├── matches_unfinished_update1.sql ← ALTER TABLE to add round_number, drop season_week_id
└── rebuild_all_tables.sql        ← Includes matches_complete.sql schema inline
```

---

## Core Business Model

### Key Principles

1. **Roles are NOT mutually exclusive**
   - Players can become operators (and stay players)
   - Operators typically play in their own leagues
   - Current `member.role` field works: 'player' | 'league_operator' | 'developer'
   - Everyone with login can be a player
   - Only operators can create leagues
   - Role determines access, not identity

2. **League Lifecycle**
   - Leagues are ongoing concepts (e.g., "Tuesday 8-Ball League")
   - Seasons are specific time periods within a league (e.g., "Spring 2025")
   - When an operator quits, their league ends (or completes paid season)
   - New operators create NEW leagues, they don't take over existing ones

3. **Venue Model**
   - Venues are shared resources (pool halls)
   - Multiple operators can run different leagues at same venue
   - Teams choose "home venue" - home games played there
   - Away teams travel to home team's venue
   - Traveling leagues supported: one league can use multiple venues
   - Venue assignment is at TEAM level, not league level

4. **Player Participation**
   - Players attach to SEASONS, not leagues
   - Players can skip seasons
   - Players can play in multiple leagues/operators simultaneously
   - Participation is season-specific

## Entity Hierarchy

```
members (user accounts)
  └─→ league_operators (if member.role includes 'league_operator')
        └─→ leagues (ongoing league concept)
              └─→ seasons (specific time period with teams/schedule)
                    ├─→ teams (compete in this season)
                    │     ├─→ players (roster for this season)
                    │     └─→ home_venue (where home games played)
                    └─→ matches (scheduled games)
                          └─→ venue (where this match played)

venues (pool halls - independent entities)
  └─→ can host many leagues/teams/matches
```

## Table Structure (Planned)

### 1. league_operators
**Purpose**: Operator business profile and contact information

**Relationship**:
- One-to-one with members (member_id foreign key)
- One member can only have one operator profile
- UNIQUE constraint on member_id enforces this

**Key Fields**:
- `member_id` → links to members table
- Organization info (name, address copied from profile at creation time)
- Contact info (email, phone with privacy/visibility settings)
- Payment info (Stripe customer ID, payment method ID, card details)
- Timestamps

**Important Design Decisions**:

1. **Address is Administrative Only**
   - Players never see operator address
   - Only visible to: system admins, BCA officials, legal/tax purposes
   - Copied from member profile at operator application time (snapshot)
   - If member address changes later, operator address stays as-is
   - Can be updated separately in operator profile settings

2. **Email/Phone are League Contact Info**
   - These are PUBLIC league contact methods (with privacy controls)
   - Separate from member profile (operator may want different contact info for leagues)
   - Visibility settings control who can see them (in_app_only, my_teams, anyone, etc.)
   - All required fields (operator must provide contact info)

3. **Profile Change Reminders**
   - When member updates phone/email in profile, system checks if they're an operator
   - Shows reminder: "Update operator profile too?"
   - Links to operator profile settings
   - Allows keeping them separate if desired

4. **Payment Required**
   - All payment fields required (cannot become operator without payment method)
   - Uses Stripe customer ID and payment method ID
   - For testing: mock payment generator creates realistic-looking IDs

**Database Behavior**:
- When operator profile created, `members.role` updated to 'league_operator'
- If member deleted, operator profile cascades (ON DELETE CASCADE)
- Address/email/phone are all separate fields (no "use profile" flags)
- Application UI pre-fills from member profile, but stores independently

### 2. venues
**Purpose**: Pool hall information (public, shared resource)

**Relationship**:
- Independent entity (not owned by operators)
- Referenced by teams (home_venue_id)
- Referenced by matches (venue_id)
- Can host multiple leagues from different operators

**Key Fields**:
- Business information (name, address, phone, website - all public)
- Pool hall details (number_of_tables, table_sizes, business_hours)
- Status (is_active)
- Timestamps

**Notes**:
- All venue info is public (no privacy controls)
- Transferable between operators (no ownership concept)
- Future: venue permission/approval system for operators

### 3. leagues
**Purpose**: Ongoing league concept (e.g., "Tuesday 8-Ball at Sam's")

**Relationship**:
- Owned by operator (operator_id foreign key)
- Has many seasons
- League defines format, not specific venues

**Key Fields**:
- `operator_id` → who runs this league
- League identity (game_type, day_of_week, qualifier)
- Team format (5_man | 8_man)
- Handicap system (custom_5man | bca_standard)
- All the formatted league names (systematic, player-friendly, operator, full display)
- Status (active, completed, abandoned)
- Timestamps

**Notes**:
- League is the "brand" or "concept"
- Specific scheduling happens in seasons
- If operator deleted, what happens to leagues? (To be decided)

### 4. seasons
**Purpose**: Specific competition period within a league

**Relationship**:
- Belongs to one league (league_id foreign key)
- Has many teams
- Has many matches
- Defines the actual schedule and venues used

**Key Fields**:
- `league_id` → which league this season belongs to
- Season info (start_date, end_date, season_length_weeks)
- Tournament dates (BCA nationals, APA nationals - to avoid scheduling conflicts)
- Playoff config (playoff_start_week, playoff_format)
- Status (registration, active, playoffs, completed)
- Timestamps

**Notes**:
- This is where actual competition happens
- Teams register for seasons, not leagues
- Schedule generated at season level

### 5. teams
**Purpose**: Roster of players competing in a specific season

**Relationship**:
- Belongs to one season (season_id foreign key)
- Has one home venue (home_venue_id foreign key)
- Has many players (team_players join table)

**Key Fields**:
- `season_id` → which season they're competing in
- `home_venue_id` → where their home games are played
- Team info (name, captain_id, roster_size)
- Standing stats (wins, losses, points, games_won, games_lost)
- Status (active, withdrawn, forfeited)
- Timestamps

**Notes**:
- Home venue determines where team plays home games
- Different teams in same season can have different home venues (traveling league support)
- Team stats tracked at season level

### 6. team_players (join table)
**Purpose**: Links players to teams for specific seasons

**Relationship**:
- Many-to-many between members and teams
- Tracks season-specific participation

**Key Fields**:
- `team_id` → which team
- `member_id` → which player
- `season_id` → which season (denormalized for query performance)
- Role on team (player, captain, co-captain)
- Player stats for this season (individual_wins, individual_losses, handicap)
- Status (active, inactive, dropped)
- Timestamps

**Notes**:
- Players can be on multiple teams across different seasons
- Player can skip seasons (no record created)
- Season-specific stats stored here

## Relationship Insights

### Why member_id on league_operators (not bidirectional)?

**✅ Correct approach:**
```sql
league_operators.member_id → members.id (ONE foreign key)
```

**❌ Avoid:**
```sql
members.league_operator_id → league_operators.id (circular dependency)
```

**Reasons**:
- One-to-one relationship only needs ONE foreign key
- Prevents circular dependency (chicken/egg problem)
- No data duplication
- Simple to query: `WHERE member_id = ?`
- CASCADE delete works cleanly

### What about members.league_operator_ids array?

That field is for **players tracking which operators they've played for**, NOT for indicating "this member IS an operator".

**Usage**:
- `member.role = 'league_operator'` → "I AM an operator"
- `members.league_operator_ids[]` → "I've PLAYED FOR these operators"

### Venue Flexibility

Venues are:
- **Not owned** by operators
- **Shared resources** available to all
- **Referenced** by teams (home venue) and matches (game location)
- **Transferable** - operator changes don't affect venue

This allows:
- Multiple operators at same venue
- Teams at different venues in same league (traveling leagues)
- Venue continuity when operators change

## Future Considerations

### Assistant Operators
See `futureFeatures.md` - not yet designed. Will likely require:
- Permissions/roles table
- Operator-assistant relationship table
- Audit logging for actions

### Venue Permissions
Future feature: require venue approval before operator can use it
- Might add `venue_operators` join table
- Approval workflow
- Territory management

### Advanced Scheduling
Complex scheduling features may require:
- Match templates
- Recurring schedule patterns
- Conflict detection tables
- Time slot reservations

---

*This schema will evolve as implementation proceeds. Document decisions and rationale as changes are made.*
