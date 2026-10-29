/**
 * @fileoverview Guards the trust behind narrowMatchRow (src/api/queries/matchRows.ts).
 *
 * The match queries type status columns from plain database text into the
 * app's status unions. That is only safe while each CHECK constraint allows
 * exactly the values the app's list declares. If a migration adds or drops a
 * status without the app's list following (or the reverse), this test fails
 * instead of the app quietly mishandling the new value.
 *
 * Run: `pnpm test:run src/__tests__/database/matchRowNarrowing`
 */

import { describe, it, expect, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';
import { MATCH_STATUSES } from '@/types/schedule';
import { TEAM_STATUSES } from '@/types/team';

/** The values a CHECK constraint on `table.column` allows, sorted. */
async function allowedValues(table: string, column: string): Promise<string[]> {
  const rows = await executeSql(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
      WHERE c.conrelid = $1::regclass AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ~ ('\\m' || $2 || '\\M')`,
    [table, column],
  );
  expect(rows).toHaveLength(1);
  // e.g. CHECK ((status = ANY (ARRAY['scheduled'::text, ...]))) → the quoted values
  return [...rows[0].def.matchAll(/'([^']+)'/g)].map((m: RegExpMatchArray) => m[1]).sort();
}

const sorted = (values: readonly string[]) => [...values].sort();

afterAll(async () => { await closePostgresPool(); });

describe('status lists match the database constraints', () => {
  it('matches.status allows exactly MATCH_STATUSES', async () => {
    expect(await allowedValues('matches', 'status')).toEqual(sorted(MATCH_STATUSES));
  });

  it('matches.match_result allows exactly the three results', async () => {
    expect(await allowedValues('matches', 'match_result')).toEqual(['away_win', 'home_win', 'tie']);
  });

  it('teams.status allows exactly TEAM_STATUSES', async () => {
    expect(await allowedValues('teams', 'status')).toEqual(sorted(TEAM_STATUSES));
  });
});
