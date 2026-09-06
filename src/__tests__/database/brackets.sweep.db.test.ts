/**
 * @fileoverview Close + inactivity-sweep tests for brackets (Unit 7).
 *
 * Proves: closeBracket-shaped writes tombstone (status='closed') and leave
 * children until swept; sweep_stale_brackets hard-deletes closed + past-idle
 * brackets and cascades to their children, while leaving recently-active
 * brackets (including a setup-phase bracket just touched) untouched.
 *
 * Runs in the `db` vitest project (sequential, jsdom). Raw pg drives the sweep
 * function directly (granted authenticated; pg runs as postgres).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('bracket close + inactivity sweep', () => {
  let memberId: string;
  const bracketIds: string[] = [];

  /** Insert a bracket with a specific status + last_activity_at. */
  async function makeBracket(status: string, activitySql: string): Promise<string> {
    const r = await executeSql(
      `INSERT INTO public.brackets (name, format, status, created_by, last_activity_at)
       VALUES ('SW', 'single_elimination', $1, $2, ${activitySql})
       RETURNING id`,
      [status, memberId]
    );
    bracketIds.push(r[0].id);
    return r[0].id;
  }

  async function sweep(idleDays = 7): Promise<number> {
    const r = await executeSql(`SELECT public.sweep_stale_brackets($1) AS n`, [idleDays]);
    return r[0].n;
  }

  async function exists(id: string): Promise<boolean> {
    const r = await executeSql(`SELECT 1 FROM public.brackets WHERE id = $1`, [id]);
    return r.length > 0;
  }

  beforeAll(async () => {
    const m = await executeSql(`SELECT id FROM public.members LIMIT 1`);
    if (m.length === 0) throw new Error('bracket sweep test requires a member row.');
    memberId = m[0].id;
  });

  afterAll(async () => {
    if (bracketIds.length > 0) {
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [bracketIds]);
    }
    await closePostgresPool();
  });

  it('sweep removes a closed bracket and cascades to its children', async () => {
    const id = await makeBracket('closed', 'now()');
    await executeSql(
      `INSERT INTO public.bracket_participants (bracket_id, display_name, seed)
       VALUES ($1, 'Ann', 1)`,
      [id]
    );

    expect(await sweep()).toBeGreaterThanOrEqual(1);
    expect(await exists(id)).toBe(false);
    const children = await executeSql(
      `SELECT 1 FROM public.bracket_participants WHERE bracket_id = $1`,
      [id]
    );
    expect(children.length).toBe(0);
  });

  it('sweep removes a bracket idle past the threshold', async () => {
    const id = await makeBracket('live', `now() - interval '10 days'`);
    await sweep(7);
    expect(await exists(id)).toBe(false);
  });

  it('sweep keeps a recently-active live bracket', async () => {
    const id = await makeBracket('live', 'now()');
    await sweep(7);
    expect(await exists(id)).toBe(true);
  });

  it('sweep keeps a setup bracket that was just touched (the setup trap)', async () => {
    // An organizer mid-configuration must not be swept out from under them.
    const id = await makeBracket('setup', `now() - interval '1 hour'`);
    await sweep(7);
    expect(await exists(id)).toBe(true);
  });

  it('a setup bracket idle past the threshold IS swept (truly abandoned)', async () => {
    const id = await makeBracket('setup', `now() - interval '30 days'`);
    await sweep(7);
    expect(await exists(id)).toBe(false);
  });
});
