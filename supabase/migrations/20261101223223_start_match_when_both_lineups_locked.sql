-- =============================================================================
-- Start a match only when BOTH teams' lineups are locked
-- =============================================================================
--
-- Bug (seen live, 2026-11-01 playoffs): a match showed as "in progress" on
-- the Live Matches page as soon as the FIRST captain locked. Its scoreboard
-- then spun on "Loading…" because the other lineup wasn't locked yet.
--
-- Cause: the lineup screen set `matches.started_at` when it thought the
-- opponent had already locked, and it judged that by
-- `matches.home_lineup_id` / `away_lineup_id` being non-NULL. But the
-- create-match trigger fills in BOTH of those ids the moment a match is
-- created (see 20251213000000_sync_match_lineups_with_matches.sql), so the
-- check was always true and the first lock always started the match.
--
-- Fix: the database decides. Whenever a lineup row flips to locked, this
-- trigger starts the match only if the home AND away lineup rows are both
-- locked. Doing it here instead of in the browser also covers two captains
-- locking at the same instant, which a browser check (each side reading
-- the other's not-yet-saved row) can miss so that NEITHER starts the match.
--
-- Already-started matches are left alone (`started_at IS NULL` guard), so
-- the tiebreaker unlock → re-lock cycle never moves the start time.
-- =============================================================================

CREATE OR REPLACE FUNCTION start_match_when_both_lineups_locked()
RETURNS TRIGGER AS $$
DECLARE
  v_home_team_id uuid;
  v_away_team_id uuid;
BEGIN
  -- Lock the match row first. Two captains locking at once both queue here,
  -- so the second one re-reads the lineups AFTER the first has committed and
  -- sees both locked. (Each plpgsql statement takes a fresh snapshot under
  -- READ COMMITTED, so the reads below see the other side's committed lock.)
  SELECT home_team_id, away_team_id
    INTO v_home_team_id, v_away_team_id
    FROM matches
   WHERE id = NEW.match_id
     AND started_at IS NULL
     FOR UPDATE;

  -- Already started (or the match is gone): nothing to do.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Playoff matches can exist before their teams are known; never start one.
  IF v_home_team_id IS NULL OR v_away_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
       SELECT 1 FROM match_lineups
        WHERE match_id = NEW.match_id AND team_id = v_home_team_id AND locked
     )
     AND EXISTS (
       SELECT 1 FROM match_lineups
        WHERE match_id = NEW.match_id AND team_id = v_away_team_id AND locked
     )
  THEN
    UPDATE matches SET started_at = now() WHERE id = NEW.match_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION start_match_when_both_lineups_locked() IS
  'Sets matches.started_at once both the home and away match_lineups rows are locked. Never moves an existing started_at.';

DROP TRIGGER IF EXISTS trigger_start_match_when_both_lineups_locked ON match_lineups;

-- Fires only on the unlocked → locked flip, not on every lineup edit.
CREATE TRIGGER trigger_start_match_when_both_lineups_locked
  AFTER UPDATE OF locked ON match_lineups
  FOR EACH ROW
  WHEN (NEW.locked IS TRUE AND OLD.locked IS DISTINCT FROM TRUE)
  EXECUTE FUNCTION start_match_when_both_lineups_locked();
