-- Migration: Transactional match-preparation RPC (Unit 4 of lineup race-condition fix)
--
-- Wraps threshold update + match_games insert in a single Postgres transaction
-- so the client can never observe partial prep. On any failure, Postgres rolls
-- back every write from the attempt automatically.
--
-- Client retry strategy: call this RPC up to N times with exponential backoff.
-- Each attempt is atomic; a failed attempt leaves zero state behind. After N
-- failures the client surfaces a toast and dismisses the overlay — DB state
-- is clean regardless.
--
-- ON CONFLICT (match_id, game_number) DO NOTHING makes partial-retry safe even
-- when the client retries mid-session. Replaces the old client-side
-- `.includes('duplicate key')` error-message string match.

CREATE OR REPLACE FUNCTION prep_match(
  p_match_id UUID,
  p_thresholds JSONB,
  p_game_rows JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Write threshold columns to the matches row. Uses ->> to text-cast; any
  -- missing or JSON-null key becomes SQL NULL, which matches the prior
  -- behavior (Fargo passes nulls for tie/lose columns, BCA passes all six).
  UPDATE matches
  SET
    home_games_to_win  = NULLIF(p_thresholds->>'home_games_to_win',  'null')::INT,
    home_games_to_tie  = NULLIF(p_thresholds->>'home_games_to_tie',  'null')::INT,
    home_games_to_lose = NULLIF(p_thresholds->>'home_games_to_lose', 'null')::INT,
    away_games_to_win  = NULLIF(p_thresholds->>'away_games_to_win',  'null')::INT,
    away_games_to_tie  = NULLIF(p_thresholds->>'away_games_to_tie',  'null')::INT,
    away_games_to_lose = NULLIF(p_thresholds->>'away_games_to_lose', 'null')::INT
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'prep_match: match % not found', p_match_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Insert all game rows. The UNIQUE(match_id, game_number) constraint from
  -- the baseline migration ensures ON CONFLICT DO NOTHING is deterministic.
  INSERT INTO match_games (
    match_id,
    game_number,
    game_type,
    home_player_id,
    away_player_id,
    home_position,
    away_position,
    home_action,
    away_action
  )
  SELECT
    p_match_id,
    (row_obj->>'game_number')::INT,
    row_obj->>'game_type',
    NULLIF(row_obj->>'home_player_id', 'null')::UUID,
    NULLIF(row_obj->>'away_player_id', 'null')::UUID,
    (row_obj->>'home_position')::INT,
    (row_obj->>'away_position')::INT,
    row_obj->>'home_action',
    row_obj->>'away_action'
  FROM jsonb_array_elements(p_game_rows) AS row_obj
  ON CONFLICT (match_id, game_number) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION prep_match(UUID, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION prep_match(UUID, JSONB, JSONB) IS
'Transactional match preparation. Writes threshold columns to matches and
inserts match_games rows in a single Postgres transaction. ON CONFLICT
(match_id, game_number) DO NOTHING makes the insert safe to retry. Client
wraps this in a retry loop; each attempt is atomic so a failed attempt
leaves no partial state behind.';
