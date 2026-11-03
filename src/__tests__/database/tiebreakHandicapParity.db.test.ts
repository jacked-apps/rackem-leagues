// @vitest-environment jsdom
/**
 * @fileoverview PARITY — Units 4 and 5 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md, which ship together.
 *
 * The tiebreak credit moves from overwritten game rows to the tiebreak record.
 * Ed's acceptance bar: for the same tiebreaker, every player's handicap comes
 * out IDENTICAL. Each scenario:
 *   1. OLD world — rows overwritten, no record. The frozen pre-change code
 *      (helpers/legacyHandicapHistory) gives the reference tallies. The new
 *      code must agree here too: ties settled before this change (D5, no
 *      backfill) keep their credit.
 *   2. NEW world — real results on the rows, a resolved record. The new code
 *      must still produce the reference tallies: a winner gains exactly one
 *      win per slot (never two), a loser nothing.
 * Tallies (wins, losses) are compared rather than rounded handicaps, so a
 * one-game drift cannot hide inside the rounding. Three windows are checked:
 * all leagues, league-scoped, and a short limit that cuts the history.
 *
 * Run: `pnpm test:run src/__tests__/database/tiebreakHandicapParity`
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';
import { fetchHandicapHistory } from '@/api/queries/matchGames';
import { calculatePlayerHandicap } from '@/utils/calculatePlayerHandicap';
import { resolveTiebreakerRecord } from '@/api/mutations/resolveTiebreaker';
import { legacyTally } from './helpers/legacyHandicapHistory';
import { buildScenario, type Side, type TiebreakScenario } from './helpers/tiebreakScenario';

type Tally = { wins: number; losses: number };

async function newTally(player: string, leagueId?: string, limit = 200): Promise<Tally> {
  const games = await fetchHandicapHistory(player, 'eight_ball', leagueId, limit);
  const wins = games.filter((g) => g.won).length;
  return { wins, losses: games.length - wins };
}

/** Every player x every window, keyed so a mismatch names who and where. */
async function allTallies(s: TiebreakScenario, tally: typeof newTally) {
  const out: Record<string, Tally> = {};
  for (const p of s.players) {
    out[`${p} all`] = await tally(p);
    out[`${p} league`] = await tally(p, s.tie.league);
    out[`${p} limit20`] = await tally(p, undefined, 20);
  }
  return out;
}

const handicaps = (s: TiebreakScenario) =>
  Promise.all(s.players.map(async (p) => [
    (await calculatePlayerHandicap(p, 'points', 'standard', 'eight_ball', s.tie.league)).value,
    (await calculatePlayerHandicap(p, 'percentage', 'standard', 'eight_ball', s.tie.league)).value,
  ]));

const SCENARIOS: [string, string[], (Side | null)[]][] = [
  ['home wins 2-1', ['a', 'b', 'c'], ['home', 'away', 'home']],
  ['away wins 2-0 (game 3 never played)', ['a', 'b', 'c'], ['away', 'away', null]],
  ['home wins 2-1 with double duty', ['a', 'b', 'a'], ['away', 'home', 'home']],
];

afterAll(async () => { await closePostgresPool(); });

describe.each(SCENARIOS)('tiebreak handicap parity — %s', (_name, pattern, results) => {
  let s: TiebreakScenario;
  let reference: Record<string, Tally>;
  let referenceHandicaps: unknown;

  beforeAll(async () => {
    s = await buildScenario(pattern, results);
    reference = await allTallies(s, (p, league, limit) => legacyTally(p, 'eight_ball', league, limit));
    referenceHandicaps = await handicaps(s);
  });
  afterAll(async () => { await s?.tie.cleanup(); });

  it('old world: the new code matches the old code (settled ties keep their credit)', async () => {
    expect(await allTallies(s, newTally)).toEqual(reference);
  });

  it('new world: real results + record give IDENTICAL tallies and handicaps', async () => {
    await s.toNewWorld();
    expect(await allTallies(s, newTally)).toEqual(reference);
    expect(await handicaps(s)).toEqual(referenceHandicaps);
  });

  it('a winner gains exactly one win per slot — never two', async () => {
    const p = (s.winner === 'home' ? s.tie.homeSlots : s.tie.awaySlots)[0];
    const slots = (s.winner === 'home' ? s.tie.homeSlots : s.tie.awaySlots).slice(0, 3).filter((x) => x === p).length;
    const [{ n }] = await executeSql(
      `SELECT count(*)::int AS n FROM match_games WHERE winner_player_id = $1 AND NOT is_tiebreaker`, [p]);
    expect((await newTally(p)).wins).toBe(n + slots);
  });

  it('the game rows keep what really happened; resolving again changes nothing', async () => {
    const rows = JSON.parse(await s.tiebreakRows()) as { r: { winner_team_id: string | null } }[];
    expect(rows.map((x) => x.r.winner_team_id)).toEqual(results.map((r) => (r ? s.teamOf(r) : null)));

    const before = await s.tiebreakRows();
    const loser: Side = s.winner === 'home' ? 'away' : 'home';
    await resolveTiebreakerRecord(s.tie.match, s.teamOf(loser));
    const [tb] = await executeSql(
      `SELECT winning_team_id, resolved_at FROM match_tiebreakers WHERE match_id = $1`, [s.tie.match]);
    expect(tb.winning_team_id).toBe(s.teamOf(s.winner));
    expect(tb.resolved_at).not.toBeNull();
    expect(await s.tiebreakRows()).toBe(before);
  });
});
