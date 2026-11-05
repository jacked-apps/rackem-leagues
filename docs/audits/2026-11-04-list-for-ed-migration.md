# LIST_FOR_ED migration audit (2026-11-04)

A dated snapshot, written once and not kept up to date. Each of the 33 sections of the old `LIST_FOR_ED.md` was checked against `origin/main` and given a new home in the short list plus `docs/list/` (plan: `docs/plans/2026-11-04-001-refactor-list-for-ed-bucket-plan.md`).

Every "done" row cites evidence that's on main, and each one was re-checked by hand (PR state, file present on main).

"Closed by open #N" means main doesn't have the fix yet, so the row stays on the list. That PR deletes the item when it's rebased onto the new list.

The `Line` column is the section's line number in the old file as of commit `355c0dda`.

## Dropped (done or no longer a task)

| Line | Section | Evidence on main |
|---|---|---|
| 62 | DB tests not run by CI; three files rotted | PR #280 merged 2026-09-15: a `db-tests` job in `.github/workflows/checks.yml` |
| 182 | Re-land Change Season Length (#211 stranded) | PR #235 merged 2026-06-14: `src/operator/components/ChangeSeasonLengthDialog.tsx` |
| 182 | Onboarding self-add join request writes no team | Insert takes the team from `teams.join_token` (`20260529000003_request_team_join.sql`). The failing tests were fixture drift, fixed in #280 |
| 323 | Staging test issues 2–4 (Fargo 5v5, double duty, start points) | `src/systems/fargo5v5.ts` and `computeMatchPrepPayload.test.ts` on main |
| 365 | Consolidate queries: Members slice | PR #183 merged 2026-06-07 (the matches slice stays, below) |
| 485 | "Future Items" placeholder | Empty heading |
| 524 | League Intake Agent tool | A reference rather than a task. `docs/league-system/intake-agent-howto.md` is on main |
| 809 | Second verifier stranded on the match-end screen | PR #169 merged 2026-06-05: `navigate('/my-teams')` in `MatchEndVerification.tsx` |
| 1211 | Messaging Phase 2 plan needs writing | Plans written and shipped: PR #267 (2026-09-05) and PR #271 (2026-09-06) |
| 248 | Gated: Stop Stop explainer | Removed from the app on this branch, commit 355c0dda (Ed: project dropped) |
| 133 | VERIFY tiebreaker fix (PR #249) | **Needs Ed.** Superseded: PR #305 (merged 2026-10-29) rebuilt the tiebreaker as its own record, and open #315 fixes the last stranded case |

## Gated

| Line | Item | Gate on main |
|---|---|---|
| 248 | Become a Host | `NavRoutes.tsx` (`become-host`, `!isProduction`) and the Profile card `Profile.tsx` (`!isProduction`). Un-gate with the Game Room (#317) |
| 248 | Scoring Workshop | `NavRoutes.tsx` (`operator/scoring-workshop`) and the dashboard card `OperatorDashboard.tsx` (both `!isProduction`). Paused by Ed for a design reason |
| — | **LMS handicap calculator (was missing from the list)** | `NavRoutes.tsx` (`tools/calc`, `NonProdGate`) and the Profile link `Profile.tsx` (`!isProduction`) |

## Kept

| Line | Section | Verdict | What's left | Kind | Proposed group |
|---|---|---|---|---|---|
| 1375 | Sync handlers that discard a promise | partly | `ConfirmationDialog.tsx`, `LineupActions.tsx`, the wizard steps and the profile sections | task | **Now** |
| 536 | #9 First lineup lock stuck on Match Setup | needs Ed | Retest the original steps that triggered it. No fix targets it | task | **Now** (retest) |
| 809 | #19 Fresh match shows "tiebreak needed" | needs Ed | Retest A→B. It may have been fixed in passing by #143 and #305 | task | **Now** (retest) |
| 182 | Rename "Manage Schedule" to "Schedule" | open | Route and title. Unblocked since #235 | task | **Next** |
| 228 | Bye detection in 2 more places | open | `SeasonSchedulePage.tsx` and `matchups-v2/steps/ReviewStep.tsx` | task | **Next** |
| 228 | A way to remove a bye team | open | `TeamCard.tsx` offers only "Fill" | task | **Next** |
| 153 | Check week numbers on staging after the schedule fix | needs Ed | PR #244 merged. Staging check still to do | task | **Next** |
| 323 | Email on staging (issue 1) | needs Ed | This is environment setup, not code | task | **Next** |
| 7 | Dark-mode scoreboard numbers turn white | closed by open #314 | — | task | Later |
| 1306 | #38 Verify Scores open to every viewer | closed by open #314 | — | task | Later |
| 1342 | #39 Dark-mode button contrast on scoring page | closed by open #314 / #309 | Re-check the remaining buttons after merge | task | Later |
| 153 | Drop the old `week_name` column (Phase C) | has doc | After the staging check. Around 124 references | task | Later |
| 365 | Consolidate queries: matches slice + stale updates | has doc | The matches slice was never started | task | Later |
| 33 | LO fixes a lineup on a finished match | has doc | No UI. Ed rated it low priority | task | Later |
| 96 | Reuse `PaymentMethodSetup` in the LO application | open | — | task | Later |
| 112 | Mock cards on file once Stripe is live | open | Waits on real Stripe | task | Later |
| 281 | Glossary: `scoring-system` and `win-calculator` stubs | open | Full write-ups | task | Later |
| 603 | #12 One team's screen flashes around the tiebreak | partly / needs Ed | Memoise the lineup page, or Ed confirms it's gone | task | Later |
| 1034 | #27 Season-activation failure-isolation test | has doc | — | task | Later |
| 1068 | #29 Read-only rules for past members and announcements | open | Waits on the RLS project. Its policy design lives only here, so it gets an item file | task | Later |
| 1259 | #34 Tap a player name for the full name | partly | `GamesList`, `ConfirmationDialog`, `DissentFlag`, `DisputeDetailModal` | task | Later |
| 23 | Past-match result cards: show more in less room | open | — | idea | Wish list |
| 182 | Seed a played match and a finished season | partly | — | idea | Wish list |
| 182 | "View Schedule" → "Matchups" label sweep | open | — | idea | Wish list |
| 228 | Resume the player-picker consolidation brainstorm | open | — | idea | Wish list |
| 300 | Modules instruction manual on the Learn page | open | — | idea | Wish list |
| 491 | Championship date reminders | has doc | `memory-bank/plans/TODO-championship-date-reminders.md` | task | Wish list |
| 694 | #13 Tied-match end screen shows more | open | — | idea | Wish list |
| 730 | #17 More setup warnings, plus feedback from league operators (LOs) on presets | open | — | idea | Wish list |
| 903 | #25 LO edit mode in the scoring popup | has doc | Brainstorm Branch B. Not planned | idea | Wish list |
| 1006 | #26 Captains add outsiders to team chat | open | — | idea | Wish list |
| 1182 | #30 LO-created org-wide group chat | open | — | idea | Wish list |
| — | 4-week check: count stale Now/Next entries (around 2026-12-02) | new | From the plan | task | Later |

## Open-PR list edits (converted on each branch after this lands)

- **#317:** league games-list alignment, plus the Game Room / Room Race gated item
- **#314:** its 9 closures delete the matching items above
- **#312:** team bonus in playoffs
- **#311:** grouped menu and favorites
- **#309:** Playoffs page, plus its dark-mode closure
