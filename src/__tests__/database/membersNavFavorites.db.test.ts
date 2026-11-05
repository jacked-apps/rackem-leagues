/**
 * @fileoverview Schema test for `members.nav_favorites` (grouped menu, Unit 3).
 *
 * The menu reads a member's starred entries from this column and writes the
 * whole list back on every star tap. Verifies the column is a nullable text
 * array whose default is NULL (NULL = "never customised" — no backfill), and
 * that a list round-trips unchanged, including the empty list ("un-starred
 * everything"), which must stay distinct from NULL.
 *
 * Runs in the `db` vitest project (sequential) against local Postgres via the
 * raw `pg` pool. Restores the member row it touches.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('members.nav_favorites', () => {
  let memberId: string;
  let original: string[] | null;

  beforeAll(async () => {
    const rows = await executeSql(`SELECT id, nav_favorites FROM public.members LIMIT 1`);
    if (rows.length === 0) {
      throw new Error('membersNavFavorites.db.test needs at least one member row. Seed the local DB.');
    }
    memberId = rows[0].id;
    original = rows[0].nav_favorites;
  });

  afterAll(async () => {
    await executeSql(`UPDATE public.members SET nav_favorites = $2 WHERE id = $1`, [memberId, original]);
    await closePostgresPool();
  });

  it('is a nullable text[] that defaults to NULL', async () => {
    const rows = await executeSql(
      `SELECT data_type, udt_name, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'nav_favorites'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ data_type: 'ARRAY', udt_name: '_text', is_nullable: 'YES' });
    expect(rows[0].column_default).toBeNull();
  });

  it('round-trips a list, and keeps [] distinct from NULL', async () => {
    const write = async (value: string[] | null) => {
      await executeSql(`UPDATE public.members SET nav_favorites = $2 WHERE id = $1`, [memberId, value]);
      const rows = await executeSql(`SELECT nav_favorites FROM public.members WHERE id = $1`, [memberId]);
      return rows[0].nav_favorites;
    };

    expect(await write(['rules', 'stats'])).toEqual(['rules', 'stats']);
    expect(await write([])).toEqual([]);
    expect(await write(null)).toBeNull();
  });
});
