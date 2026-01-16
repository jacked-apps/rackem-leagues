# Plan: Threshold Chart Editor

**Branch**: `lo-manual-scoring` (part of manual scoring feature)
**Status**: IN PROGRESS - Needs Setup Options Consolidation
**Created**: 2025-01-15
**Last Updated**: 2026-01-16

---

## Current Session Status (Resume Here)

**Where we left off**: Chart editors functional, need architectural cleanup

### Completed This Session:
- Fixed number input clearing behavior (can now clear and retype values)
- Fixed "Higher Wins + Lower Wins = Total Games + 1" math rule
- Updated Chart Issues checkbox text: "I understand the issues and want to use this chart anyway"
- Added InfoButton to Chart Issues with support contact (support@rackemleagues.com)
- Removed Allow Ties checkbox from Points chart (ties always allowed for points - too likely to be exactly even)
- Fixed Points chart default to 18 games (BCA standard)

### Architectural Decision Needed: Setup Options Consolidation

**Problem**: Settings are scattered across multiple places:
- Lineup Options has handicap type
- Threshold Options has handicap type (duplicate!)
- Games section has round-robin type
- Chart editors have their own local settings

**Solution**: Create unified "Setup Options" component that appears on:
- Match Data Page (MatchDataPage.tsx)
- Threshold Chart Editor pages (both Points and Percentage)

**Setup Options Fields**:
1. **Players per Team** (3, 4, 5, etc.) - lineup size
2. **Handicap Type** (points / percentage) - single source of truth, determines chart type
3. **Thresholds For** (team / player / off) - the mode
4. **Round Robin** (single / double / custom) - determines game multiplier

**Derived Values**:
- **Total Games** = `lineupSize² × multiplier` (or custom value)
- **Chart Type** = matches handicap type automatically

**What to Remove**:
- Duplicate handicap type from current locations
- Threshold System dropdown (redundant with handicap type)
- Chart type navigation toggle (chart type follows handicap type)

### Next Steps:
1. Create SetupOptions component with the 4 fields above
2. Add to Match Data Page (collapsible accordion at top)
3. Add to threshold chart editor pages
4. Remove redundant settings from other locations
5. Connect total games calculation to round-robin setting
6. Database integration for these settings (future)

---

## Completed

### Points Threshold Chart Editor
- **Route**: `/league/:leagueId/threshold-chart/points`
- **Page**: `src/operator/PointsThresholdChartPage.tsx`
- **Component**: `src/components/operator/threshold-editor/PointsThresholdChartEditor.tsx`
- **Features**:
  - View and edit all chart rows (diff, win, tie, lose)
  - Add rows to top (higher diff) or bottom (lower diff)
  - Delete rows
  - Chart Settings card with Total Games input and Allow Ties checkbox
  - Regenerate Chart button based on settings
  - Pattern-following for new rows (when chart matches default)
  - Reset to default BCA chart
  - Red/yellow warning highlighting for problematic rows
  - Issues Card with warnings and ignore checkbox
  - Save/Accept Chart button with proper enable/disable logic
  - Save to localStorage (mock - DB integration pending)
  - Back navigation with returnTo param support

### Percentage Threshold Chart Editor
- **Route**: `/league/:leagueId/threshold-chart/percentage`
- **Page**: `src/operator/PercentageThresholdChartPage.tsx`
- **Component**: `src/components/operator/threshold-editor/PercentageThresholdChartEditor.tsx`
- **Features**:
  - View and edit range rows (minDiff, maxDiff, higherWins, lowerWins)
  - Add ranges to top or bottom
  - Delete ranges
  - Chart Settings card with Total Games input
  - Regenerate Chart button (preserves range boundaries)
  - Range validation (gaps/overlaps detection)
  - Red/yellow warning highlighting for problematic values
  - Issues Card with warnings and ignore checkbox
  - Save/Accept Chart button with proper enable/disable logic
  - Save to localStorage (mock - DB integration pending)
  - Back navigation with returnTo param support

### ThresholdsSection Updates
- Chart preview is now read-only in ThresholdsSection
- "Edit Chart" button navigates to dedicated page
- Renamed system types: `points` | `percentage` | `custom`
- Added `leagueId` prop for navigation

---

## Remaining Work

### PvP Race Threshold Chart Editor (Future)
- Player vs player race format
- Route: `/league/:leagueId/threshold-chart/pvp`

### Database Integration (Future)
- Create `threshold_charts` table
- Replace localStorage with real DB calls

---

## Overview

Dedicated page(s) for editing threshold charts. These charts define how many games a team needs to win/tie/lose based on the handicap difference between teams.

**Why a separate page?**
- Chart editing is complex - multiple row operations, validation, pattern logic
- Charts are league-level configuration, not match-specific
- Needs dedicated space for proper UX
- Will be accessed from multiple places (Match Data Page, League Settings, Season Wizard)

---

## Chart Types

We have **3 different chart types** that work fundamentally differently:

### 1. Points Chart (Exact Diff)
- **Structure**: Exact handicap difference → thresholds
- **Range**: -12 to +12 (can be extended)
- **Columns**: Diff, Win, Tie, Lose
- **Ties**: Only on even diffs
- **Pattern**: Win +1 on odd→even (going up), Lose +1 on even→odd (going up)
- **Total games**: 18 (double round-robin 3v3)

### 2. 5v5 BCA Chart (Range-based)
- **Structure**: Handicap difference RANGE → thresholds
- **Ranges**: 0-14, 15-40, 41-66, etc.
- **Columns**: Min, Max, Higher Team Wins, Lower Team Wins
- **Ties**: None (25 games = odd)
- **Pattern**: Different - ranges with different higher/lower values
- **Total games**: 25 (single round-robin 5v5)

### 3. Custom Charts
- **Structure**: Whatever the operator defines
- **Could be**: Exact diff, ranges, or something else entirely
- **Columns**: Flexible
- **No pattern enforcement**

---

## Design Questions to Resolve

### 1. Storage Structure

**Option A: Separate tables per chart type**
```
threshold_charts_3v3 (id, league_id, diff, win, tie, lose)
threshold_charts_5v5 (id, league_id, min_diff, max_diff, higher_wins, lower_wins)
threshold_charts_custom (id, league_id, chart_data JSONB)
```
- Pro: Type-safe, easy queries
- Con: Three tables to maintain, harder to add new types

**Option B: Single table with JSONB**
```
threshold_charts (id, league_id, chart_type, chart_data JSONB)
```
- Pro: Flexible, one table
- Con: No type safety at DB level, complex queries

**Option C: Single table with type-specific columns**
```
threshold_charts (
  id, league_id, chart_type,
  -- For exact diff charts
  diff, win, tie, lose,
  -- For range charts
  min_diff, max_diff, higher_wins, lower_wins
)
```
- Pro: Type-safe columns available
- Con: Null columns based on type, confusing

**Recommendation**: Option B (JSONB) - most flexible for MVP, can optimize later

### 2. Page Structure

**Option A: One page, three modes**
- Single `ThresholdChartEditor` page
- Tab or selector for chart type
- Different UI based on type

**Option B: Three separate pages**
- `ThresholdChart3v3Editor`
- `ThresholdChart5v5Editor`
- `ThresholdChartCustomEditor`
- Pro: Cleaner code, no conditional rendering
- Con: Duplication

**Option C: One page with type-specific components**
- Single `ThresholdChartEditor` page (route/navigation)
- Renders `Chart3v3Editor`, `Chart5v5Editor`, or `ChartCustomEditor` based on type
- Pro: Single route, clean components
- Con: Need to pass type as URL param

**Recommendation**: Option C - best of both worlds

### 3. Route Structure

```
/league/:leagueId/threshold-chart/:chartType
```
Where `chartType` is: `3v3` | `5v5` | `custom`

**Navigation from Match Data Page**:
- Click "Edit Chart" in ThresholdsSection
- Navigate to `/league/:leagueId/threshold-chart/3v3` (or 5v5)
- "Back" returns to match being edited

**Navigation from League Settings** (future):
- Threshold Charts section shows all configured charts
- Click to edit each type

### 4. Chart Selection vs Chart Editing

Two different concepts:
1. **Select which chart to USE** → happens in ThresholdsSection (Match Data Page)
2. **Edit the chart DATA** → happens in ThresholdChartEditor (dedicated page)

### 5. Default vs Custom

Each chart type has:
- **Default**: Built-in BCA/standard chart (read from code)
- **Custom**: Operator's modifications (stored in DB)

If no custom chart saved, use default. Once saved, use custom.
"Reset to Default" button clears DB record, reverts to code defaults.

---

## Proposed Architecture

### Routes

```typescript
// In NavRoutes.tsx
{ path: 'threshold-chart/:chartType', element: <ThresholdChartEditor /> }
```

Full path: `/league/:leagueId/threshold-chart/:chartType`

### Components

```
src/components/operator/threshold-editor/
├── index.ts                      # Exports
├── Chart3v3Editor.tsx           # 3v3 exact diff editing
├── Chart5v5Editor.tsx           # 5v5 range editing
├── ChartCustomEditor.tsx        # Custom chart editing
├── ChartRow3v3.tsx              # Single row for 3v3 (editable)
├── ChartRow5v5.tsx              # Single row for 5v5 (editable)
└── useThresholdChart.ts         # Hook for chart CRUD

src/operator/
└── ThresholdChartEditor.tsx     # Page component (routes to correct editor)
```

### Page Component

```typescript
// ThresholdChartEditor.tsx
function ThresholdChartEditor() {
  const { leagueId, chartType } = useParams();

  // Validate chartType
  if (!['3v3', '5v5', 'custom'].includes(chartType)) {
    return <Navigate to={`/league/${leagueId}`} />;
  }

  return (
    <div>
      <PageHeader
        title={`Edit ${getChartTitle(chartType)} Chart`}
        backTo={/* previous page or league */}
      />

      {chartType === '3v3' && <Chart3v3Editor leagueId={leagueId} />}
      {chartType === '5v5' && <Chart5v5Editor leagueId={leagueId} />}
      {chartType === 'custom' && <ChartCustomEditor leagueId={leagueId} />}
    </div>
  );
}
```

---

## 3v3 Chart Editor Design

### UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ PageHeader: "Edit 3v3 Threshold Chart"                          │
│ Back to: [Match Data] or [League Settings]                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ Info Card ───────────────────────────────────────────────── │
│ │ This chart determines how many games each team needs to      │
│ │ win based on the handicap difference. The diff is calculated │
│ │ by subtracting away team's total handicap from home team's.  │
│ │ Higher handicap team = positive diff, lower = negative.      │
│ └───────────────────────────────────────────────────────────── │
│                                                                 │
│ ┌─ Chart Table ─────────────────────────────────────────────── │
│ │                                                               │
│ │  [+ Add Row] (at top)                                         │
│ │                                                               │
│ │  Diff    Win    Tie    Lose   Actions                         │
│ │  ─────────────────────────────────────────                    │
│ │  +13    [17]   [ ]    [15]    [🗑]                            │
│ │  +12    [16]   [15]   [14]    [🗑]                            │
│ │  +11    [15]   [ ]    [14]    [🗑]                            │
│ │  ...                                                          │
│ │  -12    [4]    [3]    [2]     [🗑]                            │
│ │  -13    [?]    [ ]    [?]     [🗑]  ← Pattern didn't apply?   │
│ │                                                               │
│ │  [+ Add Row] (at bottom)                                      │
│ │                                                               │
│ └───────────────────────────────────────────────────────────── │
│                                                                 │
│ ┌─ Pattern Helper ──────────────────────────────────────────── │
│ │ ☑ Auto-fill new rows using BCA pattern                       │
│ │   (Ties on even diffs, Win+1 on odd→even going up,          │
│ │    Lose+1 on even→odd going up)                              │
│ │                                                               │
│ │ Note: Pattern only applies when chart matches BCA standard.  │
│ │ If you've customized values, new rows will be blank.         │
│ └───────────────────────────────────────────────────────────── │
│                                                                 │
│ ┌─ Footer ──────────────────────────────────────────────────── │
│ │ Status: [Customized] or [Using Default]                      │
│ │                                                               │
│ │ [Reset to Default]    [Cancel]    [Save Chart]               │
│ └───────────────────────────────────────────────────────────── │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Features

1. **Add Row to Top/Bottom**
   - Button adds new row
   - Auto-fills with pattern if chart is unmodified
   - Blank if chart has been customized

2. **Edit Any Cell**
   - All cells editable (diff, win, tie, lose)
   - Tie cell disabled/hidden on odd diffs? Or allow override?

3. **Delete Row**
   - Remove any row
   - Confirm if deleting middle rows (breaks sequence)

4. **Pattern Toggle**
   - Checkbox to enable/disable auto-fill pattern
   - Shows explanation of pattern

5. **Reset to Default**
   - Clears all customizations
   - Reverts to BCA standard chart

6. **Save/Cancel**
   - Save persists to database
   - Cancel discards changes and goes back

### Bug Fix Needed

Current pattern logic issue: When adding row at top (+13), pattern didn't calculate correctly.

Looking at the code:
```typescript
if (direction === 'top') {
  // Adding to top means higher diff (moving from prevDiff to prevDiff + 1)
  // For positive diffs going up: win +1 on odd→even, lose +1 on even→odd
  const wasEven = prevDiff % 2 === 0;
  if (!wasEven && isEvenDiff) {
    // odd→even: win +1
    win = prevRow.win + 1;
  } else if (wasEven && !isEvenDiff) {
    // even→odd: lose +1
    lose = prevRow.lose + 1;
  }
}
```

The issue: At diff +12 (even), when adding +13 (odd):
- wasEven = true, isEvenDiff = false
- Should be: lose +1 (going from even→odd)
- But for the +13 row (higher positive diff), the HIGHER handicap team needs MORE games to win

Let me trace through:
- Diff +12: Win=16, Tie=15, Lose=14 (from BCA chart)
- Adding +13: Going from even (12) to odd (13)
- wasEven=true, isEvenDiff=false → triggers `lose = prevRow.lose + 1` = 15

But that's wrong! For +13, the higher handicap team should need 17 to win (not 15 to lose).

**The pattern logic is backwards for "top" direction.** When going UP in diff (higher number):
- The games_to_win for the higher team INCREASES
- The games_to_win for the lower team DECREASES

Need to fix the pattern algorithm.

---

## 5v5 Chart Editor Design

### UI Layout (Different from 3v3)

```
┌─────────────────────────────────────────────────────────────────┐
│ PageHeader: "Edit 5v5 Threshold Chart"                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ Chart Table ─────────────────────────────────────────────── │
│ │                                                               │
│ │  [+ Add Range] (at top)                                       │
│ │                                                               │
│ │  Min    Max    Higher Wins   Lower Wins   Actions             │
│ │  ───────────────────────────────────────────────              │
│ │  [0]    [14]   [13]          [13]         [🗑]                │
│ │  [15]   [40]   [14]          [12]         [🗑]                │
│ │  [41]   [66]   [15]          [11]         [🗑]                │
│ │  ...                                                          │
│ │  [145]  [999]  [19]          [7]          [🗑]  ← Capped      │
│ │                                                               │
│ │  [+ Add Range] (at bottom)                                    │
│ │                                                               │
│ └───────────────────────────────────────────────────────────── │
│                                                                 │
│ Note: No ties in 5v5 (25 games = odd number)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Differences from 3v3

- **Ranges instead of exact diffs**: Min-Max columns
- **No Tie column**: 25 games means no ties
- **Higher/Lower instead of Win/Tie/Lose**: Different conceptual model
- **Different pattern logic**: Ranges expand/contract differently

---

## Database Schema

### Table: `threshold_charts`

```sql
CREATE TABLE threshold_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  chart_type TEXT NOT NULL CHECK (chart_type IN ('3v3', '5v5', 'custom')),
  chart_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id),

  -- One active chart per type per league
  UNIQUE(league_id, chart_type, is_active) WHERE is_active = true
);

-- Index for lookups
CREATE INDEX idx_threshold_charts_league ON threshold_charts(league_id);
```

### JSONB Structure for 3v3

```json
{
  "type": "exact_diff",
  "rows": [
    { "diff": 12, "win": 16, "tie": 15, "lose": 14 },
    { "diff": 11, "win": 15, "tie": null, "lose": 14 },
    // ...
  ]
}
```

### JSONB Structure for 5v5

```json
{
  "type": "range",
  "rows": [
    { "minDiff": 0, "maxDiff": 14, "higherWins": 13, "lowerWins": 13 },
    { "minDiff": 15, "maxDiff": 40, "higherWins": 14, "lowerWins": 12 },
    // ...
  ]
}
```

---

## Implementation Order

### Phase 1: Fix Current Bug
1. Fix the pattern generation logic in ThresholdsSection
2. Test with both +13 (top) and -13 (bottom) additions

### Phase 2: Extract to Dedicated Page
1. Create route `/league/:leagueId/threshold-chart/:chartType`
2. Create `ThresholdChartEditor.tsx` page component
3. Create `Chart3v3Editor.tsx` component (move logic from ThresholdsSection)
4. Update ThresholdsSection to link to editor instead of inline editing

### Phase 3: 5v5 Chart Editor
1. Create `Chart5v5Editor.tsx` with range-based editing
2. Different UI for ranges vs exact diffs
3. Add/remove range rows

### Phase 4: Database Integration
1. Create `threshold_charts` table
2. Create `useThresholdChart` hook for CRUD
3. Replace mock localStorage with real DB calls

### Phase 5: Custom Chart Editor
1. Design flexible UI for operator-defined charts
2. Allow mixing approaches or completely custom

---

## Open Questions

1. **Should tie be allowed on odd diffs?** Current pattern says no, but operator might want override.

2. **Range overlap validation**: For 5v5, what if ranges overlap? Validate on save?

3. **Chart versioning**: Should we keep history of chart changes?

4. **Chart sharing**: Can operators share/copy charts between leagues?

5. **Validation rules**:
   - Min games_to_win?
   - Max games_to_win?
   - Win > Tie > Lose always?

---

## Notes

- This is a supporting feature for the LO Manual Scoring work
- Charts are league-level configuration
- Default charts come from code (BCA standards)
- Custom charts stored in database
- Multiple chart types with fundamentally different structures
- Each needs its own editor UI

