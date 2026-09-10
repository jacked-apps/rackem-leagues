# Resume here — self-scoring for individual races

> Written 2026-09-10 at the end of a session, so a fresh session starts from
> the right place. Read this first, then the plan.

## Where we are in one line

**Design is finished and reviewed. No code has been written.** The next action is
Unit 0 of the plan — a written league-night walkthrough — before any migration.

## The three documents, in order

1. `docs/brainstorms/2026-09-08-self-scoring-primer.md` — background and Ed's
   original vision. Committed.
2. `docs/brainstorms/2026-09-09-self-scoring-requirements.md` — **what** to
   build. 47 requirements, no blocking questions. Reviewed by seven personas,
   auto-fixes applied. Committed (`435b9e26`).
3. `docs/plans/2026-09-09-001-feat-self-scoring-individual-races-plan.md` —
   **how** to build it. 11 units across five phases. Reviewed by seven personas,
   all auto-fixes applied.

## Branch

`feat/self-scoring-individual-races`, stacked off
`feat/tournament-paid-foundation` (PR #275, awaiting Jack). Nothing is pushed.
PR #275 itself is untouched — the branch was cut so the docs would not land on a
PR under review.

## The one question still open

**What is the default advance policy** — automatic, confirm, or manual?

Ed has not answered. The recommendation on the table: **Automatic**, because it
is the only setting that delivers what the feature is sold for (the organizer
stops entering results), and it only fires after both players have already
confirmed the deciding game. `reopen_bracket_match` is the way back if it is
wrong. Ed's conservative default on *single-player* scoring is correct for a
different reason — that case has one eye and nobody to object.

Do not start Unit 8 without this answer. Everything else can proceed.

## Three things deferred to Ed, none blocking

- The Scoring tab's **name**. "Scoring" is provisional. Ed ruled out "Rules"
  (the BCA rulebook owns that word) and named the real tension himself: race
  length and game type read as *format*, while the advance and single-player
  policies are organizer preferences and are objectively not rules — yet
  splitting them scatters one coherent setup.
- **Shipped defaults** for break rule, race length per side, game type per side.
- Whether the catalog blurb — which promises buyers "You'll pick one thing"
  (`src/brackets/paid/premiumFeatures.ts:65`) — gets reworded. The plan sides
  with keeping the blurb true by collapsing the four format settings behind an
  "Advanced" disclosure, since expanding a disclosure later is trivial and
  collapsing a tested flat tab is not.

## What Ed decided this session (do not re-litigate)

- **Three kinds of human, not two.** A = registered; B = has a phone, scans,
  gets a claim ticket; C = no phone, organizer scores. Once a ticket counts as
  an identity the scoring layer stops caring which kind someone is.
- **Scanning the QR issues a ticket before any name is typed.** The organizer's
  **Validate** action then issues a large single-use 6-digit code that binds
  that ticket to a participant he typed in himself.
- **A match going in progress is what creates its race.**
- **Disputes are not adjudicated by the app.** Everyone is standing at the
  table; a disagreement is made visible and the players fetch the organizer, who
  settles it in person. Do not design a remote arbitration flow — Ed pushed back
  on this explicitly.
- **No forfeit ceremony in a tournament.** Someone who leaves is gone; the
  organizer taps the other name, exactly like the free tier.
- **Practice races are the build method, not a feature.** The race is built and
  tested with no parent first, then tournaments use it, then leagues. No
  user-facing practice mode ships.
- **Settings lock once play starts.** Race length, game type and break rule are
  the terms players agreed to — read-only after the first match starts. Advance
  policy and single-player policy stay adjustable.
- **Three views** (Ed's shape): a player Home tab (rules, who is still alive,
  on-deck, call order, payouts), a Bracket tab (who is playing, scores, table),
  and an organizer view (the setup pages). The plan builds the route into the
  room and live scores on the bracket; the richer home screen is left as its own
  piece of work.

## The two P0s the plan review caught — do not undo these

1. **Any table created in `public` is born writable by `anon`**, because the
   baseline runs `ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES TO "anon"`.
   That is why `setMatchInProgress` can update `bracket_matches` from the
   browser today. The race tables therefore need explicit
   `REVOKE INSERT, UPDATE, DELETE`, and claim tickets live in a **schema
   PostgREST does not expose** — a ticket column on a public table would be
   downloadable in one request with the key that ships in the client bundle.
2. **The automatic advance must run in a nested caught block.**
   `advance_bracket_winner` contains `RAISE EXCEPTION 'Winner % is not a
   participant in match %'` (bracket migration line 364), and that branch is
   reachable because reopening an upstream match NULLs seats downstream. Running
   it inside the scoring transaction without catching means a throw rolls back
   the confirmation too — a player watches the rack they just confirmed vanish.

## Other findings worth not rediscovering

- `reopen_bracket_match` writes to **three** places: the winner's next match,
  the loser's drop, and the grand-final reset row. Guards and cleanup apply to
  all three.
- `add_late_entry` calls `PERFORM reopen_bracket_match(...)` and **discards the
  result**, so a new guard must return a reason rather than raise.
- `deriveDissents` silently skips any row whose `side` is not exactly `'home'`
  or `'away'` — a participant uuid there disables the whole many-eyes layer
  invisibly.
- `pendingConfirmations.ts` is **not** table-agnostic (an early claim of mine
  that was wrong): its predicates take `userTeamId`/`homeTeamId` and a
  `MatchGame`. The team ids are used for one line — deriving `mySide`.
- `VacateModal.tsx` has zero callers; the live vacate flow is `EditGameDialog`.
- `src/login/EmailCodeStep.tsx` already has a tuned 6-digit numeric input.
  Reuse it for the validation code.
- **CI never runs the `db` vitest project** — `.github/workflows/checks.yml`
  runs `unit` only. Every RPC guard in this plan is verified only when someone
  runs `pnpm test:run --project db` by hand.

## Next actions, in order

1. Answer the advance-policy default.
2. **Unit 0** — write the league-night walkthrough
   (`docs/plans/2026-09-09-002-league-race-walkthrough.md`). Prose, no code, one
   day. It runs first on purpose: R32 calls the league case the acceptance test
   for the whole design, and running it after the migrations exist makes it an
   autopsy rather than a test. If it finds a gap, Unit 2's schema changes for
   free.
3. **Unit 1** — the late-entry hopper fix. Ed may prefer this as its own small
   PR ahead of the feature, since it corrects a flow that is broken today.
4. Then Phase 1 proper (Units 2–4).

## Housekeeping done this session

- Corrected a stale memory: the live-scoring / many-eyes stack is **merged into
  `main`** (commit `336bfd05`), not stranded on stacked PRs as the memory said.
  Verified with `git log`. `MEMORY.md` index updated too.
