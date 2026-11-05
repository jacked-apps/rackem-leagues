-- Migration: the race engine
--
-- Four things a race can have done to it, all server-side:
--
--   start_race         someone taps who breaks first; game 1 appears
--   record_race_game   a player enters a result and vouches for it
--   confirm_race_game  the other player agrees -> the result is official,
--                      and the race either finishes or grows a new game
--   vacate_race_game   wipe a game's result so it can be played/entered again
--
-- WHY THE APPEND LIVES HERE AND NOT IN THE BROWSER. The next game is written
-- only when every existing game is confirmed and neither side has reached its
-- goal. Both phones evaluate that gate at the same instant — the moment the
-- second confirmation lands — so a client-side append would race and write two
-- game 6s. The append therefore happens inside the same transaction as the
-- confirmation that satisfied the gate, after a FOR UPDATE lock on the race
-- row, with the unique constraint on (race_id, game_number) as the backstop.
--
-- WHY A RACE IS LINEAR. Two people play a race; both are at the table for all of
-- it. Nobody is off playing a different game, so games cannot be played or
-- entered out of order — which is the whole reason a round-robin match night
-- allows it (someone is in the bathroom and must not stall the other 24 games).
-- So a race is a straight line:
--
--   * a result may be entered only on the EARLIEST game that has none
--   * a result may be wiped only on the LATEST game that has one
--
-- To fix game 3 of 5, you reverse 5, then 4, then 3. That is deliberately
-- stricter than the league's per-game vacate, and it is what keeps the score a
-- simple count: the played games are always an unbroken run from game 1, so
-- "reached their goal" can never mean two different things.
--
-- These functions are the ONLY way to write these tables — the tables
-- themselves are SELECT-only for anon and authenticated (see the races
-- migration). Each is SECURITY DEFINER so it can write, and each re-derives the
-- caller's identity from auth rather than trusting a parameter.
--
-- @see docs/plans/2026-09-09-001-feat-self-scoring-individual-races-plan.md


-- ============================================================================
-- 1. Read helpers
-- ============================================================================

-- Which side of this race the member sits on, or NULL if they are not in it.
-- Every write path funnels through this, so "may this person score?" has one
-- answer in one place.
CREATE OR REPLACE FUNCTION "public"."race_side_of"(p_race_id uuid, p_member_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE
           WHEN r.home_member_id = p_member_id THEN 'home'
           WHEN r.away_member_id = p_member_id THEN 'away'
           ELSE NULL
         END
  FROM races r WHERE r.id = p_race_id;
$$;

COMMENT ON FUNCTION "public"."race_side_of"(uuid, uuid) IS
'home | away | NULL — which side of the race a member sits on. The single answer to "may this person score this race?".';


-- The race's standing, walked in game order over OFFICIAL games only (both
-- sides confirmed). Returns the announced score and, if someone has reached
-- their goal, who got there first and at which game.
CREATE OR REPLACE FUNCTION "public"."race_standing"(p_race_id uuid)
RETURNS TABLE (home_won integer, away_won integer, winner_player_id uuid, decided_at_game integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_race races%ROWTYPE;
BEGIN
  SELECT * INTO v_race FROM races WHERE id = p_race_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Official games only: both sides confirmed. Because play is linear, these
  -- are always an unbroken run from game 1, so counting them is enough — there
  -- is no arrangement where one side "got there first" by a different route.
  SELECT
    coalesce(count(*) FILTER (WHERE g.winner_player_id = v_race.home_member_id), 0),
    coalesce(count(*) FILTER (WHERE g.winner_player_id = v_race.away_member_id), 0),
    max(g.game_number)
  INTO home_won, away_won, decided_at_game
  FROM race_games g
  WHERE g.race_id = p_race_id
    AND g.winner_player_id IS NOT NULL
    AND g.confirmed_by_home IS NOT NULL
    AND g.confirmed_by_away IS NOT NULL;

  IF home_won >= v_race.goal_home THEN
    winner_player_id := v_race.home_member_id;
  ELSIF away_won >= v_race.goal_away THEN
    winner_player_id := v_race.away_member_id;
  ELSE
    winner_player_id := NULL;
    decided_at_game  := NULL; -- nobody is there yet; no game decided anything
  END IF;

  RETURN NEXT;
END;
$$;


COMMENT ON FUNCTION "public"."race_standing"(uuid) IS
'The announced score plus who (if anyone) has reached their goal. Counts only official games — both sides confirmed. A plain count is correct because play is linear: the played games are always an unbroken run from game 1.';


-- Who breaks game N, from the race's break rule. Called only by the append, so
-- a game's breaker is decided when it is actually knowable — which is what
-- winner-breaks requires.
CREATE OR REPLACE FUNCTION "public"."race_breaker_side"(p_race_id uuid, p_game_number integer)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_race       races%ROWTYPE;
  v_prev_wpid  uuid;
BEGIN
  SELECT * INTO v_race FROM races WHERE id = p_race_id;
  IF NOT FOUND OR v_race.first_breaker_side IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_game_number <= 1 THEN
    RETURN v_race.first_breaker_side;
  END IF;

  IF v_race.break_rule = 'winner_breaks' THEN
    SELECT g.winner_player_id INTO v_prev_wpid
    FROM race_games g
    WHERE g.race_id = p_race_id AND g.game_number = p_game_number - 1;

    IF v_prev_wpid IS NULL THEN
      RETURN NULL; -- previous game undecided: the breaker is not knowable yet
    END IF;
    RETURN CASE WHEN v_prev_wpid = v_race.home_member_id THEN 'home' ELSE 'away' END;
  END IF;

  -- alternate: the break passes every game
  IF (p_game_number - 1) % 2 = 0 THEN
    RETURN v_race.first_breaker_side;
  END IF;
  RETURN CASE WHEN v_race.first_breaker_side = 'home' THEN 'away' ELSE 'home' END;
END;
$$;

COMMENT ON FUNCTION "public"."race_breaker_side"(uuid, integer) IS
'Which side breaks game N under the race''s break rule. NULL when not yet knowable (winner-breaks with the previous game undecided).';


-- ============================================================================
-- 2. Internal: append the next game, or finish the race
-- ============================================================================
--
-- Called only from confirm/vacate, always with the race row already locked.
-- Decides between three outcomes: someone won, the race grows, or nothing
-- changes because a game is still unconfirmed.

CREATE OR REPLACE FUNCTION "public"."race_advance"(p_race_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_race        races%ROWTYPE;
  v_standing    RECORD;
  v_unconfirmed integer;
  v_max_game    integer;
  v_breaker     text;
BEGIN
  SELECT * INTO v_race FROM races WHERE id = p_race_id;

  SELECT * INTO v_standing FROM race_standing(p_race_id);

  -- Someone reached their number: the race is over and says so. It does not
  -- act on anything else — whoever owns this race reacts to it.
  IF v_standing.winner_player_id IS NOT NULL THEN
    UPDATE races
    SET status = 'finished', winner_player_id = v_standing.winner_player_id, last_activity_at = now()
    WHERE id = p_race_id;
    RETURN;
  END IF;

  -- Not finished — so if it was previously finished (a vacate dropped the
  -- score back under the goal), un-finish it.
  IF v_race.status = 'finished' THEN
    UPDATE races SET status = 'in_play', winner_player_id = NULL, last_activity_at = now()
    WHERE id = p_race_id;
  END IF;

  -- Every existing game must be official before another one exists. A game
  -- that was never played must never be a row.
  SELECT count(*) INTO v_unconfirmed
  FROM race_games g
  WHERE g.race_id = p_race_id
    AND (g.winner_player_id IS NULL OR g.confirmed_by_home IS NULL OR g.confirmed_by_away IS NULL);

  IF v_unconfirmed > 0 THEN
    RETURN;
  END IF;

  SELECT coalesce(max(g.game_number), 0) INTO v_max_game
  FROM race_games g WHERE g.race_id = p_race_id;

  v_breaker := race_breaker_side(p_race_id, v_max_game + 1);
  IF v_breaker IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO race_games (race_id, game_number, home_action, away_action, game_type)
  VALUES (
    p_race_id,
    v_max_game + 1,
    CASE WHEN v_breaker = 'home' THEN 'breaks' ELSE 'racks' END,
    CASE WHEN v_breaker = 'away' THEN 'breaks' ELSE 'racks' END,
    v_race.game_type
  )
  ON CONFLICT (race_id, game_number) DO NOTHING;

  UPDATE races SET last_activity_at = now() WHERE id = p_race_id;
END;
$$;

COMMENT ON FUNCTION "public"."race_advance"(uuid) IS
'Internal. With the race row locked: finish the race if someone reached their goal, un-finish it if a vacate dropped the score back under, else append the next game once every existing game is official.';


-- ============================================================================
-- 3. create_race — the settings a race is born with
-- ============================================================================
--
-- Everything a race needs is chosen here and never asked again: the two
-- players, a goal EACH, the break rule, and the game type.
--
-- The two goals are independent on purpose. Equal goals is the plain case;
-- unequal goals is a handicap — the stronger player races to more. Nothing
-- else about the race changes between them, which is why the goals are two
-- ordinary columns rather than a handicap feature bolted on later.

CREATE OR REPLACE FUNCTION "public"."create_race"(
  p_home_member_id uuid,
  p_away_member_id uuid,
  p_goal_home      integer,
  p_goal_away      integer,
  p_break_rule     text DEFAULT 'alternate',
  p_game_type      text DEFAULT 'eight_ball'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_member uuid := get_current_member_id();
  v_race_id uuid;
BEGIN
  IF v_member IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- You can set up your own race, not other people's.
  IF v_member NOT IN (p_home_member_id, p_away_member_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_player');
  END IF;

  IF p_home_member_id = p_away_member_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'same_player');
  END IF;

  IF coalesce(p_goal_home, 0) < 1 OR coalesce(p_goal_away, 0) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_goal');
  END IF;

  IF p_break_rule NOT IN ('alternate', 'winner_breaks') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_break_rule');
  END IF;

  IF p_game_type NOT IN ('eight_ball', 'nine_ball', 'ten_ball') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_game_type');
  END IF;

  INSERT INTO races (home_member_id, away_member_id, goal_home, goal_away, break_rule, game_type)
  VALUES (p_home_member_id, p_away_member_id, p_goal_home, p_goal_away, p_break_rule, p_game_type)
  RETURNING id INTO v_race_id;

  RETURN jsonb_build_object('ok', true, 'race_id', v_race_id);
END;
$$;

COMMENT ON FUNCTION "public"."create_race"(uuid, uuid, integer, integer, text, text) IS
'Set up a race: the two players, a goal EACH (unequal goals are the handicapped case), the break rule (alternate | winner_breaks) and the game type. The caller must be one of the two players.';


-- ============================================================================
-- 3. start_race — a race opens by naming who breaks
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."start_race"(p_race_id uuid, p_first_breaker_side text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_member uuid := get_current_member_id();
  v_race   races%ROWTYPE;
  v_side   text;
BEGIN
  IF p_first_breaker_side IS NULL OR p_first_breaker_side NOT IN ('home', 'away') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_side');
  END IF;

  SELECT * INTO v_race FROM races WHERE id = p_race_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_such_race');
  END IF;

  v_side := race_side_of(p_race_id, v_member);
  IF v_side IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_race');
  END IF;

  -- Idempotent: a second tap from the other phone is a no-op, not an error.
  IF v_race.status <> 'created' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_started');
  END IF;

  UPDATE races
  SET first_breaker_side = p_first_breaker_side, status = 'in_play', last_activity_at = now()
  WHERE id = p_race_id;

  INSERT INTO race_games (race_id, game_number, home_action, away_action, game_type)
  VALUES (
    p_race_id, 1,
    CASE WHEN p_first_breaker_side = 'home' THEN 'breaks' ELSE 'racks' END,
    CASE WHEN p_first_breaker_side = 'away' THEN 'breaks' ELSE 'racks' END,
    v_race.game_type
  )
  ON CONFLICT (race_id, game_number) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION "public"."start_race"(uuid, text) IS
'Open a race: record who breaks game 1 (however it was decided at the table) and write game 1. Idempotent — a second tap from the other phone is a no-op.';


-- The previous signature is dropped rather than left alongside: adding an
-- argument with a default would otherwise leave two overloads, and a call
-- naming neither would be ambiguous at runtime.
DROP FUNCTION IF EXISTS "public"."record_race_game"(uuid, integer, uuid, boolean, boolean, boolean, boolean, boolean, integer, integer);

-- ============================================================================
-- 4. record_race_game — a player enters a result and vouches for it
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."record_race_game"(
  p_race_id        uuid,
  p_game_number    integer,
  p_winner_player_id uuid,
  p_break_and_run  boolean DEFAULT false,
  p_golden_break   boolean DEFAULT false,
  p_early_eight    boolean DEFAULT false,
  p_break_fouled   boolean DEFAULT false,
  p_runout         boolean DEFAULT false,
  p_win_by_forfeit boolean DEFAULT false,
  p_winner_value   integer DEFAULT NULL,
  p_loser_value    integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_member uuid := get_current_member_id();
  v_race   races%ROWTYPE;
  v_side   text;
  v_game   race_games%ROWTYPE;
  v_next   integer;
BEGIN
  SELECT * INTO v_race FROM races WHERE id = p_race_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_such_race');
  END IF;

  v_side := race_side_of(p_race_id, v_member);
  IF v_side IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_race');
  END IF;

  IF v_race.status NOT IN ('in_play', 'finished') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'race_not_live');
  END IF;

  IF p_winner_player_id NOT IN (v_race.home_member_id, v_race.away_member_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'winner_not_in_race');
  END IF;

  SELECT * INTO v_game FROM race_games
  WHERE race_id = p_race_id AND game_number = p_game_number;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_such_game');
  END IF;

  -- Linear play, entry end: a result goes on the earliest game that is not yet
  -- SETTLED (both sides confirmed). Not "has no result" — that would trap the
  -- pair the moment one of them taps the wrong name, since the fix would need a
  -- vacate before the opponent had even agreed. This still blocks changing a
  -- settled game, which is what the reversal rule is actually protecting.
  SELECT min(g.game_number) INTO v_next
  FROM race_games g
  WHERE g.race_id = p_race_id
    AND (g.winner_player_id IS NULL
         OR g.confirmed_by_home IS NULL
         OR g.confirmed_by_away IS NULL);

  IF v_next IS DISTINCT FROM p_game_number THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_next_game', 'next_game', v_next);
  END IF;

  -- Entering a result replaces whatever was there and RESETS the other side's
  -- vouch: they agreed to the old result, not this one. Officiality is never
  -- inherited across a change.
  UPDATE race_games
  SET winner_player_id  = p_winner_player_id,
      break_and_run     = p_break_and_run,
      golden_break      = p_golden_break,
      early_eight       = p_early_eight,
      break_fouled      = p_break_fouled,
      runout            = p_runout,
      win_by_forfeit    = p_win_by_forfeit,
      winner_value      = p_winner_value,
      loser_value       = p_loser_value,
      confirmed_by_home = CASE WHEN v_side = 'home' THEN v_member ELSE NULL END,
      confirmed_by_away = CASE WHEN v_side = 'away' THEN v_member ELSE NULL END,
      confirmed_at      = NULL,
      updated_at        = now()
  WHERE id = v_game.id;

  INSERT INTO race_confirmations (
    race_id, game_id, game_number, confirmer_id, side, action, is_initiator,
    winner_player_id, break_and_run, golden_break, early_eight, break_fouled, runout,
    win_by_forfeit, winner_value, loser_value
  ) VALUES (
    p_race_id, v_game.id, p_game_number, v_member, v_side, 'confirm', true,
    p_winner_player_id, p_break_and_run, p_golden_break, p_early_eight, p_break_fouled,
    p_runout, p_win_by_forfeit, p_winner_value, p_loser_value
  );

  -- A changed result can un-finish a race that had been decided.
  PERFORM race_advance(p_race_id);

  RETURN jsonb_build_object('ok', true, 'side', v_side);
END;
$$;

COMMENT ON FUNCTION "public"."record_race_game"(uuid, integer, uuid, boolean, boolean, boolean, boolean, boolean, boolean, integer, integer) IS
'Enter a game result and vouch for it. Replaces any previous result and clears the other side''s confirmation — they agreed to the old result, not this one.';


-- ============================================================================
-- 5. confirm_race_game — the other player agrees
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."confirm_race_game"(p_race_id uuid, p_game_number integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_member uuid := get_current_member_id();
  v_race   races%ROWTYPE;
  v_side   text;
  v_game   race_games%ROWTYPE;
BEGIN
  SELECT * INTO v_race FROM races WHERE id = p_race_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_such_race');
  END IF;

  v_side := race_side_of(p_race_id, v_member);
  IF v_side IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_race');
  END IF;

  SELECT * INTO v_game FROM race_games
  WHERE race_id = p_race_id AND game_number = p_game_number;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_such_game');
  END IF;

  IF v_game.winner_player_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_to_confirm');
  END IF;

  -- Idempotent: re-tapping confirm is a no-op, not a second vouch.
  IF (v_side = 'home' AND v_game.confirmed_by_home IS NOT NULL)
     OR (v_side = 'away' AND v_game.confirmed_by_away IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_confirmed');
  END IF;

  UPDATE race_games
  SET confirmed_by_home = CASE WHEN v_side = 'home' THEN v_member ELSE confirmed_by_home END,
      confirmed_by_away = CASE WHEN v_side = 'away' THEN v_member ELSE confirmed_by_away END,
      confirmed_at      = now(),
      updated_at        = now()
  WHERE id = v_game.id;

  INSERT INTO race_confirmations (
    race_id, game_id, game_number, confirmer_id, side, action, is_initiator,
    winner_player_id, break_and_run, golden_break, early_eight, break_fouled, runout,
    win_by_forfeit, winner_value, loser_value
  ) VALUES (
    p_race_id, v_game.id, p_game_number, v_member, v_side, 'confirm', false,
    v_game.winner_player_id, v_game.break_and_run, v_game.golden_break,
    v_game.early_eight, v_game.break_fouled, v_game.runout, v_game.win_by_forfeit,
    v_game.winner_value, v_game.loser_value
  );

  -- The gate is re-checked here, under the lock taken above, in the same
  -- transaction as this confirmation. This is the only place a new game is born.
  PERFORM race_advance(p_race_id);

  RETURN jsonb_build_object('ok', true, 'side', v_side);
END;
$$;

COMMENT ON FUNCTION "public"."confirm_race_game"(uuid, integer) IS
'Agree with a game result. Once both sides have, the result is official and the race either finishes or grows its next game — in this same transaction, under the race lock, so two phones cannot both append.';


-- ============================================================================
-- 6. vacate_race_game — wipe a result so it can be entered again
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."vacate_race_game"(p_race_id uuid, p_game_number integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_member uuid := get_current_member_id();
  v_race   races%ROWTYPE;
  v_side   text;
  v_game   race_games%ROWTYPE;
  v_last   integer;
BEGIN
  SELECT * INTO v_race FROM races WHERE id = p_race_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_such_race');
  END IF;

  v_side := race_side_of(p_race_id, v_member);
  IF v_side IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_race');
  END IF;

  SELECT * INTO v_game FROM race_games
  WHERE race_id = p_race_id AND game_number = p_game_number;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_such_game');
  END IF;

  IF v_game.winner_player_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_empty');
  END IF;

  -- Linear play, wipe end: only the last game with a result comes off. To fix
  -- game 3 of 5, reverse 5, then 4, then 3. The room disables the button on
  -- every other game; this is what makes that a rule rather than a nudge.
  SELECT max(g.game_number) INTO v_last
  FROM race_games g WHERE g.race_id = p_race_id AND g.winner_player_id IS NOT NULL;

  IF v_last IS DISTINCT FROM p_game_number THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_last_game', 'last_game', v_last);
  END IF;

  -- The vacate marker goes in BEFORE the wipe, carrying the result being
  -- wiped. Dissent detection reads it to scope vouches to the current result:
  -- people who agreed with the old score must not be shown as disagreeing
  -- with the new one.
  INSERT INTO race_confirmations (
    race_id, game_id, game_number, confirmer_id, side, action, is_initiator,
    winner_player_id, break_and_run, golden_break, early_eight, break_fouled, runout,
    win_by_forfeit, winner_value, loser_value
  ) VALUES (
    p_race_id, v_game.id, p_game_number, v_member, v_side, 'vacate', false,
    v_game.winner_player_id, v_game.break_and_run, v_game.golden_break,
    v_game.early_eight, v_game.break_fouled, v_game.runout, v_game.win_by_forfeit,
    v_game.winner_value, v_game.loser_value
  );

  UPDATE race_games
  SET winner_player_id = NULL, winner_team_id = NULL,
      break_and_run = false, golden_break = false, early_eight = false,
      break_fouled = false, runout = false, win_by_forfeit = false,
      winner_value = NULL, loser_value = NULL,
      confirmed_by_home = NULL, confirmed_by_away = NULL, confirmed_at = NULL,
      vacate_requested_by = v_side, updated_at = now()
  WHERE id = v_game.id;

  -- Sweep any empty rows above this one. Linear play means every game after
  -- the one being wiped is already empty — the game the race had grown ready
  -- for, and any left by an earlier step of the same walk-back. Leaving them
  -- would make the race look like it had games waiting that nobody can reach,
  -- and breaks the rule that a game which was never played is never a row.
  DELETE FROM race_games
  WHERE race_id = p_race_id
    AND game_number > p_game_number
    AND winner_player_id IS NULL;

  -- The score has dropped, so a finished race becomes unfinished again, and
  -- the wiped game becomes the one being played.
  PERFORM race_advance(p_race_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION "public"."vacate_race_game"(uuid, integer) IS
'Wipe a game''s result so it can be entered again. Only the LAST game with a result — a race is linear, so fixing game 3 of 5 means reversing 5, then 4, then 3. The race un-finishes if the score drops back under the goal.';


-- ============================================================================
-- 7. Grants — authenticated only, and never PUBLIC
-- ============================================================================
--
-- Two separate exposures, and revoking one does not revoke the other:
--   1. CREATE FUNCTION grants EXECUTE to PUBLIC by default.
--   2. This database ALSO carries a default-privileges rule granting EXECUTE on
--      new functions to `anon` — the key that ships in the client bundle.
-- So each function is revoked from BOTH. It matters most for race_advance,
-- which is the one function here that does not check who is calling: it is
-- purely mechanical, and is only ever meant to be reached from the four
-- functions above, inside their transaction and under their lock.

REVOKE ALL ON FUNCTION "public"."race_side_of"(uuid, uuid) FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION "public"."race_standing"(uuid) FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION "public"."race_breaker_side"(uuid, integer) FROM PUBLIC, "anon";
-- race_advance is internal: revoked from every client role. SECURITY DEFINER
-- means the four functions above still reach it while running as the owner.
REVOKE ALL ON FUNCTION "public"."race_advance"(uuid) FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."create_race"(uuid, uuid, integer, integer, text, text) FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION "public"."start_race"(uuid, text) FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION "public"."record_race_game"(uuid, integer, uuid, boolean, boolean, boolean, boolean, boolean, boolean, integer, integer) FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION "public"."confirm_race_game"(uuid, integer) FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION "public"."vacate_race_game"(uuid, integer) FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."race_side_of"(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."race_standing"(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."race_breaker_side"(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."create_race"(uuid, uuid, integer, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."start_race"(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."record_race_game"(uuid, integer, uuid, boolean, boolean, boolean, boolean, boolean, boolean, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."confirm_race_game"(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."vacate_race_game"(uuid, integer) TO authenticated;
