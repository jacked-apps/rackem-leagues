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
 * It builds its OWN completed match with one played game (and removes it
 * after), so it runs on any database — including CI's, which has no played
 * games. It used to look for "any played game", find none in CI, and return
 * early: passing while checking nothing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServiceClient, requireSeed } from '@/test/dbTestUtils';
import { closePostgresPool, executeSql } from '@/test/dbTestUtils';
import { GAME_SELECT } from '@/api/queries/playerGameHistory';

let anyPlayer: string | null = null;
let matchId: string | null = null;

beforeAll(async () => {
  // Only structural rows come from the seed (a season week, a member); the
  // played game the query reads is ours.
  const weeks = await executeSql(
    `SELECT id AS week_id, season_id FROM public.season_weeks ORDER BY id LIMIT 1`
  );
  const members = await executeSql(`SELECT id FROM public.members ORDER BY id LIMIT 1`);
  requireSeed(weeks[0], 'a season week');
  requireSeed(members[0], 'a member');

  const match = await executeSql(
    `INSERT INTO public.matches (season_id, season_week_id, match_number, status)
     VALUES ($1, $2, 9902, 'completed')
     RETURNING id`,
    [weeks[0].season_id, weeks[0].week_id]
  );
  matchId = match[0].id;
  anyPlayer = members[0].id;

  await executeSql(
    `INSERT INTO public.match_games
       (match_id, game_number, home_action, away_action, game_type, home_player_id, is_tiebreaker)
     VALUES ($1, 1, 'breaks', 'racks', 'eight_ball', $2, false)`,
    [matchId, anyPlayer]
  );
});

afterAll(async () => {
  // Ours to remove — the game references the match.
  if (matchId) {
    await executeSql(`DELETE FROM public.match_games WHERE match_id = $1`, [matchId]);
    await executeSql(`DELETE FROM public.matches WHERE id = $1`, [matchId]);
  }
  await closePostgresPool();
});

describe('playerGameHistory — the select PostgREST has to answer', () => {
  it('resolves every embed without an ambiguity error', async () => {
    requireSeed(anyPlayer, 'the player on the game this test created');

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
    requireSeed(anyPlayer, 'the player on the game this test created');

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('match_games')
      .select(GAME_SELECT)
      .or(`home_player_id.eq.${anyPlayer},away_player_id.eq.${anyPlayer}`)
      .eq('is_tiebreaker', false)
      .in('match.status', ['completed', 'verified'])
      .limit(1);

    expect(error).toBeNull();
    requireSeed(data?.[0], 'the completed game this test created');

    // Cast through unknown: the generated types don't describe aliased embeds,
    // and this test is about the runtime shape rather than the declared one.
    const row = data[0] as unknown as Record<string, unknown> & { match: { lineups: unknown } };

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
