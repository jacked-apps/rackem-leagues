# Preferences System - Status & Future Work

**Last Updated**: 2024-11-24
**Status**: Organization-level preferences ✅ COMPLETE | League-level overrides ⏳ PENDING

---

## What We Built

### 1. Database Schema (`preferences` table)

**Purpose**: Single flexible table for both organization defaults and league-specific overrides

**Structure**:
```sql
preferences (
  id UUID PRIMARY KEY,
  entity_type TEXT ('organization' | 'league'),
  entity_id UUID (operator_id or league_id),

  -- Handicap Settings
  handicap_variant TEXT ('standard' | 'reduced' | 'none') NULL,
  team_handicap_variant TEXT ('standard' | 'reduced' | 'none') NULL,
  game_history_limit INTEGER (50-500) NULL,

  -- Format Settings
  team_format TEXT ('5_man' | '8_man') NULL,

  -- Match Rules
  golden_break_counts_as_win BOOLEAN NULL
)
```

**Key Design Principle**: NULL = "use next level default"
- League preferences NULL → use organization default
- Organization preferences NULL → use BCA Standard/system default

**Auto-Creation Triggers**:
- New operator created → auto-create org preferences row (all NULLs)
- New league created → auto-create league preferences row (all NULLs)

**Location**: `database/migrations/add_preferences_table.sql`

---

### 2. BCA Standard Rules Implementation

**Golden Break Rules** (`src/utils/goldenBreakRules.ts`):
```typescript
shouldGoldenBreakCount(gameType, goldenBreakPreference)
```

**BCA Standard Behavior** (when preference is NULL):
- ✅ **9-Ball**: Golden break DOES count as win
- ❌ **8-Ball**: Golden break does NOT count
- ❌ **10-Ball**: Golden break does NOT count

**Preference Override**:
- `true`: Golden breaks ALWAYS count for ALL game types
- `false`: Golden breaks NEVER count for ANY game types
- `null`: Use BCA Standard based on game type

**Integrated Into**: `src/hooks/useMatchScoring.ts` (live scoring logic)

---

### 3. Organization Preferences UI

**Component**: `OrganizationPreferencesCard.tsx`
**Location**: `/operator-settings` page
**Status**: ✅ COMPLETE

**Features**:
- Three editable sections with individual Edit/Save/Cancel:
  1. **Handicap Settings**: Player handicap, team handicap, game history limit
  2. **Format Settings**: Team format (5-man/8-man)
  3. **Match Rules**: Golden break counts as win

- **Display Logic**:
  - NULL values show as "None chosen" or "BCA Standard"
  - Explicit values show with "(all game types)" clarification

- **InfoButton Dialogs**:
  - Explains BCA rules and what each option does
  - Notes that leagues can override in the future

- **TODO in Code** (line 8-23): Need enhanced dialogs with "Learn More" links to help pages

---

### 4. TanStack Query Integration

**Hooks Created**:
```typescript
useOrganizationPreferences(operatorId) // 15min cache
useLeaguePreferences(leagueId)         // 15min cache
```

**Query Functions**: `src/api/queries/preferences.ts`
**Exports**: `src/api/hooks/index.ts`

**Benefits**:
- Automatic caching (no duplicate DB calls)
- Used in league creation wizard to pre-fill defaults
- Reusable across entire app

---

### 5. League Creation Wizard Integration

**Files Modified**:
- `src/operator/LeagueCreationWizard.tsx`
- `src/hooks/useLeagueWizard.ts`
- `src/data/leagueWizardSteps.simple.tsx`

**Behavior**:
- Fetches org preferences on wizard load (cached)
- **Step 4 (Team Format)**: Pre-selects radio button based on org `team_format`
- **Step 5 (Handicap Variant)**: Pre-selects based on org `handicap_variant`
- Auto-initializes formData via useEffect to prevent constraint violations
- User can still override by clicking different option

**Bug Fixed**: Initially radio appeared selected but formData was empty, causing database constraint errors. Now properly initializes formData when org preferences load.

---

## What We Need Next

### Phase 1: League-Level Override UI (HIGH PRIORITY)

**Goal**: Allow operators to customize individual leagues differently from org defaults

**Where**: New section on `/league/:leagueId` (League Detail page)

**What's Needed**:

1. **New Component**: `LeaguePreferencesCard.tsx`
   - Similar structure to OrganizationPreferencesCard
   - Shows current effective values (with fallback chain visualization)
   - Allows overriding specific settings
   - Shows which values are org default vs league override

2. **UI/UX Considerations**:
   ```
   Handicap Variant: Standard (from organization)  [Override]

   When overriding, show:
   Handicap Variant: [Dropdown: None chosen (use org) | Standard | Reduced | None]
   ```

3. **Save Logic**:
   - Update league's preferences row (entity_type='league', entity_id=league_id)
   - Set to NULL to revert to org default
   - Set to explicit value to override

4. **Display Chain**:
   - Show user: "Standard (from organization)" or "Standard (league override)"
   - Clear visual distinction between inherited and overridden values

---

### Phase 2: Help Pages (MEDIUM PRIORITY)

**Goal**: Comprehensive documentation for each preference setting

**Structure**: `/help/preferences/[setting-name]`

**Pages Needed**:
1. `/help/preferences/handicap-variant`
2. `/help/preferences/team-handicap-variant`
3. `/help/preferences/game-history-limit`
4. `/help/preferences/team-format`
5. `/help/preferences/golden-break`

**Each Page Should Explain**:
- What the setting controls
- How it works technically
- Why you might choose each option
- Impact on gameplay/scoring
- BCA Standard rules (where applicable)
- Examples of when to use each option
- Best practices

**Enhanced InfoButtons**:
- Current: Brief explanation in dialog
- Add: "Learn More →" link that navigates to help page
- Keep dialog brief, detailed help on dedicated page

---

### Phase 3: Additional Preferences (LOW PRIORITY - AS NEEDED)

**Potential Future Settings**:

1. **Scoring Rules**:
   - Time limits per game
   - Automatic forfeit rules
   - Point penalties for late arrivals

2. **Match Rules**:
   - Break rules (alternating vs winner breaks)
   - Rack rules (self-rack vs opponent racks)
   - Tournament mode settings

3. **Player Management**:
   - Minimum games played for handicap calculation
   - Handicap adjustment frequency
   - Substitute player rules

4. **Communication**:
   - Auto-announcement of match results
   - Weekly reminder settings
   - Notification preferences

**Database**: Already designed to be flexible - just add columns as needed

---

## Technical Debt / Improvements

### 1. Database Migration Tracking

**Issue**: No tracking of which migrations have been run on local vs production

**Solution Needed**:
- Version numbering system
- Migration log table
- Up/down migration scripts

### 2. Preference Validation

**Current**: Basic DB constraints (CHECK clauses)

**Could Add**:
- TypeScript runtime validation (Zod schemas)
- More detailed error messages
- Cross-field validation (if needed)

### 3. Audit Trail

**Current**: Only `updated_at` timestamp

**Could Add**:
- Who changed what and when
- Change history table
- Revert capability

### 4. Performance

**Current**: Individual queries for each preferences fetch

**Could Add**:
- Batch fetch for multiple leagues
- Aggregate queries for reporting
- Denormalized "computed preferences" table for read performance

---

## Files Reference

### Created Files
```
src/api/queries/preferences.ts           - TanStack Query functions
src/api/hooks/usePreferences.ts          - React hooks
src/components/operator/OrganizationPreferencesCard.tsx
src/utils/goldenBreakRules.ts            - BCA rule logic
database/migrations/add_preferences_table.sql
```

### Modified Files
```
src/operator/LeagueCreationWizard.tsx    - Fetch org preferences
src/hooks/useLeagueWizard.ts             - Auto-init formData
src/data/leagueWizardSteps.simple.tsx    - Use org prefs as defaults
src/hooks/useMatchScoring.ts             - Apply golden break rules
src/types/preferences.ts                 - TypeScript types
src/api/hooks/index.ts                   - Export new hooks
```

### Key Types
```typescript
// src/types/preferences.ts
OrganizationPreferences - preferences where entity_type='organization'
LeaguePreferences - preferences where entity_type='league'
SYSTEM_DEFAULTS - Hardcoded fallback values
```

---

## Testing Checklist

### Organization Preferences ✅
- [x] Create new operator → preferences row auto-created
- [x] Edit handicap settings → saves correctly
- [x] Edit format settings → saves correctly
- [x] Edit rules settings → saves correctly
- [x] Set to NULL → displays "None chosen" or "BCA Standard"
- [x] Set explicit value → displays correctly

### League Creation Wizard ✅
- [x] Org has team_format set → wizard pre-selects correctly
- [x] Org has handicap_variant set → wizard pre-selects correctly
- [x] Org preferences NULL → wizard shows no pre-selection
- [x] User changes pre-selected value → new value saves correctly
- [x] User submits with pre-selected value → league creates successfully
- [x] FormData properly initialized on wizard load

### Golden Break Rules ✅
- [x] 9-ball with NULL preference → counts as win
- [x] 8-ball with NULL preference → does NOT count as win
- [x] 10-ball with NULL preference → does NOT count as win
- [x] Any game with `true` preference → counts as win
- [x] Any game with `false` preference → does NOT count as win

### League Overrides ⏳ (NOT YET IMPLEMENTED)
- [ ] League detail page shows current effective values
- [ ] Can override individual settings per league
- [ ] Setting to NULL reverts to org default
- [ ] Fallback chain displays correctly to user

---

## Notes & Decisions

### Why Single Table vs Multiple Tables?

**Decision**: Use one `preferences` table with `entity_type` discriminator

**Rationale**:
- Easy to add new preference columns (just ALTER TABLE once)
- Same query patterns for org and league preferences
- Flexible for future entity types (season? venue?)
- Simpler migration management

**Trade-off**: Slightly more complex queries (WHERE entity_type = '...')

### Why NULL for "Use Default" vs Explicit Flag?

**Decision**: NULL = use next level default

**Rationale**:
- Database handles NULL naturally
- Clear semantic meaning
- No extra boolean columns needed
- Easy to detect "not set" vs "explicitly set to false"

**Trade-off**: Have to handle NULL in application code carefully

### Why TanStack Query for Preferences?

**Decision**: Use TanStack Query with 15min stale time

**Rationale**:
- Preferences don't change frequently
- Automatic caching prevents duplicate requests
- React Query handles loading/error states
- Easy to invalidate cache when preferences update

**Trade-off**: More infrastructure, but worth it for UX

---

## Migration Path (For Existing Leagues)

**When deploying to production**:

1. Run migration to create `preferences` table
2. Triggers auto-create rows for existing operators/leagues (backfill)
3. All existing leagues have NULL preferences (use BCA Standard)
4. Operators can gradually customize their preferences
5. No breaking changes to existing functionality

**Safe Rollback**: Drop preferences table, app continues using hardcoded defaults in code

---

## Summary

**What Works Right Now**:
- ✅ Organization-level preferences fully functional
- ✅ League creation wizard respects org defaults
- ✅ BCA Standard golden break rules implemented
- ✅ Database schema ready for league overrides

**What's Missing**:
- ⏳ League-level override UI (new component needed)
- ⏳ Help pages with detailed explanations
- ⏳ Enhanced InfoButton dialogs with "Learn More" links

**Estimated Effort for League Overrides**:
- UI Component: 3-4 hours
- Testing: 1-2 hours
- Documentation: 1 hour
- **Total**: ~6 hours

**When to Build League Overrides**:
- When operators request ability to have different rules per league
- When we have multiple leagues per operator actually in use
- When org defaults aren't granular enough

**Current Recommendation**: Ship what we have. It's fully functional for 90% of use cases. Add league overrides when actual operators request it.
