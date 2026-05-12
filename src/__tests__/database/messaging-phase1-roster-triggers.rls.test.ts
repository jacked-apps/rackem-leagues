// @vitest-environment jsdom
//
// jsdom env required for consistency with the rest of the messaging
// DB-backed tests. Trigger work uses raw SQL via pg.Pool, so the supabase-js
// happy-dom Content-Type bug doesn't directly bite, but we stay on jsdom
// in case future tests in this file add a supabase-js call.
/**
 * @fileoverview Tests for Unit 5 roster + captain lifecycle triggers
 *
 * Migration: supabase/migrations/20260509000004_messaging_phase1_roster_captain_triggers.sql
 *
 * Covers all 9 plan scenarios:
 *   1. INSERT team_players → participant row + "joined" system message
 *   2. DELETE team_players → participant left_at set + "left" system message
 *   3. UPDATE teams.captain_id → cannot_leave flips in team + captain chat
 *   4. Roster transfer (DELETE from team A, INSERT to team B)
 *   5. INSERT against a team whose chat doesn't exist is a no-op
 *   6. Soft-delete a member → past-membered on every chat
 *   7. Wholesale-replace (DELETE-all + INSERT-all same roster, single txn) is
 *      silent — zero spurious system messages
 *   8. Wholesale-replace with one add + one remove → exactly two messages
 *   9. Captain transfer with no captain chat present is a no-op (no error)
 *
 * Run: pnpm test:run src/__tests__/database/messaging-phase1-roster-triggers
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { executeSql, getPostgresPool } from '@/test/dbTestUtils';

let seasonId: string;
let leagueId: string;
let organizationId: string;
let teamId: string;
let teamConvId: string;
let captainConvId: string;
let initialCaptainId: string;
let initialRoster: Array<{ member_id: string; season_id: string }>;

/**
 * Pick a usable test team that has a captain + a multi-player roster,
 * activate the season so all auto-managed chats exist, snapshot the
 * captain + roster so we can restore after each test.
 */
async function bootstrap() {
  const rows = await executeSql(`
    SELECT t.id AS team_id, t.season_id, t.captain_id, l.id AS league_id, l.organization_id
    FROM teams t
    JOIN seasons s ON s.id = t.season_id
    JOIN leagues l ON l.id = s.league_id
    WHERE t.captain_id IS NOT NULL
    GROUP BY t.id, t.season_id, t.captain_id, l.id, l.organization_id
    HAVING (SELECT COUNT(*) FROM team_players WHERE team_id = t.id) >= 2
    ORDER BY t.created_at ASC
    LIMIT 1
  `);
  expect(rows.length).toBe(1);
  teamId = rows[0].team_id;
  seasonId = rows[0].season_id;
  leagueId = rows[0].league_id;
  organizationId = rows[0].organization_id;
  initialCaptainId = rows[0].captain_id;

  const roster = await executeSql(
    `SELECT member_id, season_id FROM team_players WHERE team_id = $1 ORDER BY member_id`,
    [teamId]
  );
  initialRoster = roster;

  // Reset season to upcoming + clear any auto-managed chats, then re-activate
  // so we start from a known state with all four chat types present.
  await executeSql(`UPDATE seasons SET status = 'upcoming' WHERE id = $1`, [
    seasonId,
  ]);
  await executeSql(
    `DELETE FROM conversations
      WHERE auto_managed = TRUE
        AND (
          (scope_type = 'team' AND scope_id IN (SELECT id FROM teams WHERE season_id = $1))
          OR (scope_type = 'season' AND scope_id = $1)
          OR (scope_type = 'organization' AND scope_id = $2)
        )`,
    [seasonId, organizationId]
  );
  // Also bring down any sibling active seasons so org chat is clean
  await executeSql(
    `UPDATE seasons SET status = 'upcoming'
      WHERE status = 'active' AND league_id IN (
        SELECT id FROM leagues WHERE organization_id = $1
      )`,
    [organizationId]
  );

  await executeSql(`UPDATE seasons SET status = 'active' WHERE id = $1`, [
    seasonId,
  ]);

  const team = await executeSql(
    `SELECT id FROM conversations
      WHERE scope_type = 'team' AND scope_id = $1 AND auto_managed = TRUE`,
    [teamId]
  );
  teamConvId = team[0].id;

  const captain = await executeSql(
    `SELECT id FROM conversations
      WHERE scope_type = 'season' AND scope_id = $1
        AND conversation_type = 'captains_chat' AND auto_managed = TRUE`,
    [seasonId]
  );
  captainConvId = captain[0].id;
}

async function restoreRosterAndCaptain() {
  // Put the original captain back
  await executeSql(`UPDATE teams SET captain_id = $1 WHERE id = $2`, [
    initialCaptainId,
    teamId,
  ]);

  // Restore roster to the bootstrap snapshot
  await executeSql(`DELETE FROM team_players WHERE team_id = $1`, [teamId]);
  for (const row of initialRoster) {
    await executeSql(
      `INSERT INTO team_players (team_id, member_id, season_id) VALUES ($1, $2, $3)
       ON CONFLICT (team_id, member_id) DO NOTHING`,
      [teamId, row.member_id, row.season_id]
    );
  }

  // Reset deleted_at on every roster member in case a soft-delete test ran
  await executeSql(
    `UPDATE members SET deleted_at = NULL
      WHERE id IN (SELECT member_id FROM team_players WHERE team_id = $1)`,
    [teamId]
  );
}

async function countSystemMessages(convId: string): Promise<number> {
  const rows = await executeSql(
    `SELECT COUNT(*)::int AS n FROM messages
      WHERE conversation_id = $1 AND is_system = TRUE`,
    [convId]
  );
  return rows[0].n;
}

async function pickUnrelatedMember(): Promise<string> {
  // Excludes anyone currently on this team AND anyone who already has a
  // conversation_participants row in the team chat (past-members from prior
  // tests would re-activate via ON CONFLICT instead of triggering the real
  // INSERT path the tests rely on).
  const rows = await executeSql(
    `SELECT id FROM members
      WHERE deleted_at IS NULL
        AND id NOT IN (SELECT member_id FROM team_players WHERE team_id = $1)
        AND id NOT IN (SELECT user_id FROM conversation_participants WHERE conversation_id = $2)
      ORDER BY created_at ASC
      LIMIT 1`,
    [teamId, teamConvId]
  );
  expect(rows.length).toBe(1);
  return rows[0].id;
}

describe('Unit 5 — roster + captain lifecycle triggers', () => {
  beforeAll(async () => {
    await bootstrap();
  });

  beforeEach(async () => {
    await restoreRosterAndCaptain();
  });

  afterAll(async () => {
    await restoreRosterAndCaptain();
    await executeSql(`UPDATE seasons SET status = 'upcoming' WHERE id = $1`, [
      seasonId,
    ]);
  });

  // ---------------------------------------------------------------------------
  // 1. Insert → participant + system message
  // ---------------------------------------------------------------------------
  it('INSERT team_players → adds active participant + posts "joined" system message', async () => {
    const newMemberId = await pickUnrelatedMember();
    const baseline = await countSystemMessages(teamConvId);

    await executeSql(
      `INSERT INTO team_players (team_id, member_id, season_id) VALUES ($1, $2, $3)`,
      [teamId, newMemberId, seasonId]
    );

    const after = await countSystemMessages(teamConvId);
    expect(after).toBe(baseline + 1);

    const participant = await executeSql(
      `SELECT user_id, left_at FROM conversation_participants
        WHERE conversation_id = $1 AND user_id = $2`,
      [teamConvId, newMemberId]
    );
    expect(participant.length).toBe(1);
    expect(participant[0].left_at).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 2. Delete → left_at set + system message
  // ---------------------------------------------------------------------------
  it('DELETE team_players (real removal) → sets left_at + posts "left" system message', async () => {
    const baseline = await countSystemMessages(teamConvId);

    // Pick a non-captain roster member to remove
    const targets = await executeSql(
      `SELECT member_id FROM team_players
        WHERE team_id = $1 AND member_id != $2 LIMIT 1`,
      [teamId, initialCaptainId]
    );
    const victimId = targets[0].member_id;

    await executeSql(
      `DELETE FROM team_players WHERE team_id = $1 AND member_id = $2`,
      [teamId, victimId]
    );

    const after = await countSystemMessages(teamConvId);
    expect(after).toBe(baseline + 1);

    const participant = await executeSql(
      `SELECT left_at FROM conversation_participants
        WHERE conversation_id = $1 AND user_id = $2`,
      [teamConvId, victimId]
    );
    expect(participant[0].left_at).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 3. Captain change → cannot_leave flips in team + captain chat
  // ---------------------------------------------------------------------------
  it('UPDATE teams.captain_id → flips cannot_leave in team and captain chats', async () => {
    // New captain must be on the roster
    const nextCaptainRow = await executeSql(
      `SELECT member_id FROM team_players
        WHERE team_id = $1 AND member_id != $2 LIMIT 1`,
      [teamId, initialCaptainId]
    );
    const newCaptainId = nextCaptainRow[0].member_id;

    const teamMsgBaseline = await countSystemMessages(teamConvId);

    await executeSql(`UPDATE teams SET captain_id = $1 WHERE id = $2`, [
      newCaptainId,
      teamId,
    ]);

    // Team chat: new captain cannot_leave=true, old false
    const teamRows = await executeSql(
      `SELECT user_id, cannot_leave FROM conversation_participants
        WHERE conversation_id = $1 AND user_id IN ($2, $3)`,
      [teamConvId, initialCaptainId, newCaptainId]
    );
    const teamMap = new Map(
      teamRows.map((r: { user_id: string; cannot_leave: boolean }) => [r.user_id, r.cannot_leave])
    );
    expect(teamMap.get(newCaptainId)).toBe(true);
    expect(teamMap.get(initialCaptainId)).toBe(false);

    // Captain chat: same flips (assuming old captain doesn't captain another team in this season)
    const captainRows = await executeSql(
      `SELECT user_id, cannot_leave FROM conversation_participants
        WHERE conversation_id = $1 AND user_id IN ($2, $3)`,
      [captainConvId, initialCaptainId, newCaptainId]
    );
    const captainMap = new Map(
      captainRows.map((r: { user_id: string; cannot_leave: boolean }) => [r.user_id, r.cannot_leave])
    );
    expect(captainMap.get(newCaptainId)).toBe(true);
    expect(captainMap.get(initialCaptainId)).toBe(false);

    // System message in team chat
    expect(await countSystemMessages(teamConvId)).toBe(teamMsgBaseline + 1);
  });

  // ---------------------------------------------------------------------------
  // 4. Roster transfer between teams
  // ---------------------------------------------------------------------------
  it('Roster transfer (delete A → insert B) marks past-member on A and active on B', async () => {
    // Need a second team in the same season
    const otherTeamRows = await executeSql(
      `SELECT id FROM teams WHERE season_id = $1 AND id != $2 LIMIT 1`,
      [seasonId, teamId]
    );
    expect(otherTeamRows.length).toBeGreaterThan(0);
    const otherTeamId = otherTeamRows[0].id;

    // Get other team's chat
    const otherConv = await executeSql(
      `SELECT id FROM conversations
        WHERE scope_type = 'team' AND scope_id = $1 AND auto_managed = TRUE`,
      [otherTeamId]
    );
    const otherConvId = otherConv[0].id;

    // Pick a non-captain victim already on team A
    const movers = await executeSql(
      `SELECT member_id FROM team_players
        WHERE team_id = $1 AND member_id != $2 LIMIT 1`,
      [teamId, initialCaptainId]
    );
    const moverId = movers[0].member_id;

    // Single-transaction transfer via DO block so deferred triggers fire after
    await executeSql(`
      DO $$
      BEGIN
        DELETE FROM team_players WHERE team_id = '${teamId}' AND member_id = '${moverId}';
        INSERT INTO team_players (team_id, member_id, season_id)
          VALUES ('${otherTeamId}', '${moverId}', '${seasonId}')
          ON CONFLICT (team_id, member_id) DO NOTHING;
      END $$;
    `);

    // Past-member on team A
    const a = await executeSql(
      `SELECT left_at FROM conversation_participants
        WHERE conversation_id = $1 AND user_id = $2`,
      [teamConvId, moverId]
    );
    expect(a[0].left_at).not.toBeNull();

    // Active on team B (or created if was not there before)
    const b = await executeSql(
      `SELECT left_at FROM conversation_participants
        WHERE conversation_id = $1 AND user_id = $2`,
      [otherConvId, moverId]
    );
    expect(b.length).toBe(1);
    expect(b[0].left_at).toBeNull();

    // Cleanup: remove the mover from team B (deferred trigger handles the
    // chat side at end-of-tx).
    await executeSql(
      `DELETE FROM team_players WHERE team_id = $1 AND member_id = $2`,
      [otherTeamId, moverId]
    );
  });

  // ---------------------------------------------------------------------------
  // 5. INSERT on a team with no chat → no-op (no error)
  // ---------------------------------------------------------------------------
  it('INSERT on a team with no auto-managed chat is a no-op (no error)', async () => {
    // Temporarily delete the team chat
    await executeSql(
      `DELETE FROM conversations
        WHERE scope_type = 'team' AND scope_id = $1 AND auto_managed = TRUE`,
      [teamId]
    );

    const newMemberId = await pickUnrelatedMember();

    // Should not throw
    await executeSql(
      `INSERT INTO team_players (team_id, member_id, season_id) VALUES ($1, $2, $3)`,
      [teamId, newMemberId, seasonId]
    );

    // Re-create the chat for subsequent tests
    await executeSql(`UPDATE seasons SET status = 'upcoming' WHERE id = $1`, [
      seasonId,
    ]);
    await executeSql(`UPDATE seasons SET status = 'active' WHERE id = $1`, [
      seasonId,
    ]);

    // Refresh teamConvId
    const refresh = await executeSql(
      `SELECT id FROM conversations
        WHERE scope_type = 'team' AND scope_id = $1 AND auto_managed = TRUE`,
      [teamId]
    );
    teamConvId = refresh[0].id;
  });

  // ---------------------------------------------------------------------------
  // 6. Soft-delete a member → past-membered on every chat
  // ---------------------------------------------------------------------------
  it('Soft-deleting a member marks them as past-member on every chat', async () => {
    // Pick a non-captain roster member
    const targets = await executeSql(
      `SELECT member_id FROM team_players
        WHERE team_id = $1 AND member_id != $2 LIMIT 1`,
      [teamId, initialCaptainId]
    );
    const victimId = targets[0].member_id;

    // Confirm they're active in at least the team chat
    const before = await executeSql(
      `SELECT left_at FROM conversation_participants
        WHERE user_id = $1 AND left_at IS NULL`,
      [victimId]
    );
    expect(before.length).toBeGreaterThan(0);

    // Soft-delete
    await executeSql(`UPDATE members SET deleted_at = NOW() WHERE id = $1`, [
      victimId,
    ]);

    const after = await executeSql(
      `SELECT left_at FROM conversation_participants
        WHERE user_id = $1 AND left_at IS NULL`,
      [victimId]
    );
    expect(after.length).toBe(0);

    // Cleanup: un-soft-delete so beforeEach restoreRoster works
    await executeSql(`UPDATE members SET deleted_at = NULL WHERE id = $1`, [
      victimId,
    ]);
  });

  // ---------------------------------------------------------------------------
  // 7. Wholesale-replace (unchanged roster) → zero system messages
  // ---------------------------------------------------------------------------
  it('Wholesale-replace with unchanged roster produces zero spurious system messages', async () => {
    const baseline = await countSystemMessages(teamConvId);

    // Snapshot the current roster as JSON-encoded VALUES list for the DO block
    const roster = await executeSql(
      `SELECT member_id, season_id FROM team_players WHERE team_id = $1`,
      [teamId]
    );
    const valueRows = roster
      .map((r: { member_id: string; season_id: string }) => `('${teamId}', '${r.member_id}', '${r.season_id}')`)
      .join(',');

    // Single-tx wipe-and-replace; the deferred DELETE trigger fires AT COMMIT
    // and finds every member is back, so it silently no-ops.
    await executeSql(`
      DO $$
      BEGIN
        DELETE FROM team_players WHERE team_id = '${teamId}';
        INSERT INTO team_players (team_id, member_id, season_id) VALUES ${valueRows};
      END $$;
    `);

    const after = await countSystemMessages(teamConvId);
    expect(after).toBe(baseline);
  });

  // ---------------------------------------------------------------------------
  // 8. Wholesale-replace adding one + removing one → exactly 2 messages
  // ---------------------------------------------------------------------------
  it('Wholesale-replace with one add + one remove produces exactly two system messages', async () => {
    const baseline = await countSystemMessages(teamConvId);

    const roster = await executeSql(
      `SELECT member_id, season_id FROM team_players WHERE team_id = $1`,
      [teamId]
    );

    // Drop the first non-captain member, add a new (unrelated) member
    const dropped = roster.find(
      (r: { member_id: string }) => r.member_id !== initialCaptainId
    );
    expect(dropped).toBeTruthy();

    const newMemberId = await pickUnrelatedMember();

    const newRoster = roster
      .filter((r: { member_id: string }) => r.member_id !== dropped.member_id)
      .concat([{ member_id: newMemberId, season_id: seasonId }]);

    const valueRows = newRoster
      .map((r: { member_id: string; season_id: string }) => `('${teamId}', '${r.member_id}', '${r.season_id}')`)
      .join(',');

    await executeSql(`
      DO $$
      BEGIN
        DELETE FROM team_players WHERE team_id = '${teamId}';
        INSERT INTO team_players (team_id, member_id, season_id) VALUES ${valueRows};
      END $$;
    `);

    const after = await countSystemMessages(teamConvId);
    expect(after).toBe(baseline + 2);
  });

  // ---------------------------------------------------------------------------
  // 9. Captain transfer with no captain chat → no error
  // ---------------------------------------------------------------------------
  it('Captain transfer with no captain chat does not error', async () => {
    // Temporarily delete the captain chat
    await executeSql(
      `DELETE FROM conversations
        WHERE scope_type = 'season' AND scope_id = $1
          AND conversation_type = 'captains_chat' AND auto_managed = TRUE`,
      [seasonId]
    );

    const nextCaptainRow = await executeSql(
      `SELECT member_id FROM team_players
        WHERE team_id = $1 AND member_id != $2 LIMIT 1`,
      [teamId, initialCaptainId]
    );
    const newCaptainId = nextCaptainRow[0].member_id;

    // Should not throw
    await executeSql(`UPDATE teams SET captain_id = $1 WHERE id = $2`, [
      newCaptainId,
      teamId,
    ]);

    // Re-activate to rebuild captain chat for following tests
    await executeSql(`UPDATE seasons SET status = 'upcoming' WHERE id = $1`, [
      seasonId,
    ]);
    await executeSql(`UPDATE seasons SET status = 'active' WHERE id = $1`, [
      seasonId,
    ]);
    const refresh = await executeSql(
      `SELECT id FROM conversations
        WHERE scope_type = 'season' AND scope_id = $1
          AND conversation_type = 'captains_chat' AND auto_managed = TRUE`,
      [seasonId]
    );
    captainConvId = refresh[0].id;
  });
});
