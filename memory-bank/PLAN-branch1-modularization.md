# Branch 1: Modularization of Current System

**Branch Name:** `feature/modular-config-system`
**Depends On:** `main`
**Goal:** Refactor existing hardcoded systems into configurable database-driven modules WITHOUT changing current behavior.

---

## Git Commands Reference

```bash
# Create and switch to the new branch (do this when ready to start coding)
git checkout -b feature/modular-config-system

# Check which branch you're on
git branch

# See status of your changes
git status

# Stage all changes for commit
git add .

# Stage specific files only
git add path/to/file.ts path/to/another.sql

# Commit with message
git commit -m "Your commit message here"

# Push branch to remote (first time - sets up tracking)
git push -u origin feature/modular-config-system

# Push subsequent commits
git push

# Switch back to main
git checkout main

# Pull latest changes from remote
git pull

# See commit history
git log --oneline

# See what changed in a file
git diff path/to/file.ts

# Undo changes to a file (before staging)
git checkout -- path/to/file.ts

# Unstage a file (after git add, before commit)
git reset HEAD path/to/file.ts
```

---

## Key Development Principles

### 1. Generic Query Functions

**BAD - Too Specific:**
```typescript
// Don't do this - single-purpose function
async function updateTeamConfigName(id: string, name: string) {
  return supabase
    .from('team_configurations')
    .update({ name })
    .eq('id', id);
}
```

**GOOD - Generic and Reusable:**
```typescript
// Do this - handles any update scenario
async function updateTeamConfiguration(
  id: string,
  updates: Partial<TeamConfigurationUpdate>
) {
  return supabase
    .from('team_configurations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
}

// Usage - update one field
await updateTeamConfiguration(id, { name: 'New Name' });

// Usage - update multiple fields
await updateTeamConfiguration(id, {
  name: 'New Name',
  roster_size: 6,
  playing_size: 4
});
```

### 2. Query Function Structure

All query functions should follow this pattern:

```typescript
/**
 * @fileoverview Team Configuration Queries
 * Generic CRUD operations for team_configurations table.
 */

// GET - Single item
export async function getTeamConfiguration(id: string) { ... }

// GET - List with optional filters
export async function getTeamConfigurations(filters?: {
  organizationId?: string;
  isSystemDefault?: boolean;
}) { ... }

// CREATE - Accept full insert type
export async function createTeamConfiguration(
  data: TeamConfigurationInsert
) { ... }

// UPDATE - Accept partial update type
export async function updateTeamConfiguration(
  id: string,
  updates: Partial<TeamConfigurationUpdate>
) { ... }

// DELETE
export async function deleteTeamConfiguration(id: string) { ... }
```

### 3. Type Definitions

```typescript
// Base type (matches database)
interface TeamConfiguration {
  id: string;
  is_system_default: boolean;
  organization_id: string | null;
  name: string;
  description: string | null;
  roster_size: number;
  playing_size: number;
  min_roster: number;
  allow_mid_match_subs: boolean;
  created_at: string;
  updated_at: string;
}

// Insert type (omit auto-generated fields)
type TeamConfigurationInsert = Omit<TeamConfiguration,
  'id' | 'created_at' | 'updated_at'
>;

// Update type (all fields optional except none)
type TeamConfigurationUpdate = Partial<Omit<TeamConfiguration,
  'id' | 'created_at' | 'updated_at' | 'is_system_default'
>>;
```

---

## Phase 1A: Database Schema

### Tasks

- [ ] **1A.1** Create `team_configurations` table and seed system defaults
- [ ] **1A.2** Create `match_format_configurations` table and seed system defaults
- [ ] **1A.3** Create `scoring_system_configurations` table and seed system defaults
- [ ] **1A.4** Create `handicap_rating_configurations` table and seed system defaults
- [ ] **1A.5** Create `threshold_chart_configurations` table
- [ ] **1A.6** Create `threshold_chart_entries` table and migrate hardcoded values
- [ ] **1A.7** Create `game_achievement_configurations` table
- [ ] **1A.8** Add foreign key columns to `leagues` table
- [ ] **1A.9** Add foreign key columns to `preferences` table
- [ ] **1A.10** Create migration to populate existing leagues with correct config references

### Migration Files to Create

```
database/migrations/
├── 001_create_team_configurations.sql
├── 002_create_match_format_configurations.sql
├── 003_create_scoring_system_configurations.sql
├── 004_create_handicap_rating_configurations.sql
├── 005_create_threshold_chart_configurations.sql
├── 006_create_threshold_chart_entries.sql
├── 007_create_game_achievement_configurations.sql
├── 008_add_config_refs_to_leagues.sql
├── 009_add_config_refs_to_preferences.sql
├── 010_migrate_existing_leagues.sql
└── 011_seed_system_defaults.sql
```

### Verification Checklist (Phase 1A)

- [ ] All tables created successfully
- [ ] System defaults seeded correctly
- [ ] Existing leagues have correct config references
- [ ] Foreign key constraints working
- [ ] Can query configs by organization
- [ ] Can query system defaults

---

## Phase 1B: Type Definitions

### Tasks

- [ ] **1B.1** Create `src/types/teamConfiguration.ts`
- [ ] **1B.2** Create `src/types/matchFormatConfiguration.ts`
- [ ] **1B.3** Create `src/types/scoringSystemConfiguration.ts`
- [ ] **1B.4** Create `src/types/handicapRatingConfiguration.ts`
- [ ] **1B.5** Create `src/types/thresholdChartConfiguration.ts`
- [ ] **1B.6** Create `src/types/gameAchievementConfiguration.ts`
- [ ] **1B.7** Update `src/types/preferences.ts` with new config references
- [ ] **1B.8** Update `src/types/league.ts` with new config references
- [ ] **1B.9** Create barrel export `src/types/configurations/index.ts`

### File Structure

```
src/types/
├── configurations/
│   ├── index.ts                          # Barrel export
│   ├── teamConfiguration.ts
│   ├── matchFormatConfiguration.ts
│   ├── scoringSystemConfiguration.ts
│   ├── handicapRatingConfiguration.ts
│   ├── thresholdChartConfiguration.ts
│   └── gameAchievementConfiguration.ts
├── preferences.ts                        # Updated
└── league.ts                             # Updated
```

### Verification Checklist (Phase 1B)

- [ ] All types compile without errors
- [ ] Types match database schema exactly
- [ ] Insert/Update types properly omit auto-generated fields
- [ ] Barrel exports work correctly

---

## Phase 1C: Query Layer

### Tasks

- [ ] **1C.1** Create `src/api/queries/teamConfigurations.ts`
- [ ] **1C.2** Create `src/api/queries/matchFormatConfigurations.ts`
- [ ] **1C.3** Create `src/api/queries/scoringSystemConfigurations.ts`
- [ ] **1C.4** Create `src/api/queries/handicapRatingConfigurations.ts`
- [ ] **1C.5** Create `src/api/queries/thresholdChartConfigurations.ts`
- [ ] **1C.6** Create `src/api/queries/gameAchievementConfigurations.ts`
- [ ] **1C.7** Create `src/api/mutations/teamConfigurations.ts`
- [ ] **1C.8** Create `src/api/mutations/matchFormatConfigurations.ts`
- [ ] **1C.9** Create `src/api/mutations/scoringSystemConfigurations.ts`
- [ ] **1C.10** Create `src/api/mutations/handicapRatingConfigurations.ts`
- [ ] **1C.11** Create `src/api/mutations/thresholdChartConfigurations.ts`
- [ ] **1C.12** Create `src/api/mutations/gameAchievementConfigurations.ts`
- [ ] **1C.13** Update `src/api/queries/preferences.ts` to include config refs
- [ ] **1C.14** Update `src/api/queries/leagues.ts` to include config refs

### Query Function Template

Each query file should include:

```typescript
/**
 * @fileoverview [Configuration Name] Queries
 *
 * Generic CRUD operations for [table_name] table.
 * Supports both system defaults and organization-specific configurations.
 */

import { supabase } from '@/supabaseClient';
import type {
  [ConfigType],
  [ConfigTypeInsert],
  [ConfigTypeUpdate]
} from '@/types/configurations';

/**
 * Get a single configuration by ID
 */
export async function get[ConfigName](id: string) {
  const { data, error } = await supabase
    .from('[table_name]')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as [ConfigType];
}

/**
 * Get configurations with optional filters
 * @param filters - Optional filters for organization, system defaults, etc.
 */
export async function get[ConfigName]s(filters?: {
  organizationId?: string;
  isSystemDefault?: boolean;
}) {
  let query = supabase.from('[table_name]').select('*');

  if (filters?.organizationId !== undefined) {
    query = query.eq('organization_id', filters.organizationId);
  }

  if (filters?.isSystemDefault !== undefined) {
    query = query.eq('is_system_default', filters.isSystemDefault);
  }

  const { data, error } = await query.order('name');

  if (error) throw error;
  return data as [ConfigType][];
}

/**
 * Get all configurations available to an organization
 * (system defaults + org-specific)
 */
export async function getAvailable[ConfigName]s(organizationId: string) {
  const { data, error } = await supabase
    .from('[table_name]')
    .select('*')
    .or(`is_system_default.eq.true,organization_id.eq.${organizationId}`)
    .order('is_system_default', { ascending: false })
    .order('name');

  if (error) throw error;
  return data as [ConfigType][];
}
```

### Mutation Function Template

```typescript
/**
 * @fileoverview [Configuration Name] Mutations
 *
 * Create, update, delete operations for [table_name] table.
 */

import { supabase } from '@/supabaseClient';
import type {
  [ConfigType],
  [ConfigTypeInsert],
  [ConfigTypeUpdate]
} from '@/types/configurations';

/**
 * Create a new configuration
 * @param data - Configuration data (all required fields)
 */
export async function create[ConfigName](data: [ConfigTypeInsert]) {
  const { data: result, error } = await supabase
    .from('[table_name]')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return result as [ConfigType];
}

/**
 * Update an existing configuration
 * @param id - Configuration ID
 * @param updates - Partial update data (only fields to change)
 */
export async function update[ConfigName](
  id: string,
  updates: [ConfigTypeUpdate]
) {
  // Prevent updating system defaults
  const { data: existing } = await supabase
    .from('[table_name]')
    .select('is_system_default')
    .eq('id', id)
    .single();

  if (existing?.is_system_default) {
    throw new Error('Cannot modify system default configurations');
  }

  const { data, error } = await supabase
    .from('[table_name]')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as [ConfigType];
}

/**
 * Delete a configuration
 * @param id - Configuration ID
 */
export async function delete[ConfigName](id: string) {
  // Prevent deleting system defaults
  const { data: existing } = await supabase
    .from('[table_name]')
    .select('is_system_default')
    .eq('id', id)
    .single();

  if (existing?.is_system_default) {
    throw new Error('Cannot delete system default configurations');
  }

  const { error } = await supabase
    .from('[table_name]')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Copy a configuration (for customization)
 * @param sourceId - ID of configuration to copy
 * @param organizationId - Organization that will own the copy
 * @param newName - Name for the copy
 */
export async function copy[ConfigName](
  sourceId: string,
  organizationId: string,
  newName: string
) {
  // Get source configuration
  const { data: source, error: fetchError } = await supabase
    .from('[table_name]')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (fetchError) throw fetchError;

  // Create copy with new ownership
  const { id, created_at, updated_at, is_system_default, ...copyData } = source;

  const { data, error } = await supabase
    .from('[table_name]')
    .insert({
      ...copyData,
      name: newName,
      organization_id: organizationId,
      is_system_default: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as [ConfigType];
}
```

### Verification Checklist (Phase 1C)

- [ ] All CRUD operations work correctly
- [ ] System defaults cannot be modified or deleted
- [ ] Copy function creates proper org-owned copies
- [ ] Filters work correctly
- [ ] Error handling is consistent

---

## Phase 1D: React Query Hooks

### Tasks

- [ ] **1D.1** Create `src/api/hooks/useTeamConfigurations.ts`
- [ ] **1D.2** Create `src/api/hooks/useMatchFormatConfigurations.ts`
- [ ] **1D.3** Create `src/api/hooks/useScoringSystemConfigurations.ts`
- [ ] **1D.4** Create `src/api/hooks/useHandicapRatingConfigurations.ts`
- [ ] **1D.5** Create `src/api/hooks/useThresholdChartConfigurations.ts`
- [ ] **1D.6** Create `src/api/hooks/useGameAchievementConfigurations.ts`

### Hook Template

```typescript
/**
 * @fileoverview React Query hooks for [Configuration Name]
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  get[ConfigName],
  get[ConfigName]s,
  getAvailable[ConfigName]s,
} from '@/api/queries/[configName]Configurations';
import {
  create[ConfigName],
  update[ConfigName],
  delete[ConfigName],
  copy[ConfigName],
} from '@/api/mutations/[configName]Configurations';
import type { [ConfigTypeUpdate] } from '@/types/configurations';

const QUERY_KEY = '[configName]Configurations';

/**
 * Hook to fetch a single configuration
 */
export function use[ConfigName](id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => get[ConfigName](id!),
    enabled: !!id,
  });
}

/**
 * Hook to fetch configurations with filters
 */
export function use[ConfigName]s(filters?: {
  organizationId?: string;
  isSystemDefault?: boolean;
}) {
  return useQuery({
    queryKey: [QUERY_KEY, 'list', filters],
    queryFn: () => get[ConfigName]s(filters),
  });
}

/**
 * Hook to fetch all available configurations for an organization
 */
export function useAvailable[ConfigName]s(organizationId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'available', organizationId],
    queryFn: () => getAvailable[ConfigName]s(organizationId!),
    enabled: !!organizationId,
  });
}

/**
 * Hook to create a configuration
 */
export function useCreate[ConfigName]() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: create[ConfigName],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * Hook to update a configuration
 */
export function useUpdate[ConfigName]() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: [ConfigTypeUpdate] }) =>
      update[ConfigName](id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * Hook to delete a configuration
 */
export function useDelete[ConfigName]() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: delete[ConfigName],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * Hook to copy a configuration
 */
export function useCopy[ConfigName]() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sourceId,
      organizationId,
      newName,
    }: {
      sourceId: string;
      organizationId: string;
      newName: string;
    }) => copy[ConfigName](sourceId, organizationId, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
```

### Verification Checklist (Phase 1D)

- [ ] All hooks compile without errors
- [ ] useQuery hooks fetch data correctly
- [ ] useMutation hooks invalidate cache properly
- [ ] Loading and error states work

---

## Phase 1E: Update Handicap Calculation Logic

### Tasks

- [ ] **1E.1** Create `src/utils/handicap/getThresholdsFromConfig.ts`
- [ ] **1E.2** Update `src/utils/handicap/index.ts` to use config-based lookup
- [ ] **1E.3** Update `src/utils/calculateHandicapThresholds.ts` to accept config
- [ ] **1E.4** Update `src/utils/calculatePlayerHandicap.ts` to use rating config
- [ ] **1E.5** Keep old functions as fallbacks during transition
- [ ] **1E.6** Add feature flag to toggle between old/new systems

### New Function Structure

```typescript
/**
 * Get thresholds from database configuration
 * Falls back to hardcoded values if config not found
 */
export async function getThresholdsFromConfig(
  chartId: string,
  handicapDiff: number
): Promise<HandicapThresholds> {
  // Query threshold_chart_entries for this chart and diff
  // Return matching thresholds
  // Fall back to hardcoded if not found
}

/**
 * Calculate player handicap based on rating configuration
 */
export function calculatePlayerHandicapFromConfig(
  playerStats: PlayerStats,
  ratingConfig: HandicapRatingConfiguration
): number {
  switch (ratingConfig.rating_method) {
    case 'win_loss_ratio':
      return calculateWinLossRatio(playerStats, ratingConfig);
    case 'win_percentage':
      return calculateWinPercentage(playerStats, ratingConfig);
    case 'fargo_rating':
      // Return stored Fargo rating (manual entry)
      return playerStats.fargo_rating ?? ratingConfig.default_rating;
    case 'manual_rating':
      return playerStats.manual_rating ?? ratingConfig.default_rating;
    case 'none':
      return 0;
  }
}
```

### Verification Checklist (Phase 1E)

- [ ] Threshold lookup works from database
- [ ] Fallback to hardcoded values works
- [ ] Player handicap calculation respects config
- [ ] Existing leagues continue working unchanged

---

## Phase 1F: Update Components to Use Configs

### Tasks

- [ ] **1F.1** Update lineup components to read `playing_size` from config
- [ ] **1F.2** Update scoring components to use config
- [ ] **1F.3** Update match creation to use config references
- [ ] **1F.4** Update league wizard to select from available configs
- [ ] **1F.5** Update preferences UI to manage config references

### Key Components to Update

```
src/components/
├── lineup/
│   ├── LineupCard.tsx          # Read playing_size from config
│   └── LineupPlayerSelect.tsx  # Dynamic player count
├── scoring/
│   ├── ScoringDialog.tsx       # Achievement options from config
│   └── MatchScoring.tsx        # Total games from config
└── operator/
    ├── PreferencesCard.tsx     # Config selection UI
    └── LeagueCreationWizard/   # Config selection in wizard
```

### Verification Checklist (Phase 1F)

- [ ] Components read from config instead of hardcoded values
- [ ] 3v3 leagues still work correctly
- [ ] 5v5 leagues still work correctly
- [ ] No visual changes to existing functionality

---

## Phase 1G: Testing & Cleanup

### Tasks

- [ ] **1G.1** Test all existing 3v3 functionality
- [ ] **1G.2** Test all existing 5v5 functionality
- [ ] **1G.3** Test league creation with config selection
- [ ] **1G.4** Test handicap calculations match old behavior
- [ ] **1G.5** Test threshold lookups match old behavior
- [ ] **1G.6** Remove feature flag (if used)
- [ ] **1G.7** Update documentation

### Test Scenarios

1. **Create new 3v3 league** - Should work exactly as before
2. **Create new 5v5 league** - Should work exactly as before
3. **Score existing 3v3 match** - Thresholds should match
4. **Score existing 5v5 match** - Thresholds should match
5. **View player handicaps** - Should calculate same values
6. **Complete match flow** - End-to-end should work

### Verification Checklist (Phase 1G)

- [ ] All existing tests pass
- [ ] Manual testing confirms identical behavior
- [ ] No regressions in any functionality
- [ ] Performance is acceptable

---

## Success Criteria for Branch 1

Before merging to main:

1. ✅ All 6 configuration tables exist and are populated
2. ✅ System defaults are seeded and read-only
3. ✅ Existing leagues reference correct configurations
4. ✅ Generic query/mutation functions work for all config types
5. ✅ Handicap thresholds read from database
6. ✅ Player handicap calculations use config
7. ✅ ALL existing functionality works exactly as before
8. ✅ No breaking changes to current leagues/matches

---

## Commit Strategy

Recommended commits for this branch:

```bash
# Phase 1A commits
git commit -m "Add team_configurations table and system defaults"
git commit -m "Add match_format_configurations table"
git commit -m "Add scoring_system_configurations table"
git commit -m "Add handicap_rating_configurations table"
git commit -m "Add threshold chart tables and migrate hardcoded values"
git commit -m "Add game_achievement_configurations table"
git commit -m "Add config references to leagues and preferences tables"
git commit -m "Migrate existing leagues to use config references"

# Phase 1B commits
git commit -m "Add TypeScript types for configuration modules"

# Phase 1C commits
git commit -m "Add generic query functions for configurations"
git commit -m "Add generic mutation functions for configurations"

# Phase 1D commits
git commit -m "Add React Query hooks for configurations"

# Phase 1E commits
git commit -m "Update handicap calculation to use config-based lookup"

# Phase 1F commits
git commit -m "Update components to read from configuration"

# Phase 1G commits
git commit -m "Complete testing and cleanup"
```

---

*Last Updated: 2025-04-09*
*Status: Ready to Start*
*Estimated Effort: Medium-Large*
