-- Wipe all games for match 44455346-f33f-4362-9f52-bcc1341b2c0c AND unlock
-- both lineups so captains can re-lock to trigger game regeneration +
-- primary handicap recalculation. Staging throwaway league; no safety.

DELETE FROM match_games
WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

UPDATE match_lineups
SET locked = false,
    locked_at = NULL
WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c';
