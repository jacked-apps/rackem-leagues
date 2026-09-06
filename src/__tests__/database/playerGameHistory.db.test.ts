/**
 * @fileoverview The My Stats query, run against a real PostgREST.
 *
 * This exists because of a bug that shipped: `match_lineups` is reachable from
 * `matches` by three different foreign keys (the lineup's own `match_id`, plus
 * the match's `home_lineup_id` and `away_lineup_id`), so an unqualified embed
 * is ambiguous and PostgREST refuses it:
 *
 *   Could not embed because more than one relationship was found for
 *   'matches' and 'match_lineups'
 *
 * Every unit test passed, typecheck passed and the build passed, because none
 * of them ask Postgres anything — they cover the pure mapping over rows that
 * are handed to them. The select string was only ever exercised by a human
 * opening the page.
 *
 * So: run the real select. It cannot assert much about the CONTENT (that
 * depends on whatever the local database has been seeded with) but it proves
 * the query is one Postgres will actually answer, which is the failure that
 * got through.
 *
 * Needs a seeded local database with played matches — see
 * `database/dev_play_matches.sql`. Skips rather than fails when there are none,
 * since an empty database is a legitimate state and a red suite would just
 * teach people to ignore it.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServiceClient } from '@/test/dbTestUtils';
import { closePostgresPool, executeSql } from '@/test/dbTestUtils';
import { GAME_SELECT } from '@/api/queries/playerGameHistory';

let anyPlayer: string | null = null;

beforeAll(async () => {
  const rows = await executeSql(
    `SELECT home_player_id AS id
       FROM public.match_games
      WHERE home_player_id IS NOT NULL
      LIMIT 1`
  );
  anyPlayer = rows[0]?.id ?? null;
});

afterAll(async () => {
  await closePostgresPool();
});

describe('playerGameHistory — the select PostgREST has to answer', () => {
  it('resolves every embed without an ambiguity error', async () => {
    if (!anyPlayer) {
      console.warn('No played games in this database — run database/dev_play_matches.sql');
      return;
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('match_games')
      .select(GAME_SELECT)
      .or(`home_player_id.eq.${anyPlayer},away_player_id.eq.${anyPlayer}`)
      .eq('is_tiebreaker', false)
      .in('match.status', ['completed', 'verified'])
      .limit(5);

    // The message is worth surfacing: an ambiguous embed reads as a data
    // problem until you notice it names two tables and a relationship.
    expect(error?.message ?? null).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('returns the shape the mapper expects, not just any rows', async () => {
    if (!anyPlayer) return;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('match_games')
      .select(GAME_SELECT)
      .or(`home_player_id.eq.${anyPlayer},away_player_id.eq.${anyPlayer}`)
      .eq('is_tiebreaker', false)
      .in('match.status', ['completed', 'verified'])
      .limit(1);

    expect(error).toBeNull();
    if (!data || data.length === 0) return;

    // Cast through unknown: the generated types don't describe aliased embeds,
    // and this test is about the runtime shape rather than the declared one.
    const row = data[0] as unknown as Record<string, any>;

    // Each of these is a field the page reads. A renamed column or a dropped
    // relationship shows up here rather than as a blank column in the UI.
    expect(row).toHaveProperty('game_type');
    expect(row).toHaveProperty('early_eight');
    expect(row.match).toBeTruthy();
    expect(row.match).toHaveProperty('assigned_table_number');
    expect(row.match).toHaveProperty('system_snapshot');
    // The embed that was ambiguous. An array, one entry per team.
    expect(Array.isArray(row.match.lineups)).toBe(true);
  });
});
