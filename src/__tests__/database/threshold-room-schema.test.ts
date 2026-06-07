/**
 * @vitest-environment node
 *
 * @fileoverview Schema invariants for the `thresholds` table — Unit 1 of the
 * threshold room. Mirrors the trigger-room schema test in shape.
 *
 * Seeds are added by Unit 8, so this file does not assert seeded officials.
 * The behavioral tamper-on-official test (which needs a seeded official row)
 * also rides Unit 8; here we assert the tamper trigger is installed and that
 * the CHECK constraints reject bad rows (failing inserts roll back, so no test
 * pollution).
 *
 * Covers Unit 1 test scenarios from
 * `docs/plans/2026-06-07-001-feat-threshold-workshop-plan.md`.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

const VALID_DEF = `'{"operationKind":"read_pref","operationArgs":{"pref_key":"x"}}'::jsonb`;

describe('thresholds — schema (no seed required)', () => {
  afterAll(async () => {
    await closePostgresPool();
  });

  it('has the expected columns', async () => {
    const rows = await executeSql(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'thresholds'`,
    );
    const cols = rows.map((r: { column_name: string }) => r.column_name);
    for (const expected of [
      'id',
      'name',
      'label',
      'description',
      'scope',
      'author_id',
      'definition',
      'expansion_mode',
      'created_at',
      'updated_at',
    ]) {
      expect(cols).toContain(expected);
    }
  });

  it('defaults expansion_mode to single', async () => {
    const rows = await executeSql(
      `SELECT column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'thresholds'
         AND column_name = 'expansion_mode'`,
    );
    expect(rows).toHaveLength(1);
    expect(String(rows[0].column_default)).toContain('single');
  });

  it('CHECK rejects scope outside the allowed set', async () => {
    await expect(
      executeSql(
        `INSERT INTO thresholds (name, label, scope, definition)
         VALUES ('threshold_x', 'X', 'banana', ${VALID_DEF})`,
      ),
    ).rejects.toThrow(/thresholds_(scope_check|author_required_for_user)/);
  });

  it('CHECK rejects expansion_mode outside the allowed set', async () => {
    await expect(
      executeSql(
        `INSERT INTO thresholds (name, label, scope, author_id, definition, expansion_mode)
         VALUES ('threshold_x', 'X', 'official', NULL, ${VALID_DEF}, 'banana')`,
      ),
    ).rejects.toThrow(/thresholds_expansion_mode_check/);
  });

  it('CHECK rejects scope=user with NULL author_id', async () => {
    await expect(
      executeSql(
        `INSERT INTO thresholds (name, label, scope, author_id, definition)
         VALUES ('threshold_x', 'X', 'user', NULL, ${VALID_DEF})`,
      ),
    ).rejects.toThrow(/thresholds_author_required_for_user/);
  });

  it('installs the tamper trigger that blocks official modification', async () => {
    const rows = await executeSql(
      `SELECT tgname FROM pg_trigger
       WHERE tgname = 'thresholds_block_official_modification'
         AND NOT tgisinternal`,
    );
    expect(rows).toHaveLength(1);
  });
});
