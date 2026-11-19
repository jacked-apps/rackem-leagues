---
summary: Make pnpm run lint pass, then have CI run it
kind: task
added: 2026-11-19
checked: 2026-11-19
---

`pnpm run lint` reports about 2,800 problems, so nobody can use it as a check.
CI doesn't run it (`.github/workflows/checks.yml`).

What's behind the number (2026-11-19):

- **~2,777 aren't our code.** They come from `.stryker-tmp/`, the leftover
  sandbox copies the mutation test makes. The folder is git-ignored, but
  `eslint.config.js` only ignores `dist` and `reference-code/**`. Fix: add
  `.stryker-tmp/**` to `globalIgnores`.
- **23 are real**, in `src/`:
  - 1 error: unused `testLeagueId` in
    `src/__tests__/database/matchLineups.rls.test.ts`
  - about 18 `react-hooks/exhaustive-deps` warnings (hooks missing a
    dependency). Each one needs a look, because adding the dependency can change
    when the effect runs. Some are probably real stale-data bugs, e.g.
    `MatchEndVerification.tsx`, `ScoreMatch.tsx`, `MatchPhaseGuard.tsx`.
  - 4 unused `eslint-disable` comments in `src/realtime/useMatchRealtime.ts`

Finish line: `pnpm run lint` exits clean, and a lint step is added to
`checks.yml` so it stays clean.
