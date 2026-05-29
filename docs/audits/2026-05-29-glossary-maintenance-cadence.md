# Glossary Maintenance Cadence

**Owner:** Ed.
**Purpose:** Keep glossary content from rotting silently as the app evolves.

## What the drift audit catches

`pnpm glossary:verify` (Unit 7) is the automated guardrail. It catches:

- Entries whose `l1_anchor.path` points at a file that no longer exists.
- Entries whose `l1_anchor.anchor` no longer matches a heading in the L1 doc.

It does **not** catch:

- Content rot (the entry still makes sense as English but is no longer accurate).
- Renamed UI labels (entry still calls something "League Format" after we rename it to "Scoring System").
- New options added to a step that the entry doesn't mention.
- A definition that was right for v1 but is misleading after a behavior change.

That's what humans are for.

## The signals

Three things tell us an entry may need a fresh look:

1. **You shipped a meaningful app change.** Renamed a dial, added a wizard step, removed an option, changed a scoring rule. The entries that reference that surface are now candidates for content rot.
2. **A search miss showed up in dev tools.** Console.warn prints `[glossary] zero-result search: "<query>"` when a user typed something and got nothing. Each miss = a candidate alias OR a sign the user expected an entry we don't have.
3. **Quarterly calendar tick.** Even with no triggers above, do a quarterly walk — a low-effort scan of the unreviewed list via `pnpm glossary:progress`.

## The quarterly re-review pass

Roughly every 90 days:

1. `pnpm glossary:progress` to see what's `reviewedByEd` vs unreviewed.
2. Pick 10–20 unreviewed entries (whatever feels manageable for one session).
3. Open each one in the browser at `/learn#<slug>`.
4. For each:
   - Read the rendered version.
   - If it still reads right → tell me, I update `reviewedByEd` to today.
   - If something's off → tell me what, I update the entry AND `reviewedByEd`.
5. Stop when you've had enough; resume next quarter.

## After significant app changes

When a wizard step, scoring rule, or named feature changes:

1. Grep the entry source files for the old name: `grep -rn "old-term" src/glossary/entries/`.
2. For each hit, decide if the entry still makes sense or needs an update.
3. If updated, refresh `reviewedByEd`.
4. Run `pnpm glossary:verify` to make sure no L1 anchors broke as a side effect.

## What "reviewedByEd" means going forward

The field captures **the most recent date Ed personally approved the rendered entry's content as accurate and clear.** An entry can lose its review state in two ways:

- Ed explicitly says it's no longer accurate.
- The entry has been edited by anyone (including me) since the date marked. In that case, I should either ping Ed for a re-look or clear the marker myself.

For simplicity, the marker doesn't auto-clear. If I rewrite an entry that was reviewed, I'll either ask first or remove the marker explicitly so the next `pnpm glossary:progress` shows it as needing re-look.

## Done definition

Phase 1's content is "validated" when:
- `pnpm glossary:verify` is clean (66/66 anchors resolve).
- An outside-LO walk has happened (see the walkthrough doc).
- ≥80% of entries have a `reviewedByEd` date — i.e., Ed has read most of the rendered versions.

The 80% threshold is a guideline, not a release gate. Some entries are inherently low-priority (rarely-seen edge cases); a 60% reviewed glossary with the high-traffic entries all marked is a healthier shape than 90% with the keystones unreviewed.
