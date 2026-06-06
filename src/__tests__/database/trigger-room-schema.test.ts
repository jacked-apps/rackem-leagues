/**
 * @vitest-environment node
 *
 * @fileoverview Schema invariants for the `triggers` table — Unit 1 of the
 * trigger room. Mirrors the per-game allocator schema test in shape.
 *
 * Covers test scenarios from
 * `docs/plans/2026-06-06-001-feat-trigger-room-plan.md` Unit 1.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

const OFFICIAL_NAMES = [
  'Initial credit — Official',
  'Game-13 bonus — Official',
  'Sweep bonus — Official',
  'Empty Starter',
] as const;

describe('triggers — schema (no seed required)', () => {
  afterAll(async () => {
    await closePostgresPool();
  });

  it('seeds exactly four official rows', async () => {
    const rows = await executeSql(
      `SELECT name FROM triggers WHERE scope = 'official' ORDER BY name`,
    );
    const names = rows.map((r: { name: string }) => r.name).sort();
    expect(names).toEqual([...OFFICIAL_NAMES].sort());
  });

  it('seeded officials have author_id IS NULL', async () => {
    const rows = await executeSql(
      `SELECT author_id FROM triggers WHERE scope = 'official'`,
    );
    for (const row of rows) {
      expect(row.author_id).toBeNull();
    }
  });

  it("Initial credit official is match_start with always condition", async () => {
    const rows = await executeSql(
      `SELECT trigger_type, condition, action FROM triggers WHERE name = 'Initial credit — Official'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].trigger_type).toBe('match_start');
    expect(rows[0].condition).toEqual({ kind: 'always' });
    expect(rows[0].action.target).toBe('home_points');
    expect(rows[0].action.value).toEqual({ kind: 'set', value: 50 });
  });

  it("Game-13 bonus official has the expected compare condition and expr action", async () => {
    const rows = await executeSql(
      `SELECT condition, action FROM triggers WHERE name = 'Game-13 bonus — Official'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].condition).toEqual({
      kind: 'compare',
      left: { kind: 'var', name: 'games_played' },
      op: '==',
      right: { kind: 'const', value: 13 },
    });
    expect(rows[0].action.target).toBe('home_points');
    expect(rows[0].action.value.kind).toBe('expr');
  });

  it('CHECK rejects scope outside the allowed set', async () => {
    await expect(
      executeSql(
        `INSERT INTO triggers (name, scope, trigger_type, condition, action)
         VALUES ('bogus', 'banana', 'match_start', '{"kind":"always"}'::jsonb, '{"target":"home_points","value":{"kind":"set","value":0}}'::jsonb)`,
      ),
    ).rejects.toThrow(
      /triggers_(scope_check|author_required_for_user)/,
    );
  });

  it('CHECK rejects trigger_type outside the allowed set', async () => {
    await expect(
      executeSql(
        `INSERT INTO triggers (name, scope, author_id, trigger_type, condition, action)
         VALUES ('bogus', 'official', NULL, 'banana_phase', '{"kind":"always"}'::jsonb, '{"target":"home_points","value":{"kind":"set","value":0}}'::jsonb)`,
      ),
    ).rejects.toThrow(/triggers_type_check/);
  });

  it('CHECK rejects rearm outside the allowed set', async () => {
    await expect(
      executeSql(
        `INSERT INTO triggers (name, scope, author_id, trigger_type, condition, action, rearm)
         VALUES ('bogus', 'official', NULL, 'match_start', '{"kind":"always"}'::jsonb, '{"target":"home_points","value":{"kind":"set","value":0}}'::jsonb, 'on_demand')`,
      ),
    ).rejects.toThrow(/triggers_rearm_check/);
  });

  it('CHECK rejects scope=user with NULL author_id', async () => {
    await expect(
      executeSql(
        `INSERT INTO triggers (name, scope, author_id, trigger_type, condition, action)
         VALUES ('bogus', 'user', NULL, 'match_start', '{"kind":"always"}'::jsonb, '{"target":"home_points","value":{"kind":"set","value":0}}'::jsonb)`,
      ),
    ).rejects.toThrow(/triggers_author_required_for_user/);
  });

  it('tamper trigger blocks UPDATE on a scope=official row', async () => {
    await expect(
      executeSql(
        `UPDATE triggers SET description = 'tampered' WHERE name = 'Empty Starter'`,
      ),
    ).rejects.toThrow(/Cannot UPDATE official triggers row/);
  });

  it('tamper trigger blocks DELETE on a scope=official row', async () => {
    await expect(
      executeSql(
        `DELETE FROM triggers WHERE name = 'Empty Starter'`,
      ),
    ).rejects.toThrow(/Cannot DELETE official triggers row/);
  });
});
