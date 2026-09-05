-- ============================================================================
-- Early 8 — record the game-ending mistake, not just the achievements
-- ============================================================================
--
-- `match_games` already records three things a WINNER did well: break_and_run,
-- golden_break, runout. It records nothing about how a game was lost, so the
-- most talked-about event in an 8-ball league — pocketing the 8 early and
-- handing over the game — leaves no trace once the score is entered.
--
-- Modelled as one nullable boolean on the game rather than a column on a
-- player, for the same reason the existing feats are: the game already knows
-- who won and who lost, so the offender is derivable and can never drift out of
-- step with the result. Attributing it to a player id as well would let the two
-- disagree after a correction.
--
-- Deliberately NOT constrained to 8-ball at the database level. Whether an
-- early 8 is even possible is a property of the game type being played, and
-- game_type lives on this same row — but leagues do play mixed formats, and a
-- CHECK here would turn "a scorekeeper corrected the game type after entry"
-- into a failed update rather than a value the UI simply stops offering. The
-- UI only offers it for eight_ball; that is where the rule belongs.
-- ============================================================================

ALTER TABLE public.match_games
  ADD COLUMN IF NOT EXISTS early_eight boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.match_games.early_eight IS
  'The game ended because the LOSER pocketed the 8 ball early. Unlike break_and_run / golden_break / runout, which describe the winner, this describes the loser — the offender is winner''s opponent, derived from winner_player_id. 8-ball only; enforced in the UI rather than by a CHECK so a game_type correction cannot fail on an existing row.';

-- A game cannot be both won on the break and lost to an early 8: the 8 going
-- down on the break is a golden break, which is a different (and opposite)
-- outcome. Break-and-run and runout are likewise incompatible — they describe
-- the winner clearing the table, not the loser ending it early.
ALTER TABLE public.match_games
  DROP CONSTRAINT IF EXISTS match_games_early_eight_excludes_feats;

ALTER TABLE public.match_games
  ADD CONSTRAINT match_games_early_eight_excludes_feats
  CHECK (NOT (early_eight AND (break_and_run OR golden_break OR runout)));


-- ----------------------------------------------------------------------------
-- The confirmation log carries the same flag
-- ----------------------------------------------------------------------------
--
-- `game_confirmations` stores a full snapshot of the result each scorer vouched
-- for — that snapshot is what dissent detection compares, so a field missing
-- here is a field two scorers can silently disagree about. Whether the loser
-- ended the game on the 8 is exactly the sort of call one scorer sees and the
-- other doesn't, so it has to be part of the comparison, not a detail applied
-- after agreement is reached.

ALTER TABLE public.game_confirmations
  ADD COLUMN IF NOT EXISTS early_eight boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.game_confirmations.early_eight IS
  'Snapshot of match_games.early_eight as this confirmer vouched for it. Compared by deriveDissents — an early 8 one scorer saw and the other did not is a real disagreement, not a footnote.';
