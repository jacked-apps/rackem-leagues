---
summary: Flag a match result that doesn't add up, without ever blocking the match
kind: task
added: 2026-11-18
checked: 2026-11-18
---

Today, when a match ends, a team that reached its win number wins and
anything else is quietly recorded as a tie. The tie numbers are never
checked. So a glitch (a missing game, wrong targets, a bad score entry)
can turn into a silent tie that nobody notices.

## The rule (Ed, 2026-11-18)

With every game played and correct targets, exactly one is true:

- **Win:** the winner reached its win number AND the loser did not.
- **Tie:** both teams landed exactly on their tie numbers (only when the
  league allows ties, i.e. tie numbers are saved).

Anything else is a result that doesn't add up.

## What happens when it doesn't add up

- **Never block.** The match still completes and records as it does
  today. Players must never get stuck on the end screen; a stuck page
  means tech support, not a report.
- **Make noise to the devs:** an alert we actually see, not just a
  console line. (Today the "both teams met their win number" case only
  writes to the browser console, which nobody sees.)
- **Tell the users quietly:** a short note on the match that the result
  looks off, with a way to report it. A report is a good outcome.

## Where to look

- `src/components/scoring/MatchEndVerification.tsx`: the judge decides
  the result; `bcaResult` / `legacyResult` are the fallback.
- `src/systems/win-calculator/` (`judge.ts`, `comparators.ts` `metGoal`):
  the judge never receives the tie numbers.
- `src/utils/determineMatchResult.ts`: its tie check returns "tie" either
  way, so it checks nothing.
- No dev-alert channel or in-app "report a problem" exists yet;
  `src/operator/ReportsManagement.tsx` is player reports to the LO, which
  may not fit app bugs. Decide the channel as part of this.

## Tests (write first, from the rule)

Win, tie and every "doesn't add up" shape (17 of 18 games, neither on a
target, both on win, tie numbers missed), each proven able to fail.
