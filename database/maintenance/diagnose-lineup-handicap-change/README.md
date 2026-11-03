# Why did this match's lineup handicaps change?

READ-ONLY. Four queries, run one at a time. Nothing here writes or changes
anything.

Built for the "Ben vs Duff" question (match `92b799f2…`): the lineup handicaps
changed on a match that had NO tiebreaker, so the tiebreaker re-lock path is
ruled out. Background: `docs/audits/2026-10-28-tiebreaker-audit.md`.

## How to run

Supabase Studio -> SQL Editor. Open one file, paste the whole thing, Run. Then
the next. They are separate files because the editor only shows you the result
of the last statement, so pasting all three would hide the first two.

Each file has the match id on one clearly marked line. To check a different
match, change that one line.

1. `1_confirm_no_tiebreaker.sql` — confirms there really was no tiebreaker.
2. `2_the_answer_swap_or_not.sql` — **this is the one that answers it.**
3. `3_who_played_each_game.sql` — cross-check: did the same players play throughout?
4. `4_targets_vs_stored_handicaps.sql` — **the proof.** The saved targets cannot
   be rewritten; if the stored handicaps no longer explain them, the lineup row
   changed after the match was prepped.

## Reading file 2

It prints a `verdict` column saying one of two things:

- **`SWAP (legitimate)`** — `swap_last_resolution` is populated, so the change
  came through `swap_player_in_lineup`. Expected behaviour, nothing to chase.
- **`NO SWAP RECORDED`** — nothing audited this change. It came from the lineup
  screen (a pick changed, a handicap hand-edited) or an unlock/re-lock before
  the match. There is no record of who or when, and that absence is itself the
  finding (audit F2).
