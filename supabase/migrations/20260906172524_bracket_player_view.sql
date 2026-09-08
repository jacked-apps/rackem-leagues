-- Migration: Tournament paid foundation — Phase C, Unit C3 (player view)
--
-- get_bracket_player_view(join_token) — what a PLAYER sees after scanning the
-- code: the tournament as it fills up, live.
--
-- Neither existing read fits:
--   • get_bracket_hopper is the organizer's. It carries player numbers and home
--     cities so same-name players can be told apart — PII that must not reach a
--     link printed on a poster.
--   • get_bracket_share reads bracket_participants, which do not exist until
--     Start. During setup it would show an empty bracket, which is exactly the
--     dead end this replaces.
--
-- So this is a THIRD read: names only, plus the tournament's rules, plus the
-- caller's own entry. Anon-callable, because a walk-up who typed their name has
-- no account — the names-only projection IS the authorization boundary, same
-- posture as get_bracket_share.
--
-- "me" is resolved from auth.uid() and is the ONLY place a paid flag appears. A
-- player may see whether THEY have paid; publishing who still owes money on a
-- link anyone can open would turn the page into a debt board.
--
-- Matches and participants are included once the bracket exists so the page can
-- show the bracket itself without a second round trip.

CREATE OR REPLACE FUNCTION "public"."get_bracket_player_view"("p_join_token" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_bracket brackets%ROWTYPE;
  v_member_id uuid;
  v_me jsonb;
  v_waiting jsonb;
  v_official jsonb;
  v_matches jsonb;
  v_participants jsonb;
BEGIN
  SELECT * INTO v_bracket FROM brackets WHERE join_token = p_join_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Names + arrival order only. No member_id, no player number, no home.
  SELECT jsonb_agg(h.display_name ORDER BY h.created_at)
    INTO v_waiting
    FROM bracket_hopper h
   WHERE h.bracket_id = v_bracket.id AND h.status = 'hopper';

  SELECT jsonb_agg(h.display_name ORDER BY COALESCE(h.seed, 2147483647), h.created_at)
    INTO v_official
    FROM bracket_hopper h
   WHERE h.bracket_id = v_bracket.id AND h.status = 'official';

  -- The caller's OWN row, when they are signed in. A walk-up who typed a name
  -- has no session, so they get null here and the page falls back to the local
  -- note it kept for them.
  SELECT id INTO v_member_id FROM members WHERE user_id = auth.uid();
  IF v_member_id IS NOT NULL THEN
    SELECT jsonb_build_object(
             'display_name', h.display_name,
             'status', h.status,
             'paid_status', h.paid_status
           )
      INTO v_me
      FROM bracket_hopper h
     WHERE h.bracket_id = v_bracket.id AND h.member_id = v_member_id;
  END IF;

  -- Only once there is a bracket to look at. Participants come too (names +
  -- seeds, no member_id — same projection as get_bracket_share) because the
  -- match rows reference players by id and would otherwise render as blanks.
  IF v_bracket.status <> 'setup' THEN
    SELECT jsonb_agg(
             jsonb_build_object('id', p.id, 'display_name', p.display_name, 'seed', p.seed)
             ORDER BY p.seed
           )
      INTO v_participants
      FROM bracket_participants p
     WHERE p.bracket_id = v_bracket.id;

    SELECT jsonb_agg(
             jsonb_build_object(
               'id', m.id, 'round', m.round, 'side', m.side, 'slot', m.slot,
               'home_participant_id', m.home_participant_id,
               'away_participant_id', m.away_participant_id,
               'winner_participant_id', m.winner_participant_id,
               'next_match_id', m.next_match_id, 'next_match_slot', m.next_match_slot,
               'loser_next_match_id', m.loser_next_match_id,
               'loser_next_match_slot', m.loser_next_match_slot,
               'status', m.status, 'in_progress', m.in_progress,
               'is_reset_match', m.is_reset_match
             ) ORDER BY m.round, m.slot
           )
      INTO v_matches
      FROM bracket_matches m
     WHERE m.bracket_id = v_bracket.id;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'bracket', jsonb_build_object(
      'id', v_bracket.id,
      'name', v_bracket.name,
      'status', v_bracket.status,
      'format', v_bracket.format,
      'grand_final_reset', v_bracket.grand_final_reset,
      'game_type', v_bracket.game_type,
      'premium_features', v_bracket.premium_features
    ),
    'waiting', COALESCE(v_waiting, '[]'::jsonb),
    'official', COALESCE(v_official, '[]'::jsonb),
    'me', v_me,
    'participants', COALESCE(v_participants, '[]'::jsonb),
    'matches', COALESCE(v_matches, '[]'::jsonb)
  );
END;
$$;

-- Anon-callable on purpose: a walk-up has no account. The projection above is
-- the boundary — names, rules, and the caller's own row, nothing else.
GRANT EXECUTE ON FUNCTION "public"."get_bracket_player_view"("uuid") TO "anon", "authenticated";

COMMENT ON FUNCTION "public"."get_bracket_player_view"("uuid") IS
  'Player-facing read of a tournament by join_token: names-only waiting + official lists, the tournament rules, the caller''s OWN entry (incl. their paid flag, from auth.uid()), and the matches once started. Anon-callable — the projection is the authorization boundary, like get_bracket_share. Never exposes another player''s paid status or identifying fields. See docs/plans/2026-09-04-001.';
