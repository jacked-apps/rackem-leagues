## What this changes

<!-- One or two plain sentences: what a player / league operator will notice. -->

## Test results

<!--
Ed reads this section, not the test run. Keep the order:
  1. Failures first (or "None").
  2. Counts: link the Checks run — the "Test results" job summary has the real
     numbers. Don't type counts by hand.
  3. One line per NEW or CHANGED test: what it protects, and the exact value
     it checks. Renames / moved imports don't need a line.
  4. Break records: for each new test, the break you made in the code (the
     way the test exists to catch) and the red result. A test that never went
     red hasn't proven anything.
-->

**Failures:** None

**Counts:** see the Checks run → "Test results" summary

**New / changed tests:**
- `path/to/file.test.ts` — protects: … ; checks: …

<details>
<summary>Break records</summary>

- Broke: … → red: …

</details>

<!--
Markers the CI checks read from this description:
  [no-changelog]          nothing a user would notice (What's New check)
  [no-db-test: <reason>]  a query changed but has no real-database test
                          (query-test check; the reason is printed, not approved)
-->
