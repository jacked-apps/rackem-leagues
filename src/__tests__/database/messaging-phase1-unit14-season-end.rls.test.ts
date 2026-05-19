// @vitest-environment jsdom
/**
 * @fileoverview Tests for the Unit 14 season-end cannot_leave-release trigger
 *
 * Migration: supabase/migrations/20260517000004_messaging_phase1_unit14_season_end_release_cannot_leave.sql
 *
 * Verifies:
 *   - Activate a season → captain has cannot_leave=TRUE on team chat
 *     and captains chat (precondition from Unit 4 + Unit 5).
 *   - Flip status active → completed → cannot_leave flips to FALSE on
 *     both chats for the captain (and all other participants who had it).
 *   - Other seasons' chats untouched (scoping by team.season_id +
 *     captains_chat.scope_id is correct).
 *   - Status change that's NOT active → completed (e.g., active →
 *     cancelled) does NOT fire the trigger.
 *   - Idempotent re-fire is a no-op.
 *
 * Run: pnpm test:run src/__tests__/database/messaging-phase1-unit14-season-end
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { executeSql } from '@/test/dbTestUtils';

let seasonId: string;
let otherSeasonId: string | null = null;
let teamId: string;
let captainId: string;
let originalStatus: string;
let otherSeasonOriginalStatus: string | null = null;

beforeAll(async () => {
  // Find a real seeded ACTIVE season with at least one team that has a
  // captain. Pick the first such pair.
  const rows = await executeSql<{
    season_id: string;
    status: string;
    team_id: string;
    captain_id: string;
  }>(`
    SELECT s.id AS season_id, s.status, t.id AS team_id, t.captain_id
    FROM seasons s
    JOIN teams t ON t.season_id = s.id
    WHERE s.status = 'active' AND t.captain_id IS NOT NULL
    ORDER BY s.id, t.team_name
    LIMIT 1
  `);
  if (rows.length === 0) {
    throw new Error('Unit 14 test needs an active season with a captained team');
  }
  seasonId = rows[0].season_id;
  originalStatus = rows[0].status;
  teamId = rows[0].team_id;
  captainId = rows[0].captain_id;

  // Find a different active season to confirm we don't touch it.
  const others = await executeSql<{ season_id: string; status: string }>(
    `SELECT id AS season_id, status FROM seasons WHERE id != $1 AND status = 'active' LIMIT 1`,
    [seasonId],
  );
  if (others.length > 0) {
    otherSeasonId = others[0].season_id;
    otherSeasonOriginalStatus = others[0].status;
  }
});

afterAll(async () => {
  if (seasonId && originalStatus) {
    await executeSql(`UPDATE seasons SET status = $1 WHERE id = $2`, [
      originalStatus,
      seasonId,
    ]);
  }
  if (otherSeasonId && otherSeasonOriginalStatus) {
    await executeSql(`UPDATE seasons SET status = $1 WHERE id = $2`, [
      otherSeasonOriginalStatus,
      otherSeasonId,
    ]);
  }
});

beforeEach(async () => {
  // Reset the season to active so we can re-test the trigger.
  await executeSql(`UPDATE seasons SET status = 'active' WHERE id = $1`, [
    seasonId,
  ]);
  // Restore captain's cannot_leave=TRUE on the team chat (the trigger
  // we're testing flips it to FALSE; previous tests in this file might
  // leave it that way).
  await executeSql(`
    UPDATE conversation_participants cp
    SET cannot_leave = TRUE
    WHERE cp.user_id = $1
      AND cp.conversation_id IN (
        SELECT c.id FROM conversations c
        WHERE (c.scope_type = 'team' AND c.scope_id = $2)
           OR (c.scope_type = 'season' AND c.scope_id = $3 AND c.conversation_type = 'captains_chat')
      )
  `, [captainId, teamId, seasonId]);
});

describe('Unit 14 — season-end trigger releases cannot_leave', () => {
  it('precondition: captain has cannot_leave=TRUE on team_chat for an active season', async () => {
    const rows = await executeSql<{ cannot_leave: boolean }>(`
      SELECT cp.cannot_leave
      FROM conversation_participants cp
      JOIN conversations c ON c.id = cp.conversation_id
      WHERE c.scope_type = 'team'
        AND c.scope_id = $1
        AND cp.user_id = $2
    `, [teamId, captainId]);
    expect(rows.length).toBe(1);
    expect(rows[0].cannot_leave).toBe(true);
  });

  it('flips cannot_leave → FALSE on team_chat and captains_chat for the captain when season completes', async () => {
    await executeSql(`UPDATE seasons SET status = 'completed' WHERE id = $1`, [
      seasonId,
    ]);

    const teamRow = await executeSql<{ cannot_leave: boolean }>(`
      SELECT cp.cannot_leave
      FROM conversation_participants cp
      JOIN conversations c ON c.id = cp.conversation_id
      WHERE c.scope_type = 'team' AND c.scope_id = $1
        AND cp.user_id = $2
    `, [teamId, captainId]);
    expect(teamRow[0].cannot_leave).toBe(false);

    const captainsRow = await executeSql<{ cannot_leave: boolean }>(`
      SELECT cp.cannot_leave
      FROM conversation_participants cp
      JOIN conversations c ON c.id = cp.conversation_id
      WHERE c.scope_type = 'season' AND c.scope_id = $1
        AND c.conversation_type = 'captains_chat'
        AND cp.user_id = $2
    `, [seasonId, captainId]);
    expect(captainsRow.length).toBe(1);
    expect(captainsRow[0].cannot_leave).toBe(false);
  });

  it('does NOT touch participants of OTHER seasons', async () => {
    if (!otherSeasonId) {
      console.warn('skipping: no other active season available in test data');
      return;
    }
    // Take a snapshot of the other season's cannot_leave state for any
    // captain there.
    const before = await executeSql<{
      conversation_id: string;
      user_id: string;
      cannot_leave: boolean;
    }>(`
      SELECT cp.conversation_id, cp.user_id, cp.cannot_leave
      FROM conversation_participants cp
      JOIN conversations c ON c.id = cp.conversation_id
      WHERE (
        (c.scope_type = 'team' AND c.scope_id IN (SELECT id FROM teams WHERE season_id = $1))
        OR (c.scope_type = 'season' AND c.scope_id = $1 AND c.conversation_type = 'captains_chat')
      )
      AND cp.cannot_leave = TRUE
    `, [otherSeasonId]);

    await executeSql(`UPDATE seasons SET status = 'completed' WHERE id = $1`, [
      seasonId,
    ]);

    // Re-check the other season — all the same rows still TRUE.
    for (const row of before) {
      const after = await executeSql<{ cannot_leave: boolean }>(
        `SELECT cannot_leave FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
        [row.conversation_id, row.user_id],
      );
      expect(after[0].cannot_leave).toBe(true);
    }
  });

  it('does NOT fire for a status change that is not active → completed', async () => {
    // Try active → cancelled. The trigger's WHEN clause filters to
    // only active→completed, so cannot_leave should stay TRUE.
    await executeSql(`UPDATE seasons SET status = 'cancelled' WHERE id = $1`, [
      seasonId,
    ]);

    const rows = await executeSql<{ cannot_leave: boolean }>(`
      SELECT cp.cannot_leave
      FROM conversation_participants cp
      JOIN conversations c ON c.id = cp.conversation_id
      WHERE c.scope_type = 'team' AND c.scope_id = $1
        AND cp.user_id = $2
    `, [teamId, captainId]);
    expect(rows[0].cannot_leave).toBe(true);
  });

  it('idempotent — re-firing on an already-completed season is a no-op (does not error)', async () => {
    await executeSql(`UPDATE seasons SET status = 'completed' WHERE id = $1`, [
      seasonId,
    ]);
    // Re-fire by setting status to active then back to completed.
    await executeSql(`UPDATE seasons SET status = 'active' WHERE id = $1`, [
      seasonId,
    ]);
    await executeSql(`UPDATE seasons SET status = 'completed' WHERE id = $1`, [
      seasonId,
    ]);

    const rows = await executeSql<{ cannot_leave: boolean }>(`
      SELECT cp.cannot_leave
      FROM conversation_participants cp
      JOIN conversations c ON c.id = cp.conversation_id
      WHERE c.scope_type = 'team' AND c.scope_id = $1
        AND cp.user_id = $2
    `, [teamId, captainId]);
    expect(rows[0].cannot_leave).toBe(false);
  });
});
