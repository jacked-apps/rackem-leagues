# Threshold Chart Editor Pages - Refactoring Plan

## Chart Types Supported (All 4 Must Remain Functional)

This refactoring **MUST** preserve full functionality for all 4 threshold chart types:

| Chart Type | DB `chart_type` | Current Page | Route |
|------------|-----------------|--------------|-------|
| **Team Points** | `team_points` | `DbPointsThresholdChartPage.tsx` | `/threshold-chart/points` |
| **Team Percentage** | `team_percentage` | `DbPercentageThresholdChartPage.tsx` | `/threshold-chart/percentage` |
| **Individual Race Points** | `race_points` | `DbRaceThresholdChartPage.tsx` | `/threshold-chart/race?raceType=points` |
| **Individual Race Percentage** | `race_percentage` | `DbRaceThresholdChartPage.tsx` | `/threshold-chart/race?raceType=percentage` |

**Important**: The Race page handles both race chart types via a `raceType` query parameter. This is intentional to avoid duplicating the race-specific logic. The refactoring should preserve this pattern.

---

## Current State Analysis

### Files Analyzed
1. **DB-Backed Pages (Active/Production)**
   - `DbPointsThresholdChartPage.tsx` (395 lines) → Team Points
   - `DbPercentageThresholdChartPage.tsx` (416 lines) → Team Percentage
   - `DbRaceThresholdChartPage.tsx` (435 lines) → Both Race Points AND Race Percentage (via `?raceType=` param)

2. **Legacy Pages (localStorage-based, deprecated)**
   - `PointsThresholdChartPage.tsx` (142 lines)
   - `PercentageThresholdChartPage.tsx` (150 lines)

### Code Duplication Analysis

The three DB-backed pages share **~80% identical code**:

| Section | Points | Percentage | Race | Identical? |
|---------|--------|------------|------|------------|
| Imports | ~25 lines | ~25 lines | ~30 lines | 90% |
| URL params extraction | 3 lines | 3 lines | 5 lines | 90% |
| State hooks | 5 lines | 5 lines | 5 lines | 100% |
| Data fetching (5 hooks) | 25 lines | 25 lines | 28 lines | 95% |
| Mutations (4 hooks) | 4 lines | 4 lines | 4 lines | 100% |
| Derived state | 15 lines | 15 lines | 20 lines | 90% |
| handleEditorSave | 15 lines | 15 lines | 15 lines | 95% |
| handleModalSave | 35 lines | 35 lines | 35 lines | 95% |
| handleCopyTemplate | 18 lines | 18 lines | 18 lines | 95% |
| handleCancel | 8 lines | 8 lines | 8 lines | 100% |
| handleChartTypeChange | 5 lines | 5 lines | 5 lines | 100% |
| Loading state JSX | 20 lines | 20 lines | 20 lines | 95% |
| Error state JSX | 20 lines | 20 lines | 20 lines | 95% |
| Main render JSX | 80 lines | 80 lines | 90 lines | 85% |
| **Row conversion functions** | 30 lines | 45 lines | 35 lines | **0%** |

### What Differs Between Pages

1. **Chart Type Constants**
   - `chart_type`: `'team_points'` | `'team_percentage'` | `'race_points'` | `'race_percentage'`
   - `lookup_mode`: `'exact'` | `'range'` | `'exact'`
   - `chartTypeLabel`: `'Points'` | `'Percentage'` | `'Race Points/Percentage'`

2. **Row Conversion Functions** (chart-type specific logic)
   - `dbRowsToEditorRows()` - different field mappings per chart type
   - `editorRowsToDbRows()` - different field mappings per chart type

3. **Default Rows Function**
   - `getDefaultPointsChartRows()` → Team Points
   - `getDefaultPercentageChartRows()` → Team Percentage
   - `getDefaultRacePointsChartRows()` → Individual Race Points
   - `getDefaultRaceMatrixPercentageChartRows()` → Individual Race Percentage

4. **Editor Component**
   - `<PointsThresholdChartEditor />` → Team Points
   - `<PercentageThresholdChartEditor />` → Team Percentage
   - `<RaceThresholdChartEditor raceChartType="points" />` → Individual Race Points
   - `<RaceThresholdChartEditor raceChartType="percentage" />` → Individual Race Percentage

5. **Page Title & Layout**
   - Title string differs per chart type
   - Race page has extra `raceChartType` handling and `handleRaceChartTypeChange` for switching between race_points and race_percentage
   - Race page uses `max-w-4xl` instead of `max-w-3xl`

6. **Race Page Sub-Type Switching**
   - The race page uses `?raceType=points` or `?raceType=percentage` query param
   - `handleRaceChartTypeChange()` navigates between the two race sub-types
   - This must be preserved in the refactored hook

---

## Recommended Refactoring

### Option A: Custom Hook + Shared Layout (Recommended)

Extract the shared logic into a custom hook and shared components.

#### New Files to Create

```
src/components/operator/threshold-editor/
├── useThresholdChartPage.ts      # Custom hook with all shared logic
├── ThresholdChartPageLayout.tsx  # Shared page shell (loading, error, main layout)
├── DatabaseStatusCard.tsx        # The blue status card (extracted)
└── index.ts                      # Updated exports
```

#### 1. Create `useThresholdChartPage.ts`

```typescript
/**
 * Custom hook that encapsulates all shared threshold chart page logic.
 * Each chart type page only needs to provide:
 * - chartType: The database chart type
 * - lookupMode: 'exact' | 'range'
 * - dbRowsToEditor: Function to convert DB rows to editor format
 * - editorRowsToDb: Function to convert editor rows to DB format
 * - getDefaultRows: Function to get default rows for this chart type
 */
export function useThresholdChartPage<TEditorRow>(config: {
  chartType: ThresholdChartType;
  lookupMode: 'exact' | 'range';
  chartTypeLabel: string;
  dbRowsToEditor: (dbRows: ThresholdChartWithRows['rows']) => TEditorRow[];
  editorRowsToDb: (rows: TEditorRow[]) => DbRowFormat[];
  getDefaultRows: () => TEditorRow[];
}) {
  // All the shared state and logic:
  // - URL params extraction
  // - Data fetching hooks
  // - Mutation hooks
  // - Derived state
  // - Handler functions
  // - Loading/error states

  return {
    // Navigation
    leagueId, seasonId, backTo, backLabel,
    navigate, handleCancel, handleChartTypeChange,

    // Data
    season, activeChart, chartRows,
    hasSeasonChart, isUsingGlobalTemplate, globalTemplates,

    // State
    isLoading, isSaving, defaultChartError,
    hasUnsavedChanges, setHasUnsavedChanges,
    showSaveModal, setShowSaveModal,

    // Handlers
    handleEditorSave, handleModalSave, handleCopyTemplate,
  };
}
```

#### 2. Create `ThresholdChartPageLayout.tsx`

```typescript
/**
 * Shared layout wrapper for all threshold chart editor pages.
 * Handles loading state, error state, and page structure.
 */
export function ThresholdChartPageLayout({
  title, subtitle, maxWidth = '3xl',
  backTo, backLabel,
  isLoading, error,
  children,
}: ThresholdChartPageLayoutProps) {
  if (isLoading) return <LoadingState ... />;
  if (error) return <ErrorState ... />;
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader ... />
      <div className={`max-w-${maxWidth} mx-auto px-4 py-6 space-y-4`}>
        {children}
      </div>
    </div>
  );
}
```

#### 3. Create `DatabaseStatusCard.tsx`

```typescript
/**
 * Blue status card showing which chart is active.
 * Shows "Create Season Copy" button when using global template.
 */
export function DatabaseStatusCard({
  hasSeasonChart,
  isUsingGlobalTemplate,
  activeChart,
  globalTemplates,
  onCopyTemplate,
  isCopying,
}: DatabaseStatusCardProps) {
  // The blue card JSX currently duplicated in all 3 pages
}
```

#### 4. Refactored Page Example: `DbPointsThresholdChartPage.tsx`

```typescript
// FROM: 395 lines → TO: ~80 lines

import { useThresholdChartPage, ThresholdChartPageLayout, DatabaseStatusCard } from './threshold-editor';

// Chart-specific conversion functions (kept in this file or moved to utils)
const dbRowsToEditorRows = (dbRows) => { /* points-specific */ };
const editorRowsToDbRows = (rows) => { /* points-specific */ };

export default function DbPointsThresholdChartPage() {
  const page = useThresholdChartPage({
    chartType: 'team_points',
    lookupMode: 'exact',
    chartTypeLabel: 'Points',
    dbRowsToEditor: dbRowsToEditorRows,
    editorRowsToDb: editorRowsToDbRows,
    getDefaultRows: getDefaultPointsChartRows,
  });

  return (
    <ThresholdChartPageLayout
      title="Threshold Chart Editor (Team/Points)"
      subtitle={page.season ? `Season: ${page.season.season_name}` : 'Configure thresholds'}
      backTo={page.backTo}
      backLabel={page.backLabel}
      isLoading={page.isLoading}
      error={page.defaultChartError}
    >
      <DatabaseStatusCard {...page.statusCardProps} />

      <ChartTypeSelector
        currentType="points"
        onChartTypeChange={page.handleChartTypeChange}
        hasUnsavedChanges={page.hasUnsavedChanges}
      />

      <PointsThresholdChartEditor
        initialData={page.chartRows}
        onSave={page.handleEditorSave}
        onCancel={page.handleCancel}
        isSaving={page.isSaving}
        onUnsavedChangesChange={page.setHasUnsavedChanges}
      />

      <SaveChartModal
        open={page.showSaveModal}
        onOpenChange={page.setShowSaveModal}
        onSave={page.handleModalSave}
        isSaving={page.isSaving}
        chartTypeLabel="Points"
      />
    </ThresholdChartPageLayout>
  );
}
```

---

### Option B: Single Generic Page Component (More Aggressive)

Create a single `ThresholdChartPage` component that handles all chart types.

**Pros**: Maximum code reuse, single file to maintain
**Cons**: More complex props/config, harder to extend for type-specific needs

```typescript
// Single page for all chart types
<ThresholdChartPage
  chartType="points"
  EditorComponent={PointsThresholdChartEditor}
  dbRowsToEditor={pointsDbRowsToEditor}
  editorRowsToDb={pointsEditorRowsToDb}
  getDefaultRows={getDefaultPointsChartRows}
/>
```

**Not recommended** because Race chart has additional complexity (raceChartType sub-selection) that would require special-casing.

---

## Additional Cleanup Items

### 1. Delete Legacy Pages
The localStorage-based pages are obsolete:
- `PointsThresholdChartPage.tsx` - Uses localStorage, has TODOs
- `PercentageThresholdChartPage.tsx` - Uses localStorage, has TODOs

**Action**: Delete these files and remove their routes from NavRoutes.tsx

### 2. Move Row Conversion Functions
The `dbRowsToEditorRows` and `editorRowsToDbRows` functions should be:
- Moved to a shared utils file: `src/utils/thresholdChartConverters.ts`
- Or kept co-located with each editor component

### 3. Consolidate Chart Type Labels
Create a single source of truth for chart type metadata:

```typescript
// src/constants/thresholdCharts.ts
export const THRESHOLD_CHART_TYPES = {
  team_points: {
    label: 'Points',
    title: 'Team/Points',
    lookupMode: 'exact',
    maxWidth: '3xl',
  },
  team_percentage: {
    label: 'Percentage',
    title: 'Team/Percentage',
    lookupMode: 'range',
    maxWidth: '3xl',
  },
  race_points: {
    label: 'Race Points',
    title: 'Individual/Points',
    lookupMode: 'exact',
    maxWidth: '4xl',
  },
  race_percentage: {
    label: 'Race Percentage',
    title: 'Individual/Percentage',
    lookupMode: 'exact',
    maxWidth: '4xl',
  },
} as const;
```

---

## Implementation Plan

### Phase 1: Extract Shared Components (Low Risk)
1. Create `DatabaseStatusCard.tsx` - extract the blue card
2. Create `ThresholdChartPageLayout.tsx` - extract loading/error/layout
3. Update all 3 DB pages to use these components
4. Run build, verify no regressions

### Phase 2: Create Custom Hook (Medium Risk)
1. Create `useThresholdChartPage.ts` with all shared logic
2. Refactor `DbPointsThresholdChartPage.tsx` first as proof of concept
3. Test thoroughly
4. Refactor remaining pages

### Phase 3: Cleanup (Low Risk)
1. Delete legacy localStorage pages
2. Remove dead routes from NavRoutes.tsx
3. Create chart type constants file
4. Move row converters if beneficial

---

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Total lines (3 DB pages) | ~1,246 | ~400 |
| Duplicated code | ~80% | ~10% |
| Files | 5 page files | 3 page files + 3 shared components |
| Testability | Low (logic in pages) | High (logic in hook) |
| Adding new chart type | Copy 400 lines | ~50 lines + converter functions |

---

## Verification Checklist (All 4 Chart Types)

After refactoring, verify that ALL of the following work correctly:

### Team Points (`team_points`)
- [ ] Navigate to `/league/:id/season/:id/threshold-chart/points`
- [ ] Load existing season chart OR fall back to global template
- [ ] Edit and save chart rows
- [ ] Create season copy from global template
- [ ] Chart linked to season via `threshold_chart_id`

### Team Percentage (`team_percentage`)
- [ ] Navigate to `/league/:id/season/:id/threshold-chart/percentage`
- [ ] Load existing season chart OR fall back to global template
- [ ] Edit and save chart rows (range-based lookup)
- [ ] Create season copy from global template
- [ ] Chart linked to season via `threshold_chart_id`

### Individual Race Points (`race_points`)
- [ ] Navigate to `/league/:id/season/:id/threshold-chart/race?raceType=points`
- [ ] Load existing season chart OR fall back to global template
- [ ] Edit and save 2D matrix rows (player1 vs player2 handicaps)
- [ ] Create season copy from global template
- [ ] Switch to Race Percentage via sub-type selector
- [ ] Chart linked to season via `threshold_chart_id`

### Individual Race Percentage (`race_percentage`)
- [ ] Navigate to `/league/:id/season/:id/threshold-chart/race?raceType=percentage`
- [ ] Load existing season chart OR fall back to global template
- [ ] Edit and save 2D matrix rows (player1 vs player2 handicaps)
- [ ] Create season copy from global template
- [ ] Switch to Race Points via sub-type selector
- [ ] Chart linked to season via `threshold_chart_id`

### Cross-Type Navigation
- [ ] `ChartTypeSelector` allows switching between all 4 types
- [ ] Unsaved changes warning appears when switching with pending edits
- [ ] Back button returns to match list for all chart types

---

## Decision Required

**Recommended approach**: Option A (Custom Hook + Shared Layout)
- Best balance of DRY, readability, and flexibility
- Each page remains explicit about its chart type
- Race page can easily handle its extra complexity (raceType query param)
- Testable via hook testing

**Question for user**: Should we proceed with Phase 1 first (extract components) to reduce risk, or jump straight to Phase 2 (full hook extraction)?
