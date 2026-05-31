-- ============================================================================
-- League Finances + Payout Calculator — schema
--
-- 4 new tables supporting the LO-facing payout calculator feature.
-- This is a calculator + record-keeper, NOT a payment processor. The
-- LO handles actual cash/Venmo/checks; the app does math + persistence.
--
-- See:
--   docs/brainstorms/2026-05-18-league-finances-payout-calculator-requirements.md
--   docs/plans/2026-05-18-001-feat-league-finances-payout-calculator-plan.md (Unit 1)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Org-wide finance defaults
--
-- Every league under this org inherits these unless overridden. LO edits
-- once on the org settings page; every future league starts pre-filled.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."org_finance_defaults" (
  "organization_id"                  uuid PRIMARY KEY REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "price_per_player_per_night"       numeric(10,2) NOT NULL DEFAULT 10.00,
  "green_fee_per_player_per_night"   numeric(10,2) NOT NULL DEFAULT 2.00,
  -- 'flat' | 'percentage' | 'both' — supports all three LO-cut models
  "lo_cut_kind"                      text NOT NULL DEFAULT 'percentage',
  "lo_cut_flat_per_week"             numeric(10,2) NOT NULL DEFAULT 0,
  "lo_cut_percent"                   numeric(5,2)  NOT NULL DEFAULT 10.00,
  -- Preset key ('50_30_20' | '40_30_20_10' | '35_25_20_12_8' | 'doubling' |
  -- 'sliding_scale' | 'flat' | 'custom'). 'custom' reads from
  -- league_finance_settings.custom_payout_percentages.
  "payout_shape"                     text NOT NULL DEFAULT '50_30_20',
  "payout_places_paid"               integer NOT NULL DEFAULT 3,
  -- Rounding target — round each prize to nearest $N. 0 = no rounding.
  "payout_rounding_target"           numeric(10,2) NOT NULL DEFAULT 25.00,
  "created_at"                       timestamptz NOT NULL DEFAULT now(),
  "updated_at"                       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "org_finance_defaults_lo_cut_kind_check"
    CHECK (lo_cut_kind IN ('flat', 'percentage', 'both')),
  CONSTRAINT "org_finance_defaults_places_paid_check"
    CHECK (payout_places_paid > 0 AND payout_places_paid <= 50)
);

ALTER TABLE "public"."org_finance_defaults" OWNER TO "postgres";

COMMENT ON TABLE "public"."org_finance_defaults" IS
  'Org-wide finance defaults inherited by all leagues in this org. League-level league_finance_settings rows override individual fields.';

-- ----------------------------------------------------------------------------
-- 2. League-level finance settings (override of org defaults)
--
-- Every field is nullable. NULL = inherit from org_finance_defaults.
-- Resolved settings for a league = COALESCE(league, org, hard default).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."league_finance_settings" (
  "league_id"                        uuid PRIMARY KEY REFERENCES "public"."leagues"("id") ON DELETE CASCADE,
  "price_per_player_per_night"       numeric(10,2),
  "green_fee_per_player_per_night"   numeric(10,2),
  "lo_cut_kind"                      text,
  "lo_cut_flat_per_week"             numeric(10,2),
  "lo_cut_percent"                   numeric(5,2),
  "payout_shape"                     text,
  "payout_places_paid"               integer,
  "payout_rounding_target"           numeric(10,2),
  -- If payout_shape='custom', this is the per-place percentage array.
  -- Length must equal payout_places_paid. Sum must equal 100 (validation
  -- at the app layer; not enforced via constraint to allow draft state).
  "custom_payout_percentages"        numeric(5,2)[],
  "created_at"                       timestamptz NOT NULL DEFAULT now(),
  "updated_at"                       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "league_finance_settings_lo_cut_kind_check"
    CHECK (lo_cut_kind IS NULL OR lo_cut_kind IN ('flat', 'percentage', 'both'))
);

ALTER TABLE "public"."league_finance_settings" OWNER TO "postgres";

COMMENT ON TABLE "public"."league_finance_settings" IS
  'Per-league overrides of org_finance_defaults. NULL columns inherit from the org row. Resolved settings = COALESCE(league override, org default, hardcoded fallback).';

-- ----------------------------------------------------------------------------
-- 3. Season finance entries (expenses, credits, dropped teams)
--
-- Polymorphic line-item table. Each row is one expense (trophies $180),
-- one credit (sponsor $200), or one dropped-team marker. Calculator
-- iterates these to adjust the projected prize pool.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."season_finance_entries" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "season_id"                uuid NOT NULL REFERENCES "public"."seasons"("id") ON DELETE CASCADE,
  -- 'expense' | 'credit' | 'dropped_team'
  -- expense  → amount is positive, deducted from pool
  -- credit   → amount is positive, added to pool (sponsor money, raffle income)
  -- dropped_team → amount is NULL (computed dynamically from team + week);
  --   dropped_team_id and dropped_at_week populated instead
  "entry_type"               text NOT NULL,
  "amount"                   numeric(10,2),
  "description"              text NOT NULL,
  "entry_date"               date NOT NULL DEFAULT CURRENT_DATE,
  -- Non-pool-funded flag — for things like "Outstanding Achievement"
  -- (Ed's developmental award for the worst player, funded from LO's
  -- pocket, NOT from the prize pool). Only meaningful for expense rows.
  -- TRUE means the expense doesn't reduce the pool; it's just tracked
  -- for the LO's records.
  "lo_funded"                boolean NOT NULL DEFAULT FALSE,
  -- Only populated when entry_type='dropped_team':
  "dropped_team_id"          uuid REFERENCES "public"."teams"("id") ON DELETE SET NULL,
  "dropped_at_week"          integer, -- 1-based week number
  "created_at"               timestamptz NOT NULL DEFAULT now(),
  "updated_at"               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "season_finance_entries_type_check"
    CHECK (entry_type IN ('expense', 'credit', 'dropped_team')),
  -- If it's an expense or credit, amount must be present.
  CONSTRAINT "season_finance_entries_amount_required"
    CHECK (
      (entry_type IN ('expense', 'credit') AND amount IS NOT NULL AND amount > 0)
      OR
      (entry_type = 'dropped_team' AND dropped_team_id IS NOT NULL AND dropped_at_week IS NOT NULL)
    )
);

ALTER TABLE "public"."season_finance_entries" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "season_finance_entries_season_id_idx"
  ON "public"."season_finance_entries" ("season_id");

COMMENT ON TABLE "public"."season_finance_entries" IS
  'Per-season line items used by the payout calculator. Polymorphic: expense, credit, or dropped_team. lo_funded flag separates non-pool-funded gifts (e.g., Outstanding Achievement) from regular pool-funded expenses.';

-- ----------------------------------------------------------------------------
-- 4. Locked-in season payouts (immutable snapshot at season end)
--
-- When the LO hits "Lock in payouts" at season end, the entire calc
-- snapshots into this table. One row per season. After lock, the
-- calculator becomes read-only for that season.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."season_locked_payouts" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "season_id"                uuid UNIQUE NOT NULL REFERENCES "public"."seasons"("id") ON DELETE CASCADE,
  -- Snapshot of all the math at lock time. Read-only afterward.
  "total_income"             numeric(10,2) NOT NULL,
  "total_deductions"         numeric(10,2) NOT NULL,
  "total_credits"            numeric(10,2) NOT NULL,
  "app_fee"                  numeric(10,2) NOT NULL,
  "lo_cut_amount"            numeric(10,2) NOT NULL,
  "final_prize_pool"         numeric(10,2) NOT NULL,
  -- Per-team payouts. Shape: [{team_id: UUID, place: int, amount: numeric}, ...]
  "team_payouts"             jsonb NOT NULL,
  -- Per-individual awards. Shape: [{member_id: UUID, label: text, amount: numeric, lo_funded: bool}, ...]
  "individual_awards"        jsonb NOT NULL,
  "locked_at"                timestamptz NOT NULL DEFAULT now(),
  "locked_by_member_id"      uuid REFERENCES "public"."members"("id")
);

ALTER TABLE "public"."season_locked_payouts" OWNER TO "postgres";

COMMENT ON TABLE "public"."season_locked_payouts" IS
  'Immutable snapshot of the final payout calculation when the LO clicks "Lock in payouts" at season end. One row per season. After insertion, the payout calculator UI becomes read-only for that season.';

-- ----------------------------------------------------------------------------
-- 5. updated_at maintenance triggers (standard pattern in this codebase)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."tg_finance_settings_updated_at"()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."tg_finance_settings_updated_at"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_org_finance_defaults_updated_at" ON "public"."org_finance_defaults";
CREATE TRIGGER "trg_org_finance_defaults_updated_at"
  BEFORE UPDATE ON "public"."org_finance_defaults"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."tg_finance_settings_updated_at"();

DROP TRIGGER IF EXISTS "trg_league_finance_settings_updated_at" ON "public"."league_finance_settings";
CREATE TRIGGER "trg_league_finance_settings_updated_at"
  BEFORE UPDATE ON "public"."league_finance_settings"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."tg_finance_settings_updated_at"();

DROP TRIGGER IF EXISTS "trg_season_finance_entries_updated_at" ON "public"."season_finance_entries";
CREATE TRIGGER "trg_season_finance_entries_updated_at"
  BEFORE UPDATE ON "public"."season_finance_entries"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."tg_finance_settings_updated_at"();
