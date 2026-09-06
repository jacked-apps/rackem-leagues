-- ============================================================================
-- Early 8 — record how the game ended
-- ============================================================================
--
-- `match_games` records how a game ended: break_and_run, golden_break, runout.
-- The most talked-about ending in an 8-ball league was missing — pocketing the
-- 8 early — so once the score was entered it left no trace.
--
-- These flags describe the GAME, not a player. The row already carries the
-- winner and the loser, so one flag reads from both chairs: "I won on an early
-- 8" and "I lost on an early 8" are the same record seen from either side.
--
-- That symmetry is the whole value. Two players can finish a season 100-100 and
-- be nothing alike — one lost fifty games to opponents running out on them, the
-- other lost fifty games they were still in. Same record, very different
-- players. Answering that needs the ending stored per game and readable from
-- either side, which is what a single flag plus winner_player_id gives.
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
  'The game ended on an early 8. Like break_and_run / golden_break / runout this describes HOW the game ended, not who to credit — combined with winner_player_id it reads from either side ("won on" / "lost on"). 8-ball only; enforced in the UI rather than by a CHECK so a game_type correction cannot fail on an existing row.';

-- A game ends exactly one way, so these are rival descriptions of the same
-- game rather than facts that can stack. An 8 going down on the break is a
-- golden break, not an early 8; a table cleared from the break is a break and
-- run. Recording two at once would say the ending is unknown, not that both
-- happened.
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
-- here is a field two scorers can silently disagree about. How a game ended is
-- exactly the sort of call one scorer sees and the other doesn't, so it has to
-- be part of the comparison, not a detail applied after agreement is reached.

ALTER TABLE public.game_confirmations
  ADD COLUMN IF NOT EXISTS early_eight boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.game_confirmations.early_eight IS
  'Snapshot of match_games.early_eight as this confirmer vouched for it. Compared by deriveDissents — an ending one scorer saw and the other did not is a real disagreement, not a footnote.';
