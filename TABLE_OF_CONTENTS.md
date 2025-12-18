# Complete Project Table of Contents

> **Last Updated**: 2025-12-18 (added dev email confirmation migration, venue table counts migration)
> **Purpose**: Comprehensive index of EVERY file in this project for quick navigation and organization analysis
> **Maintenance**: Update this file whenever you create, move, rename, or delete ANY file or folder

---

## 📋 Quick Navigation

- [Project Root Files](#-project-root-files)
- [Documentation](#-documentation)
- [Configuration Files](#%EF%B8%8F-configuration-files)
- [Memory Bank](#-memory-bank-project-intelligence)
- [Database Schema & Migrations](#-database-schema--migrations)
- [Source Code (`/src`)](#-source-code-src)
- [Reference Code](#-reference-code)
- [Build & Distribution](#-build--distribution)
- [Known Issues](#%EF%B8%8F-known-duplicates--issues)

---

## 📁 Project Root Files

### Core Documentation

| File | Purpose | Status |
|------|---------|--------|
| `README.md` | Project overview and setup instructions | Active |
| `CLAUDE.md` | Claude Code AI assistant instructions for this project | **CRITICAL** - Always read |
| `CLAUDE-PERSONAL.md` | Personal Claude preferences | Active |
| `TABLE_OF_CONTENTS.md` | This file - complete project index | **UPDATE ON EVERY FILE CHANGE** |
| `RESTRUCTURE_PLAN.md` | Current app reorganization plan | Active (app-restructure branch) |

### Feature Plans & Specifications (Active)

| File | Purpose | Status |
|------|---------|--------|
| `MVP_FEATURE_LIST.md` | Minimum viable product feature list | **Active - MVP tracker** |
| `LIST_FOR_JACK.md` | Design and styling tasks for Jack | **Active - UI/UX improvements** |

### Reference Documentation Folder

| Location | Purpose | Notes |
|----------|---------|-------|
| `/docs/` | **Domain knowledge & business rules** | Reference material about pool league systems |
| `docs/BCA_HANDICAP_SYSTEM.md` | BCA handicap system documentation | Official BCA handicap rules and calculations |
| `docs/CUSTOM_5MAN_HANDICAP_SYSTEM.md` | Custom 5-man handicap system | Proprietary handicap system for 5-man format |
| `docs/LEAGUE_MANAGEMENT_PLAN.md` | League management system architecture | System hierarchy and database schema |

### Future Work Folder

| Location | Purpose | Notes |
|----------|---------|-------|
| `/future/` | **Post-MVP features and optimizations** | Work to resume after MVP complete |
| `future/DATABASE-USAGE-MAP.md` | Phase 3 messaging TanStack migration inventory | Post-MVP optimization |
| `future/LEAGUE-SEASON-WIZARD-REFACTOR-TODO.md` | League/season wizard improvements | Future UX enhancements |
| `future/phase3-migration-approach.md` | Phase 3 TanStack Query migration planning | Post-MVP optimization |

### Archive Folder

| Location | Purpose | Notes |
|----------|---------|-------|
| `/archive/` | **Completed/obsolete planning files** | Reference only - not active work |
| `archive/PRIORITY-1-COMPLETE.md` | Auth & Members TanStack migration (complete) | ✅ Complete |
| `archive/PRIORITY-2-COMPLETE.md` | Team & Player data TanStack migration (complete) | ✅ Complete |
| `archive/TESTING-SETUP-PLAN.md` | Testing setup plan (tests now built) | ✅ Complete |
| `archive/USEREDUCER-MIGRATION-PLAN.md` | useReducer migration plan (complete) | ✅ Complete |
| `archive/OPTIMIZATION_SUMMARY.md` | Historical optimization record | Reference |
| `archive/MESSAGING_REFACTOR_PLAN.md` | Old messaging refactor plan (duplicate) | Obsolete |
| `archive/MESSAGING-REFACTOR-PLAN.md` | Old messaging refactor plan (duplicate) | Obsolete |
| `archive/EDIT-MODE-PLAN.md` | Edit mode plan (approach may have changed) | Reference |
| `archive/REFACTOR-LINEUP.md` | Lineup refactor architecture (future work) | Reference |
| `archive/REFACTOR-SCORING.md` | Scoring refactor architecture (future work) | Reference |
| `archive/TODO-CAPITALIZE-INPUT.md` | Capitalize input migration (mostly complete) | Reference |
| `archive/TODO-REPLACE-ALERTS.md` | Alert replacement TODO (mostly complete) | Reference |
| `archive/UI_IMPROVEMENTS_TODO.md` | UI improvements (mostly complete) | Reference |
| `archive/PRIORITY-3-ROADMAP.md` | Messaging TanStack Query migration (post-MVP optimization) | Future work |
| `archive/MIGRATION-TRACKER.md` | Hook migration tracker (complete) | ✅ Complete |
| `archive/NON-TANSTACK-DATABASE-CALLS.md` | Migration completion tracker (100% complete) | ✅ Complete |
| `archive/MUTATIONS-IMPLEMENTATION.md` | Mutations infrastructure summary (Phase 1 complete) | ✅ Complete |
| `archive/CENTRAL-DATABASE.md` | Early migration notes/questions | Reference |
| `archive/FEATURES_TO_SALVAGE.md` | Feature salvage notes | Reference |
| `archive/realtime-strategy.md` | Real-time strategy (implemented) | ✅ Complete |
| `archive/PLAYER_HANDICAP_IMPLEMENTATION.md` | Player handicap implementation plan (done) | ✅ Complete |
| `archive/tanstack-migration-todo.md` | TanStack migration tracking | ✅ Complete |
| `archive/messaging-system-audit.md` | Messaging TanStack audit (100% complete) | ✅ Complete |
| `archive/TESTING-ISSUES.md` | Testing issues from migration | Reference |

### Build & Package Files

| File | Purpose |
|------|---------|
| `package.json` | Project dependencies and npm scripts |
| `package-lock.json` | npm dependency lock file |
| `pnpm-lock.yaml` | **pnpm dependency lock** (primary) |
| `pnpm-workspace.yaml` | pnpm workspace configuration |
| `index.html` | Vite HTML entry point |

### Orphaned/Unknown Files

| File | Purpose | Action Needed |
|------|---------|---------------|
| `cUsersshodbpersonalsupabase-learning-hubsrcutilsscheduleGenerator.ts` | Unknown - possibly corrupt file path | **DELETE?** |

---

## ⚙️ Configuration Files

### TypeScript Configuration

| File | Purpose |
|------|---------|
| `tsconfig.json` | Main TypeScript configuration |
| `tsconfig.app.json` | App-specific TypeScript config |
| `tsconfig.node.json` | Node/build TypeScript config |

### Build & Development Tools

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build tool configuration |
| `vitest.config.ts` | Vitest test runner configuration |
| `eslint.config.js` | ESLint code quality configuration |
| `components.json` | shadcn/ui components configuration |

### Editor Configuration

| Directory/File | Purpose |
|----------------|---------|
| `.vscode/settings.json` | VSCode workspace settings |
| `.vscode/extensions.json` | Recommended VSCode extensions |
| `.claude/settings.local.json` | Claude Code local settings |

### Environment & Git

| File | Purpose |
|------|---------|
| `.env` | Environment variables (**NOT in git**) |
| `.gitignore` | Git ignore patterns |

---

## 🧠 Memory Bank (Project Intelligence)

> **Location**: `/memory-bank/`
> **Purpose**: Living documentation that Claude Code uses to understand project context, patterns, and decisions

### Core Memory Bank Files

| File | Purpose | Last Updated |
|------|---------|--------------|
| `projectbrief.md` | Foundation document - project goals and scope | Sep 22 |
| `productContext.md` | Why this exists, problems it solves, UX goals | Oct 15 |
| `activeContext.md` | Current work focus, recent changes, next steps | Oct 26 ✨ |
| `progress.md` | What works, what's left, current status | Oct 15 |
| `architecture.md` | System architecture and key decisions | Oct 15 |
| `currentStatus.md` | Current project status | Oct 15 |

### Feature-Specific Memory Files

| File | Purpose | Last Updated |
|------|---------|--------------|
| `databaseSchema.md` | Database schema documentation | Oct 26 |
| `messagingSystemProgress.md` | Messaging feature progress tracker | Oct 26 |
| `scheduleReviewSystem.md` | Schedule review feature docs | Oct 15 |
| `tournamentSchedulingPattern.md` | Tournament scheduling logic | Oct 15 |
| `leagueCreationWizard.md` | League wizard implementation | Oct 15 |
| `profanity-filter-implementation.md` | Profanity filter docs | Oct 26 |
| `perpetualBCADates.md` | BCA date handling patterns | Oct 26 |
| `edsPlan.md` | Ed's planning notes | Oct 26 |
| `futureFeatures.md` | Future feature ideas | Oct 15 |
| `API-HOOKS-USAGE.md` | TanStack Query API hooks usage guide | Nov 7 ✨ |
| `CENTRAL-DATABASE-IMPLEMENTATION.md` | TanStack Query patterns and migration approach | Nov 7 ✨ |

---

## 🗄️ Database Schema & Migrations

> **Location**: `/database/`
> **Purpose**: SQL migration files for local Supabase instance

### Core Database Tables

| File | Purpose |
|------|---------|
| `members.sql` | Member profiles and authentication |
| `leagues.sql` | League definitions |
| `seasons.sql` | Season configuration |
| `teams.sql` | Team data |
| `team_players.sql` | Team roster relationships |
| `venues.sql` | Venue information |
| `venue_owners.sql` | Venue ownership relationships |
| `league_venues.sql` | League-venue associations |
| `matches.sql` | Match data (original) |
| `matches_unfinished.sql` | Match schema iteration |
| `matches_complete.sql` | Final match schema |
| `season_weeks.sql` | Season week structure |

### League Operator System

| File | Purpose |
|------|---------|
| `league_operators.sql` | League operator definitions (original) |
| `league_operators_unfinished.sql` | Operator schema iteration |
| `league_operators_complete.sql` | Final operator schema |
| `league_operators_update1.sql` | Operator schema update |
| `operator_blackout_preferences.sql` | Operator scheduling blackout dates |

### Messaging System (`/database/messaging/`)

| File | Purpose |
|------|---------|
| `README.md` | Messaging system setup guide |
| `SETUP_messaging_system.sql` | Complete messaging system setup |
| `MIGRATION_messaging_fixes.sql` | Messaging migration fixes |
| `conversations.sql` | Conversation table |
| `conversation_participants.sql` | Participant relationships |
| `messages.sql` | Message data |
| `blocked_users.sql` | Blocked user relationships |
| `user_reports.sql` | User reporting system |
| `messaging_rls_policies.sql` | Row-level security policies |
| `enable_realtime.sql` | Realtime subscription setup |
| `create_conversation_function.sql` | Create conversation function |
| `create_dm_conversation_function.sql` | DM conversation function |
| `create_group_conversation_function.sql` | Group conversation function |
| `create_announcement_conversation_function.sql` | Announcement function |
| `create_organization_announcement_function.sql` | Org announcement function |
| `fix_all_messaging_policies.sql` | Policy fixes |
| `fix_blocked_users_rls.sql` | Blocked users RLS fix |
| `fix_dm_conversation_function.sql` | DM function fix |
| `add_profanity_filter_columns.sql` | Profanity filter support |
| `clear_test_messages.sql` | Test data cleanup |
| `debug_current_conversations.sql` | Debugging query |
| `debug_messages_policy.sql` | Policy debugging |

### 3x3 Scoring System (`/database/scoring3x3/`)

| File | Purpose |
|------|---------|
| `match_lineups.sql` | Match lineup data |
| `lineups.sql` | Lineup definitions |
| `match_games.sql` | Individual game results |
| `handicap_chart_3vs3.sql` | 3v3 handicap chart |
| `create_substitute_members.sql` | Substitute member support |
| `enable_realtime_match_games.sql` | Realtime game updates |

### Reporting System (`/database/reporting/`)

*(Files in this directory - add if needed)*

### Migrations & Utilities

| File | Purpose |
|------|---------|
| `migrations/add_handicap_variant_to_leagues.sql` | Migration: Add handicap_variant fields to leagues table |
| `migrations/add_match_results_tracking.sql` | Migration: Add match results tracking system |
| `scoring3x3/add_game_type_to_match_games.sql` | **Add game_type column to match_games (denormalized for performance)** |
| `tests/` | Database test files |
| `README_DATABASE_INTEGRATION.md` | Database integration guide |
| `MESSAGING_AND_REPORTING_COMPLETE.md` | Messaging/reporting completion notes |

### Database Utilities & Fixes

| File | Purpose |
|------|---------|
| `rebuild_all_tables.sql` | Complete database rebuild script |
| `seed_test_users.sql` | Test user data |
| `seed_fake_members.sql` | Fake member data for testing |
| `seed_fake_members.sql.backup` | Backup of seed data |
| `add_member_insert_policy.sql` | Member insert RLS policy |
| `fix_members_rls.sql` | Member RLS fixes |
| `check_members_policies.sql` | Member policy check |
| `check_authenticated_members.sql` | Auth member check |
| `test_auth_context.sql` | Auth context testing |
| `championship_date_options.sql` | Championship date calculations |
| `delete_season.sql` | Season deletion function |
| `migrate_matches_to_season_week_id.sql` | Match migration |
| `migration_matches_add_round_number.sql` | Round number migration |
| `matches_unfinished_update1.sql` | Match schema update |

---

## 💻 Source Code (`/src`)

> **Total**: 270 TypeScript/TSX files
> **Package Manager**: **pnpm** (not npm)

### 📁 Root Level (`/src`)

| File | Purpose |
|------|---------|
| `App.tsx` | Main application component with routing |
| `main.tsx` | Application entry point |
| `supabaseClient.ts` | Supabase client configuration |
| `vite-env.d.ts` | Vite TypeScript definitions |

---

### 🧪 Tests (`/__tests__`)

#### Integration Tests (`/__tests__/integration/`)
- `SeasonCreationWizard.critical.test.tsx` - Critical path tests
- `SeasonCreationWizard.smoke.test.tsx` - Smoke tests

#### Unit Tests (`/__tests__/unit/`)
- `messageQueries.test.ts` - Message query utilities
- `profanityFilter.test.ts` - Profanity filter
- `scheduleUtils.test.ts` - Schedule utilities

#### Test Utilities (`/test/`)
- `setup.ts` - Test environment setup
- `utils.tsx` - Test helper utilities
- `vitest-setup.d.ts` - Vitest type definitions

---

### 📄 Pages & Routes

#### Static Pages
- `about/About.tsx` - About page
- `home/Home.tsx` - Landing/home page
- `dashboard/Dashboard.tsx` - Main dashboard

#### Player Pages (`/player/`)
- `MatchLineup.tsx` - Match lineup editor
- `MyTeams.tsx` - Player's teams overview
- `ScoreMatch.tsx` - Match scoring interface
- `TeamSchedule.tsx` - Team schedule view

#### Operator Pages (`/operator/`)

**Dashboards & Overview**
- `OperatorDashboard.tsx` - Main operator dashboard
- `OperatorWelcome.tsx` - Welcome screen

**League Management**
- `LeagueCreationWizard.tsx` - Current league wizard
- `LeagueCreationWizard.old.tsx` - ⚠️ **LEGACY - DELETE?**
- `LeagueDetail.tsx` - League details page
- `LeagueRules.tsx` - League rules management

**Season & Schedule Management**
- `SeasonCreationWizard.tsx` - Season creation wizard
- `ScheduleCreationWizard.tsx` - Schedule creation wizard
- `ScheduleSetup.tsx` - Schedule setup component
- `ScheduleSetupPage.tsx` - Schedule setup page
- `ScheduleView.tsx` - Schedule view
- `SeasonScheduleManager.tsx` - Season schedule manager
- `SeasonSchedulePage.tsx` - Season schedule page

**Team & Venue Management**
- `TeamManagement.tsx` - Team management interface
- `TeamEditorModal.tsx` - Team editor modal
- `VenueManagement.tsx` - Venue management
- `VenueLimitModal.tsx` - Venue limit warning

**Administration**
- `OrganizationSettings.tsx` - Organization settings
- `ReportsManagement.tsx` - User reports management

**State Management**
- `wizardReducer.ts` - Wizard state reducer

#### Standalone Pages (`/pages/`)
- `AdminReports.tsx` - Admin reports dashboard
- `Messages.tsx` - Messaging page
- `PlayerProfile.tsx` - Player profile page

#### Auth Pages (`/login/`)
- `Login.tsx` - Login page
- `Register.tsx` - Registration page
- `ClaimPlayer.tsx` - Claim placeholder player for existing authenticated users
- `ForgotPassword.tsx` - Password recovery
- `ResetPassword.tsx` - Password reset
- `EmailConfirmation.tsx` - Email confirmation
- `LoginCard.tsx` - Login card component
- `LogoutButton.tsx` - Logout button

#### Profile (`/profile/`)
- `Profile.tsx` - Main profile page
- `AddressSection.tsx` - Address form section
- `ContactInfoSection.tsx` - Contact info section
- `PersonalInfoSection.tsx` - Personal info section
- `PrivacySettingsSection.tsx` - Privacy settings
- `SuccessMessage.tsx` - Success feedback
- `types.ts` - Profile type definitions
- `useProfileForm.ts` - Profile form hook
- `validationSchemas.ts` - Profile validation schemas

---

### 🏗️ Features

#### League Operator Application (`/leagueOperator/`)
- `BecomeLeagueOperator.tsx` - Entry point
- `LeagueOperatorApplication.tsx` - Main application form
- `ChoiceStep.tsx` - Choice step component
- `QuestionStep.tsx` - Question step component
- `VisibilityChoiceCard.tsx` - Visibility choice card ⚠️ **DUPLICATE** (also in `/components/privacy`)
- `applicationReducer.ts` - State reducer
- `questionDefinitions.tsx` - Question config
- `types.ts` - Type definitions
- `useApplicationForm.ts` - Form hook

#### Player Registration (`/newPlayer/`)
- `NewPlayerForm.tsx` - Registration form
- `FormField.tsx` - Form field component
- `types.ts` - Type definitions
- `usePlayerForm.ts` - Form hook
- `usePlayerFormSubmission.ts` - Submission hook

#### Info Pages (`/info/`)
- `FormatComparison.tsx` - Format comparison
- `EightManFormatDetails.tsx` - 8-man format details
- `FiveManFormatDetails.tsx` - 5-man format details

---

### 🧩 Components

#### UI Library (`/components/ui/`)

> **CRITICAL**: Always use these shadcn/ui components for ALL UI elements

| Component | Use For |
|-----------|---------|
| `button.tsx` | **ALL buttons** (never use `<button>`) |
| `input.tsx` | **ALL text inputs** (never use `<input>`) |
| `label.tsx` | **ALL form labels** (never use `<label>`) |
| `select.tsx` | **ALL dropdowns** (never use `<select>`) |
| `card.tsx` | Card containers |
| `dialog.tsx` | Modal dialogs |
| `tabs.tsx` | Tab navigation |
| `calendar.tsx` | **ALL date inputs** (never use `<input type="date">`) |
| `badge.tsx` | Status badges |
| `accordion.tsx` | Accordion/collapsible |
| `switch.tsx` | Toggle switches |
| `command.tsx` | Command palette |
| `popover.tsx` | Popover containers |
| `dropdown-menu.tsx` | Dropdown menus |
| `textarea.tsx` | Multiline text input |
| `capitalize-input.tsx` | Auto-capitalize input |
| `password-input.tsx` | Password input with toggle |

#### Shared UI Components (`/components/shared/`)
- `EmptyState.tsx` - Empty state component
- `LoadingState.tsx` - Loading state component
- `Modal.tsx` - Base modal component
- `index.ts` - Exports

#### Form Components (`/components/forms/`)

Reusable wizard/form step components

- `WizardProgress.tsx` - Progress indicator
- `WizardStepRenderer.tsx` - Step renderer wrapper
- `ChoiceStep.tsx` - Choice selection step
- `RadioChoiceStep.tsx` - Radio choice step
- `SimpleRadioChoice.tsx` - Simple radio choice
- `QuestionStep.tsx` - Question step
- `DateField.tsx` - Date input field
- `DateStep.tsx` - Date selection step
- `DualDateStep.tsx` - Dual date selection
- `ChampionshipDateStep.tsx` - Championship date step
- `LeaguePreview.tsx` - League preview card

#### Schedule Components (`/components/schedule/`)
- `MatchCard.tsx` - Match display card ⚠️ **DUPLICATE** (also in `/components`)
- `WeekCard.tsx` - Week display card
- `EmptyScheduleState.tsx` - Empty state
- `ScheduleErrorState.tsx` - Error state
- `ScheduleLoadingState.tsx` - Loading state

#### Season Components (`/components/season/`)
- `ConflictBadge.tsx` - Schedule conflict badge
- `ScheduleReview.tsx` - Schedule review component
- `ScheduleReviewTable.tsx` - Schedule review table
- `ScheduleWeekRow.tsx` - Schedule week row

#### Lineup Management (`/components/lineup/`)
- `LineupActions.tsx` - Action buttons
- `LineupSelector.tsx` - Player selector
- `MatchInfoCard.tsx` - Match info display
- `PlayerRoster.tsx` - Player roster
- `TestModeToggle.tsx` - Test mode toggle

#### Scoring Components (`/components/scoring/`)
- `ScoreboardCard.tsx` - Scoreboard display
- `GamesList.tsx` - Games list
- `MatchScoreboard.tsx` - Swipeable match scoreboard with team/player stats (extracted from ScoreMatch)
- `GameButtonRow.tsx` - Game row with breaker vs racker buttons (extracted from ScoreMatch)
- `ScoringDialog.tsx` - Game winner selection with B&R and Golden Break (extracted from ScoreMatch)
- `ConfirmationDialog.tsx` - Opponent score confirmation and vacate requests (extracted from ScoreMatch)
- `EditGameDialog.tsx` - Vacate winner request dialog (extracted from ScoreMatch)

#### Messaging Components (`/components/messages/`)
- `MessageView.tsx` - Main message view
- `MessageInput.tsx` - Message input
- `MessageBubble.tsx` - Message bubble
- `ConversationList.tsx` - Conversation list
- `ConversationHeader.tsx` - Conversation header
- `MessagesEmptyState.tsx` - Empty state
- `NewMessageModal.tsx` - New message modal
- `AnnouncementModal.tsx` - Announcement modal
- `MessageSettingsModal.tsx` - Settings modal
- `BlockedUsersModal.tsx` - Blocked users modal
- `UserListItem.tsx` - User list item

#### Operator Components (`/components/operator/`)
- `ActiveLeagues.tsx` - Active leagues overview (uses LeagueStatusCard)
- `ContactInfoCard.tsx` - Organization contact info editor (email/phone with visibility)
- `DashboardCard.tsx` - Dashboard card wrapper
- `LeagueOverviewCard.tsx` - League overview
- `LeagueProgressBar.tsx` - League progress bar component (used by LeagueStatusCard)
- `LeagueStatusCard.tsx` - **UNIFIED league status component** - Single source of truth for league/season status, progress, and next actions (used on both Dashboard and League Detail pages)
- `OrganizationBasicInfoCard.tsx` - Organization name and mailing address editor
- `OrganizationPreferencesCard.tsx` - Organization-level preferences editor (handicap, format, rules defaults)
- `PaymentMethodCard.tsx` - Payment method card (Stripe integration placeholder)
- `QuickStats.tsx` - Quick statistics
- `ScheduleCard.tsx` - Schedule card
- `SeasonStatusCard.tsx` - Season status
- `SeasonsCard.tsx` - Seasons list card
- `TeamsCard.tsx` - Teams card
- `VenueCard.tsx` - Venue card
- `VenueCreationModal.tsx` - Venue creation modal

#### Playoff Components (`/components/playoff/`)
- `ParticipationSettingsCard.tsx` - Playoff participation/qualification settings with collapsible edit controls
- `PlayoffWeeksCard.tsx` - Playoff weeks selector with add weeks modal and payment method options
- `WildcardSettingsCard.tsx` - Wildcard spots configuration for random selection from non-qualifying teams

#### Player Components (`/components/player/`)
- `TeamCard.tsx` - Player team card ⚠️ **DUPLICATE** (also in `/components`)

#### Modal Components (`/components/modals/`)
- `DayOfWeekWarningModal.tsx` - Day of week warning
- `DeleteLeagueModal.tsx` - League deletion confirmation
- `DeleteSeasonModal.tsx` - Season deletion confirmation
- `PendingInvitesModal.tsx` - Modal showing pending placeholder player invites to users after login
- `SecurityDisclaimerModal.tsx` - Security disclaimer
- `SetupGuideModal.tsx` - Setup guide
- `WeekOffReasonModal.tsx` - Week off reason

#### Preview Components (`/components/previews/`)
- `ApplicationPreview.tsx` - Application preview

#### Privacy Components (`/components/privacy/`)
- `ContactInfoExposure.tsx` - Contact info visibility
- `VisibilityChoiceCard.tsx` - Visibility choice ⚠️ **DUPLICATE** (also in `/leagueOperator`)

#### Root-Level Components (`/components/`)

> These should be categorized or moved to feature directories

- `AllPlayersRosterCard.tsx` - All players roster
- `AlertDialog.tsx` - Alert/info dialog with OK button (success/warning/error/info)
- `ConfirmDialog.tsx` - Confirmation dialog with Cancel/Confirm buttons
- `InfoButton.tsx` - Info button with tooltip
- `InvitePlayerModal.tsx` - **✅ Phase 8** Captain invite modal for placeholder players
- `InviteStatusBadge.tsx` - **✅ Phase 9** Badge showing invite status on PP cards
- `MatchCard.tsx` - Match card
- `MemberCombobox.tsx` - Member selection combobox
- `PaymentCardForm.tsx` - Payment card form
- `PlayerNameLink.tsx` - Player name link (opens InvitePlayerModal for PPs)
- `ProtectedRoute.tsx` - Route protection HOC
- `ReportUserModal.tsx` - User reporting modal
- `SponsorLogos.tsx` - Sponsor logo display
- `TeamCard.tsx` - Team card ⚠️ **DUPLICATE**
- `TeamNameLink.tsx` - Team name link
- `TeamRosterList.tsx` - Team roster list
- `VenueListItem.tsx` - Venue list item

---

### 🎣 Hooks (`/hooks/`)

#### Data Fetching & State
- `useCurrentMember.ts` - Current member data
- `useOperatorId.ts` - Operator ID lookup
- `useUserProfile.ts` - User profile data
- `usePendingReportsCount.ts` - Pending reports count
- `useTournamentSearch.ts` - Tournament search
- `useQueryStates.tsx` - **Unified query error/loading handler** - Consolidates multiple TanStack Query states into single check

#### Real-time & Messaging
- `useRealtime.ts` - Supabase realtime subscriptions
- `useMessages.ts` - Message management
- `useConversations.ts` - Conversation management
- `useConversationParticipants.ts` - Conversation participants
- `useUnreadMessageCount.ts` - Unread message count

#### League & Season Management
- `useLeagueWizard.ts` - League wizard state
- `useScheduleGeneration.ts` - Schedule generation
- `useSeasonSchedule.ts` - Season schedule data

#### Team & Match Management
- `useTeamManagement.ts` - Team management
- `useMatchLineup.ts` - Match lineup editor
- `useMatchScoring.ts` - Match scoring state (data fetching)
- `useMatchScoringMutations.ts` - Match scoring mutations (database operations)
- `useRosterEditor.ts` - Roster editing

#### Form & Validation
- `useProfanityFilter.ts` - Profanity filtering
- `useOperatorProfanityFilter.ts` - Operator profanity filter
- `useChampionshipAutoFill.ts` - Championship date autofill

#### Utilities
- `useDebounce.ts` - Debounce hook
- `useLocalStorage.ts` - Local storage hook

#### Playoff Hooks (`/hooks/playoff/`)
- `usePlayoffSettingsReducer.ts` - Playoff settings state management with useReducer pattern

---

### 🛠️ Utilities (`/utils/`)

#### Date & Time

> **CRITICAL**: Always use `formatters.ts` for timezone-safe date handling

- `formatters.ts` - **Timezone-safe date utilities** (parseLocalDate, formatLocalDate, etc.)
- `holidayUtils.ts` - Holiday detection and handling

#### Schedule & Matchup
- `scheduleGenerator.ts` - Schedule generation logic
- `scheduleUtils.ts` - Schedule utilities
- `scheduleDisplayUtils.ts` - Schedule display helpers
- `matchupTables.ts` - Matchup table utilities
- `conflictDetectionUtils.ts` - Schedule conflict detection
- `gameOrder.ts` - Game order utilities

#### Team & Player
- `teamQueries.ts` - Team database queries
- `playerQueries.ts` - Player database queries
- `calculatePlayerHandicap.ts` - **Self-contained player handicap calculator** (3v3 & 5v5 support)
- `getTeamHandicapBonus.ts` - **Team handicap bonus calculator** (placeholder until standings built)
- `handicapCalculations.ts` - Handicap calculations and team handicap utilities
- `calculateHandicapThresholds.ts` - Calculate handicap thresholds for matches
- `nicknameGenerator.ts` - Player nickname generation

#### Handicap System (`/utils/handicap/`)
- `get3v3GamesNeeded.ts` - **Hard-coded 3v3 handicap chart** (25 rows, -12 to +12 range)
- `get5v5GamesNeeded.ts` - **Hard-coded 5v5 BCA handicap chart** (7 ranges, percentage-based)
- `index.ts` - **Unified handicap interface** (getGamesNeeded, getGamesNeededForBothTeams)

#### League, Season & Tournament
- `leagueUtils.ts` - League utilities
- `seasonUtils.ts` - Season utilities (getMostRecentSeason, hasExistingSeasons)
- `tournamentUtils.ts` - Tournament utilities

#### Messaging
- `messageQueries.ts` - Message database queries
- `messageFormatters.ts` - Message formatting
- `messageValidators.ts` - Message validation
- `profanityFilter.ts` - Profanity filtering

#### Membership & Reporting
- `membershipUtils.ts` - Membership utilities
- `reportingQueries.ts` - Reporting queries

---

### 🎨 Services (`/services/`)

High-level business logic services

- `leagueService.ts` - League business logic
- `seasonService.ts` - Season business logic
- `championshipService.ts` - Championship logic

---

### 🔌 API Layer (`/api/`) **NEW - TanStack Query**

> **Purpose**: Centralized database access layer with automatic caching, deduplication, and optimistic updates
> **See**: [CENTRAL-DATABASE-IMPLEMENTATION.md](CENTRAL-DATABASE-IMPLEMENTATION.md) for migration plan

#### Core Configuration
- `client.ts` - **QueryClient configuration** with optimized defaults for caching
- `queryKeys.ts` - **Type-safe query key factory** (single source of truth for cache keys)

#### Queries (`/queries/`) - Read Operations
*Migration from `/utils/*Queries.ts` in progress*

- `members.ts` - **✅ Member queries** (getCurrentMember, getMemberProfile, getOperatorId, etc.)
- `matchGames.ts` - **✅ Match game queries** (fetchPlayerGameHistory for handicap calculations)

#### Mutations (`/mutations/`) - Write Operations
*Create/Update/Delete operations with automatic cache invalidation*

- `matches.ts` - **✅ Match mutations** (generic updateMatch for any match field updates)
- `matchLineups.ts` - **✅ Match lineup mutations** (generic updateMatchLineup + specific save/lock/unlock)

#### Hooks (`/hooks/`) - React Query Hooks
*React-specific wrappers combining queries with useQuery/useMutation*

- `useCurrentMember.ts` - **✅ Current member hook** (replaces old version, 30min cache)
- `usePendingInvites.ts` - **✅ Pending invites hook** (fetches placeholder player invites via get_my_pending_invites RPC)
- `useInviteStatuses.ts` - **✅ Invite statuses hook** (batch fetch invite statuses for PP cards in TeamEditorModal)
- `useUserProfile.ts` - **✅ User profile hook** (full member data + role utilities)
- `useOperatorId.ts` - **✅ Operator ID hook** (operator lookup with caching)
- `index.ts` - Central export point for all hooks

**Migration Status**: Phase 1 Complete (foundation), Phase 2 Next (migrate member/user data)

---

### 📊 Data & Constants

#### Wizard Step Definitions (`/data/`)
- `leagueWizardSteps.tsx` - League wizard steps
- `leagueWizardSteps.simple.tsx` - Simplified league steps
- `scheduleWizardSteps.tsx` - Schedule wizard steps
- `seasonWizardSteps.tsx` - Season wizard steps
- `mockVenues.ts` - Mock venue data

#### Matchup Tables (`/data/matchupTables/`)

Pre-calculated round-robin schedules (19 files)

- `4-team.ts`, `6-team.ts`, `8-team.ts`, `10-team.ts`
- `12-team.ts`, `14-team.ts`, `16-team.ts`, `18-team.ts`
- `20-team.ts`, `22-team.ts`, `24-team.ts`, `26-team.ts`
- `28-team.ts`, `30-team.ts`, `32-team.ts`, `34-team.ts`
- `36-team.ts`, `38-team.ts`, `40-team.ts`
- `thirtyEightTeamSchedule.ts` - 38-team schedule variant
- `index.ts` - Exports

#### Info Content (`/constants/infoContent/`)

Help/info content for features

- `leagueWizardInfoContent.tsx` - League wizard help
- `seasonWizardInfoContent.tsx` - Season wizard help
- `operatorApplicationInfoContent.tsx` - Operator app help
- `profileInfoContent.tsx` - Profile help

#### Other Constants (`/constants/`)
- `states.ts` - US states list
- `scheduleConflicts.ts` - Schedule conflict definitions

---

### 📐 Types (`/types/`)

TypeScript type definitions - **Single source of truth for all types**

- `index.ts` - **Central export point** for all types (import from `@/types`)
- `league.ts` - League types
- `season.ts` - Season types
- `team.ts` - Team types
- `member.ts` - Member types
- `operator.ts` - Operator types
- `tournament.ts` - Tournament types
- `venue.ts` - Venue types
- `schedule.ts` - **Match and schedule types** (Match, MatchWithDetails, MatchStatus, TeamSchedulePosition)
- `scheduleReview.ts` - Schedule review types
- `match.ts` - Match scoring and game types

**Type Organization Best Practice**: All duplicate type definitions have been consolidated into this folder. Always import from `@/types` for consistency.

---

### 🔒 Validation (`/schemas/`)

Zod validation schemas

- `leagueOperatorSchema.ts` - League operator validation
- `playerSchema.ts` - Player validation

---

### 📡 Real-time (`/realtime/`)

Supabase real-time subscription hooks for live data updates

- `useMatchGamesRealtime.ts` - Real-time subscription for match games (scoring updates, confirmation requests)
- `useMatchLineupsRealtime.ts` - Real-time subscription for match lineups (lineup status changes, lock/unlock events)

---

### 🧭 Navigation (`/navigation/`)

- `NavBar.tsx` - Main navigation bar
- `OperatorNavBar.tsx` - Operator navigation
- `NavRoutes.tsx` - Route definitions

---

### 🌐 Context (`/context/`)

React context providers

- `UserContext.ts` - User context definition
- `UserProvider.tsx` - User context provider
- `useUser.ts` - User context hook

---

### 🔧 Library (`/lib/`)

- `utils.ts` - General utility functions (shadcn/ui utilities)

---

### 📦 Assets (`/assets/`)

Images, logos, and other static assets

*(Directory exists - inventory needed)*

---

## 📚 Reference Code

> **Location**: `/reference-code/`
> **Purpose**: Example code, prototypes, or reference implementations

*(Directory exists - inventory needed)*

---

## 🏗️ Build & Distribution

### Build Output (`/dist/`)

Generated build files (not in git)

### Database Schema Exports (`/database-schema/`)

Database schema exports or documentation

*(Directory exists - inventory needed)*

### Public Assets (`/public/`)

Static assets served at root

*(Directory exists - inventory needed)*

### Supabase Config (`/supabase/`)

Supabase local configuration and migrations

| File | Purpose |
|------|---------|
| `supabase/config.toml` | Supabase local configuration |
| `supabase/migrations/20251218000000_venue_table_counts_optional.sql` | Fix venue total_tables computed column for array columns |

---

## ⚠️ Known Duplicates & Issues

### 🔴 Duplicate Files (MUST RESOLVE)

| File | Location 1 | Location 2 | Action Needed |
|------|-----------|-----------|---------------|
| `MatchCard.tsx` | `/components/MatchCard.tsx` | `/components/schedule/MatchCard.tsx` | Determine canonical version, delete duplicate |
| `TeamCard.tsx` | `/components/TeamCard.tsx` | `/components/player/TeamCard.tsx` | Are these different? If same, consolidate |
| `VisibilityChoiceCard.tsx` | `/leagueOperator/VisibilityChoiceCard.tsx` | `/components/privacy/VisibilityChoiceCard.tsx` | Consolidate to `/components/privacy` |

### 🟡 Legacy/Deprecated Files (DELETE AFTER VERIFICATION)

| File | Status | Action |
|------|--------|--------|
| `operator/LeagueCreationWizard.old.tsx` | Old version | Verify not referenced, then delete |
| `cUsersshodbpersonalsupabase-learning-hubsrcutilsscheduleGenerator.ts` | Corrupt file path? | **DELETE** |

### 🟠 Organizational Issues

See [RESTRUCTURE_PLAN.md](RESTRUCTURE_PLAN.md) for complete list of 20 organizational problems.

**Top Issues:**
1. Features split across multiple top-level directories (operator, player, components, pages, hooks, utils)
2. Root `/components` directory overcrowded with 15+ uncategorized components
3. Utils directory has 20+ files with unclear organization
4. Modal components scattered across 4+ locations
5. No clear pattern for page vs feature vs component organization

---

## 🔍 Quick Reference: Find By Feature

| Feature | Primary Locations | Key Files |
|---------|------------------|-----------|
| **Authentication** | `/login`, `/context` | `Login.tsx`, `UserProvider.tsx`, `members.sql` |
| **User Profile** | `/profile`, `/components/privacy` | `Profile.tsx`, `PrivacySettingsSection.tsx` |
| **League Management** | `/operator`, `/leagueOperator`, `/components/operator`, `/services` | `LeagueCreationWizard.tsx`, `leagueService.ts`, `leagues.sql` |
| **Season Management** | `/operator`, `/components/season`, `/services` | `SeasonCreationWizard.tsx`, `seasonService.ts`, `seasons.sql` |
| **Schedule Generation** | `/operator`, `/components/schedule`, `/utils`, `/data/matchupTables` | `scheduleGenerator.ts`, `ScheduleCreationWizard.tsx` |
| **Team Management** | `/operator`, `/components/player`, `/hooks` | `TeamManagement.tsx`, `useTeamManagement.ts`, `teams.sql` |
| **Match Lineup** | `/player`, `/components/lineup`, `/hooks` | `MatchLineup.tsx`, `useMatchLineup.ts`, `lineups.sql` |
| **Scoring (3x3)** | `/player`, `/components/scoring`, `/hooks`, `/database/scoring3x3` | `ScoreMatch.tsx`, `useMatchScoring.ts`, `match_games.sql` |
| **Messaging** | `/pages`, `/components/messages`, `/hooks`, `/utils`, `/database/messaging` | `Messages.tsx`, `useMessages.ts`, `messageQueries.ts` |
| **Venues** | `/operator`, `/components/operator` | `VenueManagement.tsx`, `VenueCard.tsx`, `venues.sql` |
| **Player Registration** | `/newPlayer` | `NewPlayerForm.tsx`, `usePlayerFormSubmission.ts` |
| **Reporting** | `/operator`, `/pages`, `/database/reporting` | `ReportsManagement.tsx`, `AdminReports.tsx`, `user_reports.sql` |
| **Wizards/Forms** | `/components/forms`, `/data` | `WizardStepRenderer.tsx`, `*WizardSteps.tsx` |

---

## 📝 Important Notes & Patterns

### UI Components
- **Always use shadcn/ui components** from `/components/ui` for consistency
- Never use raw HTML elements (`<button>`, `<input>`, `<label>`, `<select>`)
- Use `Calendar` component for all date inputs (never `<input type="date">`)

### Date Handling
- **Always use utilities from `/utils/formatters.ts`** for timezone-safe date handling
- `parseLocalDate(isoDate)` - Convert ISO string to Date in local timezone
- `formatLocalDate(date)` - Convert Date to ISO string in local timezone
- Never use `new Date('2024-01-15')` directly (causes timezone bugs)

### Package Management
- **Use `pnpm`** (not npm) for all package operations
- Lock file: `pnpm-lock.yaml`

### Database
- Local Supabase instance for development
- Migrations in `/database` folder
- SQL files must be run manually on local instance

### Testing
- Tests in `/__tests__` directory
- Run tests: `pnpm run test`
- Coverage: `pnpm run test:coverage`

### Build Commands
- Dev: `pnpm run dev`
- Build: `pnpm run build` (includes typecheck)
- Typecheck: `pnpm run typecheck`
- Lint: `pnpm run lint`

---

## 🔄 Maintenance Instructions

### When Creating a File
1. Add entry to appropriate section in this table of contents
2. Include file purpose and relationships
3. Update "Last Updated" date at top

### When Moving a File
1. Update file location in table of contents
2. Check "Quick Reference" section for affected features
3. Note the move in RESTRUCTURE_PLAN.md if part of reorganization

### When Deleting a File
1. Remove from table of contents
2. If deprecated/legacy, move from main sections to "Known Issues"
3. Document reason for deletion

### When Renaming a File
1. Update all references in table of contents
2. Search for old name to ensure no orphaned references

---

*This table of contents is a living document. Update it whenever ANY file or folder is created, moved, renamed, or deleted.*

**Last Full Audit**: 2025-11-01
