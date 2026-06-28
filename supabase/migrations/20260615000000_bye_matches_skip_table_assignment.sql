-- ============================================================================
-- Bye matches must not consume a table number
-- ============================================================================
--
-- A BYE is a real `teams` row (`status='bye'`) created when the league has an
-- odd team count. A matchup containing a bye is NOT a real match — nobody plays
-- it — so it must never be assigned a table.
--
-- The original `assign_tables_for_week()` (migration 20251214211103) skipped
-- byes by testing `home_team_id IS NOT NULL AND away_team_id IS NOT NULL`. That
-- worked when byes were encoded as a NULL team slot. They are now real rows
-- with real UUIDs, so the NULL test no longer catches them and a bye match was
-- silently being handed a real table — burning a physical table slot on a game
-- nobody plays, and (depending on order) pushing real matches to later tables.
--
-- Fix: also exclude any match where either side is `status='bye'`. The NULL
-- checks are kept — a NULL team now means a playoff-TBD match, which also must
-- not get a table. This is the table-assignment half of "a bye is not a real
-- match"; it mirrors the `hasTwoRealTeams()` definition used elsewhere.
--
-- This is a CREATE OR REPLACE of the one function; the original migration is
-- already applied in production and stays immutable. Grants/owner are preserved
-- by CREATE OR REPLACE.
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."assign_tables_for_week"(p_season_week_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_season_id uuid;
    v_league_id uuid;
    match_rec RECORD;
    venue_tables RECORD;
    v_table_number integer;
    v_venue_usage jsonb := '{}'::jsonb;  -- Track used table indices per venue
    v_leftover_matches uuid[] := '{}';   -- Matches that couldn't get a table at their venue
    v_all_available jsonb := '[]'::jsonb; -- All available tables across all venues
    v_leftover_match_id uuid;
    v_available_table RECORD;
BEGIN
    -- Get season_id and league_id from the week
    SELECT sw.season_id, s.league_id
    INTO v_season_id, v_league_id
    FROM season_weeks sw
    JOIN seasons s ON s.id = sw.season_id
    WHERE sw.id = p_season_week_id;

    IF v_season_id IS NULL THEN
        RAISE NOTICE 'Season week % not found', p_season_week_id;
        RETURN;
    END IF;

    RAISE NOTICE 'Assigning tables for week %, season %, league %',
        p_season_week_id, v_season_id, v_league_id;

    -- First pass: Clear existing assignments for unplayed matches in this week
    UPDATE matches
    SET
        assigned_table_number = NULL,
        actual_venue_id = NULL
    WHERE season_week_id = p_season_week_id
      AND status IN ('scheduled', 'in_progress');

    -- Build a lookup of available tables per venue
    -- The available_table_numbers array is already in fill order (set by the UI)
    -- Store as: { "venue_id": [table1, table2, ...], ... }
    FOR venue_tables IN
        SELECT
            lv.venue_id,
            lv.available_table_numbers
        FROM league_venues lv
        WHERE lv.league_id = v_league_id
          AND lv.available_table_numbers IS NOT NULL
          AND array_length(lv.available_table_numbers, 1) > 0
    LOOP
        -- Initialize usage counter for this venue
        v_venue_usage := v_venue_usage || jsonb_build_object(venue_tables.venue_id::text, 0);

        -- Add all tables from this venue to the global available list (for overflow)
        FOR i IN 1..array_length(venue_tables.available_table_numbers, 1) LOOP
            v_all_available := v_all_available || jsonb_build_array(
                jsonb_build_object(
                    'venue_id', venue_tables.venue_id,
                    'table_number', venue_tables.available_table_numbers[i],
                    'priority', i
                )
            );
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Venue usage initialized: %', v_venue_usage;

    -- Second pass: Assign tables to matches in match_number order
    -- Only process matches that have a scheduled venue (home team has chosen their venue)
    FOR match_rec IN
        SELECT m.id, m.scheduled_venue_id, m.match_number
        FROM matches m
        WHERE m.season_week_id = p_season_week_id
          AND m.status IN ('scheduled', 'in_progress')
          AND m.home_team_id IS NOT NULL  -- Skip playoff-TBD matches (NULL team)
          AND m.away_team_id IS NOT NULL
          AND m.scheduled_venue_id IS NOT NULL  -- Skip matches where home team hasn't set venue
          -- Skip BYE matches. A bye is a real teams row (status='bye') with a
          -- real UUID, so the NULL checks above no longer catch it. A bye
          -- matchup is not a real match, so it must not consume a table.
          AND NOT EXISTS (
              SELECT 1 FROM teams t
              WHERE t.id IN (m.home_team_id, m.away_team_id)
                AND t.status = 'bye'
          )
        ORDER BY m.match_number
    LOOP
        v_table_number := NULL;

        -- Get the current usage index for this venue
        DECLARE
            v_current_index integer;
            v_venue_tables integer[];
        BEGIN
            v_current_index := COALESCE((v_venue_usage->>match_rec.scheduled_venue_id::text)::integer, 0);

            -- Get the table array for this venue
            SELECT available_table_numbers INTO v_venue_tables
            FROM league_venues
            WHERE venue_id = match_rec.scheduled_venue_id
              AND league_id = v_league_id;

            -- Check if there's an available table at this venue
            IF v_venue_tables IS NOT NULL AND v_current_index < array_length(v_venue_tables, 1) THEN
                -- Assign the next table (arrays are 1-indexed in PostgreSQL)
                v_table_number := v_venue_tables[v_current_index + 1];

                -- Update the usage counter
                v_venue_usage := v_venue_usage ||
                    jsonb_build_object(match_rec.scheduled_venue_id::text, v_current_index + 1);

                -- Update the match with the assigned table
                UPDATE matches
                SET assigned_table_number = v_table_number
                WHERE id = match_rec.id;

                RAISE NOTICE 'Match % assigned table % at scheduled venue %',
                    match_rec.match_number, v_table_number, match_rec.scheduled_venue_id;
            ELSE
                -- No table available at scheduled venue, add to leftovers
                v_leftover_matches := array_append(v_leftover_matches, match_rec.id);
                RAISE NOTICE 'Match % (venue %) added to leftovers - no tables available',
                    match_rec.match_number, match_rec.scheduled_venue_id;
            END IF;
        END;
    END LOOP;

    -- Third pass: Assign leftover matches to any available table
    IF array_length(v_leftover_matches, 1) > 0 THEN
        RAISE NOTICE 'Processing % leftover matches', array_length(v_leftover_matches, 1);

        FOREACH v_leftover_match_id IN ARRAY v_leftover_matches
        LOOP
            -- Find the first venue that still has availability
            FOR venue_tables IN
                SELECT
                    lv.venue_id,
                    lv.available_table_numbers
                FROM league_venues lv
                WHERE lv.league_id = v_league_id
                  AND lv.available_table_numbers IS NOT NULL
                  AND array_length(lv.available_table_numbers, 1) > 0
            LOOP
                DECLARE
                    v_current_index integer;
                BEGIN
                    v_current_index := COALESCE((v_venue_usage->>venue_tables.venue_id::text)::integer, 0);

                    IF v_current_index < array_length(venue_tables.available_table_numbers, 1) THEN
                        -- Found an available table
                        v_table_number := venue_tables.available_table_numbers[v_current_index + 1];

                        -- Update usage
                        v_venue_usage := v_venue_usage ||
                            jsonb_build_object(venue_tables.venue_id::text, v_current_index + 1);

                        -- Update match with actual_venue_id (different from scheduled)
                        UPDATE matches
                        SET
                            assigned_table_number = v_table_number,
                            actual_venue_id = venue_tables.venue_id
                        WHERE id = v_leftover_match_id;

                        RAISE NOTICE 'Leftover match % assigned table % at alternate venue %',
                            v_leftover_match_id, v_table_number, venue_tables.venue_id;

                        EXIT; -- Move to next leftover match
                    END IF;
                END;
            END LOOP;
        END LOOP;
    END IF;

    RAISE NOTICE 'Table assignment complete for week %', p_season_week_id;
END;
$$;

COMMENT ON FUNCTION "public"."assign_tables_for_week"(uuid) IS
'Assigns table numbers to all unplayed, REAL matches in a week based on venue availability and fill order.
Matches are processed in match_number order. BYE matches (either team status=''bye'') and playoff-TBD
matches (NULL team) are skipped — they are not real matches and consume no table. If a venue runs out of
tables, overflow matches are assigned to any available table at another venue (actual_venue_id is set).';
