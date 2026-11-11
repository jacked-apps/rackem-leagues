# src/ reorg map, for Ed's approval

**Plan:** `docs/plans/2026-11-05-002-refactor-src-folder-reorg-plan.md`.

**The exact file list** is `scripts/reorg/map.json`, which the move script
runs. Every unit dry-runs cleanly today: about 230 files move, with no name
clashes.

This page gives the same moves by folder, so they can be read at a glance.
Every row was decided by who actually imports the file, read from the code on
2026-11-05.

## What moves

| Unit | From | To | Why |
|---|---|---|---|
| 2 | `officalBCARulebook/` | `bcaRulebook/` | Spelling |
| 2 | `home/Home.tsx`, `host/BecomeHost.tsx` | `pages/` | One-page folders; standalone pages live in `pages/` |
| 3 | `components/wizard/` (21 files) | `wizards/shared/` | The wizard kit lives with the wizards |
| 3 | Wizard steps in `components/forms/` (`ChoiceStep`, `QuestionStep`, `DualDateStep`, `SimpleRadioChoice`, `WizardProgress`) | `wizards/shared/` | Same kit |
| 3 | `newPlayer/FormField.tsx` | `components/forms/` | `components/forms/` becomes plain form fields: `FormField` and `DateField` |
| 3 | `operator/SeasonCreationWizard.tsx`, `operator/wizardReducer.ts`, `data/seasonWizardSteps.tsx` | `wizards/season-v1/` | The old season wizard, named to sit beside `season-v2/` |
| 3 | `operator/PlayoffsSetupWizard.tsx` | `wizards/playoffs-setup/` | Wizards live in `wizards/` |
| 4 | `newPlayer/` | `profile/new-player/` | All three profile forms in one place |
| 4 | `completeProfile/` | `profile/complete/` | Same |
| 5 | `leagueOperator/` | `operator/application/` | The become-an-LO application is part of operator |
| 5 | `components/privacy/`, `components/previews/`, and the `SecurityDisclaimer` and `SetupGuide` pop-ups | `operator/application/` | Only the application uses them |
| 5 | `components/operator/` (68 files, with `finances/`, `manual-scoring/`, `preferences/`) | `operator/components/` | One operator tree, not two |
| 5 | `components/operator/SectionCard.tsx` | `components/SectionCard.tsx` | Onboarding uses it too, so it stays shared |
| 5 | `components/playoff/` | `operator/components/playoff/` | Only operator uses it |
| 5 | Operator-only loose files: `AllPlayersRosterCard`, `MatchCard`, `RecordDuesModal`, `TableSizeLabel`, `TeamCard`, `VenueListItem`, and the `DeleteLeague` and `DayOfWeekWarning` pop-ups | `operator/components/` | Only operator uses them |
| 6 | `pages/Messages.tsx`, `components/messages/`, `components/onboarding/` (the profanity pop-up) | `messages/` | Messaging becomes one feature folder |
| 6 | `player/PlayerStats.tsx`, `pages/TopShooters.tsx`, `pages/TeamStats.tsx`, `pages/FeatsOfExcellence.tsx`, `components/StatsNavBar.tsx` | `stats/` | Stats screens join the stats logic already there |
| 6 | `components/stats/` | `stats/components/` | Same |
| 6 | `components/match/` | `player/match/` | Only match-night screens use it |
| 6 | `components/PlayerRoster.tsx` | `player/` | Only player screens use it |
| 7 | `components/AlertDialog.tsx` | `components/shared/` | It's a building block, next to `ConfirmDialog` and `Modal` |

## What stays, on purpose

- **`components/` keeps about 33 loose files.** Each is generic, or used by
  two or more features:
  - app-level pieces: `ErrorBoundary`, `PageHeader`, `InfoButton`,
    `ProtectedRoute`, `NonProdGate`
  - people and team pieces: `PlayerNameLink`, `TeamNameLink`, the
    comboboxes, the placeholder and invite pieces
  - payments: `PaymentCardForm`, `PaymentMethodSetup`
  - theme and install: `ThemeToggle`, `InstallAppCard`, `ShareAppCard`
- **These `components/` subfolders stay**, because each is used by two or
  more features: `scoring/`, `lineup/`, `schedule/`, `season/`, `reup/`,
  `invite/`, `coinflip/`, `icons/`, `layout/`, `shared/`, `modals/`, `ui/`.
- **`pages/` keeps** the standalone pages: Standings, Season Overview,
  Player Profile, Learn, Admin Reports, Captain Re-up, Match Data Viewer,
  Handicap Lookup, plus Home and Become a Host.
- **`player/` and `operator/` stay as role folders**, holding the
  match-night screens and the league-management screens.

## Something the scan found: ~45 files nothing uses

These files have no importers anywhere in the app. Tests that only test the
file itself don't count. They move with their folders unless you decide
otherwise. **Your call:** delete them before the moves, as with the five
earlier, or leave them for later.

- **Messages:** the `announcements/`, `newmessage/` and `settings/` sub-pieces
  (11 files). They look like leftovers from when the pop-ups were split up.
- **Operator cards:** `ContentModerationCard`, `QuickStats`, `SeasonsCard`,
  `operator/ScheduleView`.
- **Pop-ups:** `DeleteSeasonModal`, `PlaceholderRemovalModal`, and the
  scoring `ConfirmationModal` and `VacateModal`.
- **Schedule pieces:** `EmptyScheduleState`, `ScheduleErrorState`,
  `ScheduleLoadingState`, `WeekCard`.
- **Others:**
  - `PlayoffBracketCard`, `TestModeToggle`, two rack icons
  - `ui/CapInput`, `ui/scroll-area`
  - `LogoutButton`
  - `wizards/league-v2/LeagueCreatedScreen`
  - `wizards/season-v2/steps/PlayoffWeeksStep`
  - `leagueOperator/VisibilityChoiceCard` (a dead copy of the one in
    `privacy/`)
- **Hooks and helpers:**
  - `usePermissions`, `useTeamPlaceholders`, `venueDuplicates`
  - `useDebounce`, `useLocalStorage`, `useRealtime`, `useTournamentSearch`
  - `useMatchLineupsRealtime`, `getUserTeamInfo`, `messageValidators`
  - `playerQueries`, `teamQueries`, `tableAssignment`
  - `constants/days`
  - `data/matchupTables/thirtyEightTeamSchedule` (check it isn't picked by
    team count before deleting)

Each one gets one more check before any delete: a text search for its name,
to catch anything loaded by a string.
