/**
 * @fileoverview Atomicity test for the score_game_with_events rpc.
 *
 * The plan (docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md
 * Unit 6) requires an explicit FK-violation rollback test: the codebase
 * has not previously used multi-table PL/pgSQL transactional rollback for
 * scoring writes, and assumed-but-untested rollback is exactly the failure
 * mode `feedback_two_paths_audit_pattern` warns about.
 *
 * The test deliberately submits an events payload containing an
 * `attributed_player_id` that does not exist in `members`. The FK on
 * `game_events.attributed_player_id` rejects the INSERT, raising inside
 * the rpc. We then assert that the `match_games` row's scoring fields
 * (winner_player_id, winner_team_id, etc.) were NOT updated — i.e., the
 * UPDATE in the same function was rolled back.
 *
 * If this test passes, the dual-write atomicity guarantee Branch B
 * promises is real. If it fails, scoring is shipping with a silent
 * dual-write divergence risk and the issue must be fixed before merge.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServiceClient, executeSql, closePostgresPool } from '@/test/dbTestUtils';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const NONEXISTENT_PLAYER_UUID = '00000000-0000-0000-0000-000000000000';

describe('score_game_with_events — atomicity rollback', () => {
  let serviceClient: SupabaseClient<Database>;
  let testGameId: string | null = null;
  let testMatchId: string | null = null;

  beforeAll(async () => {
    serviceClient = createServiceClient();

    const { data: game } = await serviceClient
      .from('match_games')
      .select('id, match_id')
      .limit(1)
      .single();

    if (game) {
      testGameId = game.id;
      testMatchId = game.match_id;
    }
  });

  afterAll(async () => {
    await closePostgresPool();
  });

  it('FK violation in events INSERT rolls back the match_games UPDATE', async () => {
    if (!testGameId || !testMatchId) {
      console.warn('⚠️ No test game found, skipping atomicity check');
      return;
    }

    // Capture the row's pre-rpc state so we can assert "did not change."
    const beforeRows = await executeSql(
      'SELECT winner_team_id, winner_player_id, winner_value, loser_value, break_fouled FROM match_games WHERE id = $1',
      [testGameId],
    );
    expect(beforeRows.length).toBe(1);
    const before = beforeRows[0];

    // Use direct Postgres so we exercise the rpc as the postgres role
    // (bypasses RLS via SECURITY DEFINER / superuser context). The point is
    // not to test the auth gate — that's gameEvents.rls.test.ts. The point
    // here is ONLY to test the rollback shape.
    const eventsPayload = JSON.stringify([
      {
        event_name: 'break_and_run',
        attributed_player_id: NONEXISTENT_PLAYER_UUID, // FK violation
      },
    ]);

    let rpcThrew = false;
    try {
      await executeSql(
        `SELECT score_game_with_events($1::uuid, $2::uuid, $3::uuid, $4::int, $5::int, $6::boolean, $7::uuid, $8::uuid, $9::jsonb)`,
        [
          testGameId,
          testMatchId, // p_winner_team_id (any uuid will do; FK doesn't check teams here)
          testMatchId, // p_winner_player_id (any uuid)
          5, // p_winner_value
          3, // p_loser_value
          false, // p_break_fouled
          null, // p_confirmed_by_home
          null, // p_confirmed_by_away
          eventsPayload, // p_events with deliberate FK violation
        ],
      );
    } catch (err) {
      rpcThrew = true;
    }

    // The rpc must have thrown — the FK violation should propagate.
    expect(rpcThrew).toBe(true);

    // Critical assertion: the match_games row was NOT updated. If rollback
    // works, every field matches its pre-rpc value. If rollback is broken,
    // winner_value would now be 5 / loser_value would be 3 / etc.
    const afterRows = await executeSql(
      'SELECT winner_team_id, winner_player_id, winner_value, loser_value, break_fouled FROM match_games WHERE id = $1',
      [testGameId],
    );
    const after = afterRows[0];

    expect(after.winner_team_id).toEqual(before.winner_team_id);
    expect(after.winner_player_id).toEqual(before.winner_player_id);
    expect(after.winner_value).toEqual(before.winner_value);
    expect(after.loser_value).toEqual(before.loser_value);
    expect(after.break_fouled).toEqual(before.break_fouled);

    // And no game_events rows were inserted (the failed transaction left
    // nothing behind).
    const eventRows = await executeSql(
      'SELECT id FROM game_events WHERE game_id = $1',
      [testGameId],
    );
    expect(eventRows.length).toBe(0);
  });
});
