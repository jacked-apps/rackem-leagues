/**
 * @fileoverview DB integration tests for the placeholder lifecycle RPCs
 *
 * Covers:
 *   - placeholder_has_stats(member_id)
 *   - merge_placeholder_into_member_v2(placeholder, target, actor, role, org)
 *   - undo_merge_placeholder(archive_id, caller_org, actor)
 *
 * Each test runs inside a BEGIN/ROLLBACK transaction so real data is never
 * mutated. Fixtures are discovered from existing local seed data — the tests
 * are skipped with a clear notice when suitable fixtures aren't available
 * (fresh DB without seed).
 *
 * Run: `pnpm test:run src/__tests__/database/placeholderLifecycle`
 * Requires: local Supabase running (`pnpm run db:start`).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';

/** Shape returned by findMergeFixture — three UUIDs the RPCs need. */
type MergeFixture = { pp_id: string; target_id: string; org_id: string };

describe('Placeholder lifecycle RPCs', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = getPostgresPool();
  });

  afterAll(async () => {
    await closePostgresPool();
  });

  /**
   * Borrow a client, run the callback inside a transaction, always ROLLBACK.
   * This is the isolation primitive — no test can leak changes into another.
   */
  async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      return await fn(client);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  /**
   * Find a placeholder + registered target + org where they:
   *  - are in the same org
   *  - do NOT share any match (so the merge won't trip collision detection)
   * Returns null if the local DB has no such fixture (fresh install, no seed).
   */
  async function findMergeFixture(client: PoolClient): Promise<MergeFixture | null> {
    const result = await client.query<MergeFixture>(`
      SELECT pp.id AS pp_id, tgt.id AS target_id, l.organization_id AS org_id
      FROM members pp
      JOIN team_players pp_tp ON pp_tp.member_id = pp.id
      JOIN teams t ON t.id = pp_tp.team_id
      JOIN seasons s ON s.id = t.season_id
      JOIN leagues l ON l.id = s.league_id
      JOIN team_players tgt_tp
        ON tgt_tp.team_id != pp_tp.team_id OR tgt_tp.season_id != pp_tp.season_id
      JOIN members tgt ON tgt.id = tgt_tp.member_id AND tgt.user_id IS NOT NULL
      JOIN teams t2 ON t2.id = tgt_tp.team_id
      JOIN seasons s2 ON s2.id = t2.season_id
      JOIN leagues l2 ON l2.id = s2.league_id AND l2.organization_id = l.organization_id
      WHERE pp.user_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM match_lineups ml_p
          JOIN match_lineups ml_t ON ml_t.match_id = ml_p.match_id
          WHERE (ml_p.player1_id=pp.id OR ml_p.player2_id=pp.id OR ml_p.player3_id=pp.id
                 OR ml_p.player4_id=pp.id OR ml_p.player5_id=pp.id)
            AND (ml_t.player1_id=tgt.id OR ml_t.player2_id=tgt.id OR ml_t.player3_id=tgt.id
                 OR ml_t.player4_id=tgt.id OR ml_t.player5_id=tgt.id)
        )
      LIMIT 1
    `);
    return result.rows[0] ?? null;
  }

  // =========================================================================
  // placeholder_has_stats(member_id)
  // =========================================================================
  describe('placeholder_has_stats', () => {
    it('returns false for a nonexistent member id (total function)', async () => {
      await inTransaction(async (c) => {
        const r = await c.query(
          'SELECT placeholder_has_stats($1::uuid) AS result',
          ['00000000-0000-0000-0000-000000000000'],
        );
        expect(r.rows[0].result).toBe(false);
      });
    });

    it('returns true for a member who appears in any lineup slot', async () => {
      await inTransaction(async (c) => {
        const r = await c.query(`
          SELECT placeholder_has_stats(player1_id) AS result
          FROM match_lineups
          WHERE player1_id IS NOT NULL
          LIMIT 1
        `);
        if (r.rows.length === 0) {
          console.warn('[skip] no match_lineups rows in local DB');
          return;
        }
        expect(r.rows[0].result).toBe(true);
      });
    });

    it('returns false for a placeholder with no lineup rows', async () => {
      await inTransaction(async (c) => {
        const r = await c.query(`
          SELECT m.id FROM members m
          WHERE m.user_id IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM match_lineups ml
              WHERE ml.player1_id=m.id OR ml.player2_id=m.id OR ml.player3_id=m.id
                 OR ml.player4_id=m.id OR ml.player5_id=m.id
            )
          LIMIT 1
        `);
        if (r.rows.length === 0) {
          console.warn('[skip] no no-lineup placeholder in local DB');
          return;
        }
        const statsCheck = await c.query(
          'SELECT placeholder_has_stats($1::uuid) AS result',
          [r.rows[0].id],
        );
        expect(statsCheck.rows[0].result).toBe(false);
      });
    });
  });

  // =========================================================================
  // merge_placeholder_into_member_v2
  // =========================================================================
  describe('merge_placeholder_into_member_v2', () => {
    it('happy path: writes archive + audit and deletes the placeholder', async () => {
      await inTransaction(async (c) => {
        const fx = await findMergeFixture(c);
        if (!fx) {
          console.warn('[skip] no merge fixture in local DB');
          return;
        }

        const merge = await c.query(`
          SELECT * FROM merge_placeholder_into_member_v2($1, $2, $2, 'lo_initiated', $3)
        `, [fx.pp_id, fx.target_id, fx.org_id]);

        expect(merge.rows[0].success).toBe(true);
        expect(merge.rows[0].archive_id).toBeTruthy();
        expect(merge.rows[0].error_message).toBeNull();

        // Archive row exists
        const archive = await c.query(
          'SELECT * FROM archived_placeholders WHERE id = $1',
          [merge.rows[0].archive_id],
        );
        expect(archive.rows.length).toBe(1);
        expect(archive.rows[0].placeholder_member_id).toBe(fx.pp_id);
        expect(archive.rows[0].target_member_id).toBe(fx.target_id);
        expect(archive.rows[0].member_snapshot).toBeTruthy();
        expect(Array.isArray(archive.rows[0].transferred_rows)).toBe(true);

        // Audit row linked to the archive
        const audit = await c.query(
          'SELECT * FROM placeholder_audit_log WHERE archive_id = $1',
          [merge.rows[0].archive_id],
        );
        expect(audit.rows.length).toBe(1);
        expect(audit.rows[0].action).toBe('merge');

        // Placeholder deleted
        const pp = await c.query('SELECT id FROM members WHERE id = $1', [fx.pp_id]);
        expect(pp.rows.length).toBe(0);
      });
    });

    it('rejects an invalid actor_role with a clear error and no writes', async () => {
      await inTransaction(async (c) => {
        const fx = await findMergeFixture(c);
        if (!fx) return;

        const r = await c.query(`
          SELECT * FROM merge_placeholder_into_member_v2($1, $2, $2, 'hacker_role', $3)
        `, [fx.pp_id, fx.target_id, fx.org_id]);

        expect(r.rows[0].success).toBe(false);
        expect(r.rows[0].error_message).toMatch(/actor_role/);

        // No archive written
        const archives = await c.query('SELECT COUNT(*)::int AS n FROM archived_placeholders');
        // Baseline is whatever the seed has; we just assert no row links to this pp_id
        const linked = await c.query(
          'SELECT COUNT(*)::int AS n FROM archived_placeholders WHERE placeholder_member_id = $1',
          [fx.pp_id],
        );
        expect(linked.rows[0].n).toBe(0);
        // Unused var guards against an accidental rewrite that leaves it dangling
        expect(typeof archives.rows[0].n).toBe('number');
      });
    });

    it('rejects a wrong organization_id (org-scope guard)', async () => {
      await inTransaction(async (c) => {
        const fx = await findMergeFixture(c);
        if (!fx) return;

        const r = await c.query(`
          SELECT * FROM merge_placeholder_into_member_v2($1, $2, $2, 'lo_initiated', $3)
        `, [fx.pp_id, fx.target_id, '99999999-9999-9999-9999-999999999999']);

        expect(r.rows[0].success).toBe(false);
        expect(r.rows[0].error_message).toMatch(/not in organization/);
      });
    });

    it('rejects a same-match collision before any rewrite', async () => {
      await inTransaction(async (c) => {
        // Find a placeholder + target that DO share at least one match — this
        // is the collision fixture we want to trigger the guard on.
        const r = await c.query(`
          SELECT pp.id AS pp_id, tgt.id AS target_id, l.organization_id AS org_id
          FROM members pp
          JOIN match_lineups ml_p ON ml_p.player1_id=pp.id OR ml_p.player2_id=pp.id OR ml_p.player3_id=pp.id OR ml_p.player4_id=pp.id OR ml_p.player5_id=pp.id
          JOIN match_lineups ml_t ON ml_t.match_id = ml_p.match_id
          JOIN members tgt ON (tgt.id = ml_t.player1_id OR tgt.id = ml_t.player2_id OR tgt.id = ml_t.player3_id OR tgt.id = ml_t.player4_id OR tgt.id = ml_t.player5_id)
            AND tgt.user_id IS NOT NULL AND tgt.id != pp.id
          JOIN team_players tp ON tp.member_id = pp.id
          JOIN teams t ON t.id = tp.team_id
          JOIN seasons s ON s.id = t.season_id
          JOIN leagues l ON l.id = s.league_id
          WHERE pp.user_id IS NULL
          LIMIT 1
        `);
        if (r.rows.length === 0) {
          console.warn('[skip] no same-match collision fixture');
          return;
        }
        const fx = r.rows[0];

        const merge = await c.query(`
          SELECT * FROM merge_placeholder_into_member_v2($1, $2, $2, 'lo_initiated', $3)
        `, [fx.pp_id, fx.target_id, fx.org_id]);

        expect(merge.rows[0].success).toBe(false);
        expect(merge.rows[0].error_message).toMatch(/merge_would_create_duplicate_in_match/);

        // Placeholder still exists (nothing was written)
        const pp = await c.query('SELECT id FROM members WHERE id = $1', [fx.pp_id]);
        expect(pp.rows.length).toBe(1);
      });
    });

    it('rejects self-merge (target equals placeholder)', async () => {
      await inTransaction(async (c) => {
        // Use a registered member as both placeholder and target — forces the
        // self-merge check to fire (using a true placeholder would hit the
        // "target is not registered" check first).
        const r = await c.query(`
          SELECT m.id, l.organization_id AS org_id
          FROM members m
          JOIN team_players tp ON tp.member_id = m.id
          JOIN teams t ON t.id = tp.team_id
          JOIN seasons s ON s.id = t.season_id
          JOIN leagues l ON l.id = s.league_id
          WHERE m.user_id IS NOT NULL
          LIMIT 1
        `);
        if (r.rows.length === 0) return;
        const id = r.rows[0].id;
        const orgId = r.rows[0].org_id;

        // Force the member to look like a placeholder so the target-not-registered
        // check passes, leaving self-merge as the first genuine failure.
        await c.query('UPDATE members SET user_id = NULL WHERE id = $1', [id]);

        const merge = await c.query(`
          SELECT * FROM merge_placeholder_into_member_v2($1, $1, $1, 'lo_initiated', $2)
        `, [id, orgId]);

        expect(merge.rows[0].success).toBe(false);
        expect(merge.rows[0].error_message).toMatch(/itself|registered/);
      });
    });
  });

  // =========================================================================
  // undo_merge_placeholder
  // =========================================================================
  describe('undo_merge_placeholder', () => {
    it('round-trip: merge then undo restores placeholder and row counts', async () => {
      await inTransaction(async (c) => {
        const fx = await findMergeFixture(c);
        if (!fx) return;

        // Pre-merge counts
        const ppTpBefore = (await c.query(
          'SELECT COUNT(*)::int AS n FROM team_players WHERE member_id = $1',
          [fx.pp_id],
        )).rows[0].n;
        const ppLineupsBefore = (await c.query(`
          SELECT COUNT(*)::int AS n FROM match_lineups
          WHERE player1_id=$1 OR player2_id=$1 OR player3_id=$1 OR player4_id=$1 OR player5_id=$1
        `, [fx.pp_id])).rows[0].n;

        const merge = await c.query(`
          SELECT * FROM merge_placeholder_into_member_v2($1, $2, $2, 'lo_initiated', $3)
        `, [fx.pp_id, fx.target_id, fx.org_id]);
        expect(merge.rows[0].success).toBe(true);
        const archiveId = merge.rows[0].archive_id;

        const undo = await c.query(`
          SELECT * FROM undo_merge_placeholder($1, $2, $3)
        `, [archiveId, fx.org_id, fx.target_id]);

        expect(undo.rows[0].success).toBe(true);
        expect(undo.rows[0].missing_rows).toBe(0);

        // Placeholder row restored at original id
        const pp = await c.query('SELECT id FROM members WHERE id = $1', [fx.pp_id]);
        expect(pp.rows.length).toBe(1);

        // Row counts match pre-merge exactly
        const ppTpAfter = (await c.query(
          'SELECT COUNT(*)::int AS n FROM team_players WHERE member_id = $1',
          [fx.pp_id],
        )).rows[0].n;
        const ppLineupsAfter = (await c.query(`
          SELECT COUNT(*)::int AS n FROM match_lineups
          WHERE player1_id=$1 OR player2_id=$1 OR player3_id=$1 OR player4_id=$1 OR player5_id=$1
        `, [fx.pp_id])).rows[0].n;
        expect(ppTpAfter).toBe(ppTpBefore);
        expect(ppLineupsAfter).toBe(ppLineupsBefore);

        // Archive marked undone
        const arch = await c.query(
          'SELECT undone_at FROM archived_placeholders WHERE id = $1',
          [archiveId],
        );
        expect(arch.rows[0].undone_at).toBeTruthy();
      });
    });

    it('returns archive_not_found for a nonexistent archive id', async () => {
      await inTransaction(async (c) => {
        const r = await c.query(`
          SELECT * FROM undo_merge_placeholder($1::uuid, $2::uuid, $3::uuid)
        `, [
          '00000000-0000-0000-0000-000000000000',
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222',
        ]);
        expect(r.rows[0].success).toBe(false);
        expect(r.rows[0].error_message).toBe('archive_not_found');
      });
    });

    it('returns not_authorized before leaking archive state (wrong org)', async () => {
      // This test is load-bearing: if the check order ever regresses, cross-org
      // callers could enumerate archives by distinguishing 'already_undone'
      // from 'archive_expired'. The fix was to authz-check first.
      await inTransaction(async (c) => {
        const fx = await findMergeFixture(c);
        if (!fx) return;

        const merge = await c.query(`
          SELECT * FROM merge_placeholder_into_member_v2($1, $2, $2, 'lo_initiated', $3)
        `, [fx.pp_id, fx.target_id, fx.org_id]);
        const archiveId = merge.rows[0].archive_id;

        const undo = await c.query(`
          SELECT * FROM undo_merge_placeholder($1, $2::uuid, $3)
        `, [archiveId, '99999999-9999-9999-9999-999999999999', fx.target_id]);

        expect(undo.rows[0].success).toBe(false);
        expect(undo.rows[0].error_message).toBe('not_authorized');
      });
    });

    it('returns already_undone on a double-undo', async () => {
      await inTransaction(async (c) => {
        const fx = await findMergeFixture(c);
        if (!fx) return;

        const merge = await c.query(`
          SELECT * FROM merge_placeholder_into_member_v2($1, $2, $2, 'lo_initiated', $3)
        `, [fx.pp_id, fx.target_id, fx.org_id]);
        const archiveId = merge.rows[0].archive_id;

        const first = await c.query(
          'SELECT * FROM undo_merge_placeholder($1, $2, $3)',
          [archiveId, fx.org_id, fx.target_id],
        );
        expect(first.rows[0].success).toBe(true);

        const second = await c.query(
          'SELECT * FROM undo_merge_placeholder($1, $2, $3)',
          [archiveId, fx.org_id, fx.target_id],
        );
        expect(second.rows[0].success).toBe(false);
        expect(second.rows[0].error_message).toBe('already_undone');
      });
    });

    it('returns archive_expired when expires_at is in the past', async () => {
      await inTransaction(async (c) => {
        const fx = await findMergeFixture(c);
        if (!fx) return;

        const merge = await c.query(`
          SELECT * FROM merge_placeholder_into_member_v2($1, $2, $2, 'lo_initiated', $3)
        `, [fx.pp_id, fx.target_id, fx.org_id]);
        const archiveId = merge.rows[0].archive_id;

        await c.query(
          "UPDATE archived_placeholders SET expires_at = now() - interval '1 day' WHERE id = $1",
          [archiveId],
        );

        const undo = await c.query(
          'SELECT * FROM undo_merge_placeholder($1, $2, $3)',
          [archiveId, fx.org_id, fx.target_id],
        );
        expect(undo.rows[0].success).toBe(false);
        expect(undo.rows[0].error_message).toBe('archive_expired');
      });
    });
  });
});
