-- Migration: Tournament brackets — take a premium feature back off, while unused
--
-- remove_premium_feature(bracket_id, feature) — the counterpart to
-- add_premium_feature, so a mis-tapped upsell is recoverable.
--
-- WHY THERE IS A LIMIT AT ALL: without one, an organizer could add entry-fee
-- tracking, tick everybody off as they paid, and remove it before starting —
-- having used the feature for the whole night and paid nothing.
--
-- WHY THE LIMIT IS AN ALLOWANCE RATHER THAN "USED ONCE, BOUGHT" (Ed, 2026-09-08):
-- tracking five people is trivial and not worth charging for; the feature earns
-- its keep at 32 or 64 players. So the first few uses are the DEMO, not
-- leakage — they let an organizer see it work at a size they'd never have paid
-- for, and the bill arrives at the size where they would.
--
-- Usage is measured per feature. Only payment_tracker has a meaningful measure
-- today (players actually marked paid); the rest are shells with nothing to
-- consume, so they come off freely.
--
-- SETUP ONLY, like adding: the charge is computed from this list at start.

CREATE OR REPLACE FUNCTION "public"."remove_premium_feature"(
  "p_bracket_id" "uuid",
  "p_feature" text
)
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_bracket brackets%ROWTYPE;
  v_feature text;
  v_used    integer := 0;
  c_free_uses CONSTANT integer := 5;
BEGIN
  v_feature := btrim(COALESCE(p_feature, ''));
  IF v_feature = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_feature');
  END IF;

  SELECT * INTO v_bracket FROM brackets WHERE id = p_bracket_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_bracket.status <> 'setup' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_setup', 'status', v_bracket.status);
  END IF;

  -- Not on the tournament: a no-op, not a fault. The caller only wants it off.
  IF NOT (v_bracket.premium_features @> ARRAY[v_feature]::text[]) THEN
    RETURN jsonb_build_object('ok', true, 'already_off', true);
  END IF;

  -- How much of the feature has actually been consumed.
  IF v_feature = 'payment_tracker' THEN
    SELECT count(*) INTO v_used
      FROM bracket_hopper
     WHERE bracket_id = p_bracket_id AND paid_status = 'paid';
  END IF;

  IF v_used > c_free_uses THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'in_use', 'used', v_used, 'free_uses', c_free_uses
    );
  END IF;

  UPDATE brackets
     SET premium_features = array_remove(premium_features, v_feature),
         -- Back to free only when nothing is left; the constraint requires
         -- tier=paid for any non-empty list, and cardinality is checked AFTER
         -- the removal in the same statement.
         tier = CASE
                  WHEN cardinality(array_remove(premium_features, v_feature)) = 0
                  THEN 'free' ELSE tier
                END,
         last_activity_at = now()
   WHERE id = p_bracket_id;

  RETURN jsonb_build_object('ok', true, 'feature', v_feature);
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."remove_premium_feature"("uuid", text) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."remove_premium_feature"("uuid", text) TO "authenticated";

COMMENT ON FUNCTION "public"."remove_premium_feature"("uuid", text) IS
  'Take a premium feature back off a tournament still in setup, so a mis-tapped upsell is recoverable. Refuses once the feature has been USED beyond a small free allowance (5 players marked paid, for payment_tracker) — otherwise it could be used all night and dropped before the bill. Setup-only. See docs/plans/2026-09-04-001.';
