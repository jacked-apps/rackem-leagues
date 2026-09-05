/**
 * @fileoverview Schema tests for the paid-tier foundation columns on `brackets`
 * (Phase A, Unit A1) — tier, premium_features, game_type, and the verify-at-setup
 * payment fields.
 *
 * Verifies: the new columns exist with the right defaults; the tier CHECK rejects
 * unknown values; the tier↔premium_features invariant holds (any premium feature
 * checked forces tier='paid'); existing free-tier inserts are unaffected; and the
 * inactivity sweep stays tier-AGNOSTIC (tournaments are disposable in BOTH tiers —
 * the earlier "paid persists" idea was reversed, so sweep_stale_brackets must not
 * branch on tier).
 *
 * Runs in the `db` vitest project (sequential) against local Postgres via the raw
 * `pg` pool (see src/test/dbTestUtils.ts). Raw SQL so constraint violations
 * surface as clean throws.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('brackets paid-foundation schema (Unit A1)', () => {
  let memberId: string; // satisfies brackets.created_by FK
  const insertedBracketIds: string[] = [];

  beforeAll(async () => {
    const members = await executeSql(`SELECT id FROM public.members LIMIT 1`);
    if (members.length === 0) {
      throw new Error(
        'brackets.paid.schema.db.test requires at least one member row. Seed the local DB and retry.'
      );
    }
    memberId = members[0].id;
  });

  afterAll(async () => {
    if (insertedBracketIds.length > 0) {
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [
        insertedBracketIds,
      ]);
    }
    await closePostgresPool();
  });

  it('an existing free-tier insert is unaffected — tier defaults to free, premium_features empty, no card', async () => {
    const rows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by)
       VALUES ('Free Bar Night', 'single_elimination', $1)
       RETURNING id, tier, premium_features, game_type, payment_method_id`,
      [memberId]
    );
    insertedBracketIds.push(rows[0].id);
    expect(rows[0].tier).toBe('free');
    expect(rows[0].premium_features).toEqual([]);
    expect(rows[0].game_type).toBeNull();
    expect(rows[0].payment_method_id).toBeNull();
  });

  it('creates a paid tournament with premium features and a game type (card lives on the player, not here)', async () => {
    const rows = await executeSql(
      `INSERT INTO public.brackets
         (name, format, created_by, tier, premium_features, game_type)
       VALUES ('Paid Bar Night', 'double_elimination', $1, 'paid',
               ARRAY['self_scoring']::text[], 'eight_ball')
       RETURNING id, tier, premium_features, game_type`,
      [memberId]
    );
    insertedBracketIds.push(rows[0].id);
    expect(rows[0].tier).toBe('paid');
    expect(rows[0].premium_features).toEqual(['self_scoring']);
    expect(rows[0].game_type).toBe('eight_ball');
  });

  it('records the charge-at-checkout seam (charged_at + charge_amount_cents)', async () => {
    const rows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by, tier, premium_features)
       VALUES ('Paid Start', 'single_elimination', $1, 'paid', ARRAY['self_scoring']::text[])
       RETURNING id, charged_at, charge_amount_cents`,
      [memberId]
    );
    insertedBracketIds.push(rows[0].id);
    // Not charged until Start.
    expect(rows[0].charged_at).toBeNull();
    expect(rows[0].charge_amount_cents).toBeNull();

    // The A3 seam records the ($0 mock) charge at Start.
    await executeSql(
      `UPDATE public.brackets SET charged_at = now(), charge_amount_cents = 500 WHERE id = $1`,
      [rows[0].id]
    );
    const after = await executeSql(
      `SELECT charged_at, charge_amount_cents FROM public.brackets WHERE id = $1`,
      [rows[0].id]
    );
    expect(after[0].charged_at).toBeTruthy();
    expect(after[0].charge_amount_cents).toBe(500);
  });

  it('rejects an unknown tier value (CHECK)', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.brackets (name, format, created_by, tier)
         VALUES ('Bad Tier', 'single_elimination', $1, 'gold')`,
        [memberId]
      )
    ).rejects.toThrow();
  });

  it('enforces the invariant: a premium feature on a free bracket is rejected', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.brackets (name, format, created_by, tier, premium_features)
         VALUES ('Drifted', 'single_elimination', $1, 'free', ARRAY['self_scoring']::text[])`,
        [memberId]
      )
    ).rejects.toThrow();
  });

  it('allows premium features when tier is paid (invariant satisfied)', async () => {
    const rows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by, tier, premium_features)
       VALUES ('OK Paid', 'single_elimination', $1, 'paid',
               ARRAY['self_scoring','handicap_races']::text[])
       RETURNING id, premium_features`,
      [memberId]
    );
    insertedBracketIds.push(rows[0].id);
    expect(rows[0].premium_features).toEqual(['self_scoring', 'handicap_races']);
  });

  it('the inactivity sweep is tier-agnostic (both tiers are disposable)', async () => {
    // Tournaments are swept the same regardless of tier — assert the sweep
    // function body never branches on `tier`/`paid` (non-destructive check;
    // avoids running the global delete inside a schema test).
    const rows = await executeSql(
      `SELECT pg_get_functiondef('public.sweep_stale_brackets(integer)'::regprocedure) AS def`
    );
    const def = String(rows[0].def).toLowerCase();
    expect(def).not.toContain('tier');
    expect(def).not.toContain("'paid'");
  });
});
