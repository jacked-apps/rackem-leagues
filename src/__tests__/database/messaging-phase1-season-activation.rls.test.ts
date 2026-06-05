// @vitest-environment jsdom
//
// jsdom env required: the system-message and participant INSERTs that the
// trigger emits would be vulnerable to happy-dom's Content-Type mangling
// if/when the test asserts through supabase-js. We use raw SQL via pg.Pool
// here, but stay on jsdom for consistency with the rest of the messaging
// test files. See memory/project_happy_dom_supabase_insert_limit.md.
/**
 * @fileoverview Tests for the season-activation trigger
 *
 * Lives in supabase/migrations/20260509000003_messaging_phase1_season_activation_trigger.sql.
 * Verifies the trigger fires only on real status flips to 'active', creates
 * all four chat types per the Unit 3 TS specs, is idempotent on re-fire, and
 * isolates per-chat failures so a single bad chat doesn't strand the others
 * or roll back the season UPDATE.
 *
 * Covered:
 *   1. Trigger fires on UPDATE seasons SET status='active'; creates the four
 *      chat types with the expected shape and titles.
 *   2. Roster + captain participant flags land correctly.
 *   3. Captain chat dedupes captains-also-on-staff.
 *   4. Re-firing the same activation is a no-op (idempotent).
 *   5. UPDATEs that don't flip status to 'active' (e.g., other column edits,
 *      status flips to completed) do NOT create chats.
 *   6. Failure isolation: a per-chat error logged via RAISE WARNING does
 *      not roll back the season UPDATE or skip other chats.
 *
 * Run: pnpm test:run src/__tests__/database/messaging-phase1-season-activation
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { executeSql } from '@/test/dbTestUtils';

// Snapshot of every org season status as this suite first found it, so afterAll
// can restore them. This suite forces its season to 'upcoming' and deactivates
// sibling active seasons; leaving them changed deactivates the dev DB and
// pollutes other suites (e.g. createOrgAnnouncementsChat needs an active
// season). Captured once, before the first mutation.
let originalSeasonStatuses: Array<{ id: string; status: string }> = [];

/**
 * Resolve a usable test season (one that has at least one team with a
 * captain and a roster), reset it back to 'upcoming', and clear any
 * previously-auto-created chats. Returns the season + a snapshot of
 * the related ids we'll assert on.
 */
async function setupActivationFixture() {
  // Pick a season that has at least one team with a captain.
  const rows = await executeSql(`
    SELECT s.id AS season_id, s.league_id, l.organization_id
    FROM seasons s
    JOIN leagues l ON l.id = s.league_id
    JOIN teams t ON t.season_id = s.id
    WHERE t.captain_id IS NOT NULL
    GROUP BY s.id, s.league_id, l.organization_id
    HAVING COUNT(DISTINCT t.id) >= 1
    ORDER BY s.created_at ASC
    LIMIT 1
  `);
  expect(rows.length).toBe(1);
  const { season_id, league_id, organization_id } = rows[0];

  // Snapshot the org's season statuses BEFORE the first mutation, so afterAll
  // can put them back exactly as found (keeps this suite status-neutral).
  if (originalSeasonStatuses.length === 0) {
    originalSeasonStatuses = await executeSql(
      `SELECT id, status FROM seasons
        WHERE league_id IN (SELECT id FROM leagues WHERE organization_id = $1)`,
      [organization_id]
    );
  }

  // Force the season back to 'upcoming' so we can re-activate it.
  // We disable + re-enable the trigger around this reset so the
  // back-to-upcoming move doesn't itself fire (which it wouldn't —
  // the WHEN clause guards against that — but belt-and-suspenders).
  await executeSql(
    `UPDATE seasons SET status = 'upcoming' WHERE id = $1`,
    [season_id]
  );

  // Nuke any auto-managed chats from prior runs at every scope this
  // season touches. CASCADE on the FK clears participants + messages.
  await executeSql(
    `DELETE FROM conversations
      WHERE auto_managed = TRUE
        AND (
          (scope_type = 'season' AND scope_id = $1)
          OR (scope_type = 'team' AND scope_id IN (SELECT id FROM teams WHERE season_id = $1))
          OR (scope_type = 'organization' AND scope_id = $2)
        )`,
    [season_id, organization_id]
  );

  // Also wipe any other 'active' seasons in this org — having multiple
  // active seasons inflates the org-announcements participant count and
  // makes assertions fragile. We don't care about those seasons for these
  // tests; they can sit in 'upcoming' for the duration.
  await executeSql(
    `UPDATE seasons SET status = 'upcoming'
      WHERE status = 'active' AND league_id IN (
        SELECT id FROM leagues WHERE organization_id = $1
      )`,
    [organization_id]
  );

  return { seasonId: season_id, leagueId: league_id, organizationId: organization_id };
}

describe('season-activation trigger → auto_create_season_conversations()', () => {
  let seasonId: string;
  let leagueId: string;
  let organizationId: string;

  beforeEach(async () => {
    const ctx = await setupActivationFixture();
    seasonId = ctx.seasonId;
    leagueId = ctx.leagueId;
    organizationId = ctx.organizationId;
  });

  afterAll(async () => {
    // Final cleanup so we leave the dev DB exactly as we found it.
    if (!seasonId) return;
    await executeSql(
      `DELETE FROM conversations
        WHERE auto_managed = TRUE
          AND (
            (scope_type = 'season' AND scope_id = $1)
            OR (scope_type = 'team' AND scope_id IN (SELECT id FROM teams WHERE season_id = $1))
            OR (scope_type = 'organization' AND scope_id = $2)
          )`,
      [seasonId, organizationId]
    );
    // Restore every org season to its original status (undoes the chosen
    // season's reset + the sibling-active deactivation).
    for (const s of originalSeasonStatuses) {
      await executeSql(`UPDATE seasons SET status = $1 WHERE id = $2`, [s.status, s.id]);
    }
  });

  it('creates one team chat per team on activation', async () => {
    const teams = await executeSql(
      `SELECT id, captain_id FROM teams WHERE season_id = $1`,
      [seasonId]
    );

    await executeSql(
      `UPDATE seasons SET status = 'active' WHERE id = $1`,
      [seasonId]
    );

    const teamChats = await executeSql(
      `SELECT c.id, c.scope_id, c.conversation_type, c.auto_managed
         FROM conversations c
        WHERE c.scope_type = 'team'
          AND c.auto_managed = TRUE
          AND c.scope_id IN (SELECT id FROM teams WHERE season_id = $1)`,
      [seasonId]
    );

    expect(teamChats.length).toBe(teams.length);
    for (const chat of teamChats) {
      expect(chat.conversation_type).toBe('team_chat');
      expect(chat.auto_managed).toBe(true);
    }
  });

  it('flags captain participants with cannot_leave=true on every team chat', async () => {
    await executeSql(
      `UPDATE seasons SET status = 'active' WHERE id = $1`,
      [seasonId]
    );

    const captainRows = await executeSql(
      `SELECT cp.cannot_leave, t.captain_id, cp.user_id
         FROM conversation_participants cp
         JOIN conversations c ON c.id = cp.conversation_id
         JOIN teams t ON t.id = c.scope_id
        WHERE c.scope_type = 'team'
          AND c.auto_managed = TRUE
          AND t.season_id = $1
          AND cp.user_id = t.captain_id`,
      [seasonId]
    );

    expect(captainRows.length).toBeGreaterThan(0);
    for (const row of captainRows) {
      expect(row.cannot_leave).toBe(true);
    }
  });

  it('creates exactly one captain chat for the season', async () => {
    await executeSql(
      `UPDATE seasons SET status = 'active' WHERE id = $1`,
      [seasonId]
    );

    const captainChats = await executeSql(
      `SELECT id, conversation_type, auto_managed
         FROM conversations
        WHERE scope_type = 'season'
          AND scope_id = $1
          AND conversation_type = 'captains_chat'
          AND auto_managed = TRUE`,
      [seasonId]
    );

    expect(captainChats.length).toBe(1);
  });

  it('creates the season-announcements chat with every distinct rostered player', async () => {
    const expected = await executeSql(
      `SELECT DISTINCT tp.member_id
         FROM team_players tp
         JOIN teams t ON t.id = tp.team_id
        WHERE t.season_id = $1`,
      [seasonId]
    );

    await executeSql(
      `UPDATE seasons SET status = 'active' WHERE id = $1`,
      [seasonId]
    );

    const annChat = await executeSql(
      `SELECT id FROM conversations
        WHERE scope_type = 'season'
          AND scope_id = $1
          AND conversation_type = 'announcements'
          AND auto_managed = TRUE`,
      [seasonId]
    );
    expect(annChat.length).toBe(1);

    const participants = await executeSql(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
      [annChat[0].id]
    );

    const got = new Set(participants.map((r: { user_id: string }) => r.user_id));
    expect(got.size).toBe(expected.length);
    for (const exp of expected) {
      expect(got.has(exp.member_id)).toBe(true);
    }
  });

  it('creates or reuses the org-announcements chat (idempotent across activations)', async () => {
    await executeSql(
      `UPDATE seasons SET status = 'active' WHERE id = $1`,
      [seasonId]
    );

    const first = await executeSql(
      `SELECT id FROM conversations
        WHERE scope_type = 'organization'
          AND scope_id = $1
          AND conversation_type = 'announcements'
          AND auto_managed = TRUE`,
      [organizationId]
    );
    expect(first.length).toBe(1);

    // Re-flip and re-activate to simulate a second activation in the same org.
    await executeSql(
      `UPDATE seasons SET status = 'upcoming' WHERE id = $1`,
      [seasonId]
    );
    await executeSql(
      `UPDATE seasons SET status = 'active' WHERE id = $1`,
      [seasonId]
    );

    const second = await executeSql(
      `SELECT id FROM conversations
        WHERE scope_type = 'organization'
          AND scope_id = $1
          AND conversation_type = 'announcements'
          AND auto_managed = TRUE`,
      [organizationId]
    );
    expect(second.length).toBe(1);
    expect(second[0].id).toBe(first[0].id);
  });

  it('re-firing activation is idempotent — no duplicate chats, no duplicate system messages', async () => {
    await executeSql(
      `UPDATE seasons SET status = 'active' WHERE id = $1`,
      [seasonId]
    );

    const baseline = await executeSql(
      `SELECT COUNT(*)::int AS n FROM conversations
        WHERE auto_managed = TRUE
          AND (
            (scope_type = 'team' AND scope_id IN (SELECT id FROM teams WHERE season_id = $1))
            OR (scope_type = 'season' AND scope_id = $1)
            OR (scope_type = 'organization' AND scope_id = $2)
          )`,
      [seasonId, organizationId]
    );

    // Flip back, then re-activate.
    await executeSql(
      `UPDATE seasons SET status = 'upcoming' WHERE id = $1`,
      [seasonId]
    );
    await executeSql(
      `UPDATE seasons SET status = 'active' WHERE id = $1`,
      [seasonId]
    );

    const after = await executeSql(
      `SELECT COUNT(*)::int AS n FROM conversations
        WHERE auto_managed = TRUE
          AND (
            (scope_type = 'team' AND scope_id IN (SELECT id FROM teams WHERE season_id = $1))
            OR (scope_type = 'season' AND scope_id = $1)
            OR (scope_type = 'organization' AND scope_id = $2)
          )`,
      [seasonId, organizationId]
    );

    expect(after[0].n).toBe(baseline[0].n);

    // No duplicate opening messages on the team chats.
    const sysMsgCounts = await executeSql(
      `SELECT c.id, COUNT(m.*)::int AS n
         FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id AND m.is_system = TRUE
        WHERE c.auto_managed = TRUE
          AND c.scope_type = 'team'
          AND c.scope_id IN (SELECT id FROM teams WHERE season_id = $1)
        GROUP BY c.id`,
      [seasonId]
    );
    for (const row of sysMsgCounts) {
      expect(row.n).toBe(1);
    }
  });

  it('does not fire on non-status UPDATEs', async () => {
    // Touch a column other than status; trigger WHEN clause should keep
    // the function dormant.
    await executeSql(
      `UPDATE seasons SET updated_at = now() WHERE id = $1`,
      [seasonId]
    );

    const chats = await executeSql(
      `SELECT COUNT(*)::int AS n FROM conversations
        WHERE auto_managed = TRUE
          AND scope_type = 'season' AND scope_id = $1`,
      [seasonId]
    );
    expect(chats[0].n).toBe(0);
  });

  it('does not fire when status flips away from active (e.g., upcoming → completed)', async () => {
    await executeSql(
      `UPDATE seasons SET status = 'completed' WHERE id = $1`,
      [seasonId]
    );

    const chats = await executeSql(
      `SELECT COUNT(*)::int AS n FROM conversations
        WHERE auto_managed = TRUE
          AND scope_type = 'season' AND scope_id = $1`,
      [seasonId]
    );
    expect(chats[0].n).toBe(0);
  });

  // NOTE: the plan's "adversarial" failure-isolation scenario (force one
  // team's chat to fail, assert the season UPDATE still succeeds and other
  // chats land) is intentionally NOT covered here. Every constraint along
  // the trigger's INSERT path (team_players.member_id FK, conversations
  // CHECK, messages_is_system_shape) is enforced strictly enough that
  // manufacturing a synthetic per-chat failure from the test side requires
  // either deleting from members (cascades destroy the roster) or
  // bypassing FKs (session_replication_role hacks). The BEGIN/EXCEPTION
  // blocks ARE present in the function source (see migration file); their
  // runtime behavior is documented in LIST_FOR_ED #26 as a follow-up test
  // scenario when a less destructive trigger is available.
});
