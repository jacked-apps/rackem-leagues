# Complete Project Table of Contents

> **Last Updated**: 2026-05-17 (Messaging Phase 1 polish bundle, Units 10 + 13 — date dividers in message thread + emoji messages + composer picker. New `messageDayDividers.ts` util ("Today" / "Yesterday" / "MMM d" labels + interleave helper), `EmojiPickerButton.tsx` + `emojiSet.ts` (12 curated emojis), `isEmojiOnly` util. `MessageList.tsx` renders day-divider rows between message groups. `MessageBubble.tsx` gains a "giant emoji" render branch for ≤3 emoji-only messages. `MessageInput.tsx` slots the picker between input and send. On `messaging-phase1-polish` branch.)
> **Purpose**: Comprehensive index of EVERY file in this project for quick navigation and organization analysis
> **Maintenance**: Update this file whenever you create, move, rename, or delete ANY file or folder

---

## 📋 Quick Navigation

- [Project Root Files](#-project-root-files)
- [Documentation](#-documentation)
- [Configuration Files](#%EF%B8%8F-configuration-files)
- [Memory Bank](#-memory-bank-project-intelligence)
- [Database Schema & Migrations](#-database-schema--migrations)
- [End-to-End Testing (`/tests/e2e/`)](#-end-to-end-testing-testse2e)
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
| `/docs/brainstorms/` | **CE brainstorm requirements docs** | Output of `/compound-engineering:ce-brainstorm` |
| `docs/brainstorms/official-rulebook-reader-requirements.md` | Requirements for the Official Rulebook Reader feature | Branch 1 of the rules-feature family |
| `docs/brainstorms/e2e-test-infrastructure-requirements.md` | Requirements for the Playwright E2E scaffolding (foundation seed + factories + multi-user auth + demo mode) | Active branch `feat/e2e-test-infrastructure` |
| `/docs/plans/` | **CE implementation plans** | Output of `/compound-engineering:ce-plan` |
| `docs/plans/2026-04-17-001-feat-official-rulebook-reader-plan.md` | Implementation plan for the Official Rulebook Reader | 6 units, active branch `feature/official-rulebook-reader` |
| `docs/plans/2026-04-27-001-feat-e2e-test-infrastructure-plan.md` | Implementation plan for the E2E scaffolding | 10 units (8 in v1 scope), active branch `feat/e2e-test-infrastructure` |
| `docs/brainstorms/header-mobile-rework-requirements.md` | Requirements for the global header & navigation rework | Slim sticky header, hamburger drawer with per-org operator shortcuts, drawer-internal badges |
| `docs/brainstorms/modular-league-system-requirements.md` | Requirements for fully modular league configuration | Deprecates `5_man`/`8_man`; any-combo support; 3-layer threshold strategy; supersedes April 18 modular-handicap-scoring doc |
| `docs/brainstorms/lineup-to-scoring-transition-requirements.md` | Requirements for the lineup → scoring transition stability fix | 7-defense architecture; supersedes cache/recovery aspects of the prior race-condition brainstorm; closes LIST_FOR_ED #21/#22 |
| `docs/brainstorms/unified-scoreboard-requirements.md` | Requirements for collapsing 4 scoreboards to 1 + tiebreaker | Schema-derived display hints (escape hatch), mobile-first compact mode, "stadium not sportsbook" focus; depends on PR #98 merge |
| `/docs/plans/` | **CE implementation plans** | Output of `/compound-engineering:ce-plan` |
| `docs/plans/2026-04-17-001-feat-official-rulebook-reader-plan.md` | Implementation plan for the Official Rulebook Reader | 6 units, active branch `feature/official-rulebook-reader` |
| `docs/plans/2026-04-27-001-feat-global-header-nav-rework-plan.md` | Implementation plan for the global header & navigation rework | 9 units in 3 phases, active branch `fix/header-mobile-rework` |
| `docs/plans/2026-04-28-001-feat-modular-league-system-plan.md` | Implementation plan for the fully modular league system | 21 units across 8 phases (Phase 0 research + 7 implementation phases); supersedes April 18 plan; covers BCAPL SL handicap, audit log R21, threshold-charts wiring, team_format drop |
| `docs/plans/2026-05-04-001-fix-lineup-to-scoring-transition-stability-plan.md` | Implementation plan for the lineup → scoring transition stability fix | 7 implementation units across 3 phases; new MatchPhaseGuard + MatchTransitionRecovery + useMatchPhase; hardened prep_match RPC; foreground polling backstop; deletes 6-month-old retry loop |
| `docs/plans/2026-05-03-001-feat-unified-scoreboard-plan.md` | Implementation plan for the unified scoreboard refactor | 8 units across 3 phases; replaces 3 legacy scoreboards with 1 + tiebreaker fix; schema-derived display hints; TeamStatsCard generalized for points-mode; depends on PR #98 merge |

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

### Operator Scripts (`/scripts/`)

Node-only tooling the operator runs manually (not part of the app bundle).

| File | Purpose |
|------|---------|
| `scripts/clean-rulebook.ts` | Orchestrator — turns the CSI rulebook PDF into committed TS data modules under `src/officalBCARulebook/cleaned/`. Usage: `pnpm tsx scripts/clean-rulebook.ts --pdf "<abs-path>"` |
| `scripts/clean-rulebook/extractPdfText.ts` | `pdfjs-dist` wrapper: PDF → per-page text |
| `scripts/clean-rulebook/scrubText.ts` | Strip running headers, normalize whitespace (preserves double-space markers) |
| `scripts/clean-rulebook/splitSections.ts` | Slice scrubbed text at "RULES SECTION N" markers |
| `scripts/clean-rulebook/splitRules.ts` | Slice a section into `Rule[]` using double-space delimiters; filters figure noise |
| `scripts/clean-rulebook/writeModules.ts` | Emit the `index.ts` + per-game `.ts` modules |
| `scripts/clean-rulebook/verifyRulebook.ts` | Pre-commit sanity checks on the cleaned data |
| `scripts/clean-rulebook/games.ts` | Canonical list of games (slug, display name, section number) |
| `scripts/e2e-setup.mjs` | E2E foundation seed runner. Wired to `pnpm e2e:setup`. Validates `E2E_LOCAL_OK=true`, then pipes `database/e2e_seed.sql` into local Supabase via the `pg` client. |
| `scripts/e2e-verify-auth.mjs` | E2E bcrypt-hash verification gate. Wired to `pnpm e2e:verify-auth`. Confirms the committed hash matches `E2E_PW` via Postgres `crypt()`. |
| `scripts/e2e-verify-factories.ts` | E2E factory smoke-check. Wired to `pnpm e2e:verify-factories`. Calls each factory and asserts the resulting DB rows. |

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

### Active Planning Documents (`/memory-bank/plans/`)

| File | Purpose | Status |
|------|---------|--------|
| `plans/PLAN-wizard2.md` | Wizard 2.0 framework — clean rebuild of league wizard with reusable shell, schemas, and step contract | Planning (current branch: `wizard-2-creation`) ✨ |
| `plans/playoff-system-plan.md` | Playoff system architecture and implementation plan | Existing |

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
| `e2e_seed.sql` | **E2E test foundation seed** — local-only sandbox (1 test org, 1 venue, 5 foundation users with auth.identities + non-NULL token columns for GoTrue compatibility). Idempotent. Double-guarded against running anywhere but local Supabase. |
| `dev_starting_point.sql` | **THE dev seed.** Single-paste setup for local dev: 4 logins (dev@test.com + 3 captains, all password "password"), Tester Org with mock Stripe, Sams's Billiards venue, 3 leagues (3v3 Tuesday, Standard 5v5 Wednesday, Fargo 5v5 Thursday — start dates today/today+1/today+2), 12 teams with full rosters (captain + 4 placeholders), ~102 matches, 130 placeholder members. Idempotent. Documented in the root README's "Local development setup" section. |
| `README_DATABASE_INTEGRATION.md` | Database integration guide |
| `MESSAGING_AND_REPORTING_COMPLETE.md` | Messaging/reporting completion notes |

### Database Utilities & Fixes

| File | Purpose |
|------|---------|
| `rebuild_all_tables.sql` | Complete database rebuild script |
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

## 🎭 End-to-End Testing (`/tests/e2e/`)

Playwright-based browser tests. Local-only for v1. Two purposes:
regression coverage + raw demo video for sales reels (via slow-motion
+ headed run mode). The scaffolding is designed so future plans can
include "do test stuff" as a unit and have it materially mean
"compose factories + drive UI in 10–30 lines per spec."

See `tests/e2e/README.md` for the runbook (one-time setup, run modes,
how to add a new test, demo recording, cleanup model).

### Configuration & Setup

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright config. Drives `E2E_DEMO=1` slow-motion mode, the `setup` → `chromium` project chain, the non-localhost startup guard. |
| `tests/e2e/README.md` | Runbook for the E2E scaffolding. |
| `tests/e2e/auth.setup.ts` | Multi-user auth setup. Iterates the foundation palette, drives UI login per user, saves per-user storage states under `tests/e2e/.auth/`. |

### Fixtures (Shared Test Primitives)

| File | Purpose |
|------|---------|
| `tests/e2e/fixtures/users.ts` | Foundation user palette. Exports `E2E_USERS`, `E2E_ORG_ID`, `E2E_VENUE_ID`, `getStorageState(key)`, `getMemberId(key)`. The starting point every spec imports from. |
| `tests/e2e/fixtures/serviceClient.ts` | Local-only Supabase service-role client (bypasses RLS for setup operations). Hardcoded demo JWT, never replaced with a real key. |
| `tests/e2e/fixtures/factories.ts` | Test data factories: `createLeague`, `createSeason`, `createTeam`, `createMatch`, `createMatchReadyForLineup`. The bit that makes future tests cheap. |

### Specs

| File | Purpose |
|------|---------|
| `tests/e2e/dashboard.spec.ts` | Smoke: dashboard renders for a foundation user (captain-1). |
| `tests/e2e/specs/lineup-flow.spec.ts` | Reference example: single-captain pattern (captain reaches a match's lineup page). Copy this shape for future captain-side feature tests. |
| `tests/e2e/specs/wizard-tour.spec.ts` | Reference example: LO multi-stage tour. Doubles as the demo-recording target (`pnpm test:e2e:demo --grep wizard-tour`). |

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
| `config/environment.ts` | App environment detection (dev/staging/prod) + banner config |
| `components/EnvironmentBanner.tsx` | Top-of-app banner labeling non-production builds |

---

### 🧪 Tests (`/__tests__`)

#### Integration Tests (`/__tests__/integration/`)
- `SeasonCreationWizard.critical.test.tsx` - Critical path tests
- `SeasonCreationWizard.smoke.test.tsx` - Smoke tests
- `RulesPage.test.tsx` - `/rules` landing: filter chips, search, zero-results, clear actions
- `RuleDetailPage.test.tsx` - `/rules/:game/:ruleId`: happy path, drawer, unknown-ID fallback
- `RulesPageHouseRules.test.tsx` - House rules chip, scope picker, merged search, TOC interleave, differences-only, discovery nudge
- `HouseRuleDetailPage.test.tsx` - `/rules/house/:scope/:scopeId/:ruleId`: happy path, drawer, CSI backlink, standalone variant, unknown-ID fallback
- `LeagueRulesPage.test.tsx` - Org-wide house rules manager: render, Add/Cancel form, delete-with-Undo

#### Unit Tests (`/__tests__/unit/`)
- `messageQueries.test.ts` - Message query utilities
- `profanityFilter.test.ts` - Profanity filter
- `scheduleUtils.test.ts` - Schedule utilities
- `cleanup.smoke.test.ts` - Rulebook cleanup output smoke checks (18 tests)
- `resolveRuleId.test.ts` - Deep-link rule resolver
- `useRulebookSearch.test.ts` - In-memory substring search hook
- `searchSnippet.test.ts` - Snippet extraction + highlight helpers
- `copyLinkButton.test.tsx` - Share-link clipboard button
- `searchHouseRules.test.ts` - Pure substring search over house-rule title + body
- `groupHouseRules.test.ts` - TOC interleave grouping: standalones, override pairing, specificity ordering
- `houseRuleForm.test.tsx` - HouseRuleForm: validation, effect-type switch, CSI suggestions, snippet picker, dirty state

#### Test Documentation
- `__tests__/README.md` - **Test directory conventions.** Explains the vitest `unit` vs `db` project split, where to put new tests, the one rule that matters (`db`-touching tests go under `__tests__/database/`), and how to run them. Read this before adding a new test file.

#### Database Tests (`/__tests__/database/`)
- `rulesPageEvents.rls.test.ts` - `rules_page_events` RLS + constraints (requires local Supabase)
- `houseRules.rls.test.ts` - `house_rules` RLS probes (requires local Supabase; full coverage deferred until seed fixtures land)
- `messaging-phase1-conversations.rls.test.ts` - **Messaging Phase 1 / Unit 1** — schema verification: confirms `conversations.archived_at`, `conversation_participants.notification_mode`, `cannot_leave`, and the widened CHECK constraints all landed. 13 tests.
- `messaging-phase1-messages.rls.test.ts` - **Messaging Phase 1 / Unit 2** — schema verification: confirms `messages.is_system`, nullable `sender_id`, `messages_is_system_shape` CHECK, `members.profanity_onboarding_completed_at`, `members.deleted_at`. 9 tests.
- `messaging-phase1-postSystemMessage.test.ts` - **Messaging Phase 1 / Unit 3 helper 1/5** — DB-backed coverage of `postSystemMessage()`: inserts row with `is_system=true, sender_id=NULL`, rejects on missing conversation FK.
- `messaging-phase1-createTeamChat.test.ts` - **Messaging Phase 1 / Unit 3 helper 2/5** — DB-backed coverage of `createTeamChat()` (idempotency, roster→participants, captain `cannot_leave`, opening system message, FK errors).
- `messaging-phase1-createCaptainChat.test.ts` - **Messaging Phase 1 / Unit 3 helper 3/5** — DB-backed coverage of `createCaptainChat()`: dedups captains-also-on-staff (captain rule wins on `cannot_leave`), idempotent, posts opening message.
- `messaging-phase1-createSeasonAnnouncementsChat.test.ts` - **Messaging Phase 1 / Unit 3 helper 4/5** — DB-backed coverage of `createSeasonAnnouncementsChat()`: every distinct rostered player as `cannot_leave=true` participant, idempotent.
- `messaging-phase1-createOrgAnnouncementsChat.test.ts` - **Messaging Phase 1 / Unit 3 helper 5/5** — DB-backed coverage of `createOrgAnnouncementsChat()`: every distinct player across currently-active seasons in the org, past-season players excluded, idempotent.
- `messaging-phase1-unit7-polish.rls.test.ts` - **Messaging Phase 1 / Unit 7 (polish)** — verifies the polish migration (`20260513000001`): system-message INSERT keeps all participants' `unread_count` at 0, regular message INSERT still bumps non-senders, mixed system/regular sequence only counts the regular one, and the reworded `COMMENT ON COLUMN members.profanity_filter_enabled` mentions both minor enforcement (`minor` / `under 18` / `age`) AND the DOB fallback (`dob` / `date_of_birth`).

#### Messaging UI Components (`/components/messages/`)
- `ReadOnlyBanner.tsx` - **Messaging Phase 1 / Unit 6** — shadcn `Alert` that renders in place of the message composer when the current user can read but not post. Two reasons covered: `past-member` (left_at non-NULL) and `announcement-non-staff` (announcements channel viewed by a non-staff member). The composer is unmounted by `MessageView`, not just hidden by CSS.
- `__tests__/ReadOnlyBanner.test.tsx` - RTL test covering both `reason` values render distinct copy.
- `__tests__/ConversationList.profanity.test.tsx` - **Messaging Phase 1 / Unit 7** — RTL test covering the last-message-preview filter: filter ON censors profane previews while leaving clean ones and surrounding chrome intact, filter OFF renders raw, null/empty preview falls back to "No messages yet", unread-count badge is unaffected.
- `__tests__/MessageBubble.system-message.test.tsx` - **Messaging Phase 1 / Unit 7** — RTL test for the `isSystem` render branch: centered/italic/muted-foreground wrapper, no sender link / no timestamp / no read receipt even when those props are passed, profanity filter applies defensively when enabled, default variant unchanged when `isSystem` is omitted.
- `messageview/__tests__/useOutgoingMessages.test.ts` - **Messaging Phase 1 / Unit 8** — Unit tests for the optimistic-outgoing hook: `addPending` returns unique clientIds and appends a `sending` entry; `markFailed` flips status + records error; `markPending` clears the error on retry; `remove` deletes by clientId while preserving order; unknown-id mutators are no-ops. 6 cases.
- `messageview/__tests__/MessageList.outgoing.test.tsx` - **Messaging Phase 1 / Unit 8** — RTL test for the inline-failed-send rendering: pending outgoing entries render as normal user bubbles after the confirmed messages, failed entries render as the destructive failed-variant `MessageBubble` with error + Retry button (click invokes `onRetryOutgoing(clientId, content)`), multiple failed entries render independently (eggs AND bacon both visible + retryable), mixed pending+failed render in order, empty state only shows when both confirmed AND outgoing are empty. 7 cases.
- `EmojiPickerButton.tsx` - **Messaging Phase 1 / Unit 13** — composer emoji picker. Small smiley button → shadcn `Popover` opens with a 4×3 grid of the 12 curated emojis from `emojiSet.ts`. Tap an emoji → invokes parent's `onPick(emoji)` and closes the popover. No external dependency — emojis are native Unicode rendered by the host OS.
- `emojiSet.ts` - **Messaging Phase 1 / Unit 13** — config file holding the 12 curated emojis: 🎉 👍 👎 ❤️ 🍻 🎱 😂 🏆 💪 🔥 🤞 💔. Edit this file to change the picker contents.
- `__tests__/EmojiPickerButton.test.tsx` - **Messaging Phase 1 / Unit 13** — RTL test: trigger renders + starts closed, opens to show all 12 emojis, pick fires `onPick(emoji)` and closes the popover, disabled prop disables the trigger. 4 cases.
- `__tests__/MessageBubble.emojiOnly.test.tsx` - **Messaging Phase 1 / Unit 13** — RTL test for the "giant emoji" render branch in `MessageBubble`: ≤3 emojis render as giant variant with `data-testid="emoji-only-message"`, 4+ emojis or mixed text falls through to default bubble, system/failed variants take precedence over emoji-only, sender name link still renders for non-current-user emoji-only messages. 7 cases.
- `__tests__/ConversationList.archived.test.tsx` - **Messaging Phase 1 / Unit 21** — RTL test for the collapsible "Archived" section: header doesn't render when there are zero past-member rows, default-collapsed when there are some (header reads "Archived (N)", `aria-expanded="false"`, archived row titles absent from DOM), clicking expands (rows visible, `aria-expanded="true"`), clicking again collapses back. 3 cases.
- `CreateTeamChatPrompt.tsx` - **Messaging Phase 1 / Unit 3 helper 6/6** — captain manual-fallback prompt above the Messages conversation list. Shows one card per captained active-season team that lacks an auto-managed chat. Clicking creates the chat via `createTeamChat()` and auto-selects it.

#### Messaging Hooks (`/api/hooks/`)
- `useMessageComposerStatus.ts` - **Messaging Phase 1 / Unit 6** — TanStack Query hook. Returns `{ readOnly, reason }` for a conversation. Looks up the current user's participant row + (for announcement channels) their `organization_staff` membership. Consumed by `MessageView` to choose between `MessageInput` and `ReadOnlyBanner`.
- `useCaptainTeamsMissingChat.ts` - **Messaging Phase 1 / Unit 3 helper 6/6** — TanStack Query hook. Returns the list of teams the current user captains in an active season that lack an auto-managed team chat. Used by `CreateTeamChatPrompt`.
- `messaging-phase1-season-activation.rls.test.ts` - **Messaging Phase 1 / Unit 4** — DB-backed coverage of the season-activation trigger: team chats per team, captain chat, season + org announcements, idempotent re-fire, no-fire on non-status UPDATEs, no-fire when status flips away from active.
- `messaging-phase1-roster-triggers.rls.test.ts` - **Messaging Phase 1 / Unit 5** — DB-backed coverage of the four roster/captain lifecycle triggers: INSERT (join + msg only on real inserts), DELETE (deferred constraint trigger; sets `left_at` and posts "left" only on real removals, silent on wholesale-replace), captain change (cannot_leave flip in team + captain chats; multi-team captain edge case), member soft-delete. **Note:** the three messaging DB-backed test files race each other under default vitest file parallelism — run with `--no-file-parallelism` when executing the full directory. See `LIST_FOR_ED.md` #27.

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
- `MyMatch.tsx` - Live-match jump-in landing page (PLACEHOLDER — real detection + jump-in is a backlog item)
- `MyTeams.tsx` - Player's teams overview
- `PlayerStats.tsx` - Personal stats landing page (PLACEHOLDER — real build-out is a backlog item)
- `ScoreMatch.tsx` - Match scoring interface
- `TeamSchedule.tsx` - Team schedule view

#### Operator Pages (`/operator/`)

**Dashboards & Overview**
- `OperatorDashboard.tsx` - Main operator dashboard
- `OperatorWelcome.tsx` - Welcome screen

**League Management**
- `LeagueDetail.tsx` - League details page
- `LeagueRules.tsx` - League rules management

**Season & Schedule Management**
- `SeasonCreationWizard.tsx` - Season creation wizard
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
- `Messages.tsx` - Messaging page — also mounts the Unit 9 `ProfanityOnboardingModal` on first open (gated by NULL `profanity_onboarding_completed_at`).
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

#### Official Rulebook Reader (`/rules/`)

Public feature at `/rules`. Reads the cleaned CSI rulebook from `/src/officalBCARulebook/cleaned/` and renders it as a searchable, mobile-first document. Rule detail lives at `/rules/:game/:ruleId`.

- `RulesPage.tsx` - `/rules` landing: filter chips, search, TOC / All-games accordion
- `RuleDetailPage.tsx` - `/rules/:game/:ruleId`: full rule text, drawer, Copy-link, attribution
- `RuleView.tsx` - Pure rule renderer (heading + body paragraphs)
- `GameTOC.tsx` - Ordered rule list inside a single-game view
- `AllGamesAccordion.tsx` - Cover-to-cover reader (every game as collapsible section)
- `RuleCard.tsx` - One clickable rule row in the TOC
- `SearchInput.tsx` - Sticky debounced search with "/" keyboard shortcut
- `SearchResults.tsx` - Results list + zero-results state (Clear filter / Clear search)
- `SearchSnippet.tsx` - Snippet extraction + <mark> highlighting
- `Attribution.tsx` - R11 footer linking to CSI's hosted PDF
- `CopyLinkButton.tsx` - One-tap clipboard share with sonner toast
- `RulesSkeleton.tsx` - Suspense fallback matching the page layout
- `RulesErrorBoundary.tsx` - Branded error boundary for data-load failures
- `useRulebook.ts` - Typed loader singleton (merges cleaned game modules)
- `useRulebookSearch.ts` - In-memory substring search (hook + pure function)
- `resolveRuleId.ts` - O(1) deep-link resolver
- `useRulesEvents.ts` - Fire-and-forget usage events (page_open / search / deep_link / house_filter / differences_only / house_rule_opened / scope_changed)
- `rulebook.types.ts` - Shared types: `Rule`, `Game`, `Rulebook`, `RulebookIndex`

#### League House Rules (part of `/rules/`)

LO-authored rules layered on top of the CSI rulebook. Org-wide rules cascade into every league unless the league opts out. Reader interleaves matching house rules beneath their CSI counterparts.

- `HouseRuleDetailPage.tsx` - `/rules/house/:scope/:scopeId/:ruleId`: full rule + scope attribution + CSI backlink
- `HouseRuleCard.tsx` - Clickable house-rule row with scope badge
- `HouseRuleForm.tsx` - Shared add/edit form: effect-type radios, CSI picker, CSI preview with per-snippet "+ Add", dirty-state reporting
- `HouseRulesList.tsx` - Reusable list with inline Add/Edit and delete-with-Undo (preserves `id`)
- `HouseRulesScopePicker.tsx` - Sheet for picking which league's rules to overlay on the reader
- `CsiRulePicker.tsx` - shadcn Command palette over the in-bundle rulebook
- `CsiSuggestions.tsx` - Live "similar official rules?" panel under the title input
- `LeagueHouseRulesSection.tsx` - League-scoped list + "Use official CSI rulebook only" opt-out toggle for LeagueSettings
- `useHouseRules.ts` - Loader hooks: by memberships, by single id, and cascade-aware for a single scope
- `useMyMemberships.ts` - Derives player + staff org/league memberships for scope defaulting
- `useActiveLeague.ts` - Per-device active-league state with localStorage + sign-out clear
- `searchHouseRules.ts` - Pure substring search across house-rule title + body
- `groupHouseRules.ts` - Interleave helper: pairs house rules to their CSI counterparts + pulls out standalones
- `house-rules.types.ts` - Shared types: `HouseRule`, `HouseRuleScope`, `ScopeSelection`, memberships, etc.

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
| `filter-chip.tsx` | **ALL filter chip buttons** — extracted from MemberSearchCombobox |
| `sheet.tsx` | Side-anchored drawer (shadcn Sheet, built on Radix Dialog) |

#### Shared UI Components (`/components/shared/`)
- `EmptyState.tsx` - Empty state component
- `LoadingState.tsx` - Loading state component
- `Modal.tsx` - Base modal component
- `index.ts` - Exports

#### Form Components (`/components/forms/`)

Reusable wizard/form step components

- `WizardProgress.tsx` - Progress indicator
- `ChoiceStep.tsx` - Choice selection step
- `SimpleRadioChoice.tsx` - Simple radio choice
- `QuestionStep.tsx` - Question step
- `DateField.tsx` - Date input field
- `DualDateStep.tsx` - Dual date selection

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
- `UnifiedScoreboard.tsx` - **Single live-match scoreboard for all configs** (replaces former ThreeVThree / FiveVFive / TenSeven). Reads match-row source-of-truth, schema-derived display hints, calculator-driven per-player points column, R22 Fargo start-points display.
- `TiebreakerScoreboard.tsx` - Best-of-3 tiebreaker score panel (separate component; team-name labels per R18)
- `MatchEndVerification.tsx` - End-of-match dual-team verify-and-confirm flow (mode-aware internally)
- `GamesList.tsx` - Games list
- `GameButtonRow.tsx` - Game row with breaker vs racker buttons (extracted from ScoreMatch)
- `ScoringDialog.tsx` - Game winner selection with B&R and Golden Break (extracted from ScoreMatch)
- `ConfirmationDialog.tsx` - Opponent score confirmation and vacate requests (extracted from ScoreMatch)
- `EditGameDialog.tsx` - Vacate winner request dialog (extracted from ScoreMatch)
- `scoreboardColors.ts` - Single source of truth for team colors (home: blue, away: orange)

#### Messaging Components (`/components/messages/`)
- `MessageView.tsx` - Main message view — orchestrates header, message list (via `MessageList`), composer / read-only banner, leave + block dialogs.
- `MessageInput.tsx` - Message input — composer. Clears on send-attempt regardless of outcome; failure rendering lives in the conversation thread via `MessageList`, not here.
- `MessageBubble.tsx` - Message bubble — three variants: default user-to-user, Unit 7 centered/italic system-message, Unit 8 destructive failed-send (used inline in `MessageList` for failed outgoing entries).
- `messageview/MessageList.tsx` - Scrollable message list extracted from `MessageView`. Owns the `Message` interface (exported), loading + empty states, auto-scroll, the system-message branch (`is_system → MessageBubble isSystem`), AND the Unit 8 inline-failed-send rendering: optimistic outgoing entries (pending + failed) render after the confirmed list with the appropriate `MessageBubble` variant per status.
- `messageview/useOutgoingMessages.ts` - Local-state hook for optimistic outgoing messages (Unit 8 inline pattern). Tracks `{ clientId, content, status: 'sending' | 'failed', errorMessage?, createdAt }` entries; exposes `addPending` / `markPending` / `markFailed` / `remove`. Used by `MessageView` to thread an optimistic bubble into `MessageList` and convert it to a retryable failed bubble when the mutation rejects.
- `ConversationList.tsx` - Conversation list
- `ConversationHeader.tsx` - Conversation header
- `MessagesEmptyState.tsx` - Empty state
- `NewMessageModal.tsx` - New message modal
- `AnnouncementModal.tsx` - Announcement modal
- `MessageSettingsModal.tsx` - Settings modal
- `BlockedUsersModal.tsx` - Blocked users modal
- `UserListItem.tsx` - User list item

#### Onboarding Components (`/components/onboarding/`)
- `ProfanityOnboardingModal.tsx` - **Messaging Phase 1 / Unit 9** — shadcn `Dialog` shown once, the first time a member opens the Messages page (gated by a NULL `members.profanity_onboarding_completed_at`). One-time, defaulted-ON framing: copy explains the filter is on by default and changeable in Settings, then asks if they'd like to turn it off. Two buttons ("Turn filter off" → enabled=false, "Keep filter on" → enabled=true); dismissing (Escape / backdrop / X) is treated as "keep on" (enabled=true). Every exit path writes `completed=now()` so it never reappears. Calls `useMarkProfanityOnboardingComplete`; `onResolved` fires only on a successful write (a rejected mutation leaves the modal open for retry).
- `__tests__/ProfanityOnboardingModal.test.tsx` - **Messaging Phase 1 / Unit 9** — RTL test: copy + two buttons render, "Keep filter on" persists `filterEnabled=true`, "Turn filter off" persists `false`, Escape defaults to `true`, `onResolved` fires once per success, rejected mutation does NOT resolve (retry works), choice-then-dismiss only resolves once. 7 cases.

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

#### Match Components (`/components/match/`)
- `MatchPhaseGuard.tsx` - Server-state route guard. Reads `matches.status` via `useMatchPhase`, dispatches lineup vs scoring vs recovery rendering, holds the compound `key={matchId:recoveryEpoch}` that drives in-place subtree remounts on Hard Reset.
- `MatchTransitionRecovery.tsx` - Unified recovery surface for the lineup → scoring transition. Reason-aware copy (connection / match_not_found / auth_expired / server_error / unknown_status), two-level Try Again (soft refetch first, Hard Reset only after soft fails — with confirmation dialog).

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
- `useScheduleGeneration.ts` - Schedule generation
- `useSeasonSchedule.ts` - Season schedule data

#### Team & Match Management
- `useTeamManagement.ts` - Team management
- `useMatchLineup.ts` - Match lineup editor
- `useMatchScoring.ts` - Match scoring state (data fetching)
- `useMatchScoringMutations.ts` - Match scoring mutations (database operations)
- `useRosterEditor.ts` - Roster editing

#### Form & Validation
- `useProfanityFilter.ts` - Profanity filtering — two-tier rule: when `isMinor(date_of_birth)` is true the filter is forced ON and `canToggle: false` (R4 under-18 enforcement); otherwise respects `members.profanity_filter_enabled`. DOB is optional, so unknown-age falls back to the user's stored preference.
- `__tests__/useProfanityFilter.test.ts` - **Profanity filter hook tests** (10 cases) — loading state, fail-open on error / no data, forced ON for known minors (incl. day-before-18th-birthday boundary), adult preference both directions, null DOB respects preference, null `profanity_filter_enabled` coerces to false.
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
- `age.ts` - **Age calculation utilities** — `calculateAge(dob)` and `isMinor(dob)` built on `parseLocalDate` so DOB strings anchor to the local calendar (avoids the UTC off-by-one-day bug). Consumed by `useProfanityFilter` for R4 under-18 enforcement; returns `null` / `false` for missing or malformed DOB.
- `__tests__/age.test.ts` - **Age util tests** (10 cases) — `calculateAge` null/malformed/whole-years/birthday-not-yet/birthday-today; `isMinor` unknown DOB → false, clear minors → true, day-before-18 → true, exact 18th birthday → false, adults → false. Uses `vi.setSystemTime` to pin "today" to 2026-05-12.
- `isEmojiOnly.ts` - **Messaging Phase 1 / Unit 13** — pure helper that drives the "giant emoji" render branch in `MessageBubble`. Returns `true` when a trimmed string is composed entirely of emoji (Extended_Pictographic + ZWJ + VS16 + regional-indicator pairs) AND is ≤3 graphemes. Uses `Intl.Segmenter` to count graphemes so ZWJ sequences (like 👨‍👩‍👧) count as one. Deliberately excludes `\p{Emoji_Component}` so plain digits don't trip the regex.
- `__tests__/isEmojiOnly.test.ts` - **Emoji-only detection tests** (19 cases) — positives (single emoji, ZWJ + VS16 like ❤️, spaces between emojis, surrounding whitespace) + negatives (empty, mixed text+emoji, 4+ emojis, plain digits/punctuation).
- `messageDayDividers.ts` - **Messaging Phase 1 / Unit 10** — pure helpers for the message thread's day-divider rendering. `getDayLabel(iso, now)` returns "Today" / "Yesterday" / locale-formatted "MMM d" (with year only when prior year). `interleaveDayDividers(messages, getTimestamp, now)` walks a chronologically-ordered messages array and emits a flat `DividerRow` sequence (divider before the first message of each new local calendar day). Local-TZ aware so grouping matches the user's calendar, not UTC.
- `__tests__/messageDayDividers.test.ts` - **Day-divider helper tests** (11 cases) — `getDayLabel` for today / yesterday / same-year / prior-year / 2-days-ago; `interleaveDayDividers` empty / single-day / multi-day boundary emission / divider-before-first-message-of-day ordering / stable per-day keys for React reuse / skips dividers for empty timestamps.
- `holidayUtils.ts` - Holiday detection and handling

#### Schedule & Matchup
- `scheduleGenerator.ts` - Schedule generation logic
- `scheduleUtils.ts` - Schedule utilities
- `scheduleDisplayUtils.ts` - Schedule display helpers
- `matchupTables.ts` - Matchup table utilities
- `conflictDetectionUtils.ts` - Schedule conflict detection
- `gameOrder.ts` - Game order utilities

#### Match Running Totals (`/utils/match/`)
- `computeMatchRunningTotals.ts` - **Per-mutation running-totals calculator** (Phase 5 Unit 5.5) — pure helper that filters confirmed regular games, runs the snapshot's points calculator, and returns `{ home_games_won, away_games_won, home_points_earned, away_points_earned }`. Eager recompute on every scoring mutation keeps the match row consistent with the live scoreboard. Tiebreaker games and unconfirmed games are excluded from regular running totals.
- `auditScoringConsistency.ts` - **Match-completion scoring-consistency audit** (Phase 5 Unit 5.6) — pure `compareRunningTotals(actual, expected)` helper that returns per-field discrepancies between the match row's stored totals and a fresh recompute. Match record is never modified — divergence is logged to `app_logs` for the dev to investigate. Reusable for on-demand audits.
- `__tests__/computeMatchRunningTotals.test.ts` - **Running-totals tests** (10 cases): confirmation filtering, tiebreaker exclusion, linear_above_threshold above/tie/below bands, LOCKED tie-band-with-tiebreaker invariant, accumulated_per_game (Fargo 10-7), null calculator, unknown calculator
- `__tests__/auditScoringConsistency.test.ts` - **Audit comparison tests** (7 cases): in-sync match returns ok, single-field divergence on games_won / points_earned, multi-field divergence, diff sign convention (positive = stored too high), input non-mutation

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
- `index.ts` - **Unified handicap interface** (getGamesNeeded; now delegates through SystemModule resolver)
- `__tests__/getGamesNeeded.characterization.test.ts` - **Characterization tests** locking in pre-refactor behavior (49 cases across 3v3 and 5v5 charts)

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
- `useMatchPhase.ts` - **✅ Match-phase status query** (minimal id/status/started_at slice; staleTime: 0; foreground 7s polling while status='scheduled' as Defense 7 backstop for dropped realtime). Distinct cache key from `useMatchById` — see file header for rationale.
- `index.ts` - Central export point for all hooks

**Migration Status**: Phase 1 Complete (foundation), Phase 2 Next (migrate member/user data)

---

### 📊 Data & Constants

#### Wizard Step Definitions (`/data/`)
- `seasonWizardSteps.tsx` - Season wizard steps
- `mockVenues.ts` - Mock venue data

#### Official Rulebook Data (`/officalBCARulebook/`)
Source and cleaned data for the Rules Reader feature. Note the legacy folder-name typo ("offical") — kept as-is to avoid a cross-cutting rename.
- `bca_rules_sections.json` - **LEGACY** raw PDF-to-text dump (no longer read at runtime; kept until post-launch cleanup)
- `BCA Rules Figure 2-1.png` - **LEGACY** figure asset (not rendered in v1; retained for a future figures pass)
- `cleaned/index.ts` - Edition metadata + games list + `(game, ruleId)` → ref `idMap` (auto-generated)
- `cleaned/8-ball.ts` through `cleaned/scotch-doubles.ts` - Per-game `Rule[]` modules (auto-generated, 9 files total, 135 rules)

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
- `systemOverrides.ts` - **Per-league dial overrides** (JSONB shape stored as `leagues.system_overrides`; Fargo + BCA dial names)

**Type Organization Best Practice**: All duplicate type definitions have been consolidated into this folder. Always import from `@/types` for consistency.

---

### 🎯 Systems (`/systems/`) **NEW — Modular handicap/scoring substrate**

Preset modules implementing the `SystemModule` interface. Each shipped preset owns its rating, scoring, and threshold behavior. The resolver maps `handicap_type` string → module. See `docs/plans/2026-04-18-001-refactor-modular-handicap-scoring-systems-plan.md`.

- `types.ts` - **SystemModule interface** + mechanism-discriminated threshold union (ExtraGamesThreshold | StartPointsThreshold | RaceLengthThreshold) + supporting types (Phase 1 Unit 1.3)
- `resolver.ts` - **Module resolver** — `pickModule(handicap_type)` routes to bca3v3 / bca5v5 / fargo5v5; `resolveSystem(prefs, overrides)` delegates to buildSystemFromPreferences for full-preference resolution (Phase 5 Unit 5.1)
- `buildSystemFromPreferences.ts` - **Runtime resolver** (Phase 5 Unit 5.1; updated Phase 2 Unit 2.2) — produces a SystemModule from a `ResolvedSystemConfig`. Fast-paths to one of the three shipped presets when prefs match exactly (matchPreset checks `points_calculator` axis: bca3v3=`linear_above_threshold`, bca5v5=`accumulate_with_milestone_jumps`, fargo5v5=`accumulated_per_game`); otherwise builds an ad-hoc module dispatching rating/scoring/threshold sections on the resolved axes. `pickScoring` dispatches by calculator name; aggregate calculators stub through legacy paths until Phase 5 Unit 5.5
- `bca3v3.ts` - **BCA 3v3 module** — wraps the existing get3v3GamesNeeded chart
- `bca5v5.ts` - **BCA 5v5 module** — wraps the existing get5v5GamesNeeded chart
- `fargo5v5.ts` - **Fargo 5v5 module** — real math (Phase 3 Unit 10): rating validation (100-850 integer), start-points formula from `docs/research/fargorate-formula.md`, points→games-won match-result cascade
- `__tests__/resolver.test.ts` - Resolver routing tests (15 cases including unmapped fallback)
- `__tests__/buildSystemFromPreferences.test.ts` - **Runtime resolver tests** (Phase 5 Unit 5.1; updated Phase 2 Unit 2.2 for new `points_calculator` value space) — preset fast-path equivalence + ad-hoc combos (28 cases): teamFormat derivation, rating/scoring/threshold dispatch, mechanism dispatch (extra_games / start_points / race_length_adjustment / none), graceful fallback for not-yet-wired layers
- `__tests__/off_preset_combos.test.ts` - **Off-preset integration tests** (Phase 8 Unit 8.1) — exercises non-Tested-Preset combos through the full pipeline (buildSystemFromPreferences + computeMatchRunningTotals): 4v4+Fargo+games-won (linear_above_threshold), 5v5+percentage+10-7, 3v3+Fargo+games-won, and `points_calculator: null`. Locks the LOCKED tie-band invariant across off-preset handicap-system swaps
- `__tests__/fargo5v5.test.ts` - **Fargo math tests** (Phase 3 Unit 10) — validates against 1 real-match test case (56 start-points ±1) + 34 synthetic cases covering rating validation, start-points formula, scoring cascade, override behavior

#### Points Calculators (`/systems/calculators/`) — Phase 1 Unit 1.1

Calculator-as-type-with-params registry. Each shipped points formula implements `PointsCalculator<P>` and registers itself by name. The runtime is parameter-blind: it looks up a calculator by name (read from `preferences.points_calculator` / `match.system_snapshot.points_calculator`), feeds the right input shape, gets a points number back. Mirrors the `threshold_charts` shape pattern.

- `types.ts` - **PointsCalculator interface** — discriminated union by `kind: 'aggregate' | 'per_game'`. Aggregate calculators take `(gamesWon, thresholds, params)`. Per-game calculators take `(games, teamId, params)`. Includes `ScoringPopupFieldSpec` for the per-game UI's calculator-driven fields.
- `index.ts` - **Registry** — `registerCalculator(calc)`, `getCalculator(name)`, `listCalculators()`. Empty in Unit 1.1; populated by Units 1.2–1.4. `getCalculator(null|undefined|unknown)` returns null (graceful-degradation).
- `__tests__/registry.test.ts` - **Registry smoke tests** (18 cases) — empty-registry behavior, lookup, registration, duplicate-rejection, discriminated-union narrowing for both kinds, scoringPopupFields adapts to params, paramSchema validates.
- `linear_above_threshold.ts` - **`linear_above_threshold` calculator** (Phase 1 Unit 1.2) — three-band formula (above-win / tie-band / below-tie). Tested Preset value: BCA 3v3 default (multiplier=1). The TIE-BAND RULE is a locked invariant: tie-band always 0, multiplier never moves it off zero. Per-game tiebreaker filtering is the caller's responsibility (calculator is aggregate-input). `src/types/match.ts:calculatePoints` is a deprecation shim that delegates here.
- `__tests__/linear_above_threshold.test.ts` - **Three-band formula tests** (45 cases) — supplement worked-examples table reproduced exactly, no-tie-possible variant, multiplier scaling, tie-band invariant under varying multipliers (locked tests fail loudly if a refactor moves the tie band off zero), defensive behavior on null thresholds + malformed params, characterization equivalence with legacy `calculatePoints`.
- `accumulate_with_milestone_jumps.ts` - **`accumulate_with_milestone_jumps` calculator** (Phase 1 Unit 1.3) — monotonic with two stepped jumps. Tested Preset value: BCA 5v5 default (`per_game_increment: 0.1, milestone_percent: 0.7, milestone_jump_value: 1.5, win_threshold_jump_value: 3.0`). No tie-band rule — formula always non-decreasing. `src/types/match.ts:calculateBCAPoints` is a deprecation shim that delegates here.
- `__tests__/accumulate_with_milestone_jumps.test.ts` - **Milestone-jumps formula tests** (34 cases) — supplement worked-examples reproduced exactly (W=13: 14→3.1, 13→3.0, 9→1.5, 8→0.8), milestone target rounding (Math.round semantics), custom params, monotonicity invariant across the full range, edge cases (W=1, per_game_increment=0), defensive behavior, characterization equivalence.
- `accumulated_per_game.ts` - **`accumulated_per_game` calculator** (Phase 1 Unit 1.4) — per-game accumulation with the per-side fixed-or-counter pattern. Each side independently configurable: `{kind: 'fixed', points: number}` OR `{kind: 'counter', min, max, label}`. Tested Preset value: Fargo 10-7 (winner=fixed-10, loser=counter-0-7 "Balls pocketed"). Per-game `scoringPopupFields` adapts to the params. Counter values clamped to [min, max]; null score → min fallback. Tiebreaker filtering is the caller's responsibility.
- `__tests__/accumulated_per_game.test.ts` - **Per-game accumulation tests** (31 cases) — Fargo 10-7 default with mixed game outcomes, counter clamping (above max, below min, null, NaN), winner=counter forward-extension, both-sides-fixed configs, both-sides-counter LO-driven scoring, game filtering (skip null winner, do NOT internally filter tiebreakers), defensive behavior, characterization equivalence with legacy fargo5v5 per-game accumulation.
- `__tests__/off_preset_combinations.test.ts` - **Off-preset combination tests** (15 cases, supplement Section 8.2 mandate) — all three calculators exercised at lineup geometries other than their Tested Preset's lineup (linear at 4v4/5v5/6v6, milestone-jumps at 3v3/6v6, accumulated_per_game at 3v3/4v4 with custom 15/X scoring). Plus `registerTestedPresetCalculators()` registration verification (idempotent). Plus a "same league, three calculators" cross-test proving lineup is independent of calculator choice.

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
| `supabase/migrations/20260419000000_rules_page_events.sql` | `rules_page_events` table + RLS (anon INSERT, developer-only SELECT) |
| `supabase/migrations/20260419120000_house_rules.sql` | `house_rules` table, `house_rules_with_scope_name` view, `can_write_house_rule_org` SECURITY DEFINER, RLS policies |
| `supabase/migrations/20260420120000_leagues_ignore_org_house_rules.sql` | `leagues.ignore_org_house_rules` column for per-league pure-CSI opt-out |
| `database/dev_bootstrap_lo.sql` | DEV-ONLY: given an email, upserts member + org (owner via trigger) + one empty league. Paste into Studio. |
| `database/dev_bootstrap_full.sql` | DEV-ONLY: full fixture — org + venue + league + active 12-week season + 4 teams with 5-player rosters + full round-robin schedule. Paste into Studio. |
| `supabase/migrations/20260418000000_add_leagues_system_overrides.sql` | **Phase 2 Unit 4** — adds `leagues.system_overrides JSONB` for per-league dial overrides |
| `supabase/migrations/20260418000001_add_fargo_match_columns.sql` | **Phase 2 Unit 5** — adds `matches.fargo_start_points` + `match_games.winner_points`/`loser_points`/`loser_balls_pocketed` |
| `supabase/migrations/20260418000002_lock_tier1_preferences.sql` | **Phase 2 Unit 6** — DB trigger blocking UPDATE of `handicap_type` and `lineup_size` on league preferences (tier 1 mutability) |
| `supabase/migrations/20260418000003_add_matches_system_snapshot.sql` | **Phase 2 Unit 7** — adds `matches.system_snapshot JSONB` for per-match frozen tier-2 dials (tier 3 mutability) |
| `supabase/migrations/20260418000004_revise_fargo_columns.sql` | **Phase 2 revision** — drops 3 redundant Fargo columns (fargo_start_points, winner_points, loser_points); adds 3 always-tracked per-game flags (break_fouled, runout, win_by_forfeit). Fargo start-points now reuses home/away_games_to_win. |
| `supabase/migrations/20260419000000_add_fargo_start_points_negotiation.sql` | **Phase 3 Unit 11c** — adds `matches.fargo_start_points` + home/away confirm columns for the captain-negotiated start-points value |
| `supabase/migrations/20260501000002_teams_status_add_bye.sql` | **PR 1 bye-as-real-team** — adds `'bye'` to `teams_status_check` so byes can be represented as real teams rows. |
| `supabase/migrations/20260501000003_teams_captain_id_nullable.sql` | **PR 1 bye-as-real-team** — drops NOT NULL on `teams.captain_id` so bye rows (no captain) can be inserted. |
| `supabase/migrations/20260501000004_backfill_null_bye_matches.sql` | **PR 1 bye-as-real-team** — one-time backfill: replaces NULL `home_team_id`/`away_team_id` on legacy matches with real per-season bye-team rows. Includes pre-flight DO block enumerating abort conditions. |
| `supabase/migrations/20260501000001_team_fks_cascade_to_restrict.sql` | **PR 0 cascade safety net** — flips `matches.home_team_id`, `matches.away_team_id`, and `match_lineups.team_id` from `ON DELETE CASCADE` to `ON DELETE RESTRICT` so deleting a team can no longer silently destroy match/lineup history. See `docs/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md`. |
| `supabase/migrations/20260504000000_harden_prep_match_write_guards.sql` | **Lineup→scoring transition stability fix** — replaces `prep_match` body so ALL writes (thresholds, status, started_at) are guarded by `WHERE status = 'scheduled'`; drops `IF NOT FOUND` exception and wraps INSERT in `IF FOUND` so race-loser calls are true no-ops. See `docs/plans/2026-05-04-001-fix-lineup-to-scoring-transition-stability-plan.md`. |
| `supabase/migrations/20260509000001_messaging_phase1_conversations_participants.sql` | **Messaging Phase 1 / Unit 1** — schema foundations: `conversations.archived_at` (Phase 6 read-only gate prep), `conversation_participants.notification_mode` (tri-state replacement for legacy `is_muted` + `notifications_enabled`, with backfill), `conversation_participants.cannot_leave` (captain-force-membership flag, used by Unit 5 + Unit 6). Plus three CHECK-constraint widenings: `conversation_type` gains `'match_chat'`, `scope_type` gains `'match'`, participant `role` gains `'observer'`. All additive; legacy columns stay during deprecation window. |
| `supabase/migrations/20260509000002_messaging_phase1_messages_members.sql` | **Messaging Phase 1 / Unit 2** — `messages.is_system` flag + nullable `sender_id` + paired `messages_is_system_shape` CHECK (every row is either system-with-NULL-sender or user-with-sender, no other shape). `members.profanity_onboarding_completed_at` (Unit 9 modal). `members.deleted_at` (soft-delete, read by Unit 5 trigger). Intentionally ships **no RLS policies** — those tables have `rowsecurity=false` in dev (RLS-enablement is a separate planned effort). |
| `supabase/migrations/20260509000003_messaging_phase1_season_activation_trigger.sql` | **Messaging Phase 1 / Unit 4** — adds SECURITY DEFINER `auto_create_season_conversations(uuid)` plus trigger wrapper; trigger fires `AFTER UPDATE OF status ON seasons WHEN status flips to 'active'` and creates one team chat per team, one captain chat, one season-announcements chat, and an org-announcements chat (idempotent). Each chat creation is wrapped in `BEGIN/EXCEPTION` so a single failure doesn't strand others. Also adds `conversations` to the `supabase_realtime` publication. See `docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md`. |
| `supabase/migrations/20260509000004_messaging_phase1_roster_captain_triggers.sql` | **Messaging Phase 1 / Unit 5** — four trigger functions that keep auto-managed chats in sync with roster + captain state: `team_players` INSERT (add participant, post "joined" only on real inserts via `xmax = 0`), `team_players` DELETE (set `left_at`, post "left" only when newly set), `teams` UPDATE OF `captain_id` (flip `cannot_leave` in both team and captain chats; multi-team captains keep `cannot_leave` on captain chat), `members` UPDATE OF `deleted_at` NULL→ts (mark every active participant row as left). All `SECURITY DEFINER`, `search_path = public, pg_catalog`, REVOKE PUBLIC/authenticated. See `docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md`. |
| `supabase/migrations/20260513000001_messaging_phase1_unit7_polish.sql` | **Messaging Phase 1 / Unit 7 (polish)** — two changes. (1) `COMMENT ON COLUMN public.members.profanity_filter_enabled` reworded from "Forced ON for users under 18, optional for adults" to reflect the DOB-optional reality (forced ON only for *known* minors; toggleable for adults and members with no DOB on file). (2) `CREATE OR REPLACE FUNCTION public.increment_unread_count()` adds an explicit `IF NEW.is_system THEN RETURN NEW; END IF;` early-return so system messages never bump unread counts; today the implicit SQL NULL semantics achieve the same result but the explicit guard makes intent visible and survives future schema changes. Both statements are idempotent. See `docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md` (Unit 7). |
| `supabase/seed.sql` | Full local dev DB dump — auto-applied on `supabase db reset`. **Local only, never runs against production.** |
| `supabase/seed_test_users.sql` | 4 synthetic test auth users (player/operator/captain/owner, password `test-password-123`). **Dev-only — run manually via `docker exec ... psql`.** |
| `supabase/seed_members.sql` | 20 placeholder players (no `user_id`) spanning Fargo 300–580 ratings for wizard/team-management testing. **Dev-only — not wired into auto-seed; run manually when the local DB needs a bench of fake members.** |

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
| **League Management** | `/wizards/league-v2`, `/operator`, `/leagueOperator`, `/components/operator`, `/services` | `LeagueWizardV2Page.tsx`, `createNewLeagueFlow.ts`, `leagueService.ts`, `leagues.sql` |
| **Season Management** | `/operator`, `/components/season`, `/services` | `SeasonCreationWizard.tsx`, `seasonService.ts`, `seasons.sql` |
| **Schedule Generation** | `/operator`, `/components/schedule`, `/utils`, `/data/matchupTables` | `scheduleGenerator.ts`, `SeasonScheduleManager.tsx` |
| **Team Management** | `/operator`, `/components/player`, `/hooks` | `TeamManagement.tsx`, `useTeamManagement.ts`, `teams.sql` |
| **Match Lineup** | `/player`, `/components/lineup`, `/hooks` | `MatchLineup.tsx`, `useMatchLineup.ts`, `lineups.sql` |
| **Scoring (3x3)** | `/player`, `/components/scoring`, `/hooks`, `/database/scoring3x3` | `ScoreMatch.tsx`, `useMatchScoring.ts`, `match_games.sql` |
| **Messaging** | `/pages`, `/components/messages`, `/hooks`, `/utils`, `/database/messaging` | `Messages.tsx`, `useMessages.ts`, `messageQueries.ts` |
| **Venues** | `/operator`, `/components/operator` | `VenueManagement.tsx`, `VenueCard.tsx`, `venues.sql` |
| **Official Rulebook Reader** | `/rules`, `/officalBCARulebook/cleaned`, `/scripts/clean-rulebook` | `RulesPage.tsx`, `RuleDetailPage.tsx`, `useRulebook.ts`, `scripts/clean-rulebook.ts`, `rules_page_events.sql` |
| **League House Rules** | `/rules` (reader overlay), `/rules/house/:scope/:scopeId/:ruleId`, `/league-rules/:orgId`, `/league-settings/:leagueId` (authoring) | `HouseRuleForm.tsx`, `HouseRulesList.tsx`, `HouseRuleDetailPage.tsx`, `LeagueHouseRulesSection.tsx`, `useHouseRules.ts`, `house_rules.sql`, `leagues_ignore_org_house_rules.sql` |
| **Player Registration** | `/newPlayer` | `NewPlayerForm.tsx`, `usePlayerFormSubmission.ts` |
| **Reporting** | `/operator`, `/pages` | `ReportsManagement.tsx`, `AdminReports.tsx` (live schema in `supabase/migrations/20251130010824_baseline.sql`; legacy drafts archived 2026-05-13) |
| **Wizards/Forms** | `/wizards`, `/components/wizard`, `/components/forms`, `/data`, `/flows` | `WizardFlowShell.tsx`, `createNewLeagueFlow.ts`, `seasonWizardSteps.tsx` |

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
