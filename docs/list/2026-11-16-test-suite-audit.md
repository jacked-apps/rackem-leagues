---
summary: Go through every test, make sure each one can actually fail, and cut the ones that add nothing
kind: task
added: 2026-11-16
checked: 2026-11-16
---

Ed, 2026-11-16: AI-written test suites pick up tests that don't test
anything substantial, and some can't fail at all. In a small app that's
minor; at our size (about 300 unit test files, 5,400 tests, plus the db
project) it costs real time on every run, about 12 minutes on Ed's machine.

Go over each test and check two things:

1. **Can it fail?** Break the code it covers (flip a condition, return the
   wrong value) and confirm the test goes red. Signs it can't: it only checks
   that something rendered, it asserts on its own mock's return value, or a
   `.toBeTruthy()` would pass on anything.
2. **Is it superfluous?** It repeats what another test already proves, or it
   tests a library (React, shadcn, supabase-js) rather than our code.

Fix or delete each one that fails a check.

Known example: My Stats shipped with a totally broken query while its unit
tests stayed green (see memory `project_my_stats_page.md`).

How: one folder at a time (≤4 agents at once on Ed's machine). Mutation
testing (e.g. Stryker) can do step 1 automatically and point at the weak
spots, if the run time is acceptable.
