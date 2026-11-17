# Tests that fake the database: triage (2026-11-17)

Read-only audit for U9 of `docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md`.

**Why:** My Stats (#277) shipped a query Postgres rejected while every unit
test passed, because the tests replaced the database with a fake. A fake is
fine when the test is about what the screen *does* with data. It's a blind
spot when the risk is in the query itself (filters, joins/embeds, RPC
parameter names, permissions). This list decides, for each test that fakes
the data layer, whether to keep it, convert it to a real-database test, or delete it.

## The short version

- **72 test files** outside `src/__tests__/database/` fake the data layer:
  19 fake the Supabase client, 53 fake the query/hook layer.
- **69 keep.** They test real behaviour (screens, rules, error handling), and the fake is just
  the edge of the test.
- **2 convert:** `src/api/queries/__tests__/matches.test.ts`
  (`getMyMatchMatches`: same bug class as #277: an embed, an `.or(...)`
  filter string and team scoping that only ever ran against a fake) and
  `src/api/queries/__tests__/thresholdLookup.test.ts` (the
  `lookup_threshold` RPC's parameter names are only checked against a fake).
  Verified: no database test calls either function.
- **1 delete:** `src/api/hooks/useTeamJoinView.test.ts`. It only restates
  the react-query wiring; `get-team-join-view.test.ts` proves the RPC.
- **2 trim:** `src/utils/__tests__/getTeamHandicapBonus.characterization.test.ts`
  (drop the faked "database lookup" block once `teamHandicapBonus.db.test.ts`
  is confirmed to cover the playoff and failed-read cases; keep the pure-rule
  block), and optionally the call-order mirrors in
  `src/api/mutations/__tests__/loManualScoring.test.ts`.

Note: many "last changed" dates below are 2026-11-05. That was the folder-move
commit, not a logic change.

## New real-database tests needed (not conversions)

These kept tests are fine, but the query code beside them has no real-database test:

1. `SeasonCreationWizard`: its ~11 inline Supabase calls.
2. `NewMessageModal`: the inline `members` query (`.not().neq().order()`).
3. `lockMatchLineup` (`src/api/mutations/matchLineups.ts`): the happy-path
   `team_players` lookup.
4. LMS-entered checkbox: whether an operator may `UPDATE matches.lms_entered_at`.
5. `loadTrigger` (`src/systems/points-system/trigger-loader.ts`): the happy path.

## Missing coverage (was skipped placeholders)

Until 2026-11-17 these sat in the database tests as `describe.skip` blocks
holding only empty tests or `it.todo`. They showed up as "skipped" in every
run while testing nothing. They were deleted (U10). The plan for each is kept
here. All of them need the same thing first: a test fixture that creates an
auth user, a member row, an organization and an `organization_staff` (owner) row.

**`house_rules`** (`src/__tests__/database/houseRules.rls.test.ts`)
- CHECK: scope exclusivity (both / neither); `effect_type` ↔ `related_rule_id`;
  title length cap (121 rejected); body cardinality cap (51 elements rejected)
- Trigger: per-element body length (> 4000 chars rejected); UPDATE bumps
  `updated_at` + `updated_by`
- CASCADE: delete org → rules gone; delete league → rules gone
- View: `scope_name` populated for org + league rows
- RLS: owner + admin INSERT succeeds; league_rep INSERT rejected

**`per_game_allocators`** (`src/__tests__/database/per-game-allocator-schema.test.ts`)
- `scope='user'` insert with a real `author_id` succeeds
- `preferences.per_game_allocator_id` ON DELETE RESTRICT fires when the row is
  in use (insert a preferences row pointing at it, attempt the delete, assert
  the FK violation)

**Rating-mutation RPCs** (`src/__tests__/database/ratingMutationAtomicity.db.test.ts`)
Fixture also needs a `team_players` entry and a match + `match_lineup`.
- Happy path: roster member calls `set_match_lineup_rating`, audit row lands
- Reject: non-roster caller blocked by the authz check
- Reject: member not on the lineup blocked by the slot-resolution check
- Happy path: org owner calls `vacate_and_rescore_audit_marker`, marker lands
- Happy path: service role calls `recompute_member_rating`: no change → null;
  change → audit row + UPDATE
- Atomicity: force a rollback after the UPDATE but before the audit INSERT;
  neither persists (needs BEGIN/ROLLBACK scaffolding)

**`threshold_charts`** (`src/__tests__/database/thresholdChartsRls.db.test.ts`)
- Org owner INSERT/UPDATE/DELETE on an org-scoped chart succeeds
- Org owner UPDATE blocked when the row belongs to another org
- league_rep INSERT rejected (only owner/admin)
- Global chart INSERT/UPDATE/DELETE rejected even for an org owner
  (defense in depth; also enforced by the `prevent_global_chart_modification` trigger)

## Every faking file

Fakes: **a** = the Supabase client, **b** = the query/hook layer. Asserts:
**BEHAVIOUR** = what the code does with data; **MIRROR** = mostly re-states
which calls were made, so it can't catch a bad query. Risk: **HIGH** =
user-facing and the subject has query code the fake hides; **MEDIUM** = one
of those; **LOW** = neither.

| Test file | Subject | Fakes | Asserts | Decision | Reason | Risk | Subject last changed |
|---|---|---|---|---|---|---|---|
| src/api/queries/__tests__/matches.test.ts | src/api/queries/matches.ts (`getMyMatchMatches`) | a | Mixed: date filter + `scheduled_date` hoisting are behaviour; `.or(...)`/`.in('status',…)` argument checks are MIRROR | CONVERT | #277 bug class: the `season_week` embed, `.or` filter and team scoping only run against a fake. Keep the pure date-threshold cases | HIGH | 2026-11-17 |
| src/__tests__/integration/SeasonCreationWizard.smoke.test.tsx | src/wizards/season-v1/SeasonCreationWizard.tsx | a | BEHAVIOUR (renders; fake returns `[]`) | KEEP | Cheap crash check; the wizard's inline queries need their own DB tests (above) | HIGH | 2026-11-05 |
| src/api/mutations/matchLineups.test.ts | src/api/mutations/matchLineups.ts (`lockMatchLineup`) | a | BEHAVIOUR (network failure vs not-on-team message) | KEEP | A failed fetch can't be simulated against a real DB; happy path needs a DB test (above) | HIGH | 2026-11-05 |
| src/messages/__tests__/NewMessageModal.blocked.test.tsx | src/messages/NewMessageModal.tsx | a+b | BEHAVIOUR (blocked members hidden; loads once) | KEEP | UI regression test; the `members` query needs a DB test (above) | HIGH | 2026-11-05 |
| src/operator/components/__tests__/LmsEnteredCheckbox.test.tsx | src/operator/components/LmsEnteredCheckbox.tsx | a | BEHAVIOUR (optimistic flip, rollback); one `eq('id')` mirror | KEEP | UI is the point; the update permission needs a DB test (above) | HIGH | 2026-11-05 |
| src/race/__tests__/useRaceActions.test.tsx | src/race/useRaceActions.ts | a | BEHAVIOUR (toast names the player; refetch) | KEEP | RPCs covered by race.engine.db.test.ts | HIGH | 2026-11-04 |
| src/race/__tests__/useRaceRealtime.test.ts | src/race/useRaceData.ts (`useRaceRealtime`) | a | BEHAVIOUR (catch-up on subscribe, release on hidden tab) | KEEP | Realtime harness; HIGH by the rule only | HIGH | 2026-11-03 |
| src/api/mutations/__tests__/loManualScoring.test.ts | src/api/mutations/loManualScoring.ts | a+b | Mixed: guards are behaviour; 34 call-order/argument checks are MIRROR | KEEP (trim optional) | The guards aren't in the roundtrip DB tests | HIGH | 2026-11-01 |
| src/hooks/lineup/useLineupPersistence.test.ts | src/hooks/lineup/useLineupPersistence.ts | a+b | BEHAVIOUR (tiebreaker lock sends only the flag) | KEEP | Payload rule is logic | HIGH | 2026-11-01 |
| src/utils/__tests__/getTeamHandicapBonus.characterization.test.ts | src/utils/getTeamHandicapBonus.ts | a | Mixed: `computeTeamBonus` pure; "database lookup" block faked | KEEP (trim) | Drop the faked lookup block once teamHandicapBonus.db.test.ts is confirmed to cover it | HIGH | 2026-11-01 |
| src/api/queries/__tests__/thresholdLookup.test.ts | src/api/queries/thresholdLookup.ts | a | Mostly MIRROR (`rpc('lookup_threshold', …)` args) + result mapping | CONVERT | RPC signature only checked against a fake; keep the mapping cases | HIGH | 2026-10-28 |
| src/api/mutations/__tests__/sendMessage.timeout.test.ts | src/api/mutations/messages.ts (`sendMessage`) | a | BEHAVIOUR (stalled insert times out) | KEEP | A stall can't be reproduced against a real DB | HIGH | 2026-10-27 |
| src/systems/points-system/__tests__/trigger-loader.test.ts | src/systems/points-system/trigger-loader.ts | a | BEHAVIOUR (JSONB validation; never throws) | KEEP | Happy path needs a DB test (above) | HIGH | 2026-06-09 |
| src/systems/points-system/__tests__/per-game-allocator-loader.test.ts | src/systems/points-system/per-game-allocator-loader.ts | a | BEHAVIOUR (failure paths) | KEEP | Real query exercised by 17-point-smoke.test.ts | HIGH | 2026-06-07 |
| src/components/scoring/MatchEndVerification.test.tsx | src/components/scoring/MatchEndVerification.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-11-05 |
| src/messages/__tests__/ConversationList.profanity.test.tsx | src/messages/ConversationList.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-11-05 |
| src/messages/__tests__/CreateTeamChatPrompt.test.tsx | src/messages/CreateTeamChatPrompt.tsx | b | BEHAVIOUR | KEEP | `createTeamChat` has a DB test | MEDIUM | 2026-11-05 |
| src/messages/__tests__/MessageBubble.system-message.test.tsx | src/messages/MessageBubble.tsx | b | BEHAVIOUR | KEEP | Rendering | MEDIUM | 2026-11-05 |
| src/messages/__tests__/Messages.urlSync.test.tsx | src/messages/Messages.tsx | b | BEHAVIOUR | KEEP | Routing logic | MEDIUM | 2026-11-05 |
| src/messages/__tests__/ProfanityOnboardingModal.test.tsx | src/messages/ProfanityOnboardingModal.tsx | b | BEHAVIOUR | KEEP | Mutation calls are the visible outcome | MEDIUM | 2026-11-05 |
| src/messages/messageview/__tests__/MessageList.dmNames.test.tsx | src/messages/messageview/MessageList.tsx | b | BEHAVIOUR | KEEP | Rendering | MEDIUM | 2026-11-05 |
| src/messages/messageview/__tests__/MessageList.outgoing.test.tsx | src/messages/messageview/MessageList.tsx | b | BEHAVIOUR | KEEP | Rendering | MEDIUM | 2026-11-05 |
| src/messages/PushOnboardingPrompt.test.tsx | src/messages/PushOnboardingPrompt.tsx | b | BEHAVIOUR | KEEP | UI → action | MEDIUM | 2026-11-05 |
| src/navigation/roomsGate.test.tsx | src/navigation/NavRoutes.tsx | b | BEHAVIOUR | KEEP | Route gating | MEDIUM | 2026-11-05 |
| src/onboarding/OnboardingAttentionCard.test.tsx | src/onboarding/OnboardingAttentionCard.tsx | b | BEHAVIOUR | KEEP | Join RPCs have DB tests | MEDIUM | 2026-11-05 |
| src/onboarding/TeamJoinPage.test.tsx | src/onboarding/TeamJoinPage.tsx | b | BEHAVIOUR | KEEP | RPC has a DB test | MEDIUM | 2026-11-05 |
| src/operator/__tests__/ManualScoringMatchPicker.test.tsx | src/operator/ManualScoringMatchPicker.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-11-05 |
| src/operator/components/manual-scoring/__tests__/EntryPhase.test.tsx | src/operator/components/manual-scoring/EntryPhase.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-11-05 |
| src/operator/components/manual-scoring/__tests__/ReviewCorrection.test.tsx | src/operator/components/manual-scoring/ReviewPhase.tsx | b | BEHAVIOUR | KEEP | Roundtrip DB test covers the data | MEDIUM | 2026-11-05 |
| src/operator/components/manual-scoring/__tests__/SetupPhase.test.tsx | src/operator/components/manual-scoring/SetupPhase.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-11-05 |
| src/operator/components/PlayoffsCard.test.tsx | src/operator/components/PlayoffsCard.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-11-05 |
| src/operator/PlayoffSetup.test.tsx | src/operator/PlayoffSetup.tsx | b | BEHAVIOUR | KEEP | playoffMatchups.db.test.ts covers data | MEDIUM | 2026-11-05 |
| src/player/SpectateMatchCard.test.tsx | src/player/SpectateMatchCard.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-11-05 |
| src/stats/__tests__/PlayerStats.test.tsx | src/stats/PlayerStats.tsx | b | BEHAVIOUR | KEEP | The #277 page; its query is now covered by playerGameHistory.db.test.ts | MEDIUM | 2026-11-05 |
| src/race/__tests__/ScoreRace.test.tsx | src/race/ScoreRace.tsx | b | BEHAVIOUR | KEEP | UI → action | MEDIUM | 2026-11-04 |
| src/rooms/games/race/RoomRace.test.tsx | src/rooms/games/race/RoomRace.tsx | b | BEHAVIOUR | KEEP | roomRaces.db.test.ts covers RPCs | MEDIUM | 2026-11-04 |
| src/rooms/RoomsIndexPage.test.tsx | src/rooms/RoomsIndexPage.tsx | b | BEHAVIOUR | KEEP | rooms DB tests cover RPCs | MEDIUM | 2026-11-03 |
| src/rooms/useRoomRealtime.test.ts | src/rooms/useRoomRealtime.ts | a | BEHAVIOUR | KEEP | Realtime can't be tested against Postgres | MEDIUM | 2026-11-03 |
| src/api/hooks/useNavFavorites.test.tsx | src/api/hooks/useNavFavorites.ts | b | BEHAVIOUR | KEEP | membersNavFavorites.db.test.ts covers the write | MEDIUM | 2026-11-01 |
| src/brackets/CreateBracketFlow.test.tsx | src/brackets/CreateBracketFlow.tsx | b | BEHAVIOUR | KEEP | UI → action | MEDIUM | 2026-11-01 |
| src/components/layout/AppDrawer.test.tsx | src/components/layout/AppDrawer.tsx | b | BEHAVIOUR | KEEP | Nav UI | MEDIUM | 2026-11-01 |
| src/components/layout/AppSidebar.test.tsx | src/components/layout/AppSidebar.tsx | b | BEHAVIOUR | KEEP | Nav UI | MEDIUM | 2026-11-01 |
| src/components/layout/MemberLayout.test.tsx | src/components/layout/MemberLayout.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-11-01 |
| src/components/layout/MemberNavSections.test.tsx | src/components/layout/MemberNavSections.tsx | b | BEHAVIOUR | KEEP | Nav UI | MEDIUM | 2026-11-01 |
| src/components/layout/MyMatchTab.test.tsx | src/components/layout/MyMatchTab.tsx | b | BEHAVIOUR | KEEP | Real risk is `getMyMatchMatches` (CONVERT row) | MEDIUM | 2026-11-01 |
| src/components/PageHeader.test.tsx | src/components/PageHeader.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-11-01 |
| src/api/hooks/__tests__/useMyMatchSurfaces.test.tsx | src/api/hooks/useMyMatchSurfaces.ts | a+b | BEHAVIOUR | KEEP | Client fake is only `.channel` | MEDIUM | 2026-10-29 |
| src/hooks/__tests__/useProfanityFilter.test.ts | src/hooks/useProfanityFilter.ts | b | BEHAVIOUR | KEEP | Pure derivation | MEDIUM | 2026-10-28 |
| src/api/hooks/useRooms.test.ts | src/api/hooks/useRooms.ts | b | BEHAVIOUR | KEEP | RPCs covered by rooms DB tests | MEDIUM | 2026-10-10 |
| src/rooms/RoomActions.test.tsx | src/rooms/RoomActions.tsx | b | BEHAVIOUR | KEEP | UI → action | MEDIUM | 2026-10-10 |
| src/rooms/RoomPage.test.tsx | src/rooms/RoomPage.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-10-10 |
| src/brackets/BracketView.test.tsx | src/brackets/BracketView.tsx | b | BEHAVIOUR | KEEP | Bracket DB tests exist | MEDIUM | 2026-09-16 |
| src/rooms/games/coinflip/RoomCoinFlip.test.tsx | src/rooms/games/coinflip/RoomCoinFlip.tsx | b | BEHAVIOUR | KEEP | roomCoinFlips.db.test.ts covers RPCs | MEDIUM | 2026-09-16 |
| src/rooms/JoinRoomPage.test.tsx | src/rooms/JoinRoomPage.tsx | b | BEHAVIOUR | KEEP | rooms.join.db.test.ts covers the RPC | MEDIUM | 2026-09-16 |
| src/brackets/BracketsIndexPage.test.tsx | src/brackets/BracketsIndexPage.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-09-15 |
| src/brackets/paid/BracketSetupPage.test.tsx | src/brackets/paid/BracketSetupPage.tsx | b | BEHAVIOUR | KEEP | UI → action | MEDIUM | 2026-09-15 |
| src/brackets/paid/HopperView.test.tsx | src/brackets/paid/HopperView.tsx | b | BEHAVIOUR | KEEP | bracket.hopper.db.test.ts exists | MEDIUM | 2026-09-15 |
| src/brackets/paid/JoinHopperPage.test.tsx | src/brackets/paid/JoinHopperPage.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-09-15 |
| src/brackets/paid/JoinQrPoster.test.tsx | src/brackets/paid/JoinQrPoster.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-09-15 |
| src/realtime/useMatchRealtime.test.ts | src/realtime/useMatchRealtime.ts | a | BEHAVIOUR | KEEP | Realtime only | MEDIUM | 2026-09-15 |
| src/brackets/PublicBracketPage.test.tsx | src/brackets/PublicBracketPage.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-09-04 |
| src/api/hooks/usePushSubscription.test.ts | src/api/hooks/usePushSubscription.ts | b | Call checks, but they are the orchestration | KEEP | pushSubscriptions.db.test.ts covers rows | MEDIUM | 2026-08-25 |
| src/onboarding/components/JoinRequestList.test.tsx | src/onboarding/components/JoinRequestList.tsx | b | BEHAVIOUR | KEEP | Approve RPC has a DB test | MEDIUM | 2026-06-11 |
| src/api/hooks/usePendingJoinRequestCount.test.ts | src/api/hooks/usePendingJoinRequestCount.ts | b | BEHAVIOUR (0 fallback) | KEEP | Small but real | MEDIUM | 2026-06-05 |
| src/api/hooks/useTeamJoinView.test.ts | src/api/hooks/useTeamJoinView.ts | b | MIRROR (+ an enabled gate) | DELETE | Restates react-query wiring; get-team-join-view.test.ts proves the RPC | MEDIUM | 2026-06-05 |
| src/login/Login.test.tsx | src/login/Login.tsx | a | BEHAVIOUR | KEEP | Auth fake is a boundary | MEDIUM | 2026-06-05 |
| src/__tests__/integration/RulesPageHouseRules.test.tsx | src/rules/RulesPage.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-05-30 |
| src/login/passwordlessAuth.test.ts | src/login/passwordlessAuth.ts | a | Mostly MIRROR + guards | KEEP | Pins the auth contract; Postgres doesn't apply | MEDIUM | 2026-05-30 |
| src/__tests__/integration/LeagueRulesPage.test.tsx | src/operator/LeagueRules.tsx | b | BEHAVIOUR | KEEP | houseRules.rls.test.ts exists | MEDIUM | 2026-04-30 |
| src/__tests__/integration/HouseRuleDetailPage.test.tsx | src/rules/HouseRuleDetailPage.tsx | b | BEHAVIOUR | KEEP | UI given data | MEDIUM | 2026-04-25 |
| src/rooms/useRoomHeartbeat.test.ts | src/rooms/useRoomHeartbeat.ts | b | BEHAVIOUR (timer) | KEEP | No data shown | LOW | 2026-09-16 |
| src/whatsNew/__tests__/whatsNewAfterUpdate.test.tsx | src/whatsNew/useShowWhatsNewAfterUpdate.ts | b | BEHAVIOUR | KEEP | Static notes | LOW | 2026-09-05 |

`src/__tests__/database/17-point-smoke.test.ts` mocks `@/supabaseClient`
with a real local client, so it's already a real-database test.
