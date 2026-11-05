# List for Ed

One line per item. The group is the priority; the link holds the detail.
Only Ed moves items into Now or Next. New items go to Later (ideas to Wish list).
Finishing an item means deleting its line and its `docs/list/` file in the same PR.
How it works, and the item format: "The list" in `CLAUDE.md`.

## Now

- [Return async calls from sync click handlers so buttons block double taps](docs/list/2026-09-05-double-tap-promise-sweep.md)

## Next

- [Rename the dates page from "Manage Schedule" to "Schedule"](docs/list/2026-06-13-rename-manage-schedule.md)
- [Two screens still spot a bye by an empty team slot instead of its status](docs/list/2026-06-09-bye-detection-two-places.md)
- [Add a way to remove a bye team (only "Fill" exists today)](docs/list/2026-06-09-remove-bye-team.md)
- [Check on staging that schedule week numbers run 1 to N with no duplicates](docs/list/2026-06-30-staging-week-numbers-check.md)
- [Set up a verified sending address so email invites work (all environments)](docs/list/2026-04-21-staging-email.md)

## Later

- [Database rules so removed members and announcement chats are truly read-only](docs/list/2026-05-12-past-member-readonly-rls.md)
- [Add a test proving one failed team chat does not break season activation](docs/list/2026-05-12-season-activation-failure-test.md)
- [Make every nickname tappable to show the player's full name](docs/list/2026-05-27-tappable-player-name.md)
- [Write full glossary entries for the scoring-system and win-calculator stubs](docs/list/2026-05-30-glossary-scoring-stubs.md)
- [Drop the unused week_name column once the staging week check passes](docs/list/2026-06-30-drop-week-name-column.md)
- [Decide what happens to beta mock cards on file once real Stripe is live](docs/list/2026-09-05-mock-cards-on-file.md)
- [Make the LO application use the shared PaymentMethodSetup component](docs/list/2026-09-05-reuse-payment-method-setup.md)
- [Let a league operator fix a lineup on a match that has already started](docs/list/2026-10-28-lo-fix-finished-lineup.md)
- [Playoffs page shows the final standings and the playoff matchups once set](docs/list/2026-11-01-playoffs-page-standings-and-matchups.md)
- [Let an operator switch the team bonus on or off for league and playoffs](docs/list/2026-11-01-team-bonus-on-off-setting.md)
- [Finish the last notification controls - rate limits, pause-until, @mention alerts](docs/list/2026-11-02-notification-leftovers.md)
- [Give matches one full-record query, and make every mutation refresh stale data](docs/list/2026-11-04-consolidate-match-queries.md)
- [Around 2026-12-02, count how many Now and Next items had gone stale](docs/list/2026-11-04-four-week-list-check.md)
- [Line up the league games-list buttons the way the room race does](docs/list/2026-11-04-league-games-list-alignment.md)
- [Move to Supabase CLI v3 on purpose (config.toml, CI and both deploys together)](docs/list/2026-11-05-supabase-cli-v3.md)

## Wish list

- [Email the devs when next year's BCA or APA championship dates are missing](docs/list/2026-04-16-championship-date-reminders.md)
- [Show the regular match score and the tiebreak result on a tied match](docs/list/2026-05-02-tied-match-end-screen.md)
- [More league-setup warnings, and let LOs tell us whether presets worked](docs/list/2026-05-03-setup-warnings-and-preset-feedback.md)
- [Let a league operator hide or show scoring events right from the scoring popup](docs/list/2026-05-09-lo-edit-mode-scoring-popup.md)
- [Let an LO start an opt-in back-and-forth chat for everyone in the org](docs/list/2026-05-12-org-wide-group-chat.md)
- [Let captains add non-team members, like a spouse, to the team chat](docs/list/2026-05-12-team-chat-outside-adds.md)
- [A modules instruction manual on the Learn page, separate from the glossary](docs/list/2026-05-31-modules-manual.md)
- [Resume the player-picker consolidation brainstorm](docs/list/2026-06-09-player-picker-consolidation.md)
- [Optionally rename leftover "View Schedule" buttons to "Matchups"](docs/list/2026-06-13-matchups-label-sweep.md)
- [Seed a finished season so the playoff fill-in can be watched locally](docs/list/2026-06-13-seed-played-match-and-finished-season.md)
- [Past-match result cards on the schedule could show more in less room](docs/list/2026-10-29-past-match-result-cards.md)

## Gated

- [Custom colour schemes (preview), a fourth theme choice beside Light, Dark and System](docs/list/2026-11-01-gated-custom-colour-schemes.md)
- [Become a Host, the $1/mo or $10/yr purchase that makes you a host](docs/list/2026-11-04-gated-become-a-host.md)
- [Game Room - multi-phone rooms with the two-phone coin flip](docs/list/2026-11-04-gated-game-room.md)
- [LMS handicap calculator, a dev and staging tool](docs/list/2026-11-04-gated-lms-handicap-calculator.md)
- [Room Race - a race to 5 as the room's second game](docs/list/2026-11-04-gated-room-race.md)
- [Scoring Workshop, still in active development](docs/list/2026-11-04-gated-scoring-workshop.md)
