# League & Season Wizard Refactor TODO

> **Created**: 2025-11-01
> **Status**: Planning - User Requirements Identified
> **Priority**: Medium - Affects league creation UX and data model

---

## 🎯 Problem Statement

The current League and Season Creation Wizards need restructuring to better organize game-specific settings and properly distinguish between league-level and season-level configuration.

---

## 📋 Required Changes

### 1. Game Type Questions - Add Rule Qualifiers

**Current State:**
- Wizards ask for game type (8-ball, 9-ball, 10-ball)
- No rule variation questions

**Required Changes:**
- For each game type (8-ball, 9-ball, 10-ball), add **Rule Qualifier** question:
  - **"Standard Rules"** - Official league/tournament rules
  - **"Preferred Rules"** - House rules commonly used
  - **"Modified Rules"** - Custom modifications

**Impact:**
- Affects league creation wizard flow
- May need new database field: `leagues.rule_qualifier`
- Helps operators track which rule variations they're using

---

### 2. Team Format - Move from Season to League

**Current State:**
- Team format (5-man, 8-man) is asked during **Season Creation**
- This means the same league could have different formats per season (incorrect)

**Required Changes:**
- Move **Team Format** question from Season Wizard to **League Wizard**
- Team format is a league-level setting (consistent across all seasons)
- Remove team format question from Season Wizard

**Impact:**
- Affects: `LeagueCreationWizard.tsx`, `SeasonCreationWizard.tsx`
- May need database migration to move `team_format` field from `seasons` to `leagues` table
- Or clarify if it's already on `leagues` and just asked in wrong wizard

---

### 3. Handicap System - Add Modifiers for Team Formats

**Current State:**
- Wizards ask basic handicap system question
- No format-specific handicap modifiers

**Required Changes:**
- For **5-man** and **8-man** team formats, add **Handicap Modifier** question:
  - **"Standard Handicap"** - Full handicap system applied
  - **"Minimal Handicap"** - Reduced handicap effect
  - **"Zero Handicap"** - No handicap (scratch league)

**Why Only 5/8-man:**
- Different team formats may have different handicapping needs
- Larger team formats might need different balance approaches

**Impact:**
- May need new database field: `leagues.handicap_modifier` or similar
- Conditional question flow (only show if 5-man or 8-man selected)
- Affects scoring calculations

---

## 🗂️ Files Affected

### League Creation Wizard
- `src/operator/LeagueCreationWizard.tsx`
- `src/data/leagueWizardSteps.simple.ts`
- `src/hooks/useLeagueWizard.ts`

### Season Creation Wizard
- `src/operator/SeasonCreationWizard.tsx`
- `src/data/seasonWizardSteps.ts`
- `src/operator/wizardReducer.ts`

### Database Schema
- `database/leagues` table - May need new columns:
  - `rule_qualifier` (text/enum)
  - `team_format` (if not already there)
  - `handicap_modifier` (text/enum)
- `database/seasons` table - May need to remove:
  - `team_format` (if currently there)

---

## 🔄 Proposed Question Flow

### League Creation Wizard (New Flow)

1. **Game Type** (existing)
   - 8-ball / 9-ball / 10-ball

2. **Rule Qualifier** (NEW)
   - Standard Rules / Preferred Rules / Modified Rules

3. **Team Format** (MOVED FROM SEASON)
   - 5-man / 8-man / other

4. **Handicap System** (existing)
   - Basic handicap question

5. **Handicap Modifier** (NEW - conditional on team format)
   - _Only show if 5-man or 8-man selected_
   - Standard Handicap / Minimal Handicap / Zero Handicap

6. **Day of Week** (existing)

7. **Other existing steps...**

### Season Creation Wizard (Updated Flow)

1. **Start Date** (existing)

2. **Season Length** (existing)

3. ~~**Team Format**~~ (REMOVED - now in League Wizard)

4. **Championship Dates** (existing)
   - BCA / APA championship scheduling

5. **Schedule Review** (existing)

---

## 🎨 UI/UX Considerations

### Rule Qualifier Question
```
What rules will this league follow?

○ Standard Rules
  Official league/tournament rules as published

○ Preferred Rules
  Common house rules variations

○ Modified Rules
  Custom rule modifications for this league
```

### Handicap Modifier Question
```
How should handicapping be applied for this 5-man format?

○ Standard Handicap
  Full handicap system to balance skill levels

○ Minimal Handicap
  Reduced handicap effect for competitive play

○ Zero Handicap (Scratch)
  No handicap - pure skill-based league
```

---

## 📊 Database Changes Needed

### Check Current Schema
1. Verify if `team_format` exists on `leagues` or `seasons` table
2. Check if `handicap_system` field exists and what values it supports
3. Plan new columns if needed

### Potential Migrations
```sql
-- Add rule qualifier to leagues
ALTER TABLE leagues
ADD COLUMN rule_qualifier TEXT
CHECK (rule_qualifier IN ('standard', 'preferred', 'modified'));

-- Add handicap modifier to leagues
ALTER TABLE leagues
ADD COLUMN handicap_modifier TEXT
CHECK (handicap_modifier IN ('standard', 'minimal', 'zero'));

-- Move team_format to leagues if currently on seasons
-- (Would need data migration script)
```

---

## ⚠️ Migration Considerations

### If Team Format Moves from Seasons to Leagues

**Risk:** Existing seasons may have different team formats
- Need to audit existing data first
- May need to handle legacy seasons differently
- Could require operator to confirm/update during migration

**Safe Approach:**
1. Add `team_format` to `leagues` table (don't remove from `seasons` yet)
2. For new leagues: Use `leagues.team_format`
3. For old leagues: Fall back to `seasons.team_format` if `leagues.team_format` is null
4. Provide migration tool for operators to consolidate

---

## 🧪 Testing Requirements

### After Implementation
1. Create new league with all new questions answered
2. Create season for that league - verify team format not asked
3. Verify rule qualifier and handicap modifier saved correctly
4. Test conditional logic for handicap modifier (only shows for 5/8-man)
5. Test backward compatibility with existing leagues/seasons

---

## 📝 Implementation Steps

### Phase 1: Schema & Data Model
1. ✅ Document requirements (this file)
2. ⬜ Review current database schema
3. ⬜ Design database changes
4. ⬜ Create migration SQL scripts
5. ⬜ Update TypeScript types

### Phase 2: League Wizard Updates
1. ⬜ Add rule qualifier step to `leagueWizardSteps.simple.ts`
2. ⬜ Move team format question from season to league wizard
3. ⬜ Add handicap modifier step (conditional on team format)
4. ⬜ Update form data types
5. ⬜ Update wizard reducer and state management

### Phase 3: Season Wizard Updates
1. ⬜ Remove team format question from `seasonWizardSteps.ts`
2. ⬜ Update wizard reducer to not expect team format
3. ⬜ Update form data types

### Phase 4: Backend Integration
1. ⬜ Update league creation API to save new fields
2. ⬜ Update season creation to use league's team format
3. ⬜ Test database operations

### Phase 5: Testing & Migration
1. ⬜ Test new league creation flow end-to-end
2. ⬜ Test season creation flow end-to-end
3. ⬜ Create data migration tool for existing leagues (if needed)
4. ⬜ Update documentation

---

## 💡 Questions to Resolve

1. **Database Schema**: Where is `team_format` currently stored?
2. **Scoring Impact**: How does `handicap_modifier` affect scoring calculations?
3. **Rule Qualifier**: Is this for display only, or does it affect game logic?
4. **Backward Compatibility**: How to handle existing leagues created before these changes?
5. **Other Team Formats**: Should handicap modifier apply to formats other than 5/8-man?

---

## 🔗 Related Files

- Current wizard implementations:
  - [src/operator/LeagueCreationWizard.tsx](src/operator/LeagueCreationWizard.tsx)
  - [src/operator/SeasonCreationWizard.tsx](src/operator/SeasonCreationWizard.tsx)
- Wizard data/steps:
  - [src/data/leagueWizardSteps.simple.ts](src/data/leagueWizardSteps.simple.ts)
  - [src/data/seasonWizardSteps.ts](src/data/seasonWizardSteps.ts)
- State management:
  - [src/hooks/useLeagueWizard.ts](src/hooks/useLeagueWizard.ts)
  - [src/operator/wizardReducer.ts](src/operator/wizardReducer.ts)
- Database schema:
  - `/database/schema/` (migration files)

---

## 🎯 Next Actions

1. **Review with User**: Confirm understanding of requirements
2. **Database Audit**: Check current schema and existing data
3. **Design Review**: Plan the question flow and conditional logic
4. **Estimate Effort**: Break down into implementable chunks
5. **Prioritize**: Decide when to tackle this refactor
