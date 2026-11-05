---
summary: More league-setup warnings, and let LOs tell us whether presets worked
kind: idea
added: 2026-05-03
checked: 2026-11-04
---

The combo warnings in `src/wizards/league-v2/comboCoherence.ts` come from
hardcoded rules written from our guesses. They don't learn from how
operators actually run leagues.

## More warning rules

Add rules as operators report problems. Each warning keeps its `code` and
message (both exist today), plus:
- a hidden note on why it was added ("added after League Y reported Z")
- an optional "this was fine for my league, stop warning me"

## LO feedback on presets

- After the first season on a Tested Preset: "Did this preset work for
  your league?" (yes/no or a rating, plus details).
- After overriding a warning: "We warned you about this combo. Did it
  work?" Yes → candidate preset or suppress the warning. No → ask what
  they did instead.
- A dev-team view of which presets work and which overrides recur.

Plumbing: a `lo_preset_feedback` table (league, source, rating,
free_text, created_at, member_id), a dev-only read view, a simple insert,
and prompts timed for when the LO has results.

## Why later

It needs enough real operators running real leagues for the signal to mean
anything. `src/wizards/league-v2/steps/ThresholdSourceStep.tsx` already
classifies calibrated vs manual; feedback could refine that over time.
