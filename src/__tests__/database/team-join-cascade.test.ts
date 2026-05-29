/**
 * @fileoverview Schema tests for the onboarding cascade — Unit 1.
 *
 * Verifies the migration:
 *   supabase/migrations/20260529000001_team_join_cascade.sql
 *
 * Proves:
 *   1. teams.join_token exists (uuid, NOT NULL, default gen_random_uuid()), is
 *      uniquely indexed, and every existing team got its own distinct token
 *      (per-row volatile default on ADD COLUMN).
 *   2. team_join_requests exists with the lifecycle columns (status default
 *      'pending', expires_at defaulted) and the three indexes.
 *   3. The status CHECK rejects unknown values.
 *   4. A self-add request (no claimed_member_id) and a claim request both insert.
 *   5. The dedup guard rejects a second pending request from the same user/team.
 *   6. The per-spot guard rejects a second pending claim on the same placeholder.
 *
 * NOT covered here (later units): the approve flow, the 'captain_approve' merge
 * actor_role (Unit 4), and RLS (intentionally off project-wide).
 *
 * Run: pnpm test:run src/__tests__/database/team-join-cascade
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql } from '@/test/dbTestUtils';

describe('Onboarding cascade Unit 1 — schema migration', () => {
  let teamId: string | null = null;
  let userA: string | null = null;
  let userB: string | null = null;
  let placeholderId: string | null = null;

  beforeAll(async () => {
    const team = await executeSql(`SELECT id FROM teams LIMIT 1`);
    teamId = team[0]?.id ?? null;

    const users = await executeSql(`SELECT id FROM auth.users LIMIT 2`);
    userA = users[0]?.id ?? null;
    userB = users[1]?.id ?? null;

    const ph = await executeSql(
      `SELECT id FROM members WHERE user_id IS NULL LIMIT 1`
    );
    placeholderId = ph[0]?.id ?? null;
  });

  afterAll(async () => {
    // Remove anything this suite inserted for the fixture team.
    if (teamId) {
      await executeSql(`DELETE FROM team_join_requests WHERE team_id = $1`, [teamId]);
    }
  });

  // ---------------------------------------------------------------------------
  // 1. teams.join_token
  // ---------------------------------------------------------------------------
  describe('teams.join_token', () => {
    it('exists: uuid, NOT NULL, default gen_random_uuid()', async () => {
      const rows = await executeSql(
        `SELECT data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'teams'
            AND column_name = 'join_token'`
      );
      expect(rows.length).toBe(1);
      expect(rows[0].data_type).toBe('uuid');
      expect(rows[0].is_nullable).toBe('NO');
      expect(String(rows[0].column_default)).toContain('gen_random_uuid');
    });

    it('has a unique index', async () => {
      const rows = await executeSql(
        `SELECT indexname FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'teams'
            AND indexname = 'teams_join_token_key'`
      );
      expect(rows.length).toBe(1);
    });

    it('backfilled every existing team with a distinct, non-null token', async () => {
      const rows = await executeSql(
        `SELECT COUNT(*)::int AS total,
                COUNT(join_token)::int AS non_null,
                COUNT(DISTINCT join_token)::int AS distinct_tokens
           FROM teams`
      );
      const { total, non_null, distinct_tokens } = rows[0];
      expect(non_null).toBe(total); // no NULLs
      expect(distinct_tokens).toBe(total); // all distinct
    });
  });

  // ---------------------------------------------------------------------------
  // 2. team_join_requests shape + indexes
  // ---------------------------------------------------------------------------
  describe('team_join_requests', () => {
    it('exists with status default pending and a defaulted expires_at', async () => {
      const rows = await executeSql(
        `SELECT column_name, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'team_join_requests'`
      );
      const byName = Object.fromEntries(rows.map((r: any) => [r.column_name, r]));
      expect(byName.status).toBeTruthy();
      expect(String(byName.status.column_default)).toContain('pending');
      expect(byName.expires_at).toBeTruthy();
      expect(byName.expires_at.column_default).toBeTruthy(); // has a default
      expect(byName.acknowledged_at?.is_nullable).toBe('YES');
    });

    it('has the team/status, dedup, and per-spot indexes', async () => {
      const rows = await executeSql(
        `SELECT indexname FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'team_join_requests'`
      );
      const names = rows.map((r: any) => r.indexname);
      expect(names).toContain('team_join_requests_team_status_idx');
      expect(names).toContain('team_join_requests_user_pending_uniq');
      expect(names).toContain('team_join_requests_spot_pending_uniq');
    });

    it('status CHECK rejects an unknown value', async () => {
      expect(teamId && userA).toBeTruthy();
      await expect(
        executeSql(
          `INSERT INTO team_join_requests (team_id, requested_by_user_id, status)
           VALUES ($1, $2, 'bogus')`,
          [teamId, userA]
        )
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Inserts + guards
  // ---------------------------------------------------------------------------
  describe('requests + guard indexes', () => {
    it('inserts a self-add request (no claimed_member_id) as pending', async () => {
      expect(teamId && userA).toBeTruthy();
      const rows = await executeSql(
        `INSERT INTO team_join_requests (team_id, requested_by_user_id)
         VALUES ($1, $2)
         RETURNING id, status, claimed_member_id`,
        [teamId, userA]
      );
      expect(rows[0].status).toBe('pending');
      expect(rows[0].claimed_member_id).toBeNull();
      await executeSql(`DELETE FROM team_join_requests WHERE id = $1`, [rows[0].id]);
    });

    it('dedup guard: rejects a second pending request from the same user/team', async () => {
      expect(teamId && userA).toBeTruthy();
      const first = await executeSql(
        `INSERT INTO team_join_requests (team_id, requested_by_user_id)
         VALUES ($1, $2) RETURNING id`,
        [teamId, userA]
      );
      try {
        await expect(
          executeSql(
            `INSERT INTO team_join_requests (team_id, requested_by_user_id)
             VALUES ($1, $2)`,
            [teamId, userA]
          )
        ).rejects.toThrow(/duplicate|unique|constraint/i);
      } finally {
        await executeSql(`DELETE FROM team_join_requests WHERE id = $1`, [first[0].id]);
      }
    });

    it('per-spot guard: rejects a second pending claim on the same placeholder', async () => {
      // Needs two distinct users so the dedup guard isn't what trips.
      expect(teamId && userA && userB && placeholderId).toBeTruthy();
      const first = await executeSql(
        `INSERT INTO team_join_requests (team_id, requested_by_user_id, claimed_member_id)
         VALUES ($1, $2, $3) RETURNING id`,
        [teamId, userA, placeholderId]
      );
      try {
        await expect(
          executeSql(
            `INSERT INTO team_join_requests (team_id, requested_by_user_id, claimed_member_id)
             VALUES ($1, $2, $3)`,
            [teamId, userB, placeholderId]
          )
        ).rejects.toThrow(/duplicate|unique|constraint/i);
      } finally {
        await executeSql(`DELETE FROM team_join_requests WHERE id = $1`, [first[0].id]);
      }
    });
  });
});
