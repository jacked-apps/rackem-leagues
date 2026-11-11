# Playoff System Implementation Plan

## Overview

Build a flexible playoff system that supports different tournament formats per league/organization, with automatic seeding from regular season standings and operator control for adjustments.

---

## Key Requirements Summary

1. **Two initial templates**:
   - Template A: "Single Night 8-Team" (1v8, 2v7, 3v6, 4v5 - all in one week)
   - Template B: "Top 4 with Consolation" (2v3, 1vWildcard → Winners play for 1st/2nd, Losers play for 3rd/4th)

2. **Customizable per organization/league** with org-level defaults and league-level overrides

3. **Automatic seeding** when regular season ends, with operator ability to adjust

4. **Wild card selection** random by default, operator can override

5. **Playoff match differences from regular season**:
   - No team bonus handicap
   - Points don't count toward standings
   - Match ends early when win threshold is met

6. **Automatic bracket progression** (winner advances to next match automatically)

7. **Maximum 2 playoff weeks** for now (potential paid upgrade later)

---

## Database Schema

### New Tables

#### 1. `playoff_templates` - Reusable tournament bracket definitions

```sql
CREATE TABLE playoff_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                          -- "Single Night 8-Team", "Top 4 with Consolation"
  description TEXT,                            -- Operator-friendly explanation
  is_system_template BOOLEAN DEFAULT false,    -- Built-in vs custom
  created_by_operator_id UUID REFERENCES league_operators(id),
  team_count INTEGER NOT NULL,                 -- 4, 8, etc.
  weeks_required INTEGER NOT NULL DEFAULT 1,   -- 1-2 weeks
  has_consolation BOOLEAN DEFAULT false,       -- Do losers play for placement?
  bracket_structure JSONB NOT NULL,            -- Defines matchups and progression
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**bracket_structure JSONB format**:
```json
{
  "rounds": [
    {
      "round_number": 1,
      "week": 1,
      "matches": [
        { "match_label": "QF1", "seed_a": 1, "seed_b": 8, "winner_advances_to": "SF1-A" },
        { "match_label": "QF2", "seed_a": 2, "seed_b": 7, "winner_advances_to": "SF1-B" },
        { "match_label": "QF3", "seed_a": 3, "seed_b": 6, "winner_advances_to": "SF2-A" },
        { "match_label": "QF4", "seed_a": 4, "seed_b": 5, "winner_advances_to": "SF2-B" }
      ]
    },
    {
      "round_number": 2,
      "week": 2,
      "matches": [
        { "match_label": "SF1", "from_match_a": "QF1", "from_match_b": "QF2", "winner_advances_to": "F" },
        { "match_label": "SF2", "from_match_a": "QF3", "from_match_b": "QF4", "winner_advances_to": "F" }
      ]
    }
  ],
  "wild_card_seeds": [],  // e.g., [4] means seed 4 is wild card
  "wild_card_pool": "bottom_half"  // "all_non_qualified", "bottom_half", "specific_seeds"
}
```

#### 2. `playoff_configurations` - Per-league playoff settings

```sql
CREATE TABLE playoff_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  template_id UUID REFERENCES playoff_templates(id),

  -- Override settings (null means use template default)
  custom_team_count INTEGER,
  custom_weeks INTEGER,

  -- Playoff-specific rules
  use_team_handicap BOOLEAN DEFAULT false,     -- false = no team bonus in playoffs
  points_count BOOLEAN DEFAULT false,          -- false = points don't affect standings
  early_termination BOOLEAN DEFAULT true,      -- true = match ends when threshold met

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(league_id)  -- One config per league
);
```

#### 3. `organization_playoff_defaults` - Org-level defaults

```sql
CREATE TABLE organization_playoff_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES league_operators(id) ON DELETE CASCADE,
  default_template_id UUID REFERENCES playoff_templates(id),

  -- Default rules
  default_use_team_handicap BOOLEAN DEFAULT false,
  default_points_count BOOLEAN DEFAULT false,
  default_early_termination BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(operator_id)
);
```

#### 4. `playoff_brackets` - Instance of playoffs for a specific season

```sql
CREATE TABLE playoff_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  template_id UUID REFERENCES playoff_templates(id),
  config_id UUID REFERENCES playoff_configurations(id),

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'seeded', 'in_progress', 'completed')),

  -- Seeding data (populated when regular season ends)
  seeding JSONB,  -- {"1": "team-uuid", "2": "team-uuid", ...}
  wild_card_team_id UUID REFERENCES teams(id),

  seeded_at TIMESTAMPTZ,
  seeded_by UUID REFERENCES members(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 5. `playoff_matches` - Individual playoff matchups

```sql
CREATE TABLE playoff_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_id UUID REFERENCES playoff_brackets(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id),  -- Links to actual match record

  round_number INTEGER NOT NULL,
  match_label TEXT NOT NULL,             -- "QF1", "SF1", "F", "3rd_place"
  week_number INTEGER NOT NULL,          -- Which playoff week (1 or 2)

  seed_a INTEGER,                        -- Seed number (1-8) or null if from previous round
  seed_b INTEGER,
  from_match_a TEXT,                     -- Match label of feeder match
  from_match_b TEXT,

  team_a_id UUID REFERENCES teams(id),   -- Actual team (populated when seeded/advanced)
  team_b_id UUID REFERENCES teams(id),

  winner_team_id UUID REFERENCES teams(id),
  winner_advances_to TEXT,               -- Match label to advance to
  loser_advances_to TEXT,                -- For consolation brackets

  placement INTEGER,                     -- Final placement (1, 2, 3, 4, etc.) if this match determines it

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'in_progress', 'completed')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Modifications to Existing Tables

#### `matches` table - Add playoff flag

```sql
ALTER TABLE matches ADD COLUMN is_playoff BOOLEAN DEFAULT false;
ALTER TABLE matches ADD COLUMN playoff_match_id UUID REFERENCES playoff_matches(id);
```

#### `leagues` table - Add playoff config reference

Already has relationship through `playoff_configurations.league_id`.

---

## Two Initial Templates

### Template A: "Single Night 8-Team Bracket"

- **Team count**: 8
- **Weeks required**: 1
- **Structure**: 1v8, 2v7, 3v6, 4v5 (all same night)
- **No advancement** (all matches determine final placement)

```json
{
  "rounds": [
    {
      "round_number": 1,
      "week": 1,
      "matches": [
        { "match_label": "M1", "seed_a": 1, "seed_b": 8, "placement_winner": 1, "placement_loser": 8 },
        { "match_label": "M2", "seed_a": 2, "seed_b": 7, "placement_winner": 2, "placement_loser": 7 },
        { "match_label": "M3", "seed_a": 3, "seed_b": 6, "placement_winner": 3, "placement_loser": 6 },
        { "match_label": "M4", "seed_a": 4, "seed_b": 5, "placement_winner": 4, "placement_loser": 5 }
      ]
    }
  ],
  "wild_card_seeds": [],
  "determines_placement": true
}
```

### Template B: "Top 4 with Wild Card & Consolation"

- **Team count**: 4 (top 3 + wild card)
- **Weeks required**: 2
- **Wild card**: Random from non-qualified teams
- **Consolation**: Losers play for 3rd/4th

```json
{
  "rounds": [
    {
      "round_number": 1,
      "week": 1,
      "matches": [
        { "match_label": "SF1", "seed_a": 2, "seed_b": 3, "winner_advances_to": "F", "loser_advances_to": "3rd" },
        { "match_label": "SF2", "seed_a": 1, "seed_b": "wild_card", "winner_advances_to": "F", "loser_advances_to": "3rd" }
      ]
    },
    {
      "round_number": 2,
      "week": 2,
      "matches": [
        { "match_label": "F", "from_match_a": "SF1", "from_match_b": "SF2", "placement_winner": 1, "placement_loser": 2 },
        { "match_label": "3rd", "from_match_a": "SF1", "from_match_b": "SF2", "take_losers": true, "placement_winner": 3, "placement_loser": 4 }
      ]
    }
  ],
  "wild_card_seeds": [4],
  "wild_card_pool": "bottom_half",
  "has_consolation": true
}
```

---

## Implementation Phases

### Phase 1: Database Schema & Types (Foundation)

**Tasks**:
1. Create migration files for all new tables
2. Create TypeScript interfaces for all playoff types
3. Add `is_playoff` and `playoff_match_id` columns to matches table
4. Create RLS policies for all new tables

**Files to create**:
- `/database/playoff_templates.sql`
- `/database/playoff_configurations.sql`
- `/database/organization_playoff_defaults.sql`
- `/database/playoff_brackets.sql`
- `/database/playoff_matches.sql`
- `/database/migrations/add_playoff_to_matches.sql`
- `/src/types/playoff.ts`

### Phase 2: System Templates & Seed Data

**Tasks**:
1. Insert the two system templates into database
2. Create template query functions
3. Create template display components

**Files to create**:
- `/database/seed_playoff_templates.sql`
- `/src/api/queries/playoffTemplates.ts`
- `/src/api/hooks/usePlayoffTemplates.ts`

### Phase 3: Playoff Configuration UI

**Tasks**:
1. Create playoff configuration page for leagues
2. Template selector component
3. Rule override toggles (team handicap, points, early termination)
4. Organization defaults settings page

**Files to create**:
- `/src/operator/PlayoffConfiguration.tsx`
- `/src/operator/components/playoff/TemplateSelector.tsx`
- `/src/operator/components/playoff/PlayoffRulesForm.tsx`
- `/src/operator/OrganizationPlayoffDefaults.tsx`

### Phase 4: Automatic Seeding System

**Tasks**:
1. Detect when regular season is complete (all matches played)
2. Fetch final standings
3. Auto-populate seeding based on standings
4. Random wild card selection (if applicable)
5. Create playoff bracket with seeded teams
6. Generate playoff matches linked to matches table
7. Operator review/adjustment UI

**Files to create**:
- `/src/utils/playoffSeeding.ts`
- `/src/api/mutations/playoffBrackets.ts`
- `/src/operator/components/playoff/SeedingReview.tsx`
- `/src/operator/components/playoff/WildCardSelector.tsx`

### Phase 5: Bracket Display & Match Flow

**Tasks**:
1. Visual bracket display component
2. Playoff match cards with advancement indicators
3. Early termination logic in scoring
4. Automatic winner advancement when match completes
5. Final placement tracking

**Files to create**:
- `/src/operator/components/playoff/BracketDisplay.tsx`
- `/src/operator/components/playoff/PlayoffMatchCard.tsx`
- `/src/hooks/usePlayoffMatch.ts`
- `/src/api/mutations/advanceWinner.ts`

### Phase 6: Scoring Integration

**Tasks**:
1. Modify match scoring to check `is_playoff` flag
2. Disable team handicap when `use_team_handicap = false`
3. Skip points calculation when `points_count = false`
4. Implement early termination when threshold met
5. Trigger winner advancement on match completion

**Files to modify**:
- `/src/hooks/useMatchScoring.ts`
- `/src/utils/handicapCalculations.ts`
- `/src/api/mutations/matches.ts`
- Match completion flow

---

## Early Termination Logic

When a playoff match has `early_termination = true`:

```typescript
function checkMatchComplete(
  homeWins: number,
  awayWins: number,
  homeThreshold: number,
  awayThreshold: number
): { isComplete: boolean; winner: 'home' | 'away' | null } {
  if (homeWins >= homeThreshold) {
    return { isComplete: true, winner: 'home' };
  }
  if (awayWins >= awayThreshold) {
    return { isComplete: true, winner: 'away' };
  }
  return { isComplete: false, winner: null };
}
```

When threshold is met:
1. Show match completion modal (same as regular season)
2. Display winner announcement
3. Require verification from both teams
4. On verification: mark match complete, trigger advancement

---

## Automatic Advancement Flow

When a playoff match is completed:

```typescript
async function advanceWinner(playoffMatchId: string, winnerTeamId: string) {
  const match = await getPlayoffMatch(playoffMatchId);

  // Find the match this winner advances to
  if (match.winner_advances_to) {
    const nextMatch = await getPlayoffMatchByLabel(match.bracket_id, match.winner_advances_to);

    // Determine which slot (A or B) based on which feeder match this is
    if (nextMatch.from_match_a === match.match_label) {
      await updatePlayoffMatch(nextMatch.id, { team_a_id: winnerTeamId });
    } else {
      await updatePlayoffMatch(nextMatch.id, { team_b_id: winnerTeamId });
    }

    // Check if next match is now ready (both teams assigned)
    await checkMatchReady(nextMatch.id);
  }

  // Handle loser advancement for consolation
  if (match.loser_advances_to) {
    const loserTeamId = match.team_a_id === winnerTeamId ? match.team_b_id : match.team_a_id;
    // Similar logic for loser bracket...
  }

  // Record final placement if this match determines it
  if (match.placement_winner) {
    await recordPlacement(match.bracket_id, winnerTeamId, match.placement_winner);
  }
  if (match.placement_loser) {
    const loserTeamId = match.team_a_id === winnerTeamId ? match.team_b_id : match.team_a_id;
    await recordPlacement(match.bracket_id, loserTeamId, match.placement_loser);
  }
}
```

---

## User Flow Summary

### Operator Setup Flow

1. **Organization Settings** → Set default playoff template & rules
2. **League Settings** → Choose template (defaults from org) → Override rules if needed
3. **Season Creation** → Playoff weeks auto-added based on template

### Regular Season End Flow

1. **System detects** all regular season matches completed
2. **Auto-generates** playoff bracket with seeding from standings
3. **Notification** sent to operator: "Playoffs are ready for review"
4. **Operator reviews** → Can adjust seeds, change wild card
5. **Operator confirms** → Playoff matches created in schedule

### Playoff Match Flow

1. **Match appears** in schedule with "PLAYOFF" badge
2. **Teams play** using normal scoring (with playoff rules applied)
3. **When threshold met** → Match completion modal appears
4. **Both teams verify** → Winner automatically advances
5. **Process repeats** until all rounds complete

---

## Questions Resolved

| Question | Answer |
|----------|--------|
| Bracket progression | Automatic, operator can adjust if needed |
| Week structure | Defined in template (which matches in which week) |
| Win threshold behavior | Match ends, completion modal shows, verification required |
| Consolation support | Yes, via `loser_advances_to` in template |
| Template sharing | Phase 2 (start with built-in + private custom) |

---

## Files to Create/Modify Summary

### New Files (18 total)

**Database (6)**:
- `playoff_templates.sql`
- `playoff_configurations.sql`
- `organization_playoff_defaults.sql`
- `playoff_brackets.sql`
- `playoff_matches.sql`
- `seed_playoff_templates.sql`

**Types (1)**:
- `src/types/playoff.ts`

**API (4)**:
- `src/api/queries/playoffTemplates.ts`
- `src/api/queries/playoffBrackets.ts`
- `src/api/mutations/playoffBrackets.ts`
- `src/api/hooks/usePlayoffTemplates.ts`

**Components (5)**:
- `src/operator/components/playoff/TemplateSelector.tsx`
- `src/operator/components/playoff/PlayoffRulesForm.tsx`
- `src/operator/components/playoff/BracketDisplay.tsx`
- `src/operator/components/playoff/PlayoffMatchCard.tsx`
- `src/operator/components/playoff/SeedingReview.tsx`

**Pages (2)**:
- `src/operator/PlayoffConfiguration.tsx`
- `src/operator/OrganizationPlayoffDefaults.tsx`

### Modified Files (5)

- `matches` table (add is_playoff column)
- `src/hooks/useMatchScoring.ts` (playoff rules)
- `src/utils/handicapCalculations.ts` (skip team handicap)
- `src/api/mutations/matches.ts` (early termination + advancement)
- Match completion flow components

---

## Success Criteria

1. ✅ Operator can configure playoffs per league
2. ✅ Organization defaults apply to new leagues
3. ✅ Seeding happens automatically when season ends
4. ✅ Operator can adjust seeds before confirming
5. ✅ Wild card is random but operator can change
6. ✅ Playoff matches skip team handicap
7. ✅ Points don't count in playoffs
8. ✅ Match ends early when threshold met
9. ✅ Winners automatically advance
10. ✅ Both templates work correctly
