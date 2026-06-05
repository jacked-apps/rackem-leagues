/**
 * @vitest-environment node
 *
 * @fileoverview Schema invariants for the per_game_allocators table,
 * its tamper trigger on official rows, the preferences.per_game_allocator_id
 * pointer column, and its cascade into the resolved_league_preferences view.
 *
 * Covers test scenarios from Unit 1 of
 * `docs/plans/2026-06-04-002-feat-per-game-allocator-room-plan.md`. Tests are
 * structured into two groups:
 *
 *   1. No-seed-required (run by default) — exercises the structural
 *      invariants that hold the moment the migration applies:
 *      the four seeded officials, the resolved view's new column, the
 *      CHECK constraints, and the tamper trigger on official rows.
 *   2. Seed-required (skipped with TODO) — exercises user-row inserts +
 *      FK ON DELETE RESTRICT. These need a real auth.users row, which the
 *      seed_test_users.sql fixture provides; following the houseRules.rls
 *      precedent we skip them here and revisit when seed bootstrap lands.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

const OFFICIAL_NAMES = [
  'Percent 5-Man — Official',
  '10-Point — Official',
  '17-Point — Official',
  'Empty Starter',
] as const;

describe('per_game_allocators — schema (no seed required)', () => {
  afterAll(async () => {
    await closePostgresPool();
  });

  it('seeds exactly four official rows', async () => {
    const rows = await executeSql(
      `SELECT name FROM per_game_allocators WHERE scope = 'official' ORDER BY name`,
    );
    const names = rows.map((r: { name: string }) => r.name).sort();
    expect(names).toEqual([...OFFICIAL_NAMES].sort());
  });

  it('seeded officials have author_id IS NULL', async () => {
    const rows = await executeSql(
      `SELECT author_id FROM per_game_allocators WHERE scope = 'official'`,
    );
    for (const row of rows) {
      expect(row.author_id).toBeNull();
    }
  });

  it("10-Point official's loser side is a range with label 'Balls pocketed by loser'", async () => {
    const rows = await executeSql(
      `SELECT loser_side FROM per_game_allocators WHERE name = '10-Point — Official'`,
    );
    expect(rows).toHaveLength(1);
    const loser = rows[0].loser_side;
    expect(loser.base).toEqual({ min: 0, max: 7, label: 'Balls pocketed by loser' });
    expect(loser.formula).toBeNull();
  });

  it("17-Point official's winner side carries the evaluate_expression formula", async () => {
    const rows = await executeSql(
      `SELECT winner_side FROM per_game_allocators WHERE name = '17-Point — Official'`,
    );
    expect(rows).toHaveLength(1);
    const winner = rows[0].winner_side;
    expect(winner.base).toBe(10);
    // The expression encodes `(this_side_value + (7 - other_side_value))`
    // which the engine resolves to `winner_base + (7 - loser_value)`.
    expect(winner.formula.operationKind).toBe('evaluate_expression');
    expect(winner.formula.operationArgs.expression).toEqual({
      kind: 'op',
      op: '+',
      left: { kind: 'var', name: 'this_side_value' },
      right: {
        kind: 'op',
        op: '-',
        left: { kind: 'const', value: 7 },
        right: { kind: 'var', name: 'other_side_value' },
      },
    });
  });

  it('CHECK rejects scope outside the allowed set', async () => {
    // A scope value outside ('official','user') trips BOTH the scope CHECK and
    // the author_required CHECK (the OR clause has no matching branch). Match
    // either constraint name — Postgres reports whichever it evaluates first.
    await expect(
      executeSql(
        `INSERT INTO per_game_allocators (name, scope, winner_side, loser_side)
         VALUES ('bogus', 'banana', '{"base":0,"formula":null}'::jsonb, '{"base":0,"formula":null}'::jsonb)`,
      ),
    ).rejects.toThrow(
      /per_game_allocators_(scope_check|author_required_for_user)/,
    );
  });

  it('CHECK rejects scope=user with NULL author_id', async () => {
    await expect(
      executeSql(
        `INSERT INTO per_game_allocators (name, scope, author_id, winner_side, loser_side)
         VALUES ('bogus', 'user', NULL, '{"base":0,"formula":null}'::jsonb, '{"base":0,"formula":null}'::jsonb)`,
      ),
    ).rejects.toThrow(/per_game_allocators_author_required_for_user/);
  });

  it('CHECK rejects scope=official with non-NULL author_id', async () => {
    await expect(
      executeSql(
        `INSERT INTO per_game_allocators (name, scope, author_id, winner_side, loser_side)
         VALUES ('bogus', 'official', '11111111-1111-1111-1111-111111111111', '{"base":0,"formula":null}'::jsonb, '{"base":0,"formula":null}'::jsonb)`,
      ),
    ).rejects.toThrow(/per_game_allocators_author_required_for_user/);
  });

  it('tamper trigger blocks UPDATE on a scope=official row', async () => {
    await expect(
      executeSql(
        `UPDATE per_game_allocators
         SET description = 'tampered'
         WHERE name = '10-Point — Official'`,
      ),
    ).rejects.toThrow(/Cannot UPDATE official per_game_allocators row/);
  });

  it('tamper trigger blocks DELETE on a scope=official row', async () => {
    await expect(
      executeSql(
        `DELETE FROM per_game_allocators WHERE name = 'Empty Starter'`,
      ),
    ).rejects.toThrow(/Cannot DELETE official per_game_allocators row/);
  });
});

describe('preferences.per_game_allocator_id — pointer column + cascade view', () => {
  afterAll(async () => {
    await closePostgresPool();
  });

  it('preferences table has the per_game_allocator_id column with the right shape', async () => {
    const rows = await executeSql(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'preferences'
         AND column_name = 'per_game_allocator_id'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].data_type).toBe('uuid');
    expect(rows[0].is_nullable).toBe('YES');
  });

  it('preferences.per_game_allocator_id has ON DELETE RESTRICT to per_game_allocators(id)', async () => {
    const rows = await executeSql(
      `SELECT rc.delete_rule, ccu.table_name AS target_table, ccu.column_name AS target_column
       FROM information_schema.referential_constraints rc
       JOIN information_schema.constraint_column_usage ccu
         ON rc.unique_constraint_name = ccu.constraint_name
       JOIN information_schema.key_column_usage kcu
         ON rc.constraint_name = kcu.constraint_name
       WHERE kcu.table_name = 'preferences'
         AND kcu.column_name = 'per_game_allocator_id'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].delete_rule).toBe('RESTRICT');
    expect(rows[0].target_table).toBe('per_game_allocators');
    expect(rows[0].target_column).toBe('id');
  });

  it('resolved_league_preferences view exposes the per_game_allocator_id column', async () => {
    const rows = await executeSql(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'resolved_league_preferences'
         AND column_name = 'per_game_allocator_id'`,
    );
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// TODO: bootstrap a seeded auth.users fixture so we can exercise:
//   - Inserting scope='user' rows with a real author_id
//   - ON DELETE RESTRICT firing when a user row is referenced by
//     preferences.per_game_allocator_id (require inserting a preferences row
//     that points at it, then attempting the delete and asserting the FK violation)
// These behaviors are enforced by the migration's constraints + trigger
// and eyeball-verifiable in a seeded dev environment. Follows the precedent
// set by src/__tests__/database/houseRules.rls.test.ts.
// ---------------------------------------------------------------------------
describe.skip('per_game_allocators — needs seeded auth user (TODO)', () => {
  it('user-scope row insert with valid author_id succeeds', () => {
    // Pending seed bootstrap.
  });
  it('preferences.per_game_allocator_id ON DELETE RESTRICT fires when row is in use', () => {
    // Pending seed bootstrap.
  });
});
