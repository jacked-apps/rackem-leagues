/**
 * @fileoverview DB integration tests for the onboarding cascade — Unit 2.
 *
 * Exercises the get_team_join_view(token) RPC against the local DB:
 *   supabase/migrations/20260529000002_get_team_join_view.sql
 *
 * Proves:
 *   1. A valid token resolves to {found:true} with team_name, a composed
 *      league_name, roster_size, and spots flagged open (placeholder) vs
 *      taken (registered member).
 *   2. An unknown token returns {found:false} (the invalid-link state) — never
 *      an error.
 *   3. The payload exposes NAMES ONLY: no email/phone/address leaks through the
 *      token (the RPC is the authorization boundary while RLS is off).
 *   4. The RPC is callable pre-auth via the anon PostgREST client.
 *   5. viewer_request_status reflects the *caller's* live request — null with
 *      no JWT / no request, 'pending' when the signed-in caller has one.
 *
 * Run: pnpm test:run src/__tests__/database/get-team-join-view
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { executeSql, getPostgresPool, createTestClient } from '@/test/dbTestUtils';

describe('Onboarding cascade Unit 2 — get_team_join_view', () => {
  let teamId: string | null = null;
  let token: string | null = null;
  let userId: string | null = null;

  beforeAll(async () => {
    // A team that has at least one open placeholder spot (user_id IS NULL),
    // so the open/taken flags have something to distinguish.
    const rows = await executeSql(
      `SELECT t.id, t.join_token
         FROM teams t
         JOIN team_players tp ON tp.team_id = t.id
         JOIN members m ON m.id = tp.member_id
        WHERE m.user_id IS NULL
        LIMIT 1`
    );
    teamId = rows[0]?.id ?? null;
    token = rows[0]?.join_token ?? null;

    const users = await executeSql(`SELECT id FROM auth.users LIMIT 1`);
    userId = users[0]?.id ?? null;
  });

  // ---------------------------------------------------------------------------
  // 1. Valid token → shape + flags
  // ---------------------------------------------------------------------------
  it('resolves a valid token to the team, league name, and spots', async () => {
    expect(token).toBeTruthy();
    const rows = await executeSql(`SELECT get_team_join_view($1) AS v`, [token]);
    const v = rows[0].v;

    expect(v.found).toBe(true);
    expect(v.team_id).toBe(teamId);
    expect(typeof v.team_name).toBe('string');
    expect(v.team_name.length).toBeGreaterThan(0);
    // Composed "{Day} {Game-type}{ - Division}" — capitalized day, no underscores.
    expect(typeof v.league_name).toBe('string');
    expect(v.league_name).toMatch(/^[A-Z]/);
    expect(v.league_name).not.toContain('_');
    expect(typeof v.roster_size).toBe('number');
    expect(Array.isArray(v.spots)).toBe(true);
    expect(v.spots.length).toBeGreaterThan(0);
  });

  it('flags placeholders as open and registered members as taken', async () => {
    const rows = await executeSql(`SELECT get_team_join_view($1) AS v`, [token]);
    const spots = rows[0].v.spots as Array<{
      member_id: string;
      display_name: string;
      is_open: boolean;
    }>;

    // At least one open spot exists (the fixture team was chosen for that).
    expect(spots.some((s) => s.is_open)).toBe(true);

    // Cross-check each flag against the members table truth.
    for (const spot of spots) {
      const m = await executeSql(
        `SELECT user_id FROM members WHERE id = $1`,
        [spot.member_id]
      );
      const isPlaceholder = m[0].user_id === null;
      expect(spot.is_open).toBe(isPlaceholder);
      expect(typeof spot.display_name).toBe('string');
      expect(spot.display_name.length).toBeGreaterThan(0);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Unknown token → found:false (not an error)
  // ---------------------------------------------------------------------------
  it('returns {found:false} for an unknown token', async () => {
    const rows = await executeSql(
      `SELECT get_team_join_view('00000000-0000-0000-0000-000000000000') AS v`
    );
    expect(rows[0].v.found).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 3. Names only — no contact info leaks through the token
  // ---------------------------------------------------------------------------
  it('exposes names only (no email/phone/address keys anywhere)', async () => {
    const rows = await executeSql(`SELECT get_team_join_view($1) AS v`, [token]);
    const v = rows[0].v;

    // Each spot has exactly the three projected keys, nothing else.
    for (const spot of v.spots) {
      expect(Object.keys(spot).sort()).toEqual([
        'display_name',
        'is_open',
        'member_id',
      ]);
    }
    // Defense in depth: no contact-shaped key appears anywhere in the payload.
    expect(JSON.stringify(v)).not.toMatch(/"(email|phone|address|zip)/i);
  });

  // ---------------------------------------------------------------------------
  // 4. Callable pre-auth (anon PostgREST client)
  // ---------------------------------------------------------------------------
  it('is callable by the anonymous client (pre-auth read)', async () => {
    const anon = createTestClient();
    const { data, error } = await anon.rpc('get_team_join_view', {
      p_token: token!,
    });
    expect(error).toBeNull();
    expect((data as any).found).toBe(true);
    // Anonymous reader has no JWT → no viewer request state.
    expect((data as any).viewer_request_status).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 5. viewer_request_status reflects the caller's own request
  // ---------------------------------------------------------------------------
  it('reports the caller pending request via auth.uid() (tx-scoped JWT)', async () => {
    expect(userId && teamId && token).toBeTruthy();
    const client = await getPostgresPool().connect();
    try {
      await client.query('BEGIN');
      // Simulate the signed-in caller for this transaction only; auth.uid()
      // reads request.jwt.claims->>'sub'. SET LOCAL auto-resets on rollback.
      await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId }),
      ]);

      // No request yet → null.
      const before = await client.query(`SELECT get_team_join_view($1) AS v`, [token]);
      expect(before.rows[0].v.viewer_request_status).toBeNull();

      // Create a pending request for this caller, then re-read.
      await client.query(
        `INSERT INTO team_join_requests (team_id, requested_by_user_id)
         VALUES ($1, $2)`,
        [teamId, userId]
      );
      const after = await client.query(`SELECT get_team_join_view($1) AS v`, [token]);
      expect(after.rows[0].v.viewer_request_status).toBe('pending');
    } finally {
      // Roll back the simulated JWT + the inserted request — leaves no trace.
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
