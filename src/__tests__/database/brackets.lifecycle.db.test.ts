/**
 * @fileoverview Lifecycle tests for the bracket write RPCs (Unit 3):
 * start_bracket + advance_bracket_winner.
 *
 * Drives the SQL functions directly via raw `pg` (they're granted to
 * `authenticated`; raw pg runs as postgres, so we test the LOGIC independent of
 * the grant — which is the risky part). Proves: the engine tree persists with
 * pointers resolved; the guarded advance propagates winner→next and
 * loser→loser_next; the guard makes a stale/duplicate/conflicting advance a
 * no-op; the bracket completes when the terminal resolves; and a double-elim
 * grand-final reset activates only when the LB champion wins.
 *
 * Runs in the `db` vitest project (sequential, jsdom). Cleanup via CASCADE.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';
import { generateBracket } from '@/utils/bracket/generateBracket';
import type { BracketFormat, GeneratedMatch } from '@/types/bracket';

/** Map an engine match to the snake_case jsonb start_bracket expects. */
function toRpc(m: GeneratedMatch) {
  return {
    key: m.key,
    round: m.round,
    side: m.side,
    slot: m.slot,
    home_seed: m.homeSeed,
    away_seed: m.awaySeed,
    winner_seed: m.winnerSeed,
    status: m.status,
    next_match_key: m.nextMatchKey,
    next_match_slot: m.nextMatchSlot,
    loser_next_match_key: m.loserNextMatchKey,
    loser_next_match_slot: m.loserNextMatchSlot,
    is_reset_match: m.isResetMatch,
  };
}

describe('bracket lifecycle RPCs', () => {
  let memberId: string;
  const bracketIds: string[] = [];

  /** Create a setup bracket with N named participants; return its id. */
  async function seedBracket(
    format: BracketFormat,
    n: number,
    reset = false
  ): Promise<string> {
    const b = await executeSql(
      `INSERT INTO public.brackets (name, format, grand_final_reset, created_by)
       VALUES ('LC', $1, $2, $3) RETURNING id`,
      [format, reset, memberId]
    );
    const bracketId = b[0].id;
    bracketIds.push(bracketId);
    const values = Array.from({ length: n }, (_, i) => `($1, 'P${i + 1}', ${i + 1})`).join(',');
    await executeSql(
      `INSERT INTO public.bracket_participants (bracket_id, display_name, seed) VALUES ${values}`,
      [bracketId]
    );
    return bracketId;
  }

  /** Persist the engine tree via start_bracket. */
  async function start(bracketId: string, format: BracketFormat, n: number, reset = false) {
    const tree = generateBracket(n, { format, grandFinalReset: reset }).map(toRpc);
    await executeSql(`SELECT public.start_bracket($1, $2::jsonb)`, [
      bracketId,
      JSON.stringify(tree),
    ]);
  }

  /** All matches for a bracket, newest-schema fields, ordered for stability. */
  async function matches(bracketId: string) {
    return executeSql(
      `SELECT id, round, side, slot, home_participant_id, away_participant_id,
              winner_participant_id, next_match_id, next_match_slot,
              loser_next_match_id, loser_next_match_slot, status, is_reset_match
         FROM public.bracket_matches WHERE bracket_id = $1
        ORDER BY side, round, slot`,
      [bracketId]
    );
  }

  async function advance(matchId: string, winnerId: string): Promise<boolean> {
    const r = await executeSql(
      `SELECT public.advance_bracket_winner($1, $2) AS advanced`,
      [matchId, winnerId]
    );
    return r[0].advanced;
  }

  beforeAll(async () => {
    const m = await executeSql(`SELECT id FROM public.members LIMIT 1`);
    if (m.length === 0) throw new Error('bracket lifecycle test requires a member row.');
    memberId = m[0].id;
  });

  afterAll(async () => {
    if (bracketIds.length > 0) {
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [bracketIds]);
    }
    await closePostgresPool();
  });

  it('start_bracket persists the tree with pointers resolved and flips to live', async () => {
    const bracketId = await seedBracket('single_elimination', 4);
    await start(bracketId, 'single_elimination', 4);

    const ms = await matches(bracketId);
    expect(ms.length).toBe(3); // N-1
    const status = await executeSql(`SELECT status FROM public.brackets WHERE id = $1`, [bracketId]);
    expect(status[0].status).toBe('live');

    // Round-1 matches point at the final via a real uuid (key→uuid resolved).
    const r1 = ms.filter((x) => x.round === 1);
    expect(r1.length).toBe(2);
    expect(r1.every((x) => x.next_match_id !== null)).toBe(true);
    const finalId = ms.find((x) => x.round === 2)!.id;
    expect(r1.every((x) => x.next_match_id === finalId)).toBe(true);
    // Round-1 both slots filled → ready.
    expect(r1.every((x) => x.status === 'ready')).toBe(true);
  });

  it('advance propagates the winner into the next match and readies it', async () => {
    const bracketId = await seedBracket('single_elimination', 4);
    await start(bracketId, 'single_elimination', 4);
    const ms = await matches(bracketId);
    const [a, b] = ms.filter((x) => x.round === 1);
    const finalId = ms.find((x) => x.round === 2)!.id;

    const winnerA = a.home_participant_id;
    expect(await advance(a.id, winnerA)).toBe(true);

    let final = (await matches(bracketId)).find((x) => x.id === finalId)!;
    // a feeds the final's HOME slot.
    expect(final.home_participant_id).toBe(winnerA);
    expect(final.status).toBe('pending'); // away not filled yet

    const winnerB = b.away_participant_id;
    expect(await advance(b.id, winnerB)).toBe(true);
    final = (await matches(bracketId)).find((x) => x.id === finalId)!;
    expect(final.away_participant_id).toBe(winnerB);
    expect(final.status).toBe('ready'); // both slots filled
  });

  it('completing the terminal match marks the bracket complete', async () => {
    const bracketId = await seedBracket('single_elimination', 2);
    await start(bracketId, 'single_elimination', 2);
    const only = (await matches(bracketId))[0];
    await advance(only.id, only.home_participant_id);

    const status = await executeSql(`SELECT status FROM public.brackets WHERE id = $1`, [bracketId]);
    expect(status[0].status).toBe('complete');
  });

  it('the guard makes a duplicate / conflicting advance a no-op', async () => {
    const bracketId = await seedBracket('single_elimination', 2);
    await start(bracketId, 'single_elimination', 2);
    const only = (await matches(bracketId))[0];
    const home = only.home_participant_id;
    const away = only.away_participant_id;

    expect(await advance(only.id, home)).toBe(true); // first wins
    // Second, conflicting tap (different winner) → no-op, winner unchanged.
    expect(await advance(only.id, away)).toBe(false);
    const after = (await matches(bracketId)).find((x) => x.id === only.id)!;
    expect(after.winner_participant_id).toBe(home);
  });

  it('advance rejects a non-participant winner', async () => {
    const bracketId = await seedBracket('single_elimination', 2);
    await start(bracketId, 'single_elimination', 2);
    const only = (await matches(bracketId))[0];
    await expect(advance(only.id, memberId /* not a participant */)).rejects.toThrow();
  });

  it('double-elim advance drops the loser into the losers bracket', async () => {
    const bracketId = await seedBracket('double_elimination', 4);
    await start(bracketId, 'double_elimination', 4);
    const ms = await matches(bracketId);
    const wb1 = ms.filter((x) => x.side === 'winners' && x.round === 1)[0];
    expect(wb1.loser_next_match_id).not.toBeNull();

    const loser = wb1.away_participant_id;
    await advance(wb1.id, wb1.home_participant_id);

    const dropTarget = (await matches(bracketId)).find((x) => x.id === wb1.loser_next_match_id)!;
    const droppedIn =
      dropTarget.home_participant_id === loser || dropTarget.away_participant_id === loser;
    expect(droppedIn).toBe(true);
  });

  it('grand-final reset: LB champ win activates the reset; WB champ win completes', async () => {
    // Two independent 2-player double-elim brackets with reset ON. A 2-player
    // double-elim has WB final (W1-0) + grand final; reset is the decider.
    // Case A — WB champ (home) wins GF → reset removed, bracket completes.
    const a = await seedBracket('double_elimination', 2, true);
    await start(a, 'double_elimination', 2, true);
    let msa = await matches(a);
    const wbFinalA = msa.find((x) => x.side === 'winners')!;
    await advance(wbFinalA.id, wbFinalA.home_participant_id); // WB champ = seed of home
    const gfA = (await matches(a)).find((x) => x.side === 'grand_final' && !x.is_reset_match)!;
    await advance(gfA.id, gfA.home_participant_id); // WB champ wins GF
    msa = await matches(a);
    expect(msa.some((x) => x.is_reset_match)).toBe(false); // reset removed
    const statusA = await executeSql(`SELECT status FROM public.brackets WHERE id = $1`, [a]);
    expect(statusA[0].status).toBe('complete');

    // Case B — LB champ (away) wins GF → reset activates as a ready decider.
    const b = await seedBracket('double_elimination', 2, true);
    await start(b, 'double_elimination', 2, true);
    const wbFinalB = (await matches(b)).find((x) => x.side === 'winners')!;
    await advance(wbFinalB.id, wbFinalB.home_participant_id);
    const gfB = (await matches(b)).find((x) => x.side === 'grand_final' && !x.is_reset_match)!;
    await advance(gfB.id, gfB.away_participant_id); // LB champ wins GF
    const resetB = (await matches(b)).find((x) => x.is_reset_match)!;
    expect(resetB.status).toBe('ready'); // activated + both slots filled
    const statusB = await executeSql(`SELECT status FROM public.brackets WHERE id = $1`, [b]);
    expect(statusB[0].status).toBe('live'); // not complete — decider pending
  });
});
