-- Migration: Tournament brackets — add a premium feature to an existing tournament
--
-- add_premium_feature(bracket_id, feature) — buy a feature after the tournament
-- was created, without starting over.
--
-- Until now `premium_features` was written ONCE, at creation, and never again.
-- That froze the decision at the moment an organizer knew least about the night
-- ahead, and it made the in-app upsell impossible: a control you cannot act on
-- is not an offer.
--
-- SETUP ONLY. The charge is computed from this array when the tournament
-- starts, so adding a feature afterwards would change a bill that has already
-- been settled. The status guard lives in the WHERE clause rather than the
-- application, so it holds however the call arrives.
--
-- Appended atomically with array_append + a NOT-already-present test, rather
-- than read-modify-write in the client, so two tabs can't clobber each other's
-- additions.
--
-- The catalog of valid keys lives in TypeScript (premiumFeatures.ts) and is
-- deliberately NOT duplicated here — one list, in the place that also carries
-- the labels, blurbs and prices. This checks shape, not membership.

CREATE OR REPLACE FUNCTION "public"."add_premium_feature"(
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
BEGIN
  v_feature := btrim(COALESCE(p_feature, ''));
  IF v_feature = '' OR char_length(v_feature) > 64 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_feature');
  END IF;

  SELECT * INTO v_bracket FROM brackets WHERE id = p_bracket_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_bracket.status <> 'setup' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_setup', 'status', v_bracket.status);
  END IF;

  -- Already bought: a no-op, not a fault. Two taps shouldn't add it twice, and
  -- the caller only wants to know the feature is now on.
  IF v_bracket.premium_features @> ARRAY[v_feature]::text[] THEN
    RETURN jsonb_build_object('ok', true, 'already_had', true);
  END IF;

  UPDATE brackets
     SET premium_features = array_append(premium_features, v_feature),
         -- Keeps brackets_premium_implies_paid_check satisfied: any feature
         -- forces paid. A free tournament buying its first feature becomes paid
         -- here, which is exactly the tier's definition.
         tier = 'paid',
         last_activity_at = now()
   WHERE id = p_bracket_id;

  RETURN jsonb_build_object('ok', true, 'feature', v_feature);
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."add_premium_feature"("uuid", text) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."add_premium_feature"("uuid", text) TO "authenticated";

COMMENT ON FUNCTION "public"."add_premium_feature"("uuid", text) IS
  'Add a premium feature to a tournament still in setup, so an in-app upsell can work and the choice is not frozen at creation. Atomic append; already-present is a no-op returning ok. Forces tier=paid. Refuses once started, since the charge is computed from this array at start. See docs/plans/2026-09-04-001.';
