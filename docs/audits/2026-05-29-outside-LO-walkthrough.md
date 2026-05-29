# Outside-LO Walkthrough — Phase 1 Acceptance Procedure

**Status:** Ready to run when a validator is available.
**Owns:** Ed.
**Origin:** Unit 8 of `docs/plans/2026-05-28-001-feat-operator-help-system-phase-1-plan.md`.

## What this is

The single empirical test that tells us whether the help system actually helps. Without it, we're guessing whether the entries we wrote are doing their job.

## Validator profiles

### Primary (PR-blocking)

Pool player who has played in leagues but **has never run one**. This is the target audience for Phase 1 — they speak pool, they don't speak operator-software.

**Named candidate:** Jack.

Any friend matching the profile is acceptable. The role is "thoughtful test-driver who isn't shy about saying 'I don't know what that means.'"

### Stretch (recommended, not PR-blocking)

A non-pool-player. If they can navigate the wizard with the help system, robustness is well beyond what Phase 1 promised.

**Named candidate:** Ed's wife.

A "fail" here isn't a Phase 1 blocker — it's a Phase 2 signal for L4 (player-facing help).

### No fallback

Ed does NOT simulate. He built the app; he can't fake first-time confusion. If neither validator profile is reachable in the planned window, Phase 1 ship delays.

## The walk

**Setting:** sit the validator at a fresh browser session with `pnpm run dev` running. Ed observes silently — no coaching, no explaining.

**Task:** "Pretend you've decided to run a pool league for the first time. Walk through this app and create a league."

That's the entire prompt. No further instruction.

### What to record

For every moment the validator says (or shows) "I don't know what this means":

| Where | Term / dial | What they tried | Did the InfoButton help? | Did Learn-more help? | Notes |
|---|---|---|---|---|---|

Specifically capture:

- Wizard step name (Game Type / Start Date / League Format / etc.)
- The exact phrase they couldn't parse
- Whether they noticed the "?" pill at all (huge signal — if they didn't see it, help isn't reaching them)
- If they clicked "?" — did the short answer resolve it?
- If they clicked "Learn more →" — did the long answer resolve it?
- If they searched the glossary at `/learn` — what did they type, did it find anything

### Acceptance threshold

**No more than 2 unhandled "what does this mean?" moments across the entire league-creation wizard.**

"Unhandled" = the validator was confused, used (or tried to use) the help system, and still didn't understand after.

A confused moment that was RESOLVED by the popover or Learn page is not a fail — that's the system working.

If >2 unhandled moments, **Phase 1 does not ship** until the entries those moments surfaced are fixed.

## Post-walk procedure

1. **Capture findings** into a fresh audit doc: `docs/audits/YYYY-MM-DD-outside-LO-walk-findings.md`.
2. **For each unhandled moment:**
   - If the term had no entry → add one (per `feedback_help_ux_principles`).
   - If the entry exists but the shortDef confused them → rewrite.
   - If the entry exists but they couldn't find it → consider aliases.
   - If the relevant "?" didn't exist on the wizard step → add it.
3. **Update `reviewedByEd`** on each entry touched.
4. **Re-run validator (or accept Phase 1 ship)** — depending on how many issues surfaced and whether the validator can come back.
5. **Run `pnpm glossary:verify`** and `pnpm test:run` to confirm nothing structural broke.

## After Phase 1 ships

Schedule another outside-LO walk every time we add a substantial coverage batch (e.g., after wiring 10+ new wizard "?" buttons to slugs). The same procedure applies; each walk surfaces new gaps.

The stretch validator (non-pool-player) is worth running once after Phase 2 lands — that's when player-facing help becomes relevant.
