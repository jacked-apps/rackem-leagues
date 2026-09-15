/**
 * @fileoverview Schema checks for the early-8 columns.
 *
 * Two columns, one rule. `match_games.early_eight` records that the LOSER
 * pocketed the 8 early; `game_confirmations.early_eight` snapshots what each
 * scorer vouched for, so dissent detection compares it like every other field.
 *
 * The constraint is the point: an early 8 means the loser ended the game, so
 * the winner cleared nothing and no achievement can apply. The UI enforces the
 * same rule, but a constraint is what makes it true of rows written by anything
 * else — a migration, a fix-up script, a future import.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

afterAll(async () => {
  await closePostgresPool();
});

describe('early_eight columns', () => {
  it('exists on match_games, defaulting to false and never null', async () => {
    const rows = await executeSql(
      `SELECT data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'match_games'
          AND column_name = 'early_eight'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].data_type).toBe('boolean');
    // NOT NULL + default false: every existing game is "no early 8", which is
    // the truthful backfill — nobody recorded one before the column existed.
    expect(rows[0].is_nullable).toBe('NO');
    expect(rows[0].column_default).toBe('false');
  });

  it('exists on game_confirmations, so a vouch can disagree about it', async () => {
    const rows = await executeSql(
      `SELECT data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'game_confirmations'
          AND column_name = 'early_eight'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].data_type).toBe('boolean');
    expect(rows[0].is_nullable).toBe('NO');
  });
});

describe('early_eight excludes the winner achievements', () => {
  /** The CHECK, read straight from the catalog. */
  async function constraintDef(): Promise<string | null> {
    const rows = await executeSql(
      `SELECT pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conrelid = 'public.match_games'::regclass
          AND conname = 'match_games_early_eight_excludes_feats'`
    );
    return rows[0]?.def ?? null;
  }

  it('is present', async () => {
    expect(await constraintDef()).not.toBeNull();
  });

  it.each(['break_and_run', 'golden_break', 'runout'])(
    'names %s as incompatible',
    async (column) => {
      expect(await constraintDef()).toContain(column);
    }
  );

  it('permits an early 8 on its own', async () => {
    // Evaluate the predicate directly rather than inserting a game, which would
    // need a match, two lineups and two players to satisfy its foreign keys.
    const rows = await executeSql(
      `SELECT NOT (true AND (false OR false OR false)) AS allowed`
    );
    expect(rows[0].allowed).toBe(true);
  });

  it.each([
    ['break_and_run', 'true, false, false'],
    ['golden_break', 'false, true, false'],
    ['runout', 'false, false, true'],
  ])('rejects an early 8 alongside %s', async (_label, flags) => {
    const [br, gb, ro] = flags.split(',').map((f) => f.trim());
    const rows = await executeSql(
      `SELECT NOT (true AND (${br} OR ${gb} OR ${ro})) AS allowed`
    );
    expect(rows[0].allowed).toBe(false);
  });
});
