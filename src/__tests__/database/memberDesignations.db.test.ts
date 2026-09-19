/**
 * @fileoverview DB tests for the designations store and the
 * `member_has_designation` helper (designations Phase 1 / slice 4).
 *
 * The helper is the SQL-side authority for the developer master key — the audit
 * trigger and the rules_page_events RLS policy both ask it, so its behavior is
 * worth pinning: it must resolve an ACTIVE designation (ended_at IS NULL) for
 * the member behind a given auth user, and nothing else.
 *
 * Also covers the store's core invariant (D3): at most one active record per
 * (member, designation), and the catalog FK (D4) that stops a typo'd
 * designation from silently never matching.
 *
 * Runs in the `db` vitest project (sequential, jsdom) against local Postgres via
 * the raw `pg` pool. Creates its OWN throwaway auth user + member (never shared
 * seed rows) so it stays isolation-safe on the shared DB.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('member designations store + member_has_designation()', () => {
  let userId: string; // auth.users.id behind the member
  let memberId: string;

  beforeAll(async () => {
    // A minimal auth user (only id is required) so the member can carry a
    // user_id the helper joins on — fully isolated, no shared rows.
    const users = await executeSql(
      `INSERT INTO auth.users (id) VALUES (gen_random_uuid()) RETURNING id`
    );
    userId = users[0].id;

    const members = await executeSql(
      `INSERT INTO public.members
         (first_name, last_name, phone, email, address, city, state, zip_code, date_of_birth, user_id)
       VALUES ('Desig', 'Test', '0000000000',
               'desig-test-' || gen_random_uuid() || '@example.test',
               '1 Test St', 'Testville', 'TX', '00000', '1990-01-01', $1)
       RETURNING id`,
      [userId]
    );
    memberId = members[0].id;
  });

  // Each test starts from a clean slate — no leftover designations on our member.
  afterEach(async () => {
    await executeSql(`DELETE FROM public.member_designations WHERE member_id = $1`, [memberId]);
  });

  afterAll(async () => {
    await executeSql(`DELETE FROM public.member_designations WHERE member_id = $1`, [memberId]);
    await executeSql(`DELETE FROM public.members WHERE id = $1`, [memberId]);
    await executeSql(`DELETE FROM auth.users WHERE id = $1`, [userId]);
    await closePostgresPool();
  });

  async function hasDeveloper(uid: string): Promise<boolean> {
    const rows = await executeSql(
      `SELECT public.member_has_designation($1, 'developer') AS has`,
      [uid]
    );
    return rows[0].has;
  }

  it('is false when the member holds no designation', async () => {
    expect(await hasDeveloper(userId)).toBe(false);
  });

  it('is true once an active developer designation is granted', async () => {
    await executeSql(
      `INSERT INTO public.member_designations (member_id, designation) VALUES ($1, 'developer')`,
      [memberId]
    );
    expect(await hasDeveloper(userId)).toBe(true);
  });

  it('is false again once the designation is ended (ended_at set)', async () => {
    await executeSql(
      `INSERT INTO public.member_designations (member_id, designation) VALUES ($1, 'developer')`,
      [memberId]
    );
    expect(await hasDeveloper(userId)).toBe(true);

    await executeSql(
      `UPDATE public.member_designations
         SET ended_at = now(), end_reason = 'revoked'
       WHERE member_id = $1 AND designation = 'developer'`,
      [memberId]
    );
    expect(await hasDeveloper(userId)).toBe(false);
  });

  it('is false for an auth user with no member', async () => {
    const rows = await executeSql(
      `SELECT public.member_has_designation(gen_random_uuid(), 'developer') AS has`
    );
    expect(rows[0].has).toBe(false);
  });

  it('enforces at most one ACTIVE record per (member, designation) — D3', async () => {
    await executeSql(
      `INSERT INTO public.member_designations (member_id, designation) VALUES ($1, 'developer')`,
      [memberId]
    );
    // A second active 'developer' for the same member violates the partial
    // unique index.
    await expect(
      executeSql(
        `INSERT INTO public.member_designations (member_id, designation) VALUES ($1, 'developer')`,
        [memberId]
      )
    ).rejects.toThrow();
  });

  it('allows a fresh record once the prior one is ended (lapse-and-rebuy)', async () => {
    await executeSql(
      `INSERT INTO public.member_designations (member_id, designation, ended_at, end_reason)
       VALUES ($1, 'developer', now(), 'revoked')`,
      [memberId]
    );
    // The old record is ended, so a new active one is allowed.
    await expect(
      executeSql(
        `INSERT INTO public.member_designations (member_id, designation) VALUES ($1, 'developer')`,
        [memberId]
      )
    ).resolves.toBeDefined();
    expect(await hasDeveloper(userId)).toBe(true);
  });

  it('rejects a designation that is not in the catalog — D4 FK integrity', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.member_designations (member_id, designation) VALUES ($1, 'developor')`,
        [memberId]
      )
    ).rejects.toThrow();
  });
});
