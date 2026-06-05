# Championship Date Preferences - Implementation Plan

## Problem
Operators must select BCA/APA championship dates every time they create a season. These preferences rarely change, making this tedious and error-prone.

## Solution
Create `operator_blackout_preferences` table to save operator's championship and holiday preferences. Reuse these preferences for future seasons and filter out ignored conflicts.

---

## Database Schema: New Table

### `operator_blackout_preferences`
**Purpose**: Store operator's preferences for automatic blackouts and ignored conflicts

**Structure**:
```sql
- id (UUID, primary key)
- operator_id (UUID → league_operators.id)
- preference_type (enum: 'holiday', 'championship', 'custom')
- preference_action (enum: 'blackout', 'ignore')
- holiday_name (text, nullable) - e.g., "Christmas", "Tax Day"
- championship_id (UUID → championship_date_options.id, nullable)
- custom_name (text, nullable) - e.g., "Annual Local Tournament"
- custom_start_date (date, nullable)
- custom_end_date (date, nullable)
- auto_apply (boolean) - If true, auto-insert blackout when creating season
- created_at (timestamp)
- updated_at (timestamp)
```

**Why This Structure**:
- Supports multiple preferences per operator (not just BCA/APA)
- `preference_action = 'blackout'` → Auto-insert blackout week for this date
- `preference_action = 'ignore'` → Don't show conflict warnings for this date
- Extensible for future features (custom recurring dates, local tournaments)
- No changes needed to existing tables

**Note**: Existing `league_operators` columns (`preferred_bca_championship_id`, `preferred_apa_championship_id`) will remain but go unused. Can be removed in future cleanup.

---

## Step 1: Save Preference When Championship Data Is Saved

### When to Save
**Location**: `SeasonCreationWizard.tsx` in the `handleCreateSeason` function (lines 436-468)

**Timing**: When operator completes Schedule Review step and clicks "Save & Exit" or "Save & Continue →"
- At this point, all championship data is in formData (choice, start date, end date)
- Custom championship dates are submitted to `championship_date_options` table
- **THIS is when we also save operator's preference to `operator_blackout_preferences` table**

### What to Save
Create row in `operator_blackout_preferences` for each championship:

**If they select a championship date option** (UUID from database):
```
{
  operator_id: <operator_id>,
  preference_type: 'championship',
  preference_action: 'blackout',
  championship_id: <selected_uuid>,
  auto_apply: false  // For initial implementation
}
```

**If they select "ignore" or "skip"**:
- Check: Do future championship dates exist in database?
- If YES (dates exist):
  ```
  {
    preference_type: 'championship',
    preference_action: 'ignore',
    championship_id: <latest_future_championship_id>
  }
  ```
  - Means: "I know dates exist but don't want to use them"
- If NO (dates unavailable):
  - Don't create preference row (no data to reference)
  - NULL state means "ask me again next time"

**If they select "custom dates"**:
- Custom dates get submitted to `championship_date_options` (creates/updates vote count)
- After submission, create preference using returned UUID:
  ```
  {
    preference_type: 'championship',
    preference_action: 'blackout',
    championship_id: <returned_uuid>,
    auto_apply: false
  }
  ```

### User Communication
Show message on the wizard question itself: "We will save this preference so you only have to answer this once. If it needs to be changed, go to Organization Settings."

### The APA Problem This Solves
**Current**: APA dates are TBD → Operator must choose "ignore" → Saved as "ignore" → Next season skips question → APA dates NOW exist but operator wasn't asked → Conflict!

**Solution**: When dates unavailable, DON'T create preference row (NULL state) → Next season asks again → Operator gets chance to use newly available dates

---

## Step 2: Organization Settings - Display Preferences

### New Card: "Championship Preferences"
Location: `/operator-settings` page

Display BCA and APA preferences by querying `operator_blackout_preferences`:
- If row exists with `preference_action = 'blackout'` → Show date range
- If row exists with `preference_action = 'ignore'` → Show "Ignored"
- If no row exists → Show "Not set"

Include "Edit" button to open edit modal

---

## Step 3: Organization Settings - Edit Preferences

### Edit Modal Functionality
Allows operator to:
- Select from available championship dates (fetch from `championship_date_options`)
- Choose "ignore" (creates row with `preference_action = 'ignore'`)
- Clear preference (deletes row from table)

Updates `operator_blackout_preferences` table on save

---

## Future Phases

### Phase 2: Auto-Skip Wizard Steps
When operator has saved preferences:
- Check for existing rows in `operator_blackout_preferences`
- Auto-fill championship data from preferences
- Skip championship questions in wizard
- Go directly to Schedule Review

### Phase 3: Holiday Preferences
**Extend to all holidays**:
- In Organization Settings, show list of all common holidays
- Let operator mark each as "blackout" or "ignore" or "ask each time" (no row)
- Examples:
  - Christmas → `preference_action = 'blackout'` (always take off)
  - Tax Day → `preference_action = 'ignore'` (never flag conflict)
  - Memorial Day → No row (ask me each season)

### Phase 4: Conflict Filtering
**Filter conflicts before displaying**:
- When running `detectScheduleConflicts()`, fetch operator's preferences
- Filter out holidays with `preference_action = 'ignore'`
- Result: Operator only sees conflicts they care about
- Example: Tax Day, Presidents Day, Columbus Day silently ignored

### Phase 5: Auto-Apply Blackouts
**Automatically insert blackout weeks**:
- When creating new season, check preferences where `auto_apply = true`
- Automatically insert blackout weeks for those dates
- Operator can still remove during Schedule Review
- Quality of life: "Christmas always off" happens automatically

### Phase 6: Custom Recurring Dates
**Support local tournaments**:
```
{
  preference_type: 'custom',
  preference_action: 'blackout',
  custom_name: 'Regional 9-Ball Tournament',
  custom_start_date: '2025-08-01',  // First week of August every year
  custom_end_date: '2025-08-07',
  auto_apply: true
}
```

---

## Implementation Order

### Now (Initial Implementation):
1. ✅ Create `operator_blackout_preferences` table
2. Save BCA/APA preferences when completing Schedule Review
3. Display preferences in Organization Settings
4. Edit preferences via modal

### Later (Future Enhancements):
5. Auto-skip wizard steps when preferences exist
6. Extend to all holidays (Christmas, Thanksgiving, etc.)
7. Filter ignored conflicts from detection results
8. Auto-apply blackouts when creating seasons
9. Support custom recurring dates

---

## Files to Create/Modify

### Database:
- `database/operator_blackout_preferences.sql` (NEW) - Table creation migration

### Code Files:
- `src/operator/SeasonCreationWizard.tsx` - Save preferences after championship submission
- `src/operator/OrganizationSettings.tsx` - Display preferences card
- `src/components/modals/ChampionshipPreferencesModal.tsx` (NEW) - Edit modal
- `src/types/operator.ts` - Add TypeScript interface for preferences table
