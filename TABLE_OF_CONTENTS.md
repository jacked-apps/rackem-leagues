# Complete Project Table of Contents

> **Last Updated**: 2026-06-12 (UI/UX brainstorm — team page → scoring page journey. Confirmed "My Match" is already plan-ready (`docs/brainstorms/2026-05-29-live-match-jumpin-requirements.md`) and folded in Ed's OrgSwitcher-style bottom-switcher idea as a candidate multi-live swap mechanism. Stashed `docs/brainstorms/2026-06-12-team-page-schedule-refinement-sketch.md` — team-page declutter + schedule refinement, deferred until My Match ships. Branch `feat/my-match-shortcut`.) Prior 2026-06-11: (Auto-forfeit sweep — the league's first scheduled job. Added `supabase/migrations/20260611000000_auto_forfeit_sweep.sql`: `pg_cron` + `sweep_auto_forfeits()` (daily, set-based, all leagues) that forfeits past-due unplayed matches where exactly one team is captainless — the foundation that auto-resolves BYE weeks AND dropped-team weeks. Forfeit scoring deferred. Test `src/__tests__/database/autoForfeitSweep.db.test.ts`. Branch `feat/auto-forfeit-sweep`.) Prior 2026-06-07: (Trigger workshop landed — second standalone module workshop in the Workshops building: `triggers` table + 4 officials, never-throw `loadTrigger`, standalone `validateTrigger`, shared `_shared/ExpressionBuilder` extracted from the allocator's FormulaBuilder, full trigger workshop UI + route. Merged current main in to reconcile the stacked branch. Branch `feat/trigger-room`.) Prior 2026-06-06: (Added `docs/file-split-backlog.md` — ranked refactor backlog of files worth splitting, from a codebase sweep. Branch `docs/file-split-backlog`.) Prior 2026-06-05: (Added Facebook OAuth login alongside Google in `Login.tsx`/`Register.tsx` and shipped a public Privacy Policy at `/privacy` — `about/PrivacyPolicy.tsx` — required for Facebook app review. Branch `feat/fb-login`.) Prior 2026-06-02: (Archived ~63 completed/superseded brainstorm, plan & memory-bank docs to `docs/archive/` + `memory-bank/archive/` after a code+PR triage; active/back-burner/reference docs left in place.)
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
| `secretweapon.md` | One-line invocation pointer for the League Intake Agent | Type "read secretweapon.md" in Claude Code anywhere in repo → loads the intake-agent persona and starts the LO intake conversation |

### Feature Plans & Specifications (Active)

| File | Purpose | Status |
|------|---------|--------|
| `MVP_FEATURE_LIST.md` | Minimum viable product feature list | **Active - MVP tracker** |
| `LIST_FOR_JACK.md` | Design and styling tasks for Jack | **Active - UI/UX improvements** |
| `LIST_FOR_ED.md` | Tasks and refactoring items for Ed | **Active - travels with branch commits** |
| `PRE_LAUNCH_CHECKLIST.md` | Single source of "must do before production go-live" | **🚨 GATE** — RLS pass + auth email-confirmations + passwordless go-live items |

### Reference Documentation Folder

| Location | Purpose | Notes |
|----------|---------|-------|
| `/docs/` | **Domain knowledge & business rules** | Reference material about pool league systems |
| `docs/BCA_HANDICAP_SYSTEM.md` | BCA handicap system documentation | Official BCA handicap rules and calculations |
| `docs/CUSTOM_5MAN_HANDICAP_SYSTEM.md` | Custom 5-man handicap system | Proprietary handicap system for 5-man format |
| `docs/file-split-backlog.md` | Ranked do-one-at-a-time list of files worth splitting (single-responsibility, not line count) | Refactor backlog from the 2026-06-06 sweep; each is a behavior-preserving PR |
| `docs/guides/captain-onboarding-guide.md` | Long-form, hand-holdy captain how-to for the link-share onboarding (copy message → paste → send → wait → approve). Source for the in-app `InviteHelpContent` popup; train-the-trainer reference | Active guide; foundation for a future wizard/video |
| `docs/archive/LEAGUE_MANAGEMENT_PLAN.md` | League management system architecture | System hierarchy and database schema |
| `/docs/league-system/` | **Modular Scoring System framework — LOCKED canonical docs** | 9-Module architecture (Handicap Systems, Handicap Mechanisms, Points System, Win Calculator, Threshold Charts, Team Geometry, Match Format, Pairings Generator, Tiebreak System); LOCKED per Principle 7 gate procedure |
| `docs/league-system/PRINCIPLES.md` | 10 architectural principles + 4 Module kinds + composition patterns | **LOCKED** — edits require explicit Principle 7 unlock invocation |
| `docs/league-system/README.md` | 9-Module catalog + classification walkthrough + cheat-sheet | **LOCKED** |
| `docs/league-system/concept-analogies.md` | Lens mapping locked concepts → programming primitives (Module=component, Threshold=state setter, Trigger=if/then, per-game allocator=reducer…); flaw-detector for cold reads | **LOCKED** |
| `docs/league-system/revision-protocol.md` | How to safely revise a LOCKED doc: v2-draft-alongside, surgical-diff, plan-as-validation-gate, 3-cold-read ratification; companion to Principle 7 | Active process doc |
| `docs/league-system/implementation-status.md` | Unlocked sidecar holding code references + build-status extracted out of the LOCKED design docs (per PRINCIPLES § 6); one section per module, editable as code moves without an unlock | Living status sheet |
| `docs/league-system/intake-agent-prompt.md` | Persona prompt for the League Intake Agent (translates LO league descriptions to the modular framework) | Active tool — onboarding new LOs |
| `docs/league-system/intake-agent-howto.md` | Step-by-step ops how-to for running the intake agent | Active tool |
| `docs/league-system/modules/` | **Per-Module blueprints (9 Modules + variant pages)** | All LOCKED |
| `docs/league-system/modules/handicap-systems/` | Handicap Systems Module (README + 4 variants: percentage, fargorate, points, skill-level) | LOCKED |
| `docs/league-system/modules/handicap-mechanisms/` | Handicap Mechanisms Module (README + 3 variants: extra-games, start-points, race-length-adjustment) | LOCKED |
| `docs/league-system/modules/points-system/` | Points System Module (README + variants; + **trigger.md** canonical Trigger model) | README + trigger.md LOCKED |
| `docs/league-system/modules/win-calculator.md` | Win Calculator Module — metric precedence stack + Tiebreak System trigger model | LOCKED |
| `docs/league-system/modules/threshold-charts/` | Threshold Charts Module (README + 5 variants: 3v3-games-needed, 5v5-games-needed, race-points, race-percentage, fargo-formula) | LOCKED |
| `docs/league-system/modules/team-geometry.md` | Team Geometry Module — lineup_size + max_roster_size + game_generation | LOCKED |
| `docs/league-system/modules/match-format.md` | Match Format Module — pairing_format + race_length | LOCKED |
| `docs/league-system/modules/pairings-generator.md` | Pairings Generator Module — chain pattern (pair generation + game ordering + break/rack assignment) | LOCKED |
| `docs/league-system/modules/tiebreak-system/` | Tiebreak System Module (README + 4 Mechanism stubs: coin-flip, roshambo, human-pick, mini-match) | LOCKED |
| `/docs/brainstorms/` | **CE brainstorm requirements docs** | Output of `/compound-engineering:ce-brainstorm` |
| `docs/archive/brainstorms/official-rulebook-reader-requirements.md` | Requirements for the Official Rulebook Reader feature | Branch 1 of the rules-feature family |
| `docs/archive/brainstorms/e2e-test-infrastructure-requirements.md` | Requirements for the Playwright E2E scaffolding (foundation seed + factories + multi-user auth + demo mode) | Active branch `feat/e2e-test-infrastructure` |
| `/docs/plans/` | **CE implementation plans** | Output of `/compound-engineering:ce-plan` |
| `docs/archive/plans/2026-04-17-001-feat-official-rulebook-reader-plan.md` | Implementation plan for the Official Rulebook Reader | 6 units, active branch `feature/official-rulebook-reader` |
| `docs/archive/plans/2026-04-27-001-feat-e2e-test-infrastructure-plan.md` | Implementation plan for the E2E scaffolding | 10 units (8 in v1 scope), active branch `feat/e2e-test-infrastructure` |
| `docs/archive/brainstorms/header-mobile-rework-requirements.md` | Requirements for the global header & navigation rework | Slim sticky header, hamburger drawer with per-org operator shortcuts, drawer-internal badges |
| `docs/brainstorms/modular-league-system-requirements.md` | Requirements for fully modular league configuration | Deprecates `5_man`/`8_man`; any-combo support; 3-layer threshold strategy; supersedes April 18 modular-handicap-scoring doc |
| `docs/archive/brainstorms/lineup-to-scoring-transition-requirements.md` | Requirements for the lineup → scoring transition stability fix | 7-defense architecture; supersedes cache/recovery aspects of the prior race-condition brainstorm; closes LIST_FOR_ED #21/#22 |
| `docs/archive/brainstorms/unified-scoreboard-requirements.md` | Requirements for collapsing 4 scoreboards to 1 + tiebreaker | Schema-derived display hints (escape hatch), mobile-first compact mode, "stadium not sportsbook" focus; depends on PR #98 merge |
| `docs/brainstorms/2026-05-24-live-scoring-resilience-requirements.md` | Requirements for robust multi-device live scoring (connection resilience + concurrency correctness) | Invisible-robustness north star; hold-and-send taps; many-eyes confirm/deny with captain backstop; smoke-detector-not-judge; branch `docs/live-scoring-resilience-brainstorm` |
| `docs/archive/brainstorms/modular-handicap-scoring-requirements.md` | Original requirements for the modular handicap/scoring system | Superseded by `modular-league-system-requirements.md` |
| `docs/brainstorms/placeholder-player-improvements-requirements.md` | Requirements for the placeholder-player lifecycle (merge / archive / undo-merge) | Drove the 23-migration `20260422` PR series |
| `docs/archive/brainstorms/league-house-rules-requirements.md` | Requirements for org-level house rules with per-league opt-out | Foundation of the `house_rules` table + `ignore_org_house_rules` flag |
| `docs/archive/brainstorms/lineup-race-condition-fix-requirements.md` | Requirements for fixing the lineup → scoring race condition | Predecessor to `lineup-to-scoring-transition-requirements.md` |
| `docs/archive/brainstorms/team-deletion-cascade-fix-requirements.md` | Requirements for fixing the team-deletion cascade behavior | Drove the cascade→restrict migration |
| `docs/archive/brainstorms/2026-04-21-messaging-system-overhaul-findings.md` | Findings phase of the messaging overhaul investigation | Inputs to the Phase 1 plan |
| `docs/brainstorms/2026-04-21-messaging-system-overhaul-requirements.md` | Requirements for the messaging system overhaul | Backbone of the Phase 1 plan |
| `docs/archive/brainstorms/2026-04-29-dark-mode-requirements.md` | Requirements for dark-mode toggle support | Drove the dark-mode plan |
| `docs/archive/brainstorms/2026-04-30-navigation-ia-overhaul-requirements.md` | Requirements for the navigation IA overhaul | Drove PR #124 (MemberLayout / AppSidebar / BottomTabBar / AppDrawer) |
| `docs/brainstorms/2026-05-05-scoring-modal-rework-requirements.md` | Requirements for the scoring-modal plumbing rework | Drove the scoring modal refactor |
| `docs/archive/brainstorms/2026-05-16-modular-scoring-system-viability-requirements.md` | Viability-stage brainstorm for the modular Scoring System framework | "Works, not perfect" v1 standard established |
| `docs/archive/brainstorms/2026-05-17-modular-scoring-system-comparison-requirements.md` | Compare-stage brainstorm — verdict to ship modular framework | Drove the locked-docs framework adoption |
| `docs/brainstorms/2026-05-17-tie-resolution-ownership-requirements.md` | Captured architectural direction for Win Calc metric stack + Tiebreak System | Drove the locked-doc edits + new Tiebreak System Module (#9 in catalog, replacing dissolved Standings & Tiebreakers) |
| `docs/brainstorms/2026-05-21-lo-primitive-naming-layer-requirements.md` | Naming/identity layer for LO-built primitives — locks the internal-name / display-name / description / label glossary; mirror is workshop-authoring-only | Design (future workshop); NOT locked canon |
| `docs/brainstorms/2026-05-21-scoreboard-module-design-requirements.md` | ROUGH: scoreboard = slots per side filled by modules that read the state bag + render labeled values; LO-customizable; stress-tests the naming layer | Rough draft — Ed's idea, to flesh out |
| `docs/brainstorms/2026-05-28-operator-help-system-requirements.md` | Phased operator-facing help: glossary data source + GlossaryInfoButton wrapper + InfoButton coverage on operator wizards (Phase 1); persistent Help button + Walkthroughs/Concepts (Phase 2, evidence-gated) | L3 of the four-layer doc model; adds alias/synonym layer for operator vocabulary collisions |
| `docs/brainstorms/2026-05-29-live-match-jumpin-requirements.md` | Requirements for the "My Match" live-match jump-in shortcut (bottom-nav tab + drawer section) | One-tap into live match; bottom-nav state machine (live → scoring / no-live → `/live` scoreboards); drawer section mirrors AppDrawer OperatorSection (flat-when-1 / list-when-2+ / hidden-when-empty); `/my-match` page deferred to future Upcoming Matches brainstorm; multi-live swap delegated to scoring gear (PR #157); branch `chore/safe-meantime-work` |
| `docs/archive/brainstorms/2026-05-25-pairings-generator-extraction-requirements.md` | Pairings Generator (Module #8) v1 extraction — one Module slot, three internal stages; lineups in, player-id-tagged GameSlot[] out (matches canon); today's RR algorithm only, no preferences/workshop work; output shape variant-agnostic for future race-mode etc. | Planned (`docs/plans/2026-05-25-001-...`) |
| `docs/brainstorms/2026-05-28-passwordless-sign-in-requirements.md` | Requirements for one-door, code-based passwordless sign-in (email OTP + Google/Facebook; passwords kept but demoted) | Companion to the onboarding cold-start brainstorm; built first to dissolve the join-token-survival problem; branch `docs/passwordless-auth-brainstorm` |
| `docs/brainstorms/2026-05-28-player-onboarding-cold-start-requirements.md` | Requirements for new-league cold-start player/captain onboarding — the share→self-claim→approve cascade (persistent team join link + captain approve gate) | Resolved decisions captured; passwordless is the build-first companion; plan = `2026-05-29-001` |
| `docs/brainstorms/2026-06-02-lineup-swap-recalibration-requirements.md` | Requirements for mid-match player swap with full match recalibration | Universal opponent-approval (no per-system branches); single `recalibrateMatchAfterSwap` operation that re-runs SystemModule-dispatched prep math + cascades unplayed games + re-tallies totals via existing `updateMatchRunningTotals`; fixes existing `recalculateMatchThresholds` handicap-type heuristic leak; branch `feat/lineup-swap-recalibration` |
| `docs/brainstorms/2026-06-04-per-game-allocator-workshop-requirements.md` | Workshop for LO-authored per-game allocator variations (modules-as-data first application) — DB-row variations + per-league pointer + swap point in `pickPointsSystem`; engine already supports fixed/range/formula, only the workshop pipeline is missing | SUPERSEDED 2026-06-04 by the building-framing brainstorm below; this one jumped to feature design before locking the foundational picture. Kept for history |
| `docs/brainstorms/2026-06-04-scoring-system-workshop-building-requirements.md` | Foundational framing: Scoring System Workshop is a BUILDING with one work room per module type; build room-by-room starting with the per-game point allocator; two non-negotiables (lineup/scoring page renders + per-game W/L recording survives any variation failure) | Foundation for all subsequent Scoring System workshop plans; branch `feat/per-game-allocator-workshop` |
| `docs/brainstorms/lo-manual-match-scoring-requirements.md` | Requirements for LO manual match scoring (enter a played-on-paper match from blank) | Two-phase Setup→Entry page; reuses engine/recompute/scoreboard/modal + thin LO dual-slot write+finalize; v1 enter-from-blank only; based on many-eyes stack (PR #157) |
| `docs/brainstorms/lo-match-review-and-correction-requirements.md` | Requirements for LO view/edit of an ALREADY-scored match (take-over/adjust; dispute adjudication) | Operator-authoritative; per-game confirmer-audit (official + "+N others"); solo vacate-and-rescore appends operator override row + optional reason; explicit completed→reopen→re-finalize lifecycle; roster-identity fixes → v3; stacks on v1 (PR #167) |
| `docs/brainstorms/2026-06-12-team-page-schedule-refinement-sketch.md` | SKETCH (not full requirements) — team-page declutter (split glance/play from Manage Team; captain overload) + schedule refinement, done "with click-through in mind" | Deliberately deferred until "My Match" ships (My Match lifts the fast-path duty off these pages); full `/ce:brainstorm` after that. Sibling to the 2026-05-29 My Match doc |
| `/docs/plans/` | **CE implementation plans** | Output of `/compound-engineering:ce-plan` |
| `docs/archive/plans/2026-04-17-001-feat-official-rulebook-reader-plan.md` | Implementation plan for the Official Rulebook Reader | 6 units, active branch `feature/official-rulebook-reader` |
| `docs/archive/plans/2026-04-27-001-feat-global-header-nav-rework-plan.md` | Implementation plan for the global header & navigation rework | 9 units in 3 phases, active branch `fix/header-mobile-rework` |
| `docs/archive/plans/2026-04-28-001-feat-modular-league-system-plan.md` | Implementation plan for the fully modular league system | 21 units across 8 phases (Phase 0 research + 7 implementation phases); supersedes April 18 plan; covers BCAPL SL handicap, audit log R21, threshold-charts wiring, team_format drop |
| `docs/archive/plans/2026-05-04-001-fix-lineup-to-scoring-transition-stability-plan.md` | Implementation plan for the lineup → scoring transition stability fix | 7 implementation units across 3 phases; new MatchPhaseGuard + MatchTransitionRecovery + useMatchPhase; hardened prep_match RPC; foreground polling backstop; deletes 6-month-old retry loop |
| `docs/archive/plans/2026-05-03-001-feat-unified-scoreboard-plan.md` | Implementation plan for the unified scoreboard refactor | 8 units across 3 phases; replaces 3 legacy scoreboards with 1 + tiebreaker fix; schema-derived display hints; TeamStatsCard generalized for points-mode; depends on PR #98 merge |
| `docs/plans/2026-06-04-001-feat-per-game-allocator-workshop-plan.md` | Implementation plan for the Per-Game Allocator Workshop | SUPERSEDED 2026-06-04 by `2026-06-04-002` (room plan, built against the building framing). Kept for history |
| `docs/plans/2026-06-04-002-feat-per-game-allocator-room-plan.md` | Implementation plan for the Per-Game Allocator ROOM — first room of the Scoring System Workshop building | 9 units: DB schema + 4 officials + tamper trigger; loader (never-throw); validator hardening (formula args shape check); runtime safety net around the allocator call (mirrors `fireTrigger`); snapshot extension + LIVE-path swap in `match-adapter.ts`; workshop room UI with save-time guard (validator + dry-run); league pick UI with apply-time preview; 17-Point smoke test through the LIVE scoring mutation; TOC. Built against `2026-06-04-scoring-system-workshop-building-requirements.md`. Branch `feat/per-game-allocator-workshop` |
| `docs/plans/2026-05-24-001-feat-live-scoring-resilience-plan.md` | Implementation plan for robust multi-device live scoring (resilience + concurrency) | 11 units / 5 phases; rely-on-client reconnect + catch-up refetch + polling fallback; guarded scoring RPCs (deny-flags-not-wipes, race-safe totals, N-device completion) on prep_match model; hold-and-send taps; sticky participation modes; branch `docs/live-scoring-resilience-brainstorm`; origin 2026-05-24 brainstorm |
| `docs/plans/2026-05-28-001-feat-operator-help-system-phase-1-plan.md` | Phase 1 implementation plan for the operator help system | 8 units: glossary data source (TS module registry, per-domain split) + GlossaryInfoButton wrapper + slug-aware wizard wrapper props + infoContent migration + coverage on league-v2/season-v2/operator-area screens + Learn hub at `/operator-learn` (Glossary section only) + `pnpm glossary:verify` drift audit + outside-LO walk acceptance gate; origin 2026-05-28 brainstorm |
| `docs/plans/2026-05-28-001-feat-passwordless-sign-in-plan.md` | Implementation plan for passwordless one-door sign-in (email OTP code + Google/Facebook; passwords kept-but-demoted) | 6 units; signInWithOtp `type:'email'` typed code, `shouldCreateUser` one-door, `?redirect` repair across all auth paths, Facebook can-lag on App Review, prod email-confirmations+SMTP gate; branch `docs/passwordless-auth-brainstorm`; origin 2026-05-28 brainstorm |
| `docs/ops/passwordless-auth-setup.md` | Production setup checklist for passwordless sign-in (OTP template, custom SMTP, email-confirmations, redirect allow-list, captcha, Facebook) | Companion to PRE_LAUNCH_CHECKLIST; local dev needs none of it |
| `docs/archive/plans/2026-04-18-001-refactor-modular-handicap-scoring-systems-plan.md` | Implementation plan for the modular handicap/scoring foundation | Predecessor to the April 28 modular league system plan |
| `docs/archive/plans/2026-04-19-001-feat-league-house-rules-plan.md` | Implementation plan for org-level house rules | `house_rules` table + `ignore_org_house_rules` per-league flag |
| `docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md` | Implementation plan for the placeholder-player lifecycle | 23 migrations + RPCs + UI; merge / archive / undo-merge / org-scope |
| `docs/archive/plans/2026-04-24-001-fix-lineup-race-condition-plan.md` | Implementation plan for the lineup race-condition fix | Predecessor to the May 4 lineup→scoring transition stability plan |
| `docs/archive/plans/2026-04-29-001-feat-dark-mode-toggle-plan.md` | Implementation plan for the dark-mode toggle | Theme provider + ThemeToggle component |
| `docs/archive/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md` | Implementation plan for the team-cascade-deletion fix | Migration `20260501000001` flips FKs from CASCADE to RESTRICT |
| `docs/archive/plans/2026-04-30-001-feat-navigation-ia-overhaul-plan.md` | Implementation plan for the navigation IA overhaul | Drove PR #124 (MemberLayout + AppSidebar + BottomTabBar + AppDrawer + OperatorOrgRow) |
| `docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md` | Implementation plan for the modular league system v2 (League Wizard V2 + axis cleanup) | Builds on the April 28 modular league plan |
| `docs/archive/plans/2026-05-05-001-feat-scoring-modal-plumbing-plan.md` | Implementation plan for the scoring modal plumbing rework | Drove the scoring modal refactor |
| `docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md` | Implementation plan for the messaging overhaul Phase 1 | Units 1–14: schema, triggers, auto-chats, past-member, profanity, failed-send, value-prop empty state, etc. |
| `docs/archive/plans/2026-05-17-001-feat-new-season-from-previous-plan.md` | Implementation plan for the next-season-from-previous wizard | Draft PR #120 |
| `docs/archive/plans/2026-05-17-002-feat-captain-reup-sheet-plan.md` | Implementation plan for the captain re-up sheet | Draft PR #121 |
| `docs/plans/2026-04-28-001-feat-modular-league-system-plan-supplements/` | Supplements directory for the modular league system plan | Append-only addenda used during execution |
| `docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md` | Strangler-fig migration plan for the modular Scoring System refactor | Unit 1 (Win Calculator extraction) detailed; Units 2-9 sketched; each Unit extracts one Module piece-by-piece without breaking the shipping prepackaged Scoring Systems |
| `docs/plans/2026-05-29-002-feat-my-match-jump-in-plan.md` | Implementation plan for the "My Match" live-match jump-in shortcut | 5 units: team-scoped `getMyMatchMatches` query + `useMyMatchSurfaces` aggregate hook with lightweight realtime + BottomTabBar tab repurpose + AppDrawer "My Match" section (OperatorSection-mirrored) + AppSidebar parity; no DB schema changes; coordinates with future captain-doorbell on bottom-bar; branch `chore/safe-meantime-work` |
| `docs/archive/plans/2026-05-25-001-refactor-pairings-generator-extraction-plan.md` | Implementation plan for Pairings Generator (Module #8) v1 extraction | 8 units; lifts `gameOrder.ts` into `src/systems/pairings/` (three internal stages: pair-gen / ordering / break-rack); lineups in, player-id-tagged GameSlot[] out; deletes dead helpers; output shape variant-agnostic for future race-mode etc. Branch `feat/pairings-generator-extraction` |
| `docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md` | Implementation plan for the player/captain onboarding cold-start cascade (team join link → claim → captain approve) | 8 units / 3 phases; new `teams.join_token` + `team_join_requests` table; `/join/:token` page; `approve-join-request` edge fn (match-or-create via merge); triage board on MyTeams; doorbell; thin captain wizard; land-on-tonight's-match; builds on passwordless PR #159; origin 2026-05-28 brainstorm |
| `docs/plans/2026-06-02-001-feat-lineup-swap-recalibration-plan.md` | Implementation plan for mid-match lineup swap with full match recalibration | 5 units; finishes the Dec 2025 partial swap — system-agnostic `composeMatchThresholds` (deletes the `recalculateMatchThresholds` handicap-type leak), atomic `swap_player_in_lineup` RPC (cascade unplayed games + thresholds + audit), rewires `approveLineupChange` to call it + the missing `updateMatchRunningTotals`, popover-gate fix + waiting banner + resolution toast; branch `feat/lineup-swap-recalibration`; origin 2026-06-02 brainstorm |
| `docs/plans/2026-06-03-001-feat-lo-manual-match-scoring-plan.md` | Implementation plan for LO manual match scoring (v1 enter-from-blank) | 7 units; reuses prep_match/engine/scoreboard/modal + thin LO dual-slot write+finalize; dashboard card → week-accordion picker → two-phase page; based on many-eyes stack tip (PR #157); branch `feat/lo-manual-scoring` |
| `docs/plans/2026-06-04-001-feat-lo-match-review-correction-plan.md` | Implementation plan for LO match review & correction (v2 take-over/adjust) | 8 units; reuses v1 Entry/picker/ScoringDialog + many-eyes game_confirmations; confirmer-audit read, solo vacate + loCorrectGame override (appends operator row + reason), crash-safe reopen (keeps completion fields) → re-finalize/restore; eligibility = completed/awaiting; stacks on v1; branch `feat/lo-match-review-correction` |

### Future Work Folder

| Location | Purpose | Notes |
|----------|---------|-------|
| `/future/` | **Post-MVP features and optimizations** | Work to resume after MVP complete |
| `future/DATABASE-USAGE-MAP.md` | Phase 3 messaging TanStack migration inventory | Post-MVP optimization |
| `docs/archive/future/LEAGUE-SEASON-WIZARD-REFACTOR-TODO.md` | League/season wizard improvements | Future UX enhancements |
| `docs/archive/future/phase3-migration-approach.md` | Phase 3 TanStack Query migration planning | Post-MVP optimization |

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

*Previously listed `cUsersshodbpersonalsupabase-learning-hubsrcutilsscheduleGenerator.ts` (corrupt path) — confirmed not present on disk; entry removed.*

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
| `authorize-new-players.md` | Notes on the authorize-new-players org-level toggle |
| `BRANCH-placeholder-players.md` | Branch-tracking notes for the placeholder-player work |
| `PLAN-5v5-substitute-flow.md` | Substitute-flow plan for 5v5 lineups |
| `PLAN-branch1-modularization.md` | Branch 1 plan for the modular handicap/scoring system |
| `PLAN-branch2-fargo-points.md` | Branch 2 plan for Fargo per-game point accumulation |
| `PLAN-email-invites.md` | Email-invite plumbing plan |
| `PLAN-fargo-handicap-system.md` | Full Fargo handicap-system plan (rating + scoring + thresholds) |
| `PLAN-lo-manual-scoring.md` | Plan for LO-driven manual scoring entry |
| `PLAN-placeholder-players.md` | Original placeholder-player plan (predecessor to the lifecycle PR series) |
| `PLAN-pp-removal.md` | Plan for safely removing placeholder players |
| `PLAN-stats-and-standings.md` | Stats-and-standings architecture plan |
| `PLAN-wizard-v2-cleanup.md` | Cleanup tasks for Wizard V2 follow-up |
| `preferences-system-status.md` | Status doc for the modular preferences system |
| `pwa-implementation-guide.md` | PWA setup guide (offline + install) |
| `progress.md` | High-level progress tracker (core Memory Bank file) |
| `systemPatterns.md` | System architecture patterns (core Memory Bank file) |

### Active Planning Documents (`/memory-bank/plans/`)

| File | Purpose | Status |
|------|---------|--------|
| `plans/PLAN-wizard2.md` | Wizard 2.0 framework — clean rebuild of league wizard with reusable shell, schemas, and step contract | Planning (current branch: `wizard-2-creation`) ✨ |
| `plans/playoff-system-plan.md` | Playoff system architecture and implementation plan | Existing |
| `plans/bye-team-enhancement-plan.md` | Plan for treating byes as real team rows | Implemented (migrations `20260501000002`–`04`) |
| `plans/NOTE-scoring-abbreviations.md` | Reference note for scoring-screen abbreviations | Reference |
| `plans/schedule-manual-manipulation-plan.md` | Plan for manual schedule manipulation features | Planning |
| `plans/TODO-championship-date-reminders.md` | TODO list for championship-date reminder UX | Backlog |
| `plans/TODO-season-preferences-editor.md` | TODO list for the season-level preferences editor | Backlog |

### Memory-bank Archive (`/memory-bank/archive/`)
- `architectural-reframe-2026-05-01.md` - May 2026 architectural reframe notes.
- `BRANCH-venue-table-sizes.md` - Branch-tracking notes for the venue table-sizes feature.
- `lo-manual-scoring-investigation.md` - Investigation notes for LO manual scoring (precursor to the plan).
- `phase-0c-full-e2e-research-notes.md` - Research notes from the E2E Phase 0c pass.

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
| `add_5v5_lineup_support.sql` | Schema additions to support 5v5 in the same scoring tables |
| `add_unique_constraint_match_lineups.sql` | UNIQUE constraint on `match_lineups` to prevent duplicate rows |
| `change_game_confirmations_to_member_ids.sql` | Switches game-confirmation tracking from emails to member IDs |
| `database_changes_summary_2025_01_11.sql` | Historical change-summary doc (kept for reference) |
| `enable_matches_realtime.sql` | Adds `matches` to the realtime publication |
| `match_verification_columns.sql` | Match-row verification columns (per-team verify state) |

### 5x5 Scoring System (`/database/scoring5x5/`)
- `handicap_chart_5v5.sql` - 5v5 handicap chart seed.
- `handicap_chart_5v5_simple.sql` - Simplified 5v5 chart variant.

### Reporting System (`/database/reporting/`)
- `MIGRATION_upgrade_reporting_system.sql` - Migration to upgrade the user-report tracking system.

### Database Schemas (`/database/schemas/`)
- `playoff_configurations.sql` - Schema definition for the `playoff_configurations` table.

### Database Policies (`/database/policies/`)
- `matches_player_verification.sql` - Player-verification RLS policy for the matches table.

### Database Tests (`/database/tests/`)
- `test_messaging_rls.sql` - Manual RLS tests for messaging tables.
- `test_reporting_rls.sql` - Manual RLS tests for the reporting tables.

### Database Dev Dumps + Seeds (`/database/dumps/`, `/database/staging_seeds/`, `/database/test_data/`)
*Dev-only — never run against production.*

- `database/dumps/` - 20 dated SQL dumps used for snapshot capture and rollback during heavy migrations. Stored for reference; not auto-applied.
- `database/staging_seeds/seed_staging_users.sql` - Staging-environment seed users for QA flows.
- `database/test_data/` - 7 SQL files holding bespoke test datasets (specific bug-reproduction fixtures, ad-hoc team/match shapes for manual testing).
- `database/dev_starting_point.messaging-system-overhaul.sql` - Branch-scoped dev seed used during the messaging overhaul work.
- `database/fix_dump.py`, `database/fix_match_games.py`, `database/fix_match_lineups.py` - Python helpers for cleaning up SQL dump quirks before replay.
- `database/dump.sql` - Latest convenience dump (rotated manually).

### Migrations & Utilities

| File | Purpose |
|------|---------|
| `migrations/add_handicap_variant_to_leagues.sql` | Migration: Add handicap_variant fields to leagues table |
| `migrations/add_match_results_tracking.sql` | Migration: Add match results tracking system |
| `migrations/` (additional ~30 historical files) | **Pre-supabase/migrations/ historical migrations.** Bulk of early-development schema changes lives here as named SQL files (not timestamp-prefixed). Examples: `add_position_tracking_to_match_games.sql`, `add_preferences_table.sql`, `add_vacate_requested_by.sql`, `allow_players_update_match_thresholds.sql`, `authorize_new_players_feature.sql`, `complete_rls_reset.sql`, `create_organization_staff_table.sql`, `create_organizations_table.sql`, `disable_all_rls_for_development.sql`, `disable_rls_for_development.sql`, `drop_all_league_operators_rls_policies.sql`, `drop_league_operators_table.sql`, `drop_league_operators_table_v2.sql`, `fix_handicap_chart_games_to_lose.sql`, `fix_lineup_unlock_policy.sql`, `fix_match_lineups_unlock_policy.sql`, `increase_handicap_precision.sql`, `migrate_league_operator_data.sql`, `migrate_venues_to_organizations.sql`, `nuclear_drop_all_rls_policies.sql`, `populate_handicap_chart_tie_lose.sql`, `remove_match_lineups_check_constraint.sql`, `rename_league_email_phone_to_organization.sql`, `rename_operator_id_to_organization_id.sql`, `restore_match_games.sql`, `restore_match_lineups.sql`, `update_get_operator_stats_function.sql`, `update_handicap_columns_for_5v5_percentages.sql`, `update_operator_blackout_preferences_rls.sql`, `update_season_weeks_rls.sql`. *Going forward, all new migrations should land under `supabase/migrations/` with a timestamp prefix.* |
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
| `supabaseClient.test.ts` | Tests for the realtime survival heartbeat handler (worker + reconnect-on-dead-socket) |
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
- `autoForfeitSweep.db.test.ts` - **Auto-forfeit sweep.** Builds one league with five past/future matches and calls `sweep_auto_forfeits()` once, asserting every branch: past-due + one-captainless → forfeit to the captained team; both-captained → ignored; neither → skipped; future (not past-due) → untouched; already-completed → untouched. Requires local Supabase + the 20260611000000 migration.
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
- `team-join-cascade.test.ts` - **Onboarding cascade / Unit 1** — schema verification for `20260529000001`: `teams.join_token` (uuid, NOT NULL, unique, backfilled distinct) + `team_join_requests` lifecycle table, status CHECK, both partial-unique guards (per-user dedup, per-spot race). 9 tests.
- `get-team-join-view.test.ts` - **Onboarding cascade / Unit 2** — exercises the `get_team_join_view` RPC: valid token → team/league/spots with open-vs-taken flags, unknown token → `{found:false}`, names-only projection (no contact-info leak), anon pre-auth callability, and `viewer_request_status` via a tx-scoped `request.jwt.claims`. 6 tests.
- `request-team-join.test.ts` - **Onboarding cascade / Unit 3** — exercises the `request_team_join` RPC guard matrix (not_authenticated / invalid_token / no_member / already_member / full / invalid_claim / spot_taken) + happy self-add, happy claim, idempotent already_pending. Each case runs under a tx-scoped JWT and rolls back. 11 tests.
- `approve-join-request.test.ts` - **Onboarding cascade / Unit 4** — exercises `approve_join_request`: not_authenticated / invalid_action / not_found / already_handled / not_authorized + Decline, Add, Replace (real merge), no_placeholder, nullable-captain→staff path. Tx-scoped JWT, rolls back. 11 tests.
- `join-requests-for-approver.test.ts` - **Onboarding cascade / Unit 5 (read)** — exercises `get_join_requests_for_approver`: anonymous/no-member → []; captain sees labeled pending request; excludes non-pending + expired; non-approver sees nothing; de-dup when captain is also staff. Tx-scoped JWT. 6 tests.
- `approve-surface-roster.test.ts` - **Approve surface / richer cards (Unit 1)** — exercises `get_team_roster_for_approver` (captain row flagged + registered/claimable consistent; captain always present even when only in `teams.captain_id`; non-approver/anon → []) + the feed's new captain summary (`captain_is_placeholder` true on a placeholder-captain team, false on a registered-captain team). Tx-scoped JWT. 7 tests.
- `my-approved-join-requests.test.ts` - **Onboarding cascade / Unit 3 (notify)** — exercises `get_my_approved_join_requests` + `acknowledge_join_request`: anonymous → []; owner sees approved-unacknowledged with labels; pending excluded; acknowledge removes it; can't ack someone else's. Tx-scoped JWT. 6 tests.
- `join-link-distribution.test.ts` - **Onboarding cascade / Unit 7** — exercises `rotate_team_join_token` (captain/staff rotates; non-approver can't) + `get_org_teams_for_onboarding` (staff sees team+captain+token; non-staff → []). Tx-scoped JWT. 5 tests.
- `per-game-allocator-schema.test.ts` - **Scoring System Workshop — Per-Game Allocator Room Unit 1** — schema verification for the `per_game_allocators` table + cascade. 15 tests: 5 seeded officials (Percent 5-Man, 10-Point, 17-Point, 17-Point (Single Formula), Empty Starter) present with author_id IS NULL; 10-Point loser side is a labeled range; both 17-Points use `evaluate_expression` with the expected expression tree shape; CHECK rejects scope outside ('official','user'); CHECK rejects scope=user with NULL author_id; CHECK rejects scope=official with non-NULL author_id; tamper trigger blocks UPDATE on officials; tamper trigger blocks DELETE on officials; `preferences.per_game_allocator_id` is a nullable UUID; FK is ON DELETE RESTRICT to `per_game_allocators(id)`; resolved view exposes the new column. 2 tests skipped pending seeded auth.users fixture (user-row insert + FK RESTRICT-while-in-use).
- `17-point-smoke.test.ts` - **Scoring System Workshop — Per-Game Allocator Room Unit 8** — R10 acceptance through the LIVE path. 4 DB-touching tests: seeded 17-Point official exists; `loadPerGameAllocator(real_id)` produces a valid in-memory PerGameAllocator with the expected SideConfig shape; full pipeline DB row → loader → match-adapter → engine produces correct totals (home=48, away=37 for the [0,3,5,7,2] sequence); BOTH 17-Point templates (base+formula form AND single-formula form) produce identical totals — proves they're equivalent ways to express the same scoring. Uses `vi.mock('@/supabaseClient')` → `createTestClient()` to point the loader at the local supabase URL.

#### Messaging UI Components (`/components/messages/`)
- `ReadOnlyBanner.tsx` - **Messaging Phase 1 / Unit 6** — shadcn `Alert` that renders in place of the message composer when the current user can read but not post. Two reasons covered: `past-member` (left_at non-NULL) and `announcement-non-staff` (announcements channel viewed by a non-staff member). The composer is unmounted by `MessageView`, not just hidden by CSS.
- `__tests__/ReadOnlyBanner.test.tsx` - RTL test covering both `reason` values render distinct copy.
- `__tests__/ConversationList.profanity.test.tsx` - **Messaging Phase 1 / Unit 7** — RTL test covering the last-message-preview filter: filter ON censors profane previews while leaving clean ones and surrounding chrome intact, filter OFF renders raw, null/empty preview falls back to "No messages yet", unread-count badge is unaffected.
- `__tests__/MessageBubble.system-message.test.tsx` - **Messaging Phase 1 / Unit 7** — RTL test for the `isSystem` render branch: centered/italic/muted-foreground wrapper, no sender link / no timestamp / no read receipt even when those props are passed, profanity filter applies defensively when enabled, default variant unchanged when `isSystem` is omitted.
- `messageview/__tests__/useOutgoingMessages.test.ts` - **Messaging Phase 1 / Unit 8** — Unit tests for the optimistic-outgoing hook: `addPending` returns unique clientIds and appends a `sending` entry; `markFailed` flips status + records error; `markPending` clears the error on retry; `remove` deletes by clientId while preserving order; unknown-id mutators are no-ops. 6 cases.
- `messageview/__tests__/MessageList.outgoing.test.tsx` - **Messaging Phase 1 / Unit 8** — RTL test for the inline-failed-send rendering: pending outgoing entries render as normal user bubbles after the confirmed messages, failed entries render as the destructive failed-variant `MessageBubble` with error + Retry button (click invokes `onRetryOutgoing(clientId, content)`), multiple failed entries render independently (eggs AND bacon both visible + retryable), mixed pending+failed render in order, empty state only shows when both confirmed AND outgoing are empty. 7 cases.
- `CreateTeamChatPrompt.tsx` - **Messaging Phase 1 / Unit 3 helper 6/6** — captain manual-fallback prompt above the Messages conversation list. Shows one card per captained active-season team that lacks an auto-managed chat. Clicking creates the chat via `createTeamChat()` and auto-selects it.

#### Messaging Hooks (`/api/hooks/`)
- `useMessageComposerStatus.ts` - **Messaging Phase 1 / Unit 6** — TanStack Query hook. Returns `{ readOnly, reason }` for a conversation. Looks up the current user's participant row + (for announcement channels) their `organization_staff` membership. Consumed by `MessageView` to choose between `MessageInput` and `ReadOnlyBanner`.
- `useCaptainTeamsMissingChat.ts` - **Messaging Phase 1 / Unit 3 helper 6/6** — TanStack Query hook. Returns the list of teams the current user captains in an active season that lack an auto-managed team chat. Used by `CreateTeamChatPrompt`.
- `messaging-phase1-season-activation.rls.test.ts` - **Messaging Phase 1 / Unit 4** — DB-backed coverage of the season-activation trigger: team chats per team, captain chat, season + org announcements, idempotent re-fire, no-fire on non-status UPDATEs, no-fire when status flips away from active.
- `messaging-phase1-roster-triggers.rls.test.ts` - **Messaging Phase 1 / Unit 5** — DB-backed coverage of the four roster/captain lifecycle triggers: INSERT (join + msg only on real inserts), DELETE (deferred constraint trigger; sets `left_at` and posts "left" only on real removals, silent on wholesale-replace), captain change (cannot_leave flip in team + captain chats; multi-team captain edge case), member soft-delete. **Note:** the three messaging DB-backed test files race each other under default vitest file parallelism — run with `--no-file-parallelism` when executing the full directory. See `LIST_FOR_ED.md` #27.
- `gameConfirmations.schema.db.test.ts` - **Many-eyes Layer-2 / Unit 1 + Phase 2 Amendment A** — schema verification for the append-only `game_confirmations` table: exists + on the `supabase_realtime` publication, full-vouch insert defaults (`action='confirm'`, `created_at`), `action='vacate'` marker accepted, side/action CHECK rejections, FK rejections (game_id, confirmer_id), snapshot `winner_team_id` is FK-free (history must not mutate on team delete), `match_games` officiality columns left intact, and the Amendment A column (`is_initiator` boolean, default false, accepts true, NO unique constraint — multiple initiators per side allowed). 13 tests.
- `appendConfirmation.db.test.ts` - **Many-eyes Layer-2 / Unit 2** — behavior of `appendConfirmation` against the local DB: confirm append carries the full snapshot, append NEVER modifies the `match_games` row (officiality preserved), exact re-tap no-op + change-of-mind new row, extra witnesses accrue without touching `match_games`, vacate marker recorded, finalized match no-op, missing confirmer no-op, and a failure is swallowed (best-effort, never throws). 9 tests.

#### Test Utilities (`/test/`)
- `setup.ts` - Test environment setup
- `utils.tsx` - Test helper utilities
- `vitest-setup.d.ts` - Vitest type definitions

---

### 📄 Pages & Routes

#### Static Pages
- `about/About.tsx` - About page
- `about/Pricing.tsx` - Pricing breakdown page
- `about/PrivacyPolicy.tsx` - Public privacy policy at `/privacy` (required by Google/Facebook OAuth review)
- `home/Home.tsx` - Landing/home page
- `dashboard/Dashboard.tsx` - Main dashboard

#### Player Pages (`/player/`)
- `MatchLineup.tsx` - Match lineup editor
- `MyMatch.tsx` - Live-match jump-in landing page (PLACEHOLDER — real detection + jump-in is a backlog item)
- `MyTeams.tsx` - Player's teams overview
- `PlayerStats.tsx` - Personal stats landing page (PLACEHOLDER — real build-out is a backlog item)
- `ScoreMatch.tsx` - Match scoring interface
- `TeamSchedule.tsx` - Team schedule view
- `SpectateLiveMatches.tsx` - League-scoped spectator view: lists currently-live matches in a league.
- `SpectateMyLiveMatches.tsx` - Spectator view scoped to the current user's teams' live matches.
- `SpectateMatchCard.tsx` - Per-match card used inside the spectate pages; routes through `UnifiedScoreboard`.

#### Operator Pages (`/operator/`)

**Dashboards & Overview**
- `OperatorDashboard.tsx` - Main operator dashboard. "Need Help?" card's "Operator Handbook" link points at `/learn`.
- `OperatorWelcome.tsx` - Welcome screen

**Learn hub** (moved to `src/pages/` in 2026-05-29 rename — visible to all signed-in users, not just operators):
- `src/pages/Learn.tsx` — Phase 1 Learn hub at `/learn`. Page shell + Glossary section. Was `src/operator/OperatorLearn.tsx` at `/operator-learn`.
- `src/pages/learn/GlossaryView.tsx` — search input + 3-state UI (single-entry on deep-link, browse on direct nav, search filtered when typing).
- `src/pages/learn/GlossaryEntry.tsx` — single entry render: canonical heading + aliases ("also called: …") + shortDef + longDef + related links.
- `src/pages/learn/__tests__/GlossaryView.test.tsx` — 6 tests covering the 3-state UI and the alias-match subtitle.

**League Management**
- `LeagueDetail.tsx` - League details page
- `LeagueRules.tsx` - League rules management
- `LeagueSettings.tsx` - General league settings page (linked from the League Settings card on `LeagueDetail`). Mounts `AllocatorPicker` card from the scoring-workshop room (Unit 7).
- `LeaguePlayoffSettings.tsx` - League-scoped playoff configuration page.

**Scoring System Workshop (`/operator/scoring-workshop/`)**

The workshop building. One sub-folder per module room. Each room owns a list page + editor + data hook + save-time guard, with optional league-side pickers. First room shipped 2026-06-04.

- `per-game-allocator/AllocatorRoomPage.tsx` - **Per-Game Allocator Room** page container. Mounted at `/operator/scoring-workshop/per-game-allocator` (lazy-loaded, withOperator-gated). List ↔ editor mode switching.
- `per-game-allocator/AllocatorList.tsx` - Two-section list: read-only "Templates" (officials) + editable "Yours" (user-scope rows). Clone / Edit / Delete actions.
- `per-game-allocator/AllocatorEditor.tsx` - Editor: name + description + two `SideEditor` blocks + save-time guard.
- `per-game-allocator/SideEditor.tsx` - Reusable side component. Four peer kinds: Fixed number / **State-bag value (R11 first-class)** / Scorer-input range / Formula recipe. Switching kinds resets irrelevant SideConfig fields.
- `per-game-allocator/useAllocatorRoom.ts` - Data hook: list officials + user's own, clone, upsert, delete against `per_game_allocators`. App-layer visibility (RLS is the eventual real protection).
- `per-game-allocator/saveTimeGuard.ts` - First of four guard layers between save and runtime. Runs `validatePerGameAllocator` + synthetic 5-game dry-run through `evaluatePointsSystem`. Refuses to save on validator rejection / dry-run throw / non-finite totals.
- `per-game-allocator/AllocatorPicker.tsx` - League-side picker (Unit 7). Mounted on `LeagueSettings`. Lists officials + user's variations + "Use prepackaged default" (NULL). On select runs `applyTimePreview`; on Apply upserts `preferences.per_game_allocator_id` for the league.
- `per-game-allocator/applyTimePreview.ts` - Pure helper. Validates the variation (Unit 3 args-shape), builds the league's prepackaged composition, swaps the slot, runs `evaluatePointsSystem` over a synthetic 5-game match with reasonable default prefs. Returns `{ok, warnings}` or `{ok:false, reason}`.
- `per-game-allocator/__tests__/saveTimeGuard.test.ts` - 7 tests covering happy paths (fixed/fixed, fixed/range, 17-point formula, read_state_var) + Unit 3 rejection cases (unregistered op, missing required arg, type mismatch).
- `per-game-allocator/__tests__/applyTimePreview.test.ts` - 7 tests covering clean preview for fixed/formula variations against 10-Point + Percent 5-Man compositions, unknown calculator rejection, structural-failure blocks Apply.
- `per-game-allocator/FormulaBuilder.tsx` - Thin perspective-aware wrapper around the shared `_shared/ExpressionBuilder` (resolves Winner/Loser labels).
- `_shared/ExpressionBuilder.tsx` - **Perspective-free expression builder widget** shared by the allocator's `FormulaBuilder` and the trigger workshop's `ActionBuilder`. Owns the cursor + token model.
- `trigger/TriggerRoomPage.tsx` - **Trigger workshop** page container (`/operator/scoring-workshop/trigger`). Second standalone module workshop. List ↔ editor.
- `trigger/TriggerList.tsx` - Yours + Templates sections (clone / edit / delete).
- `trigger/TriggerEditor.tsx` - name + description + TYPE + `ConditionBuilder` + `ActionBuilder` + RE-ARM + save-time guard.
- `trigger/ConditionBuilder.tsx` - Always | Compare condition editor (plain-English comparators, state-bag operands).
- `trigger/ActionBuilder.tsx` - Target picker (home_points / away_points) + value (fixed number OR expression via the bare `ExpressionBuilder`).
- `trigger/availableData.ts` - Universal-only state-bag registry for triggers + `TRIGGER_WRITE_TARGETS` whitelist + `triggerLabelForVar`.
- `trigger/useTriggerRoom.ts` - Data hook (list officials + own, clone, upsert, remove) against `triggers`; synthesizes default fire-order on load.
- `trigger/saveTimeGuard.ts` - `validateTrigger` (with write-target whitelist) + synthetic dry-run through `evaluatePointsSystem` before save.
- `trigger/__tests__/availableData.test.ts` - 11 tests: universal-only registry + write whitelist.
- `trigger/__tests__/saveTimeGuard.test.ts` - 9 tests: accepts the four seeded official patterns; rejects empty name / out-of-whitelist target.

**Playoffs**
- `PlayoffSetup.tsx` - Playoff setup page (mounts the bracket + settings cards).
- `PlayoffsSetupWizard.tsx` - Entry-point for the playoff setup wizard flow.
- `OrganizationPlayoffSettings.tsx` - Org-default playoff settings page.

**Player Management**
- `PlayerManagement.tsx` - Operator player-management page (search, edit, merge placeholders).

**Components (`/operator/components/`)**
- `AttachPlaceholderDialog.tsx` - Dialog to attach an existing placeholder to a team.
- `OrgPlaceholdersCard.tsx` - Card listing org-owned placeholder players (merge / archive / remove); orchestration only.
- `orgPlaceholders.ts` - Shared `OrgPlaceholderRow` type + `fetchOrgPlaceholders` RPC helper for the placeholders surface.
- `PlaceholderRow.tsx` - One active placeholder row (compact header + expand to detail + Attach/Remove). Extracted from OrgPlaceholdersCard.
- `ArchivedRow.tsx` - One archived placeholder row (compact + Restore). Extracted from OrgPlaceholdersCard.
- `RemovePlaceholderDialog.tsx` - Confirmation dialog before removing a placeholder.
- `UnmergePlayerDialog.tsx` - Undo-merge dialog (restores a placeholder from the merge snapshot).

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
- `VenueLimitModal.tsx` - Venue table-limits modal (chrome only; logic in useVenueTableLimits)
- `useVenueTableLimits.ts` - Hook holding the venue table-limits state machine (enabled sizes, blocked tables, fill order, capacity, save). Extracted from VenueLimitModal.

**Administration**
- `OrganizationSettings.tsx` - Organization settings
- `ReportsManagement.tsx` - User reports management

**State Management**
- `wizardReducer.ts` - Wizard state reducer

#### Standalone Pages (`/pages/`)
- `AdminReports.tsx` - Admin reports dashboard
- `Messages.tsx` - Messaging page — also mounts the Unit 9 `ProfanityOnboardingModal` on first open (gated by NULL `profanity_onboarding_completed_at`).
- `PlayerProfile.tsx` - Player profile page
- `Standings.tsx` - Standings page (team rankings + win/loss/points/games).
- `TopShooters.tsx` - Top shooters page (per-player aggregated stats).
- `TeamStats.tsx` - Team stats page (per-team aggregated stats).
- `FeatsOfExcellence.tsx` - Feats-of-excellence page (break-and-run, special achievements).
- `MatchDataViewer.tsx` - Raw match-data viewer (developer / advanced view).
- `HandicapLookupTest.tsx` - Dev/test page for exercising the handicap lookup engine.

#### Auth Pages (`/login/`)
- `Login.tsx` - Login page
- `Register.tsx` - Registration page
- `ClaimPlayer.tsx` - Claim placeholder player for existing authenticated users (orchestration + the interactive screen)
- `ClaimStatusScreen.tsx` - The terminal status screens of the claim flow (loading/invalid/expired/claimed/success/rejected/error). Extracted from ClaimPlayer.
- `claimPlayerTypes.ts` - Shared types for the claim flow (ClaimState, InviteDetails, TeamInfo, PlaceholderExtras, MergeStats).
- `ForgotPassword.tsx` - Password recovery
- `ResetPassword.tsx` - Password reset
- `EmailConfirmation.tsx` - Email confirmation
- `LoginCard.tsx` - Login card component
- `LogoutButton.tsx` - Logout button

#### Onboarding Cascade (`/onboarding/`)
*Player/captain cold-start join-by-link flow. See `docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md`.*
- `TeamJoinPage.tsx` - **Unit 3.** The public `/join/:token` page. Reads the join view and routes to the right step: invalid-link / already-approved / waiting / inline sign-in / short profile form / Join-or-claim. Sign-in is in-page (passwordless code) and the profile form returns here, so the join intent never leaves the page.
- `TeamJoinPage.test.tsx` - Routing-state-machine test (7 cases) with hooks + steps mocked.
- `components/JoinSignInStep.tsx` - **Unit 3.** Inline email-code sign-in (reuses `requestEmailCode` + `EmailCodeStep`); invalidates the join view on auth so the page advances. "More options" → `/login?redirect=/join/:token`.
- `components/JoinSubmitStep.tsx` - **Unit 3.** Signed-in member's "ask to join" step. The generic team link carries no identity, so there's **no name-picker** — the joiner just asks to join as himself and the captain makes the match at the gate (see `JoinRequestCard`). Always self-adds (no claimed_member_id); maps guard reasons (full / already_member) to inline copy.
- `components/JoinStatusCard.tsx` - **Unit 3.** Presentational centered status card reused by every join state.
- `components/JoinRequestList.tsx` - **Unit 5.** The approve surface (one component, two scopes): owns the approve mutation + a short lead-in, and renders each request as a `JoinRequestCard`. Mounted in MyTeams (captain) + OperatorDashboard (LO); renders nothing when empty.
- `components/JoinRequestCard.tsx` - **Unit 5 + Approve-surface richer cards.** A scannable collapsed summary — "{name} accepted the invite", team · league, and a "Captain spot still open" chip when `captain_is_placeholder` — that expands to the team's FULL roster via `useTeamRosterForApprover`: claimable placeholder spots as tap-to-connect targets (captain flagged + first; tap → confirm → merge/replace, "Make captain" copy for the captain spot), registered members as non-tappable "Already on the team" context. No open spot → single "Add to the team". **Footgun guard:** when the team has any open spot the incomer might fill (placeholder OR still-placeholder captain), "just add as new" is a deliberate confirmed action; the guard keys off the feed flags so a failed roster fetch can't silently re-open it. Decline always confirms. Roster fetched per-card, only on expand.
- `components/JoinRequestList.test.tsx` - Approve-surface flow (8 cases): guided card, inline merge confirm (record vs no-record copy), just-add fallback, decline. Requests/approve/placeholder hooks mocked.
- `landingTeam.ts` + `landingTeam.test.ts` - **Unit 8.** `defaultOpenTeamId(teamIds)` — pure helper deciding which team accordion to auto-expand on MyTeams (single team → open it so its existing Quick Score card is front-and-center; several → leave collapsed). Reuse, not rebuild: no parallel match hook, no MyMatch.
- `InviteMyTeamButton.tsx` - **Unit 7.** Captain's "Invite my team": shares the /join/:token link via ShareLinkSection (now also passing a ready-to-send `shareMessage` naming the captain), a "generate new link" rotate affordance, a dismissible first-run tip (localStorage), and a `?` InfoButton (`InviteHelpContent`). Mounted per captained team in MyTeams.
- `InviteHelpContent.tsx` - Condensed, hand-holdy in-app captain invite help rendered inside the "Invite my team" InfoButton popup (copy message → paste → send → wait for the notice). Long-form version lives in `docs/guides/captain-onboarding-guide.md`.
- `OnboardCaptainsList.tsx` - LO's "onboard my captains" — **league-scoped, temporary, self-clearing.** One row per team in the league whose captain is **not yet registered** (team · captain · Copy link), pre-paired. Mounted on `LeagueDetail` (next to TeamsCard); renders nothing once every captain has registered. Re-scoped from org→league + placeholder-only filter on 2026-06-06 (was on OperatorDashboard).
- `OnboardCaptainsList.test.tsx` - 4 tests: renders nothing while loading + when self-cleared (empty); one row per captain with team + captain name; Copy link writes `/join/:token` and flips that row to "Copied!".

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

#### Handicap Calculator (`/handicapCalculator/`) — **dev/staging only**

Standalone explainer at `/tools/calc`. Estimates Fargo-style team handicap for a 5v5 / 25-game match. Entry point is a small "LMS Calc" link at the bottom of the Profile page (dev/staging only). Self-contained — to remove the feature entirely: delete the `/handicapCalculator/` folder and remove the marked blocks (grep for `Handicap Calculator`) in `navigation/NavRoutes.tsx` and `profile/Profile.tsx`.

- `HandicapCalculator.tsx` - The page: 10 rating inputs + result card
- `fargoHandicap.ts` - Educational handicap-spot approximation (gap / 65, capped)
- `NonProdGate.tsx` - Local route gate; redirects to `/` in production
- `index.ts` - Public surface (page + gate re-exports)

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

#### Layout Components (`/components/layout/`) — **Navigation IA overhaul (PR #124)**

Shared chrome that wraps all authenticated routes. `MemberLayout` is mounted by `NavRoutes.tsx` as a parent route; child routes render into its `<Outlet/>`.

- `MemberLayout.tsx` - Persistent layout shell. Desktop: left sidebar (`<AppSidebar>`). Mobile: bottom tab bar (`<BottomTabBar>`). Also hosts global features previously on the Dashboard (e.g., pending-invites modal). Pages still own their own `<PageHeader>`.
- `AppSidebar.tsx` - Desktop persistent sidebar — brand, primary nav, theme toggle, drawer trigger. Auth-aware: minimal chrome for public visitors, full nav for logged-in users. Renders the shared **`MyMatchPanel`** at the top (mirrors the drawer's Live/Makeup chips + lists), replacing the old static `/my-match` link.
- `AppSidebar.test.tsx` - Tests that the sidebar wires in the My Match panel (chips + matchup, chip switching, hidden-when-empty).
- `MyMatchPanel.tsx` - **✅ Shared My Match panel** used by BOTH the drawer and the desktop sidebar (so they can't drift). Live/Makeup filter chips (icons on phones, text on `sm+`), radio-select with a 0-count chip dimmed/disabled; revealed list under a small heading; rows lead with date + matchup that wraps instead of truncating. `inSheet` wraps rows in `SheetClose` for the drawer.
- `BottomTabBar.tsx` - Mobile fixed bottom tab bar (My Teams / My Match / Messages / Profile, + Manage for operators). Auth-aware like the sidebar. Generic tabs render via a local `TabLink`; the My Match slot renders `<MyMatchTab>`.
- `MyMatchTab.tsx` - **✅ My Match tab (Unit 3)** — state-driven bottom-nav tab consuming `useMyMatchSurfaces`. Links to the player's current match (Tiers 1–3, accent live dot on Tier 1); dims + toasts as a non-navigating button on Tier 4 / error; neutral silent no-op while hydrating.
- `MyMatchTab.test.tsx` - Tests for the My Match tab's five postures (live/today/makeup Link, Tier-4 toast, hydrating no-op, error toast).
- `AppDrawer.tsx` - Slide-in drawer with secondary nav (profile, settings, operator-org switcher, sign-out) + the shared **`MyMatchPanel`** pinned at the TOP (`inSheet`). Drawer is the home for nav items that don't fit on the sidebar/tab bar.
- `AppDrawer.test.tsx` - Tests for the drawer's per-org operator shortcuts and auth-gated content.
- `OperatorOrgRow.tsx` - Drawer row showing one of the user's operator orgs with quick-jump links to the dashboard. Used inside `<AppDrawer>` when the member is a league operator.

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
- `DuplicateNicknameWarning.tsx` - Inline warning when two roster players share a nickname (impacts scoring identification).
- `FargoStartPointsCard.tsx` - Card surface for the Fargo start-points negotiation (per-team, captain-confirmable).
- `HandicapCell.tsx` - Compact cell rendering a player's handicap + chart-derived bonus.
- `HandicapSummary.tsx` - Per-team handicap-summary block (totals, bonus distribution).
- `OpponentSubstituteModal.tsx` - Modal opened when the opposing team wants to substitute a player; supports accept/reject flow.
- `PlayerSelectionRow.tsx` - One row in the player picker grid (selectable, shows handicap + warnings).
- `PrepStatusBanner.tsx` - Banner reflecting `prep_match` RPC status (ready / blocked / waiting on opponent).
- `SubResolutionBanner.tsx` - Banner shown while a substitute resolution is pending captain confirmation.
- `SubstituteInfo.tsx` - Inline info chip showing why a slot is a substitute (no roster spot, missed practice, etc.).

#### Scoring Components (`/components/scoring/`)
- `UnifiedScoreboard.tsx` - **Single live-match scoreboard for all configs** (replaces former ThreeVThree / FiveVFive / TenSeven). Reads match-row source-of-truth, schema-derived display hints, calculator-driven per-player points column, R22 Fargo start-points display.
- `TiebreakerScoreboard.tsx` - Best-of-3 tiebreaker score panel (separate component; team-name labels per R18)
- `MatchEndVerification.tsx` - End-of-match dual-team verify-and-confirm flow (mode-aware internally)
- `GamesList.tsx` - Games list. Column ordering (`displayMode` + `onToggleDisplayMode`) is now a **controlled prop** lifted to ScoreMatch (via `useGameDisplayMode`) so the in-list header bar and the settings gear stay in sync; the header bar still toggles it on click.
- `ScoringSettingsMenu.tsx` - **Scoring participation modes / Unit D.** Gear-icon `Popover` in the scoring header (replaced the cramped inline Auto-Confirm checkbox). Houses Auto-Confirm, I'm-Not-Scoring, and the Break/Rack ⇄ Home/Away game-order toggle, each with an `InfoButton`. Presentational only — state/persistence live in the hooks behind its props.
- `GameButtonRow.tsx` - Game row with breaker vs racker buttons (extracted from ScoreMatch)
- `ScoringDialog.tsx` - Game winner selection with B&R and Golden Break (extracted from ScoreMatch)
- `ConfirmationDialog.tsx` - Opponent score confirmation and vacate requests (extracted from ScoreMatch). Has a neutral **Cancel** dismiss (also the X / Escape) that neither confirms nor denies — "not sure / didn't witness"; the caller suppresses re-prompting that game for the session. Outside-click stays prevented so a stray backdrop tap can't dismiss.
- `ConfirmationModal.tsx` - Modal variant of the confirmation dialog (used in different layouts).
- `EditGameDialog.tsx` - Vacate winner request dialog (extracted from ScoreMatch)
- `LineupChangeModal.tsx` - In-scoring lineup substitution modal (captain-driven mid-match swap).
- `LineupChangeRequestModal.tsx` - Opposing-team lineup-change request modal (must be accepted by the other captain).
- `ManualTiebreakerDialog.tsx` - Manual tiebreaker entry dialog for cases where the auto-tiebreaker can't determine a winner.
- `VacateModal.tsx` - Vacate-game confirmation modal (clears a recorded result, used when a game was entered wrong).
- `DissentFlag.tsx` - **Many-eyes Layer-2 / Unit 5 (restructured 2026-05-26 per Ed's design).** Inline notice (shadcn `Alert` `warning` variant — visual style pending Ed's manual test review) shown when a confirmation row's snapshot differs from current `match_games`. Title: "Game N — Conflict!"; body shows the recorded result (winner/extras/points), then "N agree" + "X disagree" lines, then a verify-and-vacate CTA. Live-trigger note: no code path in Phase 2 produces a divergent confirmation row — the flag is plumbing for Phase 3's tap-to-peek + record-different mode. Copy in constants at top for iteration.
- `DisputeBanner.tsx` - **Many-eyes Layer-2 / Amendment F.** Persistent dispute banner (shadcn `Alert` `destructive` variant) shown to EVERY device when one or more games are in the auto-cleared "two initiators disagreed" state. Renders nothing when there are no disputes (no residual chrome). Each disputed game row is inert text (Amendment F alone) or a tappable button (when Amendment G's `onDisputeClick` is wired to open the detail modal). Copy in constants at top for iteration.
- `DisputeDetailModal.tsx` - **Many-eyes Layer-2 / Amendment G.** Shadcn `Dialog` opened from the dispute-banner row click. Shows the conflicting initiator entries side-by-side with confirmer name + side + winner + extras + points. Informational only — close via X/ESC/outside-click; re-scoring goes through the normal player-tap flow in the games list (per the brainstorm's "Re-score should just be a re-score, nothing special"). Copy in constants at top.
- `PeekConfirmDialog.tsx` - **Many-eyes Layer-2 / Unit 6.** Shadcn `Dialog` opened when a viewer taps a fully-confirmed game row in `GamesList`. Shows the recorded result (winner + achievements + points) + Confirm button (adds my vouch as an extra witness via `confirmOpponentScore`, which Amendment I's 3-step check gates safely). Confirm button hides + "already vouched" note shown when the viewer's `is_initiator=false` row is already in the log. Close paths: shadcn X icon / ESC / outside-click (no redundant footer button).
- `TableNumberBar.tsx` - Compact bar showing the venue table number assigned to this match.
- `AdaptiveCounter.tsx` - Tap-target counter optimized for thumb input on mobile scoring.
- `scoreboardColors.ts` - Single source of truth for team colors (home: blue, away: orange)
- `__tests__/UnifiedScoreboard.test.tsx` - Unit tests for the unified scoreboard (preset paths).
- `__tests__/UnifiedScoreboard.offPreset.test.tsx` - Tests covering off-preset combos (different lineup / scoring calculator combos).
- `__tests__/TiebreakerScoreboard.test.tsx` - Tests for the best-of-3 tiebreaker panel.
- `__tests__/AdaptiveCounter.test.tsx` - Tests for the adaptive counter component.

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
- `CreateTeamChatPrompt.tsx` - **Phase 1 / Unit 5** — banner shown to captains whose teams are missing an auto-managed team chat (e.g., team created before the trigger landed); offers one-tap creation via `useCaptainTeamsMissingChat`.
- `ReadOnlyBanner.tsx` - **Phase 1 / Unit 6** — banner rendered at the top of a conversation when the viewer is a past member or non-staff in an announcement chat. Replaces the composer with a read-only explanation.
- `__tests__/ConversationList.profanity.test.tsx` - RTL test ensuring the conversation list applies the profanity filter to preview snippets per the viewer's `profanity_filter_enabled`.
- `__tests__/CreateTeamChatPrompt.test.tsx` - RTL test for the create-team-chat banner (visibility predicate, click → mutation, post-success dismissal).
- `__tests__/MessageBubble.system-message.test.tsx` - RTL test for the centered/italic system-message variant of `MessageBubble`.
- `__tests__/ReadOnlyBanner.test.tsx` - RTL test for the Unit 6 read-only banner (announcement-non-staff + past-member triggers).
- `messageview/__tests__/MessageList.outgoing.test.tsx` - RTL test exercising the inline failed-send rendering inside `MessageList` (Unit 8).
- `messageview/__tests__/useOutgoingMessages.test.ts` - Unit test for the optimistic-outgoing-messages state hook (Unit 8).

###### Announcement composer (`/components/messages/announcements/`)
Subtree behind the **announcement modal** — operator/captain-only broadcast composer.
- `AnnouncementTextInput.tsx` - Text input with length counter for the announcement body.
- `TargetSelector.tsx` - Picker for which scope(s) the announcement targets (league / season / team / org).
- `SelectedTargetChips.tsx` - Chip strip showing the currently-selected targets with remove buttons.
- `useAnnouncementTargets.ts` - Hook that loads the targetable scopes for the current sender + maintains the selection state.

###### New-message composer (`/components/messages/newmessage/`)
Subtree behind the **new direct/group message modal**.
- `UserSearchInput.tsx` - Debounced user-search input — drives the member picker.
- `MemberList.tsx` - Selectable list of matched members; supports single (direct) or multi (group) selection.
- `GroupNameInput.tsx` - Group-name input shown when ≥2 members are selected (creates a named group chat).
- `useFilteredMembers.ts` - Hook that filters the member pool by the search query + excludes already-selected members.

###### Message settings panel (`/components/messages/settings/`)
Subtree behind the **message settings modal** — per-user messaging preferences.
- `ProfanityFilterSection.tsx` - Toggle for the per-viewer profanity filter (forced ON for known minors per `useProfanityFilter`).
- `PrivacySafetyActions.tsx` - Block-user / unblock-user actions and link to the blocked-users modal.
- `StatusAlert.tsx` - Inline alert banner showing the result of the most recent setting change.

#### Onboarding Components (`/components/onboarding/`)
- `ProfanityOnboardingModal.tsx` - **Messaging Phase 1 / Unit 9** — shadcn `Dialog` shown once, the first time a member opens the Messages page (gated by a NULL `members.profanity_onboarding_completed_at`). One-time, defaulted-ON framing: copy explains the filter is on by default and changeable in Settings, then asks if they'd like to turn it off. Two buttons ("Turn filter off" → enabled=false, "Keep filter on" → enabled=true); dismissing (Escape / backdrop / X) is treated as "keep on" (enabled=true). Every exit path writes `completed=now()` so it never reappears. Calls `useMarkProfanityOnboardingComplete`; `onResolved` fires only on a successful write (a rejected mutation leaves the modal open for retry).
- `__tests__/ProfanityOnboardingModal.test.tsx` - **Messaging Phase 1 / Unit 9** — RTL test: copy + two buttons render, "Keep filter on" persists `filterEnabled=true`, "Turn filter off" persists `false`, Escape defaults to `true`, `onResolved` fires once per success, rejected mutation does NOT resolve (retry works), choice-then-dismiss only resolves once. 7 cases.

#### Operator Components (`/components/operator/`)
- `ActiveLeagues.tsx` - Active leagues overview (uses LeagueStatusCard)
- `AuthorizeNewPlayersCard.tsx` - Org-level toggle: whether new player applications need LO approval before joining.
- `BlackoutDatesCard.tsx` - Org-level blackout dates editor (holidays, no-play dates inherited by season scheduling).
- `ContactInfoCard.tsx` - Organization contact info editor (email/phone with visibility)
- `ContentModerationCard.tsx` - Org-level content-moderation settings card (wraps `ContentModerationSection` in preferences/).
- `DashboardCard.tsx` - Dashboard card wrapper
- `MatchupsCard.tsx` - The **Matchups** part of a league (header-only `SectionCard`). Subtitle "Set" / "Not set yet" / "Create a season first"; button launches the create-league wizard's matchups stage (the only place matchups are set/edited today). Follow-up in LIST_FOR_ED #36: give matchups its own edit surface for unfinished matches.
- `SectionCard.tsx` - **Shared league-detail section shell** (built on shadcn Card). `SectionCard` (title + subtitle + right-aligned actions, optional `collapsible`/`defaultOpen`, trimmed padding) + `SectionCardLoading` / `SectionCardEmpty`. Teams / Schedule / Season / Stats all use it so the cards look + behave identically.
- `SeasonCard.tsx` - The **Season** part of a league (was `LeagueOverviewCard`). Collapsed: "Season · *name* · *status*"; expand for dates/format/team+week counts + **Next holiday** (blackout weeks are a season concept; moved here from the Schedule card). Actions: Manage Season + Delete Season (incomplete only), or Create Season when none exists. Setup-flow buttons (Create Schedule / Add Teams / Set Matchups) + the old inline-styled wizard button were dropped — setup is driven by the Status card's Next Steps + the ActionCard. Grouped with Teams + Schedule on the league page.
- `LeagueProgressBar.tsx` - League progress bar component (used by LeagueStatusCard)
- `LeagueStatusCard.tsx` - **UNIFIED league status component** - Single source of truth for league/season status, progress, and next actions (used on both Dashboard and League Detail pages). Setup progress + Next Steps render only during setup; activation counted as the 5th stage so the bar and checklist agree (no "100% while a step is open"); current step highlighted "← do this next".
- `leagueSetupProgress.ts` - Pure five-stage setup-progress derivation (season/schedule/teams/matchups/activate) extracted from LeagueStatusCard for unit testing — `deriveSetupProgress(state)` → `{ stepsDone, firstIncompleteIndex, percent, allComplete }`.
- `leagueSetupProgress.test.ts` - 5 tests: 0% / 20% / 80%-not-activated / 100%-activated, and first-gap-is-current for out-of-order data.
- `OrganizationBasicInfoCard.tsx` - Organization name and mailing address editor
- `OrganizationPreferencesCard.tsx` - Organization-level preferences editor (handicap, format, rules defaults)
- `OrganizationStaffCard.tsx` - Staff roster editor — invite/remove additional league operators within the org.
- `PaymentMethodCard.tsx` - Payment method card (Stripe integration placeholder)
- `PendingInvitesList.tsx` - Pending placeholder-player invites list (operator view of invites waiting on acceptance).
- `PlayoffsCard.tsx` - Playoffs entry-point card on the league page (on `SectionCard`, collapsed). Subtitle = status (Bracket created / Ready to set up / No playoff week scheduled / Create a season first); expand for template + playoff-week + regular-season/match status. Action: Setup Playoffs (solid) / View Bracket (outline) → playoff config page.
- `PreferencesCard.tsx` - **Unified preferences card** — composes the five section components from `preferences/`. Used for both org-level and league-level preferences editing.
- `QuickStats.tsx` - Quick statistics (legacy; see also `QuickStatsCard.tsx`).
- `QuickStatsCard.tsx` - Dashboard quick-stats card (active leagues, active seasons, member count).
- `ScheduleCard.tsx` - The **Schedule** part of a league (on `SectionCard`, collapsed). Subtitle "N/M weeks played"; expand for Upcoming Weeks. Actions: Create Schedule / View Schedule. (Score a Match moved to the Stats card; Started/Playoffs summary + Next Holiday dropped — Next Holiday lives on the Season card now.)
- `SeasonStatusCard.tsx` - Season status
- `SeasonsCard.tsx` - Seasons list card
- `StatsCard.tsx` - **Scoring** card on the league page (on `SectionCard`; title "Scoring"). Two slim icon-left buttons: **Standings** (team + player stats) and **Score a Match** (the manual score / verify / edit workflow, production-visible). Replaced the old read-only "Match Data" debug viewer link (the `MatchDataViewer` page/route still exist for dev, just unlinked here).
- `TableBadgePopover.tsx` - Popover badge showing per-venue table configuration summary (count, table numbers).
- `TableConfigureModal.tsx` - Modal for editing a venue's table configuration (count, numbers, types).
- `TeamsCard.tsx` - The **Teams** part of a league (on `SectionCard`, collapsed). Subtitle "N teams"; expand for the roster table (captain + venue, click a row for contact details). Action: Manage Teams.
- `VenueCard.tsx` - Venue card
- `VenueCreationModal.tsx` - Venue creation modal
- `VenueTableInputs.tsx` - Reusable table-config inputs (used by venue creation/edit flows).
- `VenueTableSummaryCard.tsx` - Read-only table-config summary card for a venue.

##### Preferences Sections (`/components/operator/preferences/`)

Reusable section components composed by `PreferencesCard.tsx`. Same components drive both organization-level and league-level preference editing.

- `HandicapSettingsSection.tsx` - Handicap type + downstream modular axes (rating, scoring calculator, threshold strategy).
- `RosterSettingsSection.tsx` - Lineup size, roster max, sub rules.
- `MatchRulesSection.tsx` - Match-level rules (games-to-win, race lengths, tiebreaker behavior).
- `PlayerAuthorizationSection.tsx` - Toggle for whether new player applications require LO approval.
- `ContentModerationSection.tsx` - Profanity filter + content-moderation defaults (drives the messaging Phase 1 profanity onboarding flow).
- `index.ts` - Barrel exports for the five sections.

#### Playoff Components (`/components/playoff/`)
- `ParticipationSettingsCard.tsx` - Playoff participation/qualification settings with collapsible edit controls
- `PlayoffWeeksCard.tsx` - Playoff weeks selector with add weeks modal and payment method options
- `WildcardSettingsCard.tsx` - Wildcard spots configuration for random selection from non-qualifying teams
- `ExampleTeamCountCard.tsx` - Card showing example bracket sizes given the current team count + qualification rules.
- `PlayoffBracketCard.tsx` - Renders the playoff bracket (single/double elimination layouts).
- `PlayoffBracketPreviewCard.tsx` - Read-only preview of the bracket pre-finalization (used in the setup flow).
- `PlayoffMatchRulesCard.tsx` - Playoff-specific match-rule overrides (race lengths, tiebreakers).
- `PlayoffMatchupCard.tsx` - Single-matchup card within the bracket display.
- `PlayoffSeedingCard.tsx` - Seed-order editor (drag-to-reorder or manual entry).
- `PlayoffSettingsCard.tsx` - Top-level playoff settings card (format, weeks, payment, etc.).
- `PlayoffStandingsTable.tsx` - Standings projected into playoff seeding context.
- `PlayoffTemplateSelector.tsx` - Picks a bracket template (4-team / 6-team / 8-team / etc.).

#### Match Components (`/components/match/`)
- `MatchPhaseGuard.tsx` - Server-state route guard. Reads `matches.status` via `useMatchPhase`, dispatches lineup vs scoring vs recovery rendering, holds the compound `key={matchId:recoveryEpoch}` that drives in-place subtree remounts on Hard Reset.
- `MatchTransitionRecovery.tsx` - Unified recovery surface for the lineup → scoring transition. Reason-aware copy (connection / match_not_found / auth_expired / server_error / unknown_status), two-level Try Again (soft refetch first, Hard Reset only after soft fails — with confirmation dialog).
- `ConnectionIndicator.tsx` - Calm connection indicator for the active scorer. Renders nothing while live, a quiet "Catching up…" pill while degraded, and a single calm note only after a sustained offline outage (north star: invisible robustness).
- `ConnectionIndicator.test.tsx` - Tests for ConnectionIndicator (live=nothing, degraded=quiet pill, sustained-offline=calm note + threshold).

#### Player Components (`/components/player/`)
- `TeamCard.tsx` - Player team card ⚠️ **DUPLICATE** (also in `/components`)

#### Modal Components (`/components/modals/`)
- `DayOfWeekWarningModal.tsx` - Day of week warning
- `DeleteLeagueModal.tsx` - League deletion confirmation
- `DeleteSeasonModal.tsx` - Season deletion confirmation
- `PendingInvitesModal.tsx` - Modal showing pending placeholder player invites to users after login
- `ApprovedJoinModal.tsx` - **Onboarding cascade (Unit 3 notify)** — "you're on the team!" popup mounted app-wide in MemberLayout; tells a joiner the moment they're approved (even if they closed the tab) and routes to their team, stamping acknowledged so it shows once.
- `SecurityDisclaimerModal.tsx` - Security disclaimer
- `SetupGuideModal.tsx` - Setup guide
- `WeekOffReasonModal.tsx` - Week off reason — prompts for a custom week-off label; takes an optional `initialReason` to pre-fill the holiday/championship name when the week already has a conflict flag (re-seeded each open; operator can override). Tested in `WeekOffReasonModal.test.tsx`.

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
- `InstallAppCard.tsx` - **Install the app** — platform-adaptive PWA install entry: Android/desktop fire the native install prompt; iPhone (Safari) + Android-without-a-captured-prompt open a step-by-step add-to-home-screen instructions modal. Renders nothing when already installed or unsupported. Self-contained (drop-in); used at the top of Player Settings. Tested in `InstallAppCard.test.tsx`.
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
- *(`useMatchLineup.ts` was extracted into the dedicated `/hooks/lineup/` subtree — see Lineup Hooks below.)*
- `useMatchScoring.ts` - Match scoring state (data fetching)
- `useMatchScoringMutations.ts` - Match scoring mutations (database operations). **Many-eyes Layer-2:** each vouch path (`handleConfirmScore`, `confirmOpponentScore`) now also appends a `confirm` row, and the wipe paths (`confirmOpponentScore` accept-vacate, `denyOpponentScore` deny-score) append a `vacate` marker, via `api/mutations/appendConfirmation.ts` — officiality writes stay first/authoritative. **Amendment D:** `handleConfirmScore` re-reads the match_games row before writing; if another initiator already wrote a winner during the modal grace period, it compares results via `resultsDiffer` — agreement → just append the new initiator row alongside (strongest confirmation); disagreement → auto-clear the game's winner fields + append both initiator row and vacate marker + toast the user to re-enter. **Amendment E:** `denyOpponentScore` counts distinct endorsers (post-latest-vacate confirm rows) before wiping; ≤2 (the standard officiality pair) wipes as before; >2 (extras endorsed) skips the wipe, records a vacate marker, and toasts the denier — the dissent flag surfaces it; vacate-and-rescore remains the deliberate correction path. **Amendment I:** `confirmOpponentScore` non-vacate branch reads the fresh match_games row before writing and runs a 3-step check (opponent's column set, my column null, modal snapshot still matches current official). Only writes the officiality column when all three pass; ALWAYS appends the vouch row regardless. Toasts the user when the state diverged so they know their tap landed but didn't lock officiality (Sally's stale-modal-after-auto-clear scenario + any future state-divergence case). **Unit 7 (Phase 3):** all three mutations (`handleConfirmScore`, `confirmOpponentScore`, `denyOpponentScore`) now read `matches.status` at entry and bail with a toast when `'completed'` — belt-and-suspenders behind `MatchEndVerification`'s nav-off so a sub-second race between finalization and page navigation can't mutate `match_games` on a finalized match.
- `api/mutations/appendConfirmation.ts` - **Many-eyes Layer-2 / Unit 2 + Amendment B.** The single best-effort "record a vouch" path: appends to `game_confirmations` (confirm or vacate marker), never touches `match_games` officiality, never throws into scoring; append-only (exact re-tap = no-op, change of mind = new row), no-op when match finalized or no confirmer. **Amendment B:** `isInitiator: boolean` is a REQUIRED param — `handleConfirmScore` passes `true` (filled the details from scratch), `confirmOpponentScore` + vacate paths pass `false`. The no-exact-dup guard ignores `is_initiator` (same data + same person = same vouch, even if role label differs). **Scoring participation modes / Unit A:** optional `autoConfirmed` param (default false) recorded on the row — `confirmOpponentScore` passes `true` from the two auto-confirm call sites (scan + handlePlayerClick auto-branch), false elsewhere; integrity metric only.
- `useScoringParticipationModes.ts` - **Scoring participation modes / Unit C.** Owns the two opt-in scoring modes with consequence-scaled persistence: **Auto-Confirm** (sessionStorage keyed by match — survives a refresh but clears on leaving the page, via a deferred clear-on-unmount that cancels on remount so StrictMode's dev double-fire doesn't wipe it) and **I'm-Not-Scoring** (localStorage keyed by match — lasts the whole match). The two are mutually exclusive (each setter turns the other off).
- `useGameDisplayMode.ts` - **Scoring participation modes / Unit D.** Owns the games-list column ordering (`break-rack` | `home-away`), lifted out of `GamesList` so the list's header bar AND the settings gear both drive it in sync. localStorage, global + forever (a pure display preference — least-consequential setting persists longest).
- `__tests__/useScoringParticipationModes.test.ts` - **Participation-modes hook tests** (8 cases) — mutual exclusion, match-keyed persistence for both modes (survives a fresh-mount "refresh"), Auto-Confirm clears on a real unmount (off-on-leave) while I'm-Not-Scoring does not, and the StrictMode unmount→remount cancels the deferred clear. Fake timers drive the deferred-clear macrotask.
- `useRosterEditor.ts` - Roster editing
- `useSpectateMatch.ts` - Hook used by the spectator views to subscribe to a live match.

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

#### Lineup Hooks (`/hooks/lineup/`)

Lineup-page workhorse hooks. Extracted from the monolithic `useMatchLineup` so each one has a single responsibility and can be tested independently.

- `useLineupState.ts` - Owns the in-flight lineup form state (slots, substitute flags) before persistence.
- `useLineupPersistence.ts` - Save/load mutations for the lineup row + optimistic update wiring.
- `useLineupValidation.ts` - Pre-submit validation (roster coverage, handicap totals, duplicate nicknames).
- `useMatchPreparation.ts` - Drives the `prep_match` RPC + reads/writes the prep status banner state.
- `useOpponentStatus.ts` - Tracks the opponent's lineup state for the "waiting on opponent" UI.
- `useHandicapCalculations.ts` - Computes per-player + per-team handicap totals from the current lineup.
- `useFargoStartPointsNegotiation.ts` - Fargo start-points negotiation flow (proposal, confirm, override).
- `useTiebreakerLineup.ts` - Separate lineup state for the best-of-3 tiebreaker.
- `index.ts` - Barrel exports.

---

### 🛠️ Utilities (`/utils/`)

#### Date & Time

> **CRITICAL**: Always use `formatters.ts` for timezone-safe date handling

- `formatters.ts` - **Timezone-safe date utilities** (parseLocalDate, formatLocalDate, etc.)
- `age.ts` - **Age calculation utilities** — `calculateAge(dob)` and `isMinor(dob)` built on `parseLocalDate` so DOB strings anchor to the local calendar (avoids the UTC off-by-one-day bug). Consumed by `useProfanityFilter` for R4 under-18 enforcement; returns `null` / `false` for missing or malformed DOB.
- `__tests__/age.test.ts` - **Age util tests** (10 cases) — `calculateAge` null/malformed/whole-years/birthday-not-yet/birthday-today; `isMinor` unknown DOB → false, clear minors → true, day-before-18 → true, exact 18th birthday → false, adults → false. Uses `vi.setSystemTime` to pin "today" to 2026-05-12.
- `holidayUtils.ts` - Holiday detection and handling

#### Schedule & Matchup
- `scheduleGenerator.ts` - Schedule generation logic
- `scheduleUtils.ts` - Schedule utilities
- `scheduleReflow.ts` - Pure blackout re-flow logic (re-date play weeks around skips, no match changes)
- `scheduleReflowApply.ts` - Persists a re-flow plan to the DB (edit-page blackout add/remove)
- `scheduleToggle.ts` - Pure week-off toggle decisions (remove/add/prompt, past-or-played warn)
- `scheduleDisplayUtils.ts` - Schedule display helpers
- `matchupTables.ts` - Matchup table utilities
- `conflictDetectionUtils.ts` - Schedule conflict detection; also exports `extractHolidayName` (strips a conflict name's " (...)" timing suffix → bare label, for seeding a week-off reason). Tested in `conflictDetectionUtils.extractHolidayName.test.ts`.

#### Match Running Totals (`/utils/match/`)
- `composeMatchThresholds.ts` - **System-agnostic match threshold composer** (lineup-swap recalibration, Unit 2). Given resolved prefs + both (post-swap) lineups, returns the six `*_to_win/tie/lose` columns. Builds a SystemModule via `buildSystemFromPreferences` and dispatches on the resolved `handicapMechanism.kind` — NEVER on `handicap_type`. Extended-finish (`extra_games`) delegates to `calculateHandicapThresholds` for byte-identical parity with match prep; head-start (Fargo start-points) recomputes the weaker team's credit fresh from ratings into `*_to_tie`. Replaces the deleted `recalculateMatchThresholds` handicap-type heuristic in `matchLineups.ts`. Tested in `src/__tests__/unit/composeMatchThresholds.test.ts` (percentage/points/fargo/none parity + modularity-invariant source grep).
- `computeMatchRunningTotals.ts` - **Per-mutation running-totals calculator** (Phase 5 Unit 5.5) — pure helper that filters confirmed regular games, runs the snapshot's points calculator, and returns `{ home_games_won, away_games_won, home_points_earned, away_points_earned }`. Eager recompute on every scoring mutation keeps the match row consistent with the live scoreboard. Tiebreaker games and unconfirmed games are excluded from regular running totals.
- `auditScoringConsistency.ts` - **Match-completion scoring-consistency audit** (Phase 5 Unit 5.6) — pure `compareRunningTotals(actual, expected)` helper that returns per-field discrepancies between the match row's stored totals and a fresh recompute. Match record is never modified — divergence is logged to `app_logs` for the dev to investigate. Reusable for on-demand audits.
- `engineRunningTotals.ts` - **Strand-B engine running-totals (post-flip source of truth).** `computeEngineRunningTotals` runs the NEW modular Points System engine (`src/systems/points-system/match-adapter.ts`) on the frozen prep snapshot (snapshotted threshold columns + LOCKED `match_lineups` ratings/team-bonus) and returns the four totals the match row is written with; `runningTotalsDiffer` is the audit comparator. Never throws — returns `null` on any failure so `updateMatchRunningTotals` falls back to legacy `computeMatchRunningTotals` (which also stays on as the auditor: "two paths audit each other"). Was the shadow auditor pre-flip; the roles reversed at the flip.
- `__tests__/computeMatchRunningTotals.test.ts` - **Running-totals tests** (10 cases): confirmation filtering, tiebreaker exclusion, linear_above_threshold above/tie/below bands, LOCKED tie-band-with-tiebreaker invariant, accumulated_per_game (Fargo 10-7), null calculator, unknown calculator
- `pendingConfirmations.ts` - **Data-derived live-scoring handoff** — pure helpers that compute "which games need MY action" from the `match_games` rows: `gameNeedsMyConfirmation` (opponent scored + confirmed, I haven't), `gameHasPendingVacateForMe` (opponent requested an undo, derived from `vacate_requested_by` so the requester never self-prompts), plus `buildConfirmationItem` / `buildVacateConfirmationItem`. Run on every load/refetch/poll so the confirm + vacate prompts survive a dropped realtime event (delayed, never lost). Realtime stays the fast path. **Many-eyes Layer-2 / Unit 4 + Amendment C:** `decidePendingAction` + `gameNeedsMyConfirmation` accept an optional `PersonalConfirmContext` (built once per render by `buildPersonalConfirmContext` from `game_confirmations` + `memberId`) so the prompt fires per-PERSON, not per-side. Context now uses `initiatorSidesByGameId: Map<string, Set<'home'|'away'>>` (a *set* — multiple initiators per side are valid) derived from `is_initiator=true` rows explicitly. When BOTH sides have initiators (cross-side modal race), no live prompt fires — Amendments D + F take over via the dispute path. Layer-1 column logic remains the fallback when no initiators exist for a game.
- `__tests__/pendingConfirmations.test.ts` - **Pending-confirmation tests** (34 cases): confirm + vacate predicates (Layer-1), `decidePendingAction` decision table; many-eyes Unit 4 + Amendment C — `buildPersonalConfirmContext` (initiator sides from `is_initiator=true` only; vacate markers ignored; multiple-initiator sets handled; null memberId safe) + per-person predicates (scoring-side viewer not prompted; extras prompted until they personally vouch; cross-side race = no prompt; same-side dual initiation still prompts the other side; pre-Phase-1 games fall back to column logic).
- `deriveDissents.ts` - **Many-eyes Layer-2 / Unit 5.** Pure derivation: per game, compare each `confirm` row's snapshot against the official `match_games` result on every tracked field (winner, extras, points). Skips `confirm` rows older than the game's latest `vacate` marker so a vacate-and-rescore doesn't falsely flag prior agreers. Returns per-game dissenters + agreeing confirmers (ids only — name resolution belongs in the component).
- `__tests__/deriveDissents.test.ts` - **Dissent-derivation tests** (11 cases): empty cases (no winner, no confirmations, all agree); any-field difference flags (winner, extras, points); pre-vacate scoping (old vouches don't dissent against the new result; genuine post-rescore dissent still flags); robustness (malformed rows skipped, multiple games processed independently).
- `deriveDisputes.ts` - **Many-eyes Layer-2 / Amendment F.** Pure derivation: detects games currently in the auto-cleared "two initiators disagreed" state (Amendment D). Window-scoped to the CURRENT dispute (between the latest two vacate markers) so old resolved disputes don't resurface. Distinguished from a normal vacate-pending-rescore (no disagreement among initiators).
- `__tests__/deriveDisputes.test.ts` - **Dispute-derivation tests** (9 cases): empty cases (game still has winner, no vacate marker, normal vacate, all initiators agree); real disputes (fresh auto-clear, same-side disagreement); window scoping (resolved old dispute doesn't resurface on a new auto-clear); robustness (malformed rows skipped, multiple games independent).

#### Per-Game Allocator Room — Points System support files (`src/systems/points-system/`)

Files added 2026-06-04 for the first room of the Scoring System Workshop building. Run-time engine (existing) is unchanged; these add the data-to-object bridge, the contract-checking surface, and the registered formula recipes.

- `per-game-allocator-loader.ts` - **Unit 2 — never-throw loader.** `loadPerGameAllocator(id)` reads a row from `per_game_allocators`, unmarshals winner_side/loser_side JSONB into `SideConfig`, runs `validatePerGameAllocator`, returns `PerGameAllocator | null`. Four failure paths each catch + warn + return null (supabase error, missing row, malformed JSONB, validator rejection).
- `allocator-formula-operations/read-state-var.ts` - **Unit 3 (R11 first-class) — state-bag read recipe.** Single arg `var_name`. Reads `state[var_name]`; returns 0 + warn on missing/non-numeric. Honors the communication contract: anywhere the allocator takes a number, it can come from the state bag by name.
- `__tests__/per-game-allocator-loader.test.ts` - **Loader tests** (13 cases): happy paths for the three shapes (fixed/fixed, fixed/range, formula/range), not-found, supabase error, supabase throw, malformed JSONB (missing base, string instead of number, range missing min, non-string operationKind), validator rejection, args-shape rejection (Unit 3).
- `__tests__/composition-validator-args.test.ts` - **Validator args-shape tests** (9 cases): happy paths for all 3 ops, missing required arg, string-where-number, banana-where-side, non-string state_var_name, NaN rejected, forward-compat extra arg accepted.
- `__tests__/read-state-var.test.ts` - **read_state_var tests** (6 cases): reads numeric value by name, reads different vars, returns 0 + warn on missing, returns 0 + warn on non-numeric, returns 0 + warn on non-string var_name, declares its argsShape.
- `__tests__/runtime-allocator-safety.test.ts` - **Unit 4 safety-net tests** (4 cases): single-game throw preserves W/L for all games, every-game throw preserves W/L counts with points at 0, no exception escapes under any sequence, games_played still increments past a thrown allocator.
- `__tests__/snapshot-and-swap.test.ts` - **Unit 5 swap + parity tests** (7 cases): override swaps the 10-Point allocator slot, no override = today's behavior unchanged, explicit null = omitted, 17-Point variation end-to-end through match-adapter, `pickPointsSystem` parity, R9 historical replay stability.
- `__tests__/17-point-via-match-adapter.test.ts` - **Unit 8 17-Point acceptance** (6 cases): per-game boundaries (loser=0 → winner=17; loser=7 → winner=10; loser=4 → winner=13), named acceptance sequence (home=48, away=37), per-side sum = 17 invariant, no-override = pure 10-Point.
- `trigger-loader.ts` - **Trigger workshop — never-throw loader.** `loadTrigger(id)` reads a `triggers` row, unmarshals condition/action JSONB, runs `validateTrigger` (write-target whitelist), synthesizes default order; returns `Trigger | null`.
- `__tests__/trigger-loader.test.ts` - 9 cases: happy paths + not-found / supabase error / malformed JSONB / unknown op / out-of-whitelist target.
- `__tests__/composition-validator-trigger.test.ts` - 13 cases: standalone `validateTrigger` structural checks + `allowedTargets` whitelist.
- `composition-validator.ts` now also exports `validateTrigger` (used by the trigger loader + the trigger workshop's save-time guard).

Existing files modified — `composition-validator.ts` exposes `validatePerGameAllocator` (called by the loader + the workshop's guards); declares args-shape checking against `AllocatorFormulaOperation.argsShape`. `types.ts` adds `ArgKind` / `ArgSpec` and the optional `argsShape` field. `runtime.ts` wraps the `evaluateAllocator` call in try/catch (Unit 4 backstop). `match-adapter.ts` `buildComposition` accepts `perGameAllocatorOverride`; `computeMatchRunningTotalsViaEngine` threads it through.

#### Lineup Utils (`/utils/lineup/`)

Pure helpers extracted from the lineup page. No React. Imported by both the page components and the hooks under `/hooks/lineup/`.

- `index.ts` - Barrel exports.
- `lineupValidation.ts` - Lineup-level validators (slot coverage, captain requirement, handicap totals).
- `lineupCompleteness.ts` - Computes "is this lineup ready to submit" + reasons it isn't.
- `computePrepBlockedReason.ts` - Maps `prep_match` RPC state + lineup status to a human-friendly blocked-reason string for the banner.
- `getMatchTotalGames.ts` - Returns the expected total game count for a match given its system snapshot.
- `handicapFormatters.ts` - Per-player handicap display formatting.
- `substituteHelpers.ts` - Helpers for substitute slot logic (eligibility, missing-roster-spot detection).
- `__tests__/computePrepBlockedReason.test.ts`, `__tests__/getMatchTotalGames.test.ts`, `__tests__/lineupCompleteness.test.ts`, `__tests__/substituteHelpers.test.ts` - Tests for the four most load-bearing helpers.

#### Standings + Tiebreaker (`/utils/standings/`, `/utils/tiebreaker/`)
- `standings/sortStandings.ts` + `__tests__/sortStandings.test.ts` - Sort helper for the standings table (W → Pts → Games tiebreak chain).
- `tiebreaker/gameNumbers.ts` + `__tests__/gameNumbers.test.ts` - Game-number assignment for best-of-3 tiebreakers.

#### Misc utility files
- `fargoMatchTotals.ts` - Fargo per-match totals helpers (used by `computeMatchRunningTotals` for the Fargo path).
- `getUserTeamInfo.ts` - Looks up the current user's team membership for the active league.
- `goldenBreakRules.ts` - Golden break eligibility rules (per-game flag setter).
- `logger.ts` - Client-side logger (writes to `app_logs` when configured).
- `__tests__/age.test.ts` - already indexed above under Date & Time.
- `__tests__/calculateHandicapThresholds.characterization.test.ts`, `determineMatchResult.characterization.test.ts`, `fargoMatchTotals.characterization.test.ts`, `getTeamHandicapBonus.characterization.test.ts`, `goldenBreakRules.characterization.test.ts`, `handicapCalculations.characterization.test.ts`, `playoffGenerator.standingsSort.characterization.test.ts` - **Characterization tests** locking in pre-refactor behavior for legacy utilities; consumed by the modular handicap/scoring refactor as a regression guard.
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
- *(`messageQueries.ts` was migrated into `src/api/queries/messages.ts` and `src/api/queries/conversations.ts` — see API Layer.)*
- `messageFormatters.ts` - Message formatting helpers (timestamps, previews).
- `messageValidators.ts` - Message validation (length, content, profanity gates).
- `profanityFilter.ts` - Profanity filtering shared util (consumed by `useProfanityFilter` + `messageValidators`).

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
- `conversations.ts` - Conversation list/detail reads.
- `featsStats.ts` - Feats-of-excellence aggregation queries (break-and-run, etc.).
- `handicaps.ts` - Per-member handicap fetches.
- `leagues.ts` - League list/detail reads.
- `matches.ts` - Match list/detail reads (separate from mutations file).
- `members.ts` — see above; also exposes additional org-scoped reads.
- `memberSearch.ts` - Server-side member-search query (used by the new-message modal + operator player picker).
- `messages.ts` - Message list/detail reads.
- `operators.ts` - Operator list/detail reads.
- `operatorStats.ts` - Operator-dashboard aggregate stats.
- `organizations.ts` - Org list/detail reads.
- `organizationStaff.ts` - Org-staff list query.
- `players.ts` - Player list/detail reads.
- `playerStats.ts` - Per-player stats aggregations.
- `preferences.ts` - Org/league/season resolved-preference queries.
- `reports.ts` - User-report queries.
- `seasons.ts` - Season list/detail reads.
- `standings.ts` - Standings aggregation query.
- `teamJoin.ts` - **Onboarding cascade (Unit 2)** — wraps the `get_team_join_view` RPC: resolves a team `join_token` to `{found, team_id, team_name, league_name, roster_size, spots[], viewer_request_status}`. Names only; the authz boundary while RLS is off.
- `teams.ts` - Team list/detail reads.
- `teamStats.ts` - Per-team stats aggregations.
- `thresholdLookup.ts` - Modular threshold-chart lookup query (used by the system resolver).
- `venueDuplicates.ts` - Detects duplicate venues during creation flows.
- `venues.ts` - Venue list/detail reads.
- `__tests__/thresholdLookup.test.ts` - Tests for the threshold-chart lookup.
- `__tests__/matches.test.ts` - Tests for `getMyMatchMatches` (My Match team-scoped detection query — team/status scoping + client-side date threshold).

#### Mutations (`/mutations/`) - Write Operations
*Create/Update/Delete operations with automatic cache invalidation*

- `matches.ts` - **✅ Match mutations** (generic updateMatch for any match field updates)
- `matchLineups.ts` - **✅ Match lineup mutations** (generic updateMatchLineup + specific save/lock/unlock)
- `announcements.ts` - Announcement-channel mutations (post / edit / archive).
- `autoConversations.ts` - Helper mutations for the season-activation auto-chats (manual create-missing-chat path).
- `championshipDates.ts` - Championship date CRUD.
- `conversations.ts` - Conversation create/archive/leave mutations.
- `houseRules.ts` - House-rules CRUD (org-scope + league-scope rules).
- `leagues.ts` - League CRUD.
- `leagueVenues.ts` - League↔venue linking mutations.
- `members.ts` - Member CRUD (including profanity-onboarding completion writer).
- `messages.ts` - Message send/edit/delete mutations (uses the timeout wrapper).
- `operatorBlackoutPreferences.ts` - Blackout-date preference CRUD.
- `organizations.ts` - Organization CRUD.
- `organizationStaff.ts` - Org-staff invite/remove mutations.
- `playoffConfigurations.ts` - Playoff config CRUD.
- `preferences.ts` - Preference CRUD across org / league / season scopes.
- `preferenceTypes.ts` - Shared preference type definitions used by `preferences.ts`.
- `ratingMutations.ts` - Member-rating edit RPC writers (writes audit row alongside the change).
- `reports.ts` - User-report CRUD.
- `schedules.ts` - Schedule CRUD (seasons-weeks + matches).
- `seasons.ts` - Season CRUD.
- `teamJoin.ts` - **Onboarding cascade (Unit 3)** — `submitJoinRequest(token, claimedMemberId?)` wrapping the `request_team_join` RPC; the only join-request write path.
- `teams.ts` - Team CRUD.
- `venues.ts` - Venue CRUD.
- `__tests__/sendMessage.timeout.test.ts` - Timeout-wrapper test for the sendMessage mutation (Unit 16 bounded-send).

#### Hooks (`/hooks/`) - React Query Hooks
*React-specific wrappers combining queries with useQuery/useMutation*

- `useCurrentMember.ts` - **✅ Current member hook** (replaces old version, 30min cache)
- `useInstallApp.ts` - **PWA install capability** — captures the Android/desktop-Chrome `beforeinstallprompt` at **module scope** via `startInstallCapture()` (called from `main.tsx` at boot, since the event fires early + is single-use), detects iOS + already-installed (standalone), and exposes `{ isStandalone, canPromptInstall, platform, promptInstall }` via a subscribe/re-render. Backs `InstallAppCard`. Tested in `useInstallApp.test.ts`.
- `usePendingInvites.ts` - **✅ Pending invites hook** (fetches placeholder player invites via get_my_pending_invites RPC)
- `useInviteStatuses.ts` - **✅ Invite statuses hook** (batch fetch invite statuses for PP cards in TeamEditorModal)
- `useTeamJoinView.ts` - **Onboarding cascade (Unit 2)** — TanStack hook backing `/join/:token`; loads the public join view (team + spots + caller's request state) via `getTeamJoinView`. Disabled until a token is present; 30s staleTime.
- `useSubmitJoinRequest.ts` - **Onboarding cascade (Unit 3)** — mutation hook filing a join request via `submitJoinRequest`; invalidates the team's join view on success so the page flips to "waiting".
- `useApproveJoinRequest.ts` - **Onboarding cascade (Unit 4)** — mutation hook for the approver's Add/Replace/Decline via `approveJoinRequest`; invalidates the join-cascade queries + team rosters on success.
- `useTeamJoinRequests.ts` - **Onboarding cascade (Unit 5)** — query hook for the approver's pending-request feed via `getJoinRequestsForApprover` (captain = his team, LO = all org teams).
- `useTeamPlaceholders.ts` - **Onboarding cascade (Unit 5)** — lazily loads a team's claimable placeholders (+ record flag) for the Replace picker via `getTeamPlaceholdersForClaim`.
- `usePendingJoinRequestCount.ts` - **Onboarding cascade (Unit 6, the doorbell)** — derives the pending-request count from the shared approver feed; drives the drawer/sidebar "Join requests (N)" link + the My Teams bottom-tab badge. 0 for non-approvers.
- `useApprovedJoinRequests.ts` - **Onboarding cascade (Unit 3 notify)** — `useApprovedJoinRequests` polls the caller's approved-but-unacknowledged joins; `useAcknowledgeJoinRequest` stamps one so the "you're in" popup shows once.
- `useTeamJoinDistribution.ts` - **Onboarding cascade** — `useTeamJoinToken` (read share token), `useRotateTeamJoinToken` (leak rotation), `useLeagueTeamsForOnboarding` (LO per-league not-yet-registered captains + link list; was `useOrgTeamsForOnboarding`, re-scoped org→league 2026-06-06).
- `useUserProfile.ts` - **✅ User profile hook** (full member data + role utilities)
- `useOperatorId.ts` - **✅ Operator ID hook** (operator lookup with caching)
- `useMatchPhase.ts` - **✅ Match-phase status query** (minimal id/status/started_at slice; staleTime: 0; foreground 7s polling while status='scheduled' as Defense 7 backstop for dropped realtime). Distinct cache key from `useMatchById` — see file header for rationale.
- `useMyMatchSurfaces.ts` - **✅ My Match aggregate hook (Unit 2)** — single contract for the bottom-nav tab + drawer section + sidebar entry. Owns the team-scoped detection query + a status-change-guarded `matches` realtime channel; exports pure resolvers (four-tier ladder, multi-live tiebreak, drawer labeling). Returns `{tier, destinationMatchId, showLiveDot, drawerItems, isHydrating, isError}`.
- `__tests__/useMyMatchSurfaces.test.tsx` - Tests for the My Match pure resolvers (tiers/tiebreak/drawer labels) + hook wiring (no-member posture, live resolution, no-teams short-circuit, error fallback).
- `useAnnouncementMutations.ts` - Announcement-channel mutation hooks.
- `useCaptainTeamsMissingChat.ts` - Detects captain teams that don't have an auto-managed team chat yet; drives the `CreateTeamChatPrompt` banner.
- `useChampionshipDateMutations.ts` - Championship-date CRUD hooks.
- `useConversationMutations.ts` - Conversation create/archive/leave mutation hooks.
- `useConversationQueries.ts` - Conversation list/detail query hooks.
- `useFeatsStats.ts` - Feats-of-excellence stats hook.
- `useHandicaps.ts` - Handicap-fetch hooks.
- `useIsWizard2League.ts` - Returns whether a league was created via Wizard V2 (drives some routing decisions).
- `useLeagueMutations.ts` - League CRUD hooks.
- `useLeagues.ts` - League query hooks.
- `useLeagueVenueMutations.ts` - League↔venue linking hooks.
- `useMatches.ts` - Match query hooks.
- `useGameConfirmations.ts` - **Many-eyes Layer-2 / Unit 3.** Query hook that OWNS the `game_confirmations` fetch for a match (live fresh-data config); `useMatchScoring` consumes it and wires the realtime invalidation. Phase 2/3 read the rows.
- `useMatchLineupMutations.ts` - Match-lineup CRUD hooks.
- `useMatchMutations.ts` - Match-state mutation hooks.
- `useMemberMutations.ts` - Member CRUD hooks.
- `useMemberSearch.ts` - Member-search hook (debounced).
- `useMessageComposerStatus.ts` - Tracks composer state (sending / failed / idle) for inline feedback.
- `useMessageMutations.ts` - Message send/edit/delete hooks.
- `useMessages.ts` - Message query hooks.
- `useMessagingRealtime.ts` - Supabase realtime subscription for the messages channels.
- `useOperatorBlackoutPreferenceMutations.ts` - Blackout-preference CRUD hooks.
- `useOperatorProfile.ts` - Operator profile query hook.
- `useOperatorStats.ts` - Operator-dashboard stats hook.
- `useOrganizationInvites.ts` - Org-invite query hooks.
- `useOrganizationMutations.ts` - Org CRUD hooks.
- `useOrganizations.ts` - Org list/detail hooks.
- `useOrganizationStaff.ts` - Org-staff query hook.
- `useOrganizationStaffMutations.ts` - Org-staff invite/remove hooks.
- `usePlayerHandicaps.ts` - Per-player handicap query hook.
- `usePlayerTeamCount.ts` - Returns a player's team count for the current scope.
- `usePlayoffConfigurations.ts` - Playoff config query hooks.
- `usePreferenceMutations.ts` - Preference CRUD hooks.
- `usePreferences.ts` - Preference query hooks (resolved + raw).
- `useReportMutations.ts` - User-report CRUD hooks.
- `useReportQueries.ts` - User-report query hooks.
- `useResolvedLeaguePrefs.ts` - Resolved-preference reader (the single shared resolver for org→league→season inheritance).
- `useScheduleMutations.ts` - Schedule CRUD hooks.
- `useSeasonMutations.ts` - Season CRUD hooks.
- `useSeasons.ts` - Season query hooks.
- `useStandings.ts` - Standings query hook.
- `useTeamMutations.ts` - Team CRUD hooks.
- `useTeams.ts` - Team query hooks.
- `useTeamStats.ts` - Per-team stats hook.
- `useTopShooters.ts` - Top-shooters stats hook.
- `useVenueMutations.ts` - Venue CRUD hooks.
- `useVenues.ts` - Venue list/detail hooks.
- `index.ts` - Central export point for all hooks
- `__tests__/computePhaseRefetchInterval.test.ts` - Tests for the phase-refetch interval helper.

**Migration Status**: Phase 1 Complete (foundation), Phase 2 Next (migrate member/user data)

---

### 🧙 Wizards (`/wizards/`)

Multi-step setup flows backed by the shared WizardFlowShell scaffold. Each wizard family owns its config, types, mutation hook, and one folder per step. The `_flowContext` slot on `formData` carries cross-step state (orgId, leagueId, etc.) without prop-drilling.

#### League Wizard V2 (`/wizards/league-v2/`)
The current LO league-creation flow (replaces the legacy wizard). Modular axes (handicap / scoring / threshold / mechanism) each have their own step. The TestedPreset → ad-hoc path is decided by `comboCoherence.ts`.

- `LeagueWizardV2Page.tsx` - Top-level page that mounts the flow + handles route params.
- `LeagueCreatedScreen.tsx` - Success screen rendered after league insert completes.
- `leagueWizardConfig.ts` - Step list, navigation rules, validators per step.
- `leagueWizardTypes.ts` - Form-data types + per-step input/output shapes.
- `leagueWizardHelpers.ts` - Shared helpers (formatting, name derivation).
- `comboCoherence.ts` - **Modular-axis coherence checker** — decides whether the current axis selections match a TestedPreset or are an ad-hoc combo; gates the review step's warning copy.
- `presetMappings.ts` - Maps `handicap_type` to default values for every downstream axis (rating / scoring / threshold).
- `useCreateLeagueV2.ts` - Mutation hook performing the actual league insert (atomic via RPC).
- `useFlowStageDetection.ts` - Detects where in the flow the user dropped out so resume works.
- `useFlowStageHandlers.ts` - Per-step submit handlers.
- `steps/LeagueIntroStep.tsx` - Welcome / overview step.
- `steps/GameTypeStep.tsx` - 8-ball / 9-ball / 10-ball / scotch doubles picker.
- `steps/LeagueFormatStep.tsx` + `leagueFormatOptions.ts` - Format chooser (singles / doubles / team).
- `steps/LineupSizeStep.tsx` - Lineup geometry (3v3 / 4v4 / 5v5 / etc.).
- `steps/RosterSizeStep.tsx` - Roster max.
- `steps/HandicapSystemStep.tsx` - `handicap_type` picker (BCA / Fargo / APA / off).
- `steps/MechanismStep.tsx` - Threshold mechanism axis (extra_games / start_points / race_length_adjustment / none).
- `steps/PointsCalculatorStep.tsx` - Points-calculator axis picker (linear_above_threshold / accumulate_with_milestone_jumps / accumulated_per_game / custom).
- `steps/ThresholdSourceStep.tsx` - Threshold-chart source axis (chart-by-id vs ad-hoc).
- `steps/PairingFormatStep.tsx` - Round-robin / Swiss / etc.
- `steps/MatchFormatStep.tsx` - Match-format details (races, games-to-win).
- `steps/WinConditionStep.tsx` - Win-condition axis.
- `steps/QualifierStep.tsx` - Qualifier rules (if any).
- `steps/StandingsSortStep.tsx` - Standings sort priorities.
- `steps/TiebreakerStep.tsx` - Tiebreaker rule picker.
- `steps/StartDateStep.tsx` - League start date.
- `steps/ReviewStep.tsx` - Final review + create button (shows preset-vs-ad-hoc copy from `comboCoherence`).
- `__tests__/comboCoherence.test.ts`, `presetMappings.test.ts`, `ThresholdSourceStep.test.tsx`, `useCreateLeagueV2.contract.test.ts` - Coverage for the wizard's load-bearing pieces.

#### Season Wizard V2 (`/wizards/season-v2/`)
Season-creation flow. Less branchy than the league wizard.

- `seasonWizardConfig.ts` - Step list + validators.
- `seasonWizardTypes.ts` - Form-data shape.
- `useCreateSeasonV2.ts` - Season-insert mutation hook.
- `playoffPresetMappings.ts` - Maps playoff format to default playoff-config values.
- `steps/SeasonIntroStep.tsx`, `steps/SeasonStartDateStep.tsx`, `steps/SeasonLengthStep.tsx`, `steps/PlayoffFormatStep.tsx` + `playoffFormatOptions.ts`, `steps/PlayoffWeeksStep.tsx` - The five season-wizard steps.

#### Schedule Wizard V2 (`/wizards/schedule-v2/`)
Round-robin / Swiss / custom schedule generation.

- `ScheduleWizardStep.tsx` - Single-step shell that orchestrates the schedule generator.
- `scheduleWizardConfig.ts`, `scheduleWizardTypes.ts` - Config + types.
- `useExistingWeeks.ts` - Loads existing scheduled weeks for replay/append flows.
- `useSaveScheduleV2.ts` - Save-mutation hook for the generated schedule.
- `ChampionshipStep.tsx` - Optional championship-date step.

#### Matchups Wizard V2 (`/wizards/matchups-v2/`)
Per-match position assignment within a season.

- `matchupsWizardConfig.ts`, `matchupsWizardTypes.ts` - Config + types.
- `steps/PositionsStep.tsx`, `steps/ReviewStep.tsx` - The two matchups-wizard steps.

#### Teams Wizard V2 (`/wizards/teams-v2/`)
Captain + team setup flow.

- `teamsWizardConfig.ts`, `teamsWizardTypes.ts` - Config + types.
- `useSaveTeamsV2.ts` - Save-mutation hook.
- `steps/CaptainsTeamsStep.tsx` - Captain → team mapping step.
- `steps/VenueSelectionStep.tsx` - Per-team venue picker.

#### Next-Season Wizard (`/wizards/next-season/`) — **draft PR #120**
*Fast-track wizard for cloning the previous season's setup. Currently on the `feat/new-season-from-previous` branch; the directory exists on disk pending merge.*

- `useNextSeasonFlowHandlers.ts` - Per-step handlers reusing existing wizard scaffold steps.
- `useNextSeasonStageDetection.ts` - Resume-from-stage detection.

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

Preset modules implementing the `SystemModule` interface. Each shipped preset owns its rating, scoring, and threshold behavior. The resolver maps `handicap_type` string → module. See `docs/archive/plans/2026-04-18-001-refactor-modular-handicap-scoring-systems-plan.md`.

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
- `resolveParams.ts` - Parameter resolution helper — merges calculator params from preferences with overrides/defaults so callers get a fully-shaped params object regardless of which fields the LO actually configured.
- `__tests__/types.contract.test.ts` - **Contract tests** locking the `PointsCalculator<P>` discriminated-union shape — every shipped calculator must conform to either `kind: 'aggregate'` or `kind: 'per_game'` with the matching input signature.
- `__tests__/displayHints.test.ts` - Tests for calculator-driven display hints (scoring popup field shapes) used by the per-game UI to render the right inputs for the active calculator.

---

### 📖 Glossary (`/glossary/`) **NEW — Operator-facing term registry**

Single source of truth for operator help terminology. Slug-keyed TS module registry; entries carry canonical name + aliases + short def + long def (rich content) + L1 anchor + related slugs. Consumed by `GlossaryInfoButton`, the Learn-hub Glossary page, and the `pnpm glossary:verify` drift audit. See `docs/plans/2026-05-28-001-feat-operator-help-system-phase-1-plan.md` Unit 1.

- `types.ts` — `GlossaryEntry` and `L1Anchor` schema. **R4 contract**: every entry has slug, canonicalName, aliases, shortDef (string, ≤2 sentences), longDef (`React.ReactNode`), `l1_anchor`, related.
- `index.tsx` — registry merge across per-domain entry files. Exports `GlossarySlug` union (compile-time enforced), `getGlossaryEntry(slug)`, `getAllGlossaryEntries()`, `searchGlossary(query)` (substring on canonical + aliases), `useGlossarySearch` hook, `glossaryToInfoButtonProps(slug)` helper.
- `entries/handicap.tsx` — handicap-related entries (15 terms): fargorate, handicap, handicap-system, handicap-mechanism, points/percentage/no-handicap, extra-games, start-points, race-length-adjustment, threshold + chart, calibrated, manual-entry, rating.
- `entries/general.tsx` — cross-cutting entries (27 terms): keystone containers (league, season, matchup, match, game, pairing), game types (8/9/10-ball), teams/roster (lineup, lineup-size, roster, roster-size, substitute, anonymous-sub, double-duty, captain, scorekeeper, lineup-lock, racker, breaker), tiebreakers (tiebreaker, extra-round, single-short-race, accept-tie, manual-tiebreaker), start-date, qualifier (with descriptor + division-descriptor aliases).
- `entries/scoring.tsx` — scoring entries (8 terms): win-condition, points-calculator, linear-above-threshold, accumulate-with-milestone-jumps, accumulated-per-game, win-threshold, tie-threshold, multiplier.
- `entries/match-format.tsx` — match-format entries (9 terms): match-format, round-robin, single-round-robin, double-round-robin, individual-races, pairing-format, single-rack, race-to-n, race.
- `entries/standings.tsx` — standings entries (5 terms): standings, standings-sort, match-wins, total-points, total-games-won.
- `__tests__/glossary.test.ts` — schema completeness, slug uniqueness, alias collisions, related-dial integrity, search behavior.

---

### 🔒 Validation (`/schemas/`)

Zod validation schemas

- `leagueOperatorSchema.ts` - League operator validation
- `playerSchema.ts` - Player validation

---

### 📡 Real-time (`/realtime/`)

Supabase real-time subscription hooks for live data updates

- `useMatchRealtime.ts` - Unified real-time subscription for the whole match flow (matches/lineups/games); surfaces connection status + fires a catch-up refetch on re-subscribe after a drop
- `useConnectionHealth.ts` - Classifies realtime trouble into actionable health (realtime-down vs offline) via one cheap reachability probe; drives the degraded polling fallback cadence
- `useConnectionHealth.test.ts` - Tests for classifyHealth + computeDegradedPollInterval + the useConnectionHealth probe/online-offline behavior
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
| `database/dev_seed_full.sql` | **DEV-ONLY: canonical full test environment (post-modular).** 4 logins (all captains, password "password"), Tester Org + venue, ~100 placeholders with random handicaps (3v3/5v5/fargo), and 3 leagues — one per packaged scoring system (3v3 points / 5v5 percentage / 5v5 fargo 10-7, prefs = byte-exact PRESET_MAPPINGS) — each with 4 captained teams, lineup_size+1 rosters, and a scheduled round-robin. Idempotent. Paste into Studio after `pnpm db:reset`. Use this to test scoring across all 3 systems. |
| `database/dev_seed_minimal.sql` | DEV-ONLY: foundation-only seed (4 logins, org, 130 FL placeholders, handicaps) — no leagues/teams; build those via the wizard. Use when testing the wizard itself. |
| `supabase/migrations/20260418000000_add_leagues_system_overrides.sql` | **Phase 2 Unit 4** — adds `leagues.system_overrides JSONB` for per-league dial overrides |
| `supabase/migrations/20260418000001_add_fargo_match_columns.sql` | **Phase 2 Unit 5** — adds `matches.fargo_start_points` + `match_games.winner_points`/`loser_points`/`loser_balls_pocketed` |
| `supabase/migrations/20260418000002_lock_tier1_preferences.sql` | **Phase 2 Unit 6** — DB trigger blocking UPDATE of `handicap_type` and `lineup_size` on league preferences (tier 1 mutability) |
| `supabase/migrations/20260418000003_add_matches_system_snapshot.sql` | **Phase 2 Unit 7** — adds `matches.system_snapshot JSONB` for per-match frozen tier-2 dials (tier 3 mutability) |
| `supabase/migrations/20260418000004_revise_fargo_columns.sql` | **Phase 2 revision** — drops 3 redundant Fargo columns (fargo_start_points, winner_points, loser_points); adds 3 always-tracked per-game flags (break_fouled, runout, win_by_forfeit). Fargo start-points now reuses home/away_games_to_win. |
| `supabase/migrations/20260419000000_add_fargo_start_points_negotiation.sql` | **Phase 3 Unit 11c** — adds `matches.fargo_start_points` + home/away confirm columns for the captain-negotiated start-points value |
| `supabase/migrations/20260501000002_teams_status_add_bye.sql` | **PR 1 bye-as-real-team** — adds `'bye'` to `teams_status_check` so byes can be represented as real teams rows. |
| `supabase/migrations/20260501000003_teams_captain_id_nullable.sql` | **PR 1 bye-as-real-team** — drops NOT NULL on `teams.captain_id` so bye rows (no captain) can be inserted. |
| `supabase/migrations/20260501000004_backfill_null_bye_matches.sql` | **PR 1 bye-as-real-team** — one-time backfill: replaces NULL `home_team_id`/`away_team_id` on legacy matches with real per-season bye-team rows. Includes pre-flight DO block enumerating abort conditions. |
| `supabase/migrations/20260501000001_team_fks_cascade_to_restrict.sql` | **PR 0 cascade safety net** — flips `matches.home_team_id`, `matches.away_team_id`, and `match_lineups.team_id` from `ON DELETE CASCADE` to `ON DELETE RESTRICT` so deleting a team can no longer silently destroy match/lineup history. See `docs/archive/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md`. |
| `supabase/migrations/20260504000000_harden_prep_match_write_guards.sql` | **Lineup→scoring transition stability fix** — replaces `prep_match` body so ALL writes (thresholds, status, started_at) are guarded by `WHERE status = 'scheduled'`; drops `IF NOT FOUND` exception and wraps INSERT in `IF FOUND` so race-loser calls are true no-ops. See `docs/archive/plans/2026-05-04-001-fix-lineup-to-scoring-transition-stability-plan.md`. |
| `supabase/migrations/20260606000000_trigger_room.sql` | **Trigger workshop Unit 1** — `triggers` table (id, name, description, scope, `author_id` FK → `members(id)`, trigger_type, condition JSONB, action JSONB, rearm, timestamps) + CHECK constraints + BEFORE UPDATE/DELETE tamper trigger on `scope='official'`; seeds 4 official rows (Initial credit, Game-13 bonus, Sweep bonus, Empty Starter). Order is NOT stored (scoring-system-room concern). See `docs/plans/2026-06-06-001-feat-trigger-room-plan.md`. |
| `supabase/migrations/20260604000000_per_game_allocator_room.sql` | **Scoring System Workshop — Per-Game Allocator Room Unit 1** — `per_game_allocators` table (id, name, description, scope, `author_id` FK → `members(id)`, winner_side JSONB, loser_side JSONB, timestamps), CHECK constraints for scope + author_id pairing, BEFORE UPDATE/DELETE tamper trigger blocking modification of `scope='official'` rows, `preferences.per_game_allocator_id` UUID FK (ON DELETE RESTRICT), extended `resolved_league_preferences` view with the new COALESCE'd column, seeded 5 official rows (Percent 5-Man, 10-Point, 17-Point [base+formula form], 17-Point (Single Formula) [single self-contained formula], Empty Starter). See `docs/plans/2026-06-04-002-feat-per-game-allocator-room-plan.md`. |
| `supabase/migrations/20260509000001_messaging_phase1_conversations_participants.sql` | **Messaging Phase 1 / Unit 1** — schema foundations: `conversations.archived_at` (Phase 6 read-only gate prep), `conversation_participants.notification_mode` (tri-state replacement for legacy `is_muted` + `notifications_enabled`, with backfill), `conversation_participants.cannot_leave` (captain-force-membership flag, used by Unit 5 + Unit 6). Plus three CHECK-constraint widenings: `conversation_type` gains `'match_chat'`, `scope_type` gains `'match'`, participant `role` gains `'observer'`. All additive; legacy columns stay during deprecation window. |
| `supabase/migrations/20260509000002_messaging_phase1_messages_members.sql` | **Messaging Phase 1 / Unit 2** — `messages.is_system` flag + nullable `sender_id` + paired `messages_is_system_shape` CHECK (every row is either system-with-NULL-sender or user-with-sender, no other shape). `members.profanity_onboarding_completed_at` (Unit 9 modal). `members.deleted_at` (soft-delete, read by Unit 5 trigger). Intentionally ships **no RLS policies** — those tables have `rowsecurity=false` in dev (RLS-enablement is a separate planned effort). |
| `supabase/migrations/20260509000003_messaging_phase1_season_activation_trigger.sql` | **Messaging Phase 1 / Unit 4** — adds SECURITY DEFINER `auto_create_season_conversations(uuid)` plus trigger wrapper; trigger fires `AFTER UPDATE OF status ON seasons WHEN status flips to 'active'` and creates one team chat per team, one captain chat, one season-announcements chat, and an org-announcements chat (idempotent). Each chat creation is wrapped in `BEGIN/EXCEPTION` so a single failure doesn't strand others. Also adds `conversations` to the `supabase_realtime` publication. See `docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md`. |
| `supabase/migrations/20260509000004_messaging_phase1_roster_captain_triggers.sql` | **Messaging Phase 1 / Unit 5** — four trigger functions that keep auto-managed chats in sync with roster + captain state: `team_players` INSERT (add participant, post "joined" only on real inserts via `xmax = 0`), `team_players` DELETE (set `left_at`, post "left" only when newly set), `teams` UPDATE OF `captain_id` (flip `cannot_leave` in both team and captain chats; multi-team captains keep `cannot_leave` on captain chat), `members` UPDATE OF `deleted_at` NULL→ts (mark every active participant row as left). All `SECURITY DEFINER`, `search_path = public, pg_catalog`, REVOKE PUBLIC/authenticated. See `docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md`. |
| `supabase/migrations/20260513000001_messaging_phase1_unit7_polish.sql` | **Messaging Phase 1 / Unit 7 (polish)** — two changes. (1) `COMMENT ON COLUMN public.members.profanity_filter_enabled` reworded from "Forced ON for users under 18, optional for adults" to reflect the DOB-optional reality (forced ON only for *known* minors; toggleable for adults and members with no DOB on file). (2) `CREATE OR REPLACE FUNCTION public.increment_unread_count()` adds an explicit `IF NEW.is_system THEN RETURN NEW; END IF;` early-return so system messages never bump unread counts; today the implicit SQL NULL semantics achieve the same result but the explicit guard makes intent visible and survives future schema changes. Both statements are idempotent. See `docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md` (Unit 7). |
| **Migrations backfilled by TOC sync — concise descriptions** | (the entries below were missing from the TOC; descriptions inferred from filename + adjacent context. Cross-reference the migration files for full SQL.) |
| `supabase/migrations/20251130010824_baseline.sql` | Initial schema baseline — all core tables (members, organizations, leagues, seasons, teams, matches, etc.) as they existed at the start of tracked migrations. |
| `supabase/migrations/20251130014152_add_rls_policies.sql` | First-pass RLS policies layered onto the baseline schema. |
| `supabase/migrations/20251201174359_add_app_logs_table.sql` | `app_logs` table for client-side logger output (used by `src/utils/logger.ts`). |
| `supabase/migrations/20251202194308_authorize_new_players.sql` | Org-level "require LO authorization before new players can join" flag + supporting logic. |
| `supabase/migrations/20251206000000_playoff_configurations.sql` | `playoff_configurations` table + related schema for per-season playoff config (bracket size, qualification rules). |
| `supabase/migrations/20251211000000_add_lineup_change_request.sql` | `lineup_change_requests` table for in-match captain-to-captain lineup change negotiations. |
| `supabase/migrations/20260602000000_add_swap_audit_columns.sql` | **Lineup-swap recalibration / Unit 1.** Adds `swap_requested_by_member_id` (UUID→members) + `swap_last_resolution` (JSONB) to `match_lineups` — provenance of who opened a swap request and the outcome (`{kind, by_member_id, resolved_at, position, old_player_id, new_player_id}`) of the most-recent resolved request, persisted after the pending `swap_*` columns clear. Substrate for the resolution toast + audit. See `docs/plans/2026-06-02-001-feat-lineup-swap-recalibration-plan.md`. |
| `supabase/migrations/20260602000001_swap_player_in_lineup_rpc.sql` | **Lineup-swap recalibration / Unit 3.** `swap_player_in_lineup(p_lineup_id, p_thresholds, p_resolution)` SECURITY DEFINER RPC — atomically applies an approved swap (new player at its position), cascades the new player into UNPLAYED `match_games` only, writes recomputed thresholds, and stamps `swap_last_resolution`, all in one transaction (mirrors `prep_match`). Data-integrity guards only (pending swap exists via `FOR UPDATE`, match in_progress, outgoing player has no completed games) — NO caller-identity check (per [[feedback_gate_ui_relax_rls]]; any scorekeeper may call). Test: `src/__tests__/database/swapPlayerInLineupRpc.db.test.ts`. |
| `supabase/migrations/20251212000000_enable_realtime.sql` | Adds core tables (matches, match_lineups, match_games, etc.) to the `supabase_realtime` publication. |
| `supabase/migrations/20251213000000_sync_match_lineups_with_matches.sql` | Trigger keeping `match_lineups` rows in sync with their parent `matches` row (status, timing). |
| `supabase/migrations/20251214114804_venue_table_configuration.sql` | Per-venue table-count + table-numbering configuration columns. |
| `supabase/migrations/20251214211103_match_table_assignment.sql` | `matches.table_number` + assignment logic so a match can be pinned to a specific venue table. |
| `supabase/migrations/20251215165551_allow_nullable_member_fields.sql` | Loosens NOT NULL on members fields that placeholder players don't have (email, etc.). |
| `supabase/migrations/20251216121115_placeholder_player_merge_system.sql` | **Placeholder-player merge** — foundational merge function + supporting columns for converting a placeholder into a registered member. |
| `supabase/migrations/20251216140000_allow_nullable_member_fields.sql` | Follow-up nullable relaxations for additional placeholder-friendly columns. |
| `supabase/migrations/20251216180000_enhanced_placeholder_search.sql` | RPC for placeholder search across multiple fields (nickname, alias, partial name). |
| `supabase/migrations/20251217144653_invite_tokens.sql` | `invite_tokens` table — one-time tokens for placeholder→registered claim flow. |
| `supabase/migrations/20251217152629_merge_placeholder_player.sql` | `merge_placeholder_player(...)` RPC — the actual merge entry point. |
| `supabase/migrations/20251217170000_check_pending_invites.sql` | `get_my_pending_invites` RPC + supporting view for the pending-invites modal. |
| `supabase/migrations/20251219103904_get_operator_player_stats.sql` | `get_operator_player_stats` RPC — operator-side aggregated stats per member across their orgs. |
| `supabase/migrations/20251219113254_get_operator_placeholders.sql` | `get_operator_placeholders` RPC — list of placeholder members owned by an org. |
| `supabase/migrations/20251219113430_remove_placeholder_from_team.sql` | RPC: safely remove a placeholder from a team without losing match history. |
| `supabase/migrations/20260410000000_extend_preferences_modular.sql` | **Modular handicap/scoring foundation** — adds modular preference columns (rating axis, scoring calculator, threshold strategy) to org/league preferences. |
| `supabase/migrations/20260410000001_add_fargo_to_members.sql` | `members.fargo_rating` column + supporting indexes for Fargo handicap support. |
| `supabase/migrations/20260410000002_threshold_charts.sql` | `threshold_charts` table — modular threshold lookup keyed by lineup geometry + chart strategy. |
| `supabase/migrations/20260410000003_seed_threshold_charts.sql` | Seeds the shipped threshold charts (BCA 3v3, BCA 5v5, etc.) into `threshold_charts`. |
| `supabase/migrations/20260410000004_add_threshold_chart_fk.sql` | FK from preferences to `threshold_charts` so leagues reference a chart by ID, not by string. |
| `supabase/migrations/20260415000000_seed_apa_2026.sql` | Seeds the APA 2026 preset (handicap chart + rules). |
| `supabase/migrations/20260417000000_add_modular_to_resolved_view.sql` | Extends the `resolved_preferences` view to project the modular axes through the org→league inheritance chain. |
| `supabase/migrations/20260420000000_relax_teams_roster_size_check.sql` | Loosens the `teams_roster_size_check` CHECK constraint to accommodate the incremental-roster-slots flow. |
| `supabase/migrations/20260422000000_placeholder_has_stats_function.sql` | **Placeholder lifecycle PR (1/23)** — `placeholder_has_stats(member_id)` helper used by the archive flow. |
| `supabase/migrations/20260422000001_archived_placeholders_table.sql` | **Placeholder lifecycle PR (2/23)** — `archived_placeholders` table for soft-archived placeholder members. |
| `supabase/migrations/20260422000002_placeholder_audit_log_table.sql` | **Placeholder lifecycle PR (3/23)** — audit-log table for every placeholder mutation (create/merge/archive/remove). |
| `supabase/migrations/20260422000003_add_match_lineups_player_fk.sql` | **Placeholder lifecycle PR (4/23)** — adds player_id FK on `match_lineups` so history survives merges. |
| `supabase/migrations/20260422000004_merge_placeholder_snapshot_and_audit.sql` | **Placeholder lifecycle PR (5/23)** — extends merge RPC to write a pre-merge snapshot + audit row. |
| `supabase/migrations/20260422000005_undo_merge_placeholder_rpc.sql` | **Placeholder lifecycle PR (6/23)** — `undo_merge_placeholder` RPC for rolling back a recent merge using the snapshot. |
| `supabase/migrations/20260422000006_invite_tokens_rejected_status.sql` | **Placeholder lifecycle PR (7/23)** — adds `'rejected'` to `invite_tokens.status` enum + supporting logic. |
| `supabase/migrations/20260422000007_auto_invite_on_placeholder_email.sql` | **Placeholder lifecycle PR (8/23)** — trigger auto-creates an invite token when a placeholder is given an email. |
| `supabase/migrations/20260422000008_pending_invites_left_join_team.sql` | **Placeholder lifecycle PR (9/23)** — fixes `pending_invites` view to LEFT JOIN teams (so invites without a team aren't dropped). |
| `supabase/migrations/20260422000009_enrich_pending_invites_rpc.sql` | **Placeholder lifecycle PR (10/23)** — extends `get_my_pending_invites` with org/league context fields. |
| `supabase/migrations/20260422000010_members_created_by_member_id.sql` | **Placeholder lifecycle PR (11/23)** — `members.created_by_member_id` column for attribution. |
| `supabase/migrations/20260422000011_placeholder_org_scoping.sql` | **Placeholder lifecycle PR (12/23)** — scopes placeholder visibility to the org that created them. |
| `supabase/migrations/20260422000012_fix_placeholder_trigger_split.sql` | **Placeholder lifecycle PR (13/23)** — splits an overloaded placeholder trigger into two narrower triggers. |
| `supabase/migrations/20260422000013_fix_get_invite_details_left_join.sql` | **Placeholder lifecycle PR (14/23)** — fixes a JOIN bug in `get_invite_details`. |
| `supabase/migrations/20260422000014_invite_tokens_fk_set_null.sql` | **Placeholder lifecycle PR (15/23)** — flips invite_tokens FKs to ON DELETE SET NULL so token rows survive parent deletions. |
| `supabase/migrations/20260422000015_audit_placeholder_to_registered_conversion.sql` | **Placeholder lifecycle PR (16/23)** — audit-row writer for the placeholder→registered conversion path. |
| `supabase/migrations/20260422000016_org_placeholders_for_merge.sql` | **Placeholder lifecycle PR (17/23)** — RPC listing org placeholders that are candidates for a target merge. |
| `supabase/migrations/20260422000017_delete_unused_placeholder_rpc.sql` | **Placeholder lifecycle PR (18/23)** — RPC to delete a placeholder that has no match history (safe path). |
| `supabase/migrations/20260422000018_placeholder_archive_flag.sql` | **Placeholder lifecycle PR (19/23)** — `members.archived_at` for soft archive (parallel to `deleted_at`). |
| `supabase/migrations/20260422000019_placeholder_remove_context.sql` | **Placeholder lifecycle PR (20/23)** — adds the team/league context onto remove-placeholder audit rows. |
| `supabase/migrations/20260422000020_merge_v2_org_check_via_members_column.sql` | **Placeholder lifecycle PR (21/23)** — tightens merge org-scope check using the members column rather than an indirect lookup. |
| `supabase/migrations/20260422000021_get_org_recent_merges_rpc.sql` | **Placeholder lifecycle PR (22/23)** — `get_org_recent_merges` RPC for the "recent merges" audit view. |
| `supabase/migrations/20260422000022_invite_tokens_optional_team_and_inviter.sql` | **Placeholder lifecycle PR (23/23)** — relaxes invite_tokens to allow NULL team_id/inviter for system-issued tokens. |
| `supabase/migrations/20260424000000_prep_match_rpc.sql` | First version of the `prep_match` RPC (later hardened by `20260504000000`). |
| `supabase/migrations/20260425000000_drop_fargo_start_points_columns.sql` | Drops the legacy `matches.fargo_start_points` family of columns superseded by the negotiated value. |
| `supabase/migrations/20260425000001_members_bca_number_unique.sql` | UNIQUE constraint on `members.bca_number`. |
| `supabase/migrations/20260429000000_replace_tier1_lock_with_status_aware.sql` | Replaces the blunt tier-1 lock trigger with a status-aware version that only blocks edits after the league has matches. |
| `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` | **Phase 2** — adds the second wave of modular axis columns to preferences. |
| `supabase/migrations/20260429000002_resolved_view_phase2_modular_axes.sql` | **Phase 2** — extends `resolved_preferences` view to project the new axes. |
| `supabase/migrations/20260429000003_rating_edit_audit_log_table.sql` | `rating_edit_audit_log` table — tracks operator edits to member ratings. |
| `supabase/migrations/20260429000004_threshold_charts_rls_production.sql` | Production-ready RLS policies for `threshold_charts`. |
| `supabase/migrations/20260429000005_rating_mutation_rpcs.sql` | `set_member_rating` + supporting RPCs that write the audit row alongside the rating change. |
| `supabase/migrations/20260501000000_matches_modular_columns.sql` | Modular-axis columns on `matches` (per-match frozen tier-3 dials). |
| `supabase/migrations/20260502000000_drop_team_format.sql` | Drops the legacy `team_format` column (superseded by the modular axis system). |
| `supabase/migrations/20260502000001_set_member_starting_handicap_rpc.sql` | `set_member_starting_handicap` RPC for the wizard's per-player handicap seeding step. |
| `supabase/migrations/20260502000002_prep_match_rpc_renamed_columns.sql` | Renames a handful of columns referenced by `prep_match` to align with the modular-axis naming. |
| `supabase/migrations/20260505000000_match_games_value_columns.sql` | Adds `match_games.winner_balls_pocketed` / `loser_balls_pocketed` / counter-value columns for the per-game-points calculator (`accumulated_per_game`). |
| `supabase/migrations/20260529000001_team_join_cascade.sql` | **Onboarding cascade / Unit 1.** `teams.join_token` (persistent forwardable per-team link) + `team_join_requests` lifecycle table (status pending/approved/rejected/cancelled, expires_at 30d, acknowledged_at) with team/status index + two partial-unique guards (per-user dedup, per-spot race). Additive, no RLS. |
| `supabase/migrations/20260529000002_get_team_join_view.sql` | **Onboarding cascade / Unit 2.** `get_team_join_view(token)` SECURITY DEFINER RPC (granted anon + authenticated) resolving a token to the public-safe join payload — names only; the authz boundary while RLS is off. |
| `supabase/migrations/20260529000003_request_team_join.sql` | **Onboarding cascade / Unit 3.** `request_team_join(token, claimed_member_id?)` SECURITY DEFINER RPC (authenticated only) — the only path that files a join request; derives requester from `auth.uid()` + team from the token (never client input), returns `{ok, reason, status}` covering the guard states. |
| `supabase/migrations/20260529000005_join_requests_for_approver.sql` | **Onboarding cascade / Unit 5 (read).** `get_join_requests_for_approver()` — pending requests across every team the caller captains OR staffs, de-duplicated, with person/team/league labels + `has_open_placeholders` (drives Replace + the Add guard). Plus STABLE helpers `league_display_name(uuid)` + `member_display_name(uuid)`. |
| `supabase/migrations/20260529000006_team_placeholders_for_claim.sql` | **Onboarding cascade / Unit 5.** `get_team_placeholders_for_claim(team_id)` — a team's unclaimed placeholders + `placeholder_has_stats` record flag for the Replace picker; captain/org-staff gated. |
| `supabase/migrations/20260529000008_join_link_distribution.sql` | **Onboarding cascade / Unit 7.** `rotate_team_join_token(team_id)` (leak rotation, captain/staff gated; submitted requests unaffected) + `get_org_teams_for_onboarding(org_id)` (**superseded + dropped 2026-06-06** by the league-scoped RPC below). |
| `supabase/migrations/20260606010000_onboard_captains_league_scope.sql` | **Onboard captains re-scope.** Adds `get_league_teams_for_onboarding(league_id)` — one row per **non-bye** team in the league whose captain is **still a placeholder** (`members.user_id IS NULL`); team + captain name + join link; org-staff gated against the league's org; self-clears as captains register (no season filter needed). Drops the org-scoped `get_org_teams_for_onboarding`. See `docs/plans/2026-06-06-002-fix-onboard-captains-league-scope-plan.md`. |
| `supabase/migrations/20260529000007_my_approved_join_requests.sql` | **Onboarding cascade / Unit 3 (notify).** `get_my_approved_join_requests()` (caller's approved-but-unacknowledged joins + labels) + `acknowledge_join_request(id)` (stamp so the "you're in" popup shows once, own-request scoped). |
| `supabase/migrations/20260529000004_approve_join_request.sql` | **Onboarding cascade / Unit 4.** `approve_join_request(request_id, action, claimed_member_id?)` SECURITY DEFINER RPC — captain/org-staff one-tap Add/Replace/Decline; reads team_id from the row, resolves org via `teams.league_id`, `FOR UPDATE` race-guard, actor from `auth.uid()`. Also widens `'captain_approve'` in BOTH the merge RPC whitelist (recreated verbatim from `20260422000020`) AND the `archived_placeholders` actor_role CHECK. |
| `supabase/migrations/20260525000000_game_confirmations.sql` | **Many-eyes Layer-2 / Unit 1** — append-only `game_confirmations` table (every vouch + full result snapshot + `action` confirm/vacate marker); FKs on match_id/game_id/confirmer_id, snapshot columns FK-free; on the `supabase_realtime` publication + `REPLICA IDENTITY FULL`. Officiality stays on `match_games.confirmed_by_*` (additive only). |
| `supabase/migrations/20260526000000_game_confirmations_is_initiator.sql` | **Many-eyes Layer-2 / Phase 2 Amendment A** — adds `is_initiator boolean NOT NULL DEFAULT false` to `game_confirmations`. Distinguishes rows from `handleConfirmScore` (filled details from scratch = `true`) vs `confirmOpponentScore` (just tapped Confirm = `false`). **NO unique index** — multiple initiators per `(game_id, side)` are deliberately allowed (agreement = stronger confirmation, disagreement = the dispute path that auto-clears the game). |
| `supabase/migrations/20260528000000_game_confirmations_auto_confirmed.sql` | **Scoring participation modes / Unit A** — adds `auto_confirmed boolean NOT NULL DEFAULT false` to `game_confirmations`. `true` only when the vouch came from the confirmer's Auto-Confirm mode (no modal — scan-fired); `false` for a manual tap, an initiator entry, or a vacate marker. Integrity metric only (auto-vouches are weaker evidence than manual); never affects officiality or counting. |
| `supabase/migrations/20260609193503_drop_redundant_before_delete_match_lineups_trigger.sql` | **Bugfix** — drops the redundant `trigger_auto_delete_match_lineups` (BEFORE DELETE on `matches`) + its function. It deleted a match's lineups, but `match_lineups.match_id` (NOT NULL) already CASCADEs on match delete, so it was redundant — and as a BEFORE trigger mutating rows in the same multi-row delete (via `matches.home/away_lineup_id → match_lineups SET NULL`) it broke bulk match deletes (`clearSchedule` / regenerate matchups) with Postgres error **27000**, surfaced as HTTP **400**. Verified on a 54-match season: delete now succeeds, zero orphaned lineups. |
| `supabase/migrations/20260612000000_approve_surface_roster.sql` | **Approve surface — richer cards (Unit 1).** Extends `get_join_requests_for_approver()` with a captain summary (`captain_name` + `captain_is_placeholder`) and adds `get_team_roster_for_approver(team_id)` — a team's full roster (registered + claimable placeholders), each marked `is_captain`/`is_registered`/`claimable`/`has_stats`, captain first. Captain is unioned in from `teams.captain_id` so the "seat the captain" target always appears even when the captain isn't a `team_players` row. Captain-OR-org-staff gated (mirrors `get_team_placeholders_for_claim`). Additive. |
| `supabase/migrations/20260611000000_auto_forfeit_sweep.sql` | **Auto-forfeit sweep — first pg_cron job.** `create extension pg_cron` + `sweep_auto_forfeits()` (SECURITY DEFINER) + a daily `cron.schedule` at 06:00 UTC. One set-based query over ALL leagues: for every `scheduled`, unplayed, **past-due** match (its week's `scheduled_date < CURRENT_DATE`) where **exactly one team is captainless**, declares the captained team the winner (`winner_team_id` + `status='completed'` — how standings already count a win). Both-captained → ignored; neither-captained → skipped (deferred). This is what makes BYE weeks + dropped-team weeks auto-resolve. Forfeit SCORING (points) deferred. Self-healing. Test: `src/__tests__/database/autoForfeitSweep.db.test.ts`. |
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

*(Previously listed entry for `cUsersshodbpersonalsupabase-learning-hubsrcutilsscheduleGenerator.ts` — confirmed not present on disk during the 2026-05-19 TOC sync; removed.)*

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
| **Team Management** | `/operator`, `/components/player`, `/hooks`, `/api/hooks`, `/api/mutations` | `TeamManagement.tsx`, `useTeamManagement.ts`, `useTeams.ts`, `useTeamMutations.ts`, `teams.sql` |
| **Match Lineup** | `/player`, `/components/lineup`, `/hooks/lineup`, `/utils/lineup`, `/api/hooks` | `MatchLineup.tsx`, `useLineupState.ts` + sibling hooks under `/hooks/lineup/`, `useMatchLineupMutations.ts`, `lineups.sql` |
| **Scoring (3x3)** | `/player`, `/components/scoring`, `/hooks`, `/database/scoring3x3` | `ScoreMatch.tsx`, `UnifiedScoreboard.tsx`, `useMatchScoring.ts`, `match_games.sql` |
| **Messaging** | `/pages`, `/components/messages`, `/api/queries`, `/api/mutations`, `/api/hooks`, `/database/messaging` | `Messages.tsx`, `MessageView.tsx`, `useMessages.ts`, `api/queries/messages.ts`, `api/mutations/messages.ts` |
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
