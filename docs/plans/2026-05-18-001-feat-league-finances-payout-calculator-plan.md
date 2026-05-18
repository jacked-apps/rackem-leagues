# League Finances + Payout Calculator — Implementation Plan

> **Date:** 2026-05-18
> **Status:** Plan drafted; awaiting sign-off before implementation
> **Brainstorm:** `docs/brainstorms/2026-05-18-league-finances-payout-calculator-requirements.md`
> **Branch (planned):** `feat/league-finances-calculator`
> **Estimated scope:** ~3–4 days total across 5 units

---

## Overview

A calculator (with light supporting bookkeeping) that helps League Operators figure out end-of-season prize payouts. **The calculator UI is the headline** — the income/expense tracking is supporting cast per Ed's "don't go crazy on the credit debit side, go crazy on the calculate payouts nifty slick and cool side."

**Architectural principles (from brainstorm):**
- App is a **calculator + record-keeper**, NOT a payment processor. LO handles cash; we do math.
- Income is a **deterministic formula** (`price × lineup × teams × weeks`), not a per-week ledger. Team is the unit of obligation.
- **Two-level configuration**: org-level defaults inherit down to leagues; leagues can override.
- Three LO entry paths: (A) full formula → calculator; (B) "I have $X, distribute it" manual pool; (C) hybrid.
- **Polish budget concentrated on the payout calculator view** — the rest is intentionally lean.

---

## Status table

| Unit | Title | Status |
|---|---|---|
| 1 | Schema + math engine (pure utilities + unit tests) | ⬜ not started |
| 2 | League-level "Finances" tab — setup form + running projection | ⬜ not started |
| 3 | Expense / credit line items (with quick-add chips) | ⬜ not started |
| 4 | Payout calculator — the headline slick UI | ⬜ not started |
| 5 | Org-level defaults + lock-in persistence + season-summary integration | ⬜ not started |

---

## Unit 1 — Schema + math engine

**Goal:** ship the persistent data shape + a pure-function math layer that any UI in subsequent units can call. No UI in this unit; just plumbing + extensive unit tests so the math is verifiably correct before pixels touch it.

**New tables:**

```sql
-- Org-wide defaults that leagues inherit
CREATE TABLE org_finance_defaults (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  price_per_player_per_night NUMERIC(10,2) DEFAULT 10.00,
  green_fee_per_player_per_night NUMERIC(10,2) DEFAULT 2.00,
  lo_cut_kind TEXT DEFAULT 'percentage', -- 'flat' | 'percentage' | 'both'
  lo_cut_flat_per_week NUMERIC(10,2) DEFAULT 0,
  lo_cut_percent NUMERIC(5,2) DEFAULT 10.00,
  payout_shape TEXT DEFAULT '50_30_20', -- preset key OR 'custom'
  payout_places_paid INTEGER DEFAULT 3,
  payout_rounding_target NUMERIC(10,2) DEFAULT 25.00, -- $25 buckets
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Per-league overrides (NULL = inherit from org)
CREATE TABLE league_finance_settings (
  league_id UUID PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,
  price_per_player_per_night NUMERIC(10,2),
  green_fee_per_player_per_night NUMERIC(10,2),
  lo_cut_kind TEXT,
  lo_cut_flat_per_week NUMERIC(10,2),
  lo_cut_percent NUMERIC(5,2),
  payout_shape TEXT,
  payout_places_paid INTEGER,
  payout_rounding_target NUMERIC(10,2),
  custom_payout_percentages NUMERIC(5,2)[], -- if payout_shape='custom'
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Per-season line items (expenses, credits, dropped teams)
CREATE TABLE season_finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL, -- 'expense' | 'credit' | 'dropped_team'
  amount NUMERIC(10,2), -- NULL for dropped_team (computed from team + week)
  description TEXT NOT NULL,
  entry_date DATE DEFAULT CURRENT_DATE,
  -- Only for dropped_team entries:
  dropped_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  dropped_at_week INTEGER, -- 1-based; the week they dropped
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX season_finance_entries_season_id_idx ON season_finance_entries(season_id);

-- Locked-in final payouts (one row per season once "Lock in" is hit)
CREATE TABLE season_locked_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID UNIQUE NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  -- Snapshot of all the math at lock time
  total_income NUMERIC(10,2) NOT NULL,
  total_deductions NUMERIC(10,2) NOT NULL,
  total_credits NUMERIC(10,2) NOT NULL,
  app_fee NUMERIC(10,2) NOT NULL,
  lo_cut_amount NUMERIC(10,2) NOT NULL,
  final_prize_pool NUMERIC(10,2) NOT NULL,
  -- Per-team payouts as JSON: [{team_id, place, amount}, ...]
  team_payouts JSONB NOT NULL,
  -- Per-individual awards as JSON: [{member_id, label, amount, lo_funded}, ...]
  individual_awards JSONB NOT NULL,
  locked_at TIMESTAMPTZ DEFAULT now(),
  locked_by_member_id UUID REFERENCES members(id)
);
```

**Math engine (new module):**
- `src/utils/finances/computeProjectedIncome.ts` — `(price, lineup_size, team_count, total_weeks, dropped_team_entries[]) → projected_income`
- `src/utils/finances/computeProjectedGreenFees.ts` — same shape with green-fee multiplier
- `src/utils/finances/computeAppFee.ts` — `(team_count, season_length) → (team_count × season_length × 1) + 10`
- `src/utils/finances/computeLOCut.ts` — `(lo_cut_kind, flat_per_week, percent, weeks_played, pool) → lo_cut_amount`
- `src/utils/finances/distributePrizes.ts` — `(pool, places_paid, shape, rounding_target) → [{place, amount}, ...]`. Supports presets (50_30_20, 40_30_20_10, 35_25_20_12_8, doubling, sliding_scale, flat, custom).
- `src/utils/finances/index.ts` — barrel

**Tests:** comprehensive unit suite per function. Cover:
- Formula correctness on known inputs
- Dropped-team subtraction logic (team drops at week 6 of 12 → loses 6 weeks of income)
- Each prize-distribution shape produces correct ratios
- Rounding behavior at all granularities ($25, $50, $100)
- Rounding remainder correctly added to 1st place
- LO cut math for flat / percent / both modes
- Edge cases: zero teams, zero weeks, pool smaller than min payout per place

**Files:**
- Migration: `supabase/migrations/<date>_league_finances.sql`
- Code: `src/utils/finances/*.ts`
- Tests: `src/utils/finances/__tests__/*.test.ts`

**No UI in this unit.** Validation = green tests + tsc clean.

---

## Unit 2 — League-level "Finances" tab (setup form + running projection)

**Goal:** the operator can open a new "Finances" tab on `LeagueDetail.tsx`, see/edit the league's finance settings (inheriting from org defaults), and view a running income projection while the season is active.

**Files:**
- Create: `src/components/operator/finances/LeagueFinancesTab.tsx` — top-level component
- Create: `src/components/operator/finances/FinanceSettingsCard.tsx` — the editable settings (price, green fee, LO cut shape)
- Create: `src/components/operator/finances/RunningProjectionCard.tsx` — read-mostly view showing income so far + projected end-of-season pool
- Create: `src/api/queries/leagueFinances.ts` — fetches `league_finance_settings` joined with `org_finance_defaults` (effective settings = league override OR org default), plus the season's entries
- Create: `src/api/hooks/useLeagueFinances.ts` — TanStack query hook
- Create: `src/api/mutations/leagueFinanceSettings.ts` — upsert for the league row
- Modify: `src/operator/LeagueDetail.tsx` — add the new "Finances" tab (or section)

**Settings form:**
- Price-per-player-per-night (number input, default from org)
- Green-fee-per-player-per-night (number input, default from org)
- LO cut: kind dropdown (flat / % / both) + the relevant inputs
- "Use org defaults" button to reset overrides

**Running projection card** (shown when season is active):
- Projected total income at season end (formula)
- Projected app fee (auto, with tooltip showing `(N teams × M weeks × $1) + $10`)
- Running projected LO cut
- Projected prize pool
- "Calculate end-of-season payouts" CTA → routes to Unit 4

**Test scenarios:**
- League with no override → shows org defaults inline
- LO edits the price → only this league updates; org default unchanged
- LO clicks "Use org defaults" → row deleted, falls back to inheritance
- Projection updates when team count / season length / settings change

---

## Unit 3 — Expense / credit line items + dropped-team list

**Goal:** the operator can add expense and credit line items (with dates) and mark teams that dropped mid-season. Persists to `season_finance_entries`. Quick-add chips suggest common expense categories.

**Files:**
- Create: `src/components/operator/finances/SeasonExpensesCard.tsx` — list + add form
- Create: `src/components/operator/finances/DroppedTeamsCard.tsx` — picker + week-number entry
- Create: `src/api/queries/seasonFinanceEntries.ts` + hook
- Create: `src/api/mutations/seasonFinanceEntries.ts` — insert / update / delete

**Expense quick-add chips:**
🏆 Trophies · 🖨️ Ink / paper · 🍕 Banquet · 👕 Shirts · 📋 Sanctioning fees · 🎁 LO gift (non-pool-funded) · ➕ Other

**Credit quick-add chips:**
💰 Sponsor cash · 🍺 Bar tab (in-kind) · 🎟️ 50/50 raffle · ➕ Other

**Dropped-team UI:**
- Select team from active teams in the season
- Pick week number they dropped (1-based)
- Calculator deducts the lost weeks from projected income automatically

**Persisted with dates** so the LO has a "what did I spend, when" reference. Each line item gets a delete button (confirms before removing).

**Test scenarios:**
- Add trophies $180 → projection drops $180
- Add sponsor $200 → projection rises $200
- Mark Team X dropped at week 6 of 12 → projection drops by `price × lineup × 6 weeks`
- Delete a line item → projection adjusts
- LO-funded expense (Outstanding Achievement gift) → still appears in expenses but flagged separately

---

## Unit 4 — Payout calculator (the headline slick UI)

**Goal:** the polish budget lands here. Interactive end-of-season calculator with three modes, LO-cut slider, individual awards, and the "non-pool-funded" pattern.

**Files:**
- Create: `src/components/operator/finances/PayoutCalculator.tsx` — main interactive view
- Create: `src/components/operator/finances/PayoutModeSwitch.tsx` — 3-tab toggle (Round / Percentage / Custom)
- Create: `src/components/operator/finances/LOCutSlider.tsx` — live-updating slider
- Create: `src/components/operator/finances/PrizeRowEditor.tsx` — per-place row (read in Round/% modes, editable in Custom)
- Create: `src/components/operator/finances/IndividualAwardsList.tsx` — togglable Top Shooter / MVP / Outstanding Achievement / etc.
- Create: `src/components/operator/finances/ManualPoolEntry.tsx` — Path B: "I have $X, distribute it"
- Reuse: math functions from Unit 1 — all calculations are pure-function calls
- Modify: `src/operator/LeagueDetail.tsx` — Finances tab routes to calculator when season is `completed`

**Three calculation modes:**
1. **Round Numbers** — applies the configured shape, rounds each prize to the configured target. Rounding remainder → 1st place.
2. **Percentage (exact)** — applies the configured shape exactly. Yields uneven amounts ($732.47 etc.).
3. **Custom** — LO types each place's amount; running total + over/under banner shows whether the LO cut needs adjusting.

**LO-cut slider:**
- Top of the calculator
- Adjusts the LO's cut by $ amount (or %)
- Every prize line updates **live** as the slider moves
- "If I take $50 less, 1st place gets $50 more"

**Individual awards section:**
- Default off; LO toggles which to include
- For each enabled award: amount input + "from pool" / "LO-funded" toggle
- "LO-funded" awards don't reduce the pool, shown with 🎁 badge

**Manual pool entry (Path B):**
- "Skip formula, enter pool amount directly" link at the top
- Opens a small form: total pool amount → goes straight into the calculator
- No income/expense tracking required; pure distributor

**Test scenarios:**
- Round mode with $3,840 pool, 50/30/20 split, $25 rounding → 1st=$1,925 (with $5 remainder), 2nd=$1,150, 3rd=$765
- Percentage mode same pool → 1st=$1,920.00, 2nd=$1,152.00, 3rd=$768.00
- Custom mode: LO types $2,000 / $1,000 / $500 — banner shows "+ $340 over current pool — increase LO cut?"
- Slider: drag LO cut from 10% to 5% → all prize lines bump up live
- Individual award added as LO-funded → pool stays the same, award appears with 🎁
- Manual pool entry: $1,000 → instant 50/30/20 split shown

---

## Unit 5 — Org-level defaults + lock-in persistence + season summary

**Goal:** close the loop. Org-level defaults editable from the org settings page (so the LO sets them once and every new league inherits). Calculator's "Lock in payouts" button saves to `season_locked_payouts`. Standings page renders the locked payouts read-only.

**Files:**
- Create: `src/components/operator/finances/OrgFinanceDefaultsCard.tsx` — section on `/operator-settings/:orgId`
- Create: `src/api/mutations/orgFinanceDefaults.ts` + hook
- Modify: `src/operator/OrganizationSettings.tsx` (or wherever org settings live) — add the new section
- Create: `src/api/mutations/lockSeasonPayouts.ts` — atomic insert into `season_locked_payouts`
- Create: `src/api/hooks/useLockSeasonPayouts.ts`
- Modify: `src/components/operator/finances/PayoutCalculator.tsx` — "Lock in payouts" button wires to the mutation
- Modify: standings page (find the right component) — render `season_locked_payouts` data as a "Final Payouts" section, read-only

**Lock-in flow:**
- "Lock in payouts" button confirms via dialog: "This will save the final payouts to the season's record. You can adjust expenses later but the payout structure is locked."
- On confirm: snapshot of all the math (income, deductions, cuts, per-team amounts, individual awards) inserts into `season_locked_payouts`
- After lock-in, the Payout Calculator becomes read-only for that season (operator can still browse, can't edit)
- Standings page surfaces the locked payouts as a "Final Payouts" section

**Test scenarios:**
- Org sets defaults → new league created → defaults inherited automatically
- LO overrides at league level → org-level edit doesn't override the league
- Lock in payouts → calculator becomes read-only
- Standings page shows the locked structure correctly
- Trying to lock when season status != 'completed' → error (or warning)
- Unlock-and-re-edit flow? — out of scope for v1 (locked is locked)

---

## Out of scope (deliberately)

- **Actual payment processing.** App is a calculator. LO handles cash.
- **Player-facing finance visibility** — LO-only for v1
- **Multi-season operator rollup** — dropped per Ed (2026-05-18)
- **Calcutta auctions** — flagged as Phase 2 candidate in brainstorm; needs state-by-state legal disclaimers
- **Carry-over / next-season credit for winners** — interesting but separate feature
- **"Everyone in the money" floor** — power-user option from research, not in v1 defaults
- **Bowling-style dual-layer (place money + point money)** — power-user option, not v1
- **Side pots** (break-and-run raffle, 50/50 raffle running during season) — Phase 2
- **Tax exports** — LO's CPA territory; not us

## Risks / things to watch

- **Numeric precision.** PostgreSQL NUMERIC handles money cleanly; JavaScript number does not. Math engine uses arbitrary-precision-ish via fixed-point integers (cents) internally, formats to dollars for display.
- **Existing season-completion flow.** Locking payouts probably wants to happen alongside (or after) the season being marked completed. Need to verify the existing season-completion trigger doesn't fight us.
- **Migration timing.** This stack already has 4 unmerged branches in front. New tables won't conflict, but local DB resets need them applied. Same dance as the other features in the stack.
- **The standings page integration (Unit 5) needs to find the right component.** Probably `src/components/operator/StandingsCard.tsx` or similar — quick audit before Unit 5.

## PR strategy

Each unit ships as its own commit on a single feature branch (`feat/league-finances-calculator`), then opens as a draft PR (per the no-solo-doc-PR rule already established + the "lots of in-flight branches" pattern). Final PR depends on whatever the merge order ends up being — likely main moves forward via the existing stack first, then we rebase this on top.

## Open questions before starting (none new — all 10 from the brainstorm are settled)

The brainstorm captured A through J. All settled per Ed (2026-05-18). The "standing pick" item E (mid-season expenses apply immediately) is the only one where Ed hasn't explicitly confirmed — but it's the natural-feeling default and was my pick from the start.
