/**
 * @fileoverview DB integration tests for the onboarding cascade — Unit 3 notify.
 *
 * Exercises get_my_approved_join_requests() + acknowledge_join_request()
 * against the local DB:
 *   supabase/migrations/20260529000007_my_approved_join_requests.sql
 *
 * Tx-scoped JWT, rolls back. Proves: anonymous → []; an approved-unacknowledged
 * request appears for its owner with labels; pending requests don't; acknowledge
 * removes it from the feed and is scoped to the caller's own request.
 *
 * Run: pnpm test:run src/__tests__/database/my-approved-join-requests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { executeSql, getPostgresPool } from '@/test/dbTestUtils';
import type { PoolClient } from 'pg';

async function inTx(fn: (c: PoolClient) => Promise<void>): Promise<void> {
  const c = await getPostgresPool().connect();
  try {
    await c.query('BEGIN');
    await fn(c);
  } finally {
    await c.query('ROLLBACK');
    c.release();
  }
}

async function setJwt(c: PoolClient, sub: string | null): Promise<void> {
  await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
    sub ? JSON.stringify({ sub }) : '',
  ]);
}

async function feed(c: PoolClient): Promise<any[]> {
  const res = await c.query(`SELECT get_my_approved_join_requests() AS f`);
  return res.rows[0].f;
}

describe('Onboarding cascade Unit 3 — notify-on-approval', () => {
  let teamId: string | null = null;
  let joinerUser: string | null = null;
  let joinerMember: string | null = null;
  let otherUser: string | null = null;

  beforeAll(async () => {
    const team = await executeSql(`SELECT id FROM teams LIMIT 1`);
    teamId = team[0]?.id ?? null;

    const users = await executeSql(
      `SELECT m.id, m.user_id FROM members m WHERE m.user_id IS NOT NULL LIMIT 1`
    );
    joinerMember = users[0]?.id ?? null;
    joinerUser = users[0]?.user_id ?? null;

    const other = await executeSql(
      `SELECT m.user_id FROM members m WHERE m.user_id IS NOT NULL AND m.user_id <> $1 LIMIT 1`,
      [joinerUser]
    );
    otherUser = other[0]?.user_id ?? null;
  });

  async function seedApproved(c: PoolClient): Promise<string> {
    const res = await c.query(
      `INSERT INTO team_join_requests
         (team_id, requested_by_user_id, requested_member_id, status, resolved_at)
       VALUES ($1, $2, $3, 'approved', now()) RETURNING id`,
      [teamId, joinerUser, joinerMember]
    );
    return res.rows[0].id;
  }

  it('has fixtures', () => {
    expect(teamId && joinerUser && joinerMember && otherUser).toBeTruthy();
  });

  it('returns [] for an anonymous caller', async () => {
    await inTx(async (c) => {
      await seedApproved(c);
      await setJwt(c, null);
      expect(await feed(c)).toEqual([]);
    });
  });

  it('surfaces an approved-unacknowledged request for its owner', async () => {
    await inTx(async (c) => {
      const id = await seedApproved(c);
      await setJwt(c, joinerUser);
      const rows = await feed(c);
      const mine = rows.find((r) => r.request_id === id);
      expect(mine).toBeTruthy();
      expect(mine.team_id).toBe(teamId);
      expect(typeof mine.team_name).toBe('string');
    });
  });

  it('does not surface a still-pending request', async () => {
    await inTx(async (c) => {
      const res = await c.query(
        `INSERT INTO team_join_requests (team_id, requested_by_user_id, requested_member_id)
         VALUES ($1, $2, $3) RETURNING id`,
        [teamId, joinerUser, joinerMember]
      );
      await setJwt(c, joinerUser);
      const ids = (await feed(c)).map((r) => r.request_id);
      expect(ids).not.toContain(res.rows[0].id);
    });
  });

  it('acknowledge removes it from the feed', async () => {
    await inTx(async (c) => {
      const id = await seedApproved(c);
      await setJwt(c, joinerUser);
      expect((await feed(c)).some((r) => r.request_id === id)).toBe(true);

      const ack = await c.query(`SELECT acknowledge_join_request($1) AS r`, [id]);
      expect(ack.rows[0].r.ok).toBe(true);
      expect((await feed(c)).some((r) => r.request_id === id)).toBe(false);
    });
  });

  it("cannot acknowledge someone else's request", async () => {
    await inTx(async (c) => {
      const id = await seedApproved(c); // owned by joinerUser
      await setJwt(c, otherUser);
      const ack = await c.query(`SELECT acknowledge_join_request($1) AS r`, [id]);
      expect(ack.rows[0].r.ok).toBe(false);

      // Still unacknowledged for the real owner.
      await setJwt(c, joinerUser);
      expect((await feed(c)).some((r) => r.request_id === id)).toBe(true);
    });
  });
});
