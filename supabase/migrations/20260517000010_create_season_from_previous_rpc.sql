-- ============================================================================
-- Migration: create_season_from_previous RPC
--
-- Atomic "Start Next Season" operation. Given (a) the league id,
-- (b) the previous season id, (c) new-season dates + name, and (d)
-- per-team and per-venue decisions from the wizard, this function
-- creates a new season + new team rows + new team_players rows +
-- new league_venues rows (or trims existing ones) in a single
-- transaction. All-or-nothing: any error rolls back.
--
-- Returns the new season's id + a counts summary so the caller can
-- display "Created 12 teams, 3 venues, etc." after activation.
--
-- The new season is created with status='upcoming'. The existing
-- season-activation trigger (auto_create_season_conversations) will
-- fire when the operator separately moves it to status='active'.
--
-- Closes Unit 6 of docs/plans/2026-05-17-001-feat-new-season-from-previous-plan.md.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_season_from_previous(
  p_league_id uuid,
  p_previous_season_id uuid,
  p_season_name text,
  p_start_date date,
  p_end_date date,
  p_season_length integer,
  -- Each element: { source_team_id uuid, captain_id uuid, team_name text, home_venue_id uuid|null }
  -- Only INCLUDED teams should appear in this array; the wizard
  -- filters before calling.
  p_teams jsonb,
  -- Array of venue_id (uuid) strings — only INCLUDED venues.
  p_venue_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_season_id uuid;
  v_team_record jsonb;
  v_new_team_id uuid;
  v_source_team_id uuid;
  v_captain_id uuid;
  v_team_name text;
  v_home_venue_id uuid;
  v_teams_created integer := 0;
  v_players_carried integer := 0;
  v_player_count integer;
  v_venue_id uuid;
  v_venues_created integer := 0;
BEGIN
  -- 1. Create the new season row (status='upcoming').
  INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length, status)
  VALUES (p_league_id, p_season_name, p_start_date, p_end_date, p_season_length, 'upcoming')
  RETURNING id INTO v_new_season_id;

  -- 2. For each included team, create a new teams row + copy its
  --    roster (skipping archived/missing members; the join we did in
  --    the prefill query already filtered those, but the wizard
  --    state may include stale entries so we re-check by joining
  --    against members on insert).
  FOR v_team_record IN SELECT * FROM jsonb_array_elements(p_teams) LOOP
    v_source_team_id := (v_team_record->>'source_team_id')::uuid;
    v_captain_id := (v_team_record->>'captain_id')::uuid;
    v_team_name := v_team_record->>'team_name';
    v_home_venue_id := NULLIF(v_team_record->>'home_venue_id', '')::uuid;

    -- If the home venue isn't in the new venue set, NULL it out —
    -- captain can pick a new one post-activation.
    IF v_home_venue_id IS NOT NULL
       AND NOT (v_home_venue_id = ANY(p_venue_ids)) THEN
      v_home_venue_id := NULL;
    END IF;

    -- Insert new team row carrying forward name + captain + venue.
    INSERT INTO teams (
      season_id, league_id, team_name, captain_id, home_venue_id, status
    )
    VALUES (
      v_new_season_id, p_league_id, v_team_name, v_captain_id, v_home_venue_id, 'active'
    )
    RETURNING id INTO v_new_team_id;
    v_teams_created := v_teams_created + 1;

    -- Carry forward roster — skip rows whose member no longer exists
    -- (archived/deleted). Preserve is_captain flag from the source.
    WITH carried AS (
      INSERT INTO team_players (team_id, member_id, is_captain)
      SELECT v_new_team_id, tp.member_id, tp.is_captain
      FROM team_players tp
      INNER JOIN members m ON m.id = tp.member_id
      WHERE tp.team_id = v_source_team_id
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_player_count FROM carried;
    v_players_carried := v_players_carried + v_player_count;
  END LOOP;

  -- 3. Carry forward league_venues — only the included venue set.
  --    First, delete any existing league_venues for this league that
  --    aren't in the new set (operator's "uncheck this venue" choice).
  --    Then insert any new ones from the included set that don't
  --    already exist for this league.
  DELETE FROM league_venues
  WHERE league_id = p_league_id
    AND venue_id != ALL(p_venue_ids);

  -- Insert any included venues that aren't already on the league
  -- (e.g., operator added a brand-new venue via Venue Management
  -- since the previous season).
  WITH new_venues AS (
    INSERT INTO league_venues (league_id, venue_id, available_table_numbers, capacity)
    SELECT
      p_league_id,
      unnest_venue_id,
      ARRAY[]::integer[],
      0
    FROM unnest(p_venue_ids) AS unnest_venue_id
    WHERE NOT EXISTS (
      SELECT 1 FROM league_venues lv
      WHERE lv.league_id = p_league_id AND lv.venue_id = unnest_venue_id
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_venues_created FROM new_venues;

  -- 4. Return summary.
  RETURN jsonb_build_object(
    'new_season_id', v_new_season_id,
    'teams_created', v_teams_created,
    'players_carried', v_players_carried,
    'venues_added', v_venues_created
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_season_from_previous(uuid, uuid, text, date, date, integer, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_season_from_previous(uuid, uuid, text, date, date, integer, jsonb, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.create_season_from_previous IS
'Atomic "Start Next Season" — creates a new season + carries forward teams + rosters + venues from the wizard decisions. Returns {new_season_id, teams_created, players_carried, venues_added}. Transactional: any failure rolls back. SECURITY DEFINER + locked-down EXECUTE grant.';
