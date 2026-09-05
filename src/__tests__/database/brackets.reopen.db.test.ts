/**
 * @fileoverview Reopen (undo) tests for the bracket RPC (reopen_bracket_match).
 *
 * Proves: reopening a decided match clears its winner (→ ready) and pulls the
 * advanced player back out of the next match (→ pending); the downstream guard
 * refuses when a later match has already been played; reopening a terminal
 * match flips the bracket back from complete to live.
 *
 * Runs in the `db` vitest project (sequential, jsdom). Drives the SQL directly
 * via raw pg (the RPC is authenticated-only; pg runs as postgres).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';
import { generateBracket } from '@/utils/bracket/generateBracket';
import type { BracketFormat, GeneratedMatch } from '@/types/bracket';

function toRpc(m: GeneratedMatch) {
  return {
    key: m.key, round: m.round, side: m.side, slot: m.slot,
    home_seed: m.homeSeed, away_seed: m.awaySeed, winner_seed: m.winnerSeed,
    status: m.status, next_match_key: m.nextMatchKey, next_match_slot: m.nextMatchSlot,
    loser_next_match_key: m.loserNextMatchKey, loser_next_match_slot: m.loserNextMatchSlot,
    is_reset_match: m.isResetMatch,
  };
}

describe('reopen_bracket_match', () => {
  let memberId: string;
  const bracketIds: string[] = [];

  async function seedAndStart(format: BracketFormat, n: number): Promise<string> {
    const b = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by)
       VALUES ('RE', $1, $2) RETURNING id`,
      [format, memberId]
    );
    const id = b[0].id;
    bracketIds.push(id);
    const values = Array.from({ length: n }, (_, i) => `($1, 'P${i + 1}', ${i + 1})`).join(',');
    await executeSql(
      `INSERT INTO public.bracket_participants (bracket_id, display_name, seed) VALUES ${values}`,
      [id]
    );
    const tree = generateBracket(n, { format }).map(toRpc);
    await executeSql(`SELECT public.start_bracket($1, $2::jsonb)`, [id, JSON.stringify(tree)]);
    return id;
  }

  const matches = (id: string) =>
    executeSql(
      `SELECT id, round, side, slot, home_participant_id, away_participant_id,
              winner_participant_id, next_match_id, next_match_slot, status
         FROM public.bracket_matches WHERE bracket_id = $1 ORDER BY side, round, slot`,
      [id]
    );
  const advance = (matchId: string, winnerId: string) =>
    executeSql(`SELECT public.advance_bracket_winner($1, $2)`, [matchId, winnerId]);
  const reopen = (matchId: string) =>
    executeSql(`SELECT public.reopen_bracket_match($1) AS ok`, [matchId]).then((r) => r[0].ok);
  const bracketStatus = (id: string) =>
    executeSql(`SELECT status FROM public.brackets WHERE id = $1`, [id]).then((r) => r[0].status);

  beforeAll(async () => {
    const m = await executeSql(`SELECT id FROM public.members LIMIT 1`);
    if (m.length === 0) throw new Error('reopen test requires a member row.');
    memberId = m[0].id;
  });

  afterAll(async () => {
    if (bracketIds.length > 0) {
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [bracketIds]);
    }
    await closePostgresPool();
  });

  it('reopen clears the winner and pulls the player out of the next match', async () => {
    const id = await seedAndStart('single_elimination', 4);
    const ms = await matches(id);
    const semi = ms.filter((x) => x.round === 1)[0];
    const finalId = ms.find((x) => x.round === 2)!.id;
    const winner = semi.home_participant_id;

    await advance(semi.id, winner);
    // Winner advanced into the final's home slot.
    let final = (await matches(id)).find((x) => x.id === finalId)!;
    expect(final.home_participant_id).toBe(winner);

    expect(await reopen(semi.id)).toBe(true);
    const after = await matches(id);
    const reopened = after.find((x) => x.id === semi.id)!;
    expect(reopened.winner_participant_id).toBeNull();
    expect(reopened.status).toBe('ready');
    // Pulled back out of the final.
    final = after.find((x) => x.id === finalId)!;
    expect(final.home_participant_id).toBeNull();
    expect(final.status).toBe('pending');
  });

  it('refuses to reopen when a later match has already been played', async () => {
    const id = await seedAndStart('single_elimination', 4);
    const ms = await matches(id);
    const [a, b] = ms.filter((x) => x.round === 1);
    const finalId = ms.find((x) => x.round === 2)!.id;

    await advance(a.id, a.home_participant_id);
    await advance(b.id, b.away_participant_id);
    // Play the final (downstream of both semis).
    const final = (await matches(id)).find((x) => x.id === finalId)!;
    await advance(final.id, final.home_participant_id);

    // Reopening a semi now must fail — the final was already played.
    await expect(reopen(a.id)).rejects.toThrow();
  });

  it('reopening the terminal match flips the bracket back to live', async () => {
    const id = await seedAndStart('single_elimination', 2);
    const only = (await matches(id))[0];
    await advance(only.id, only.home_participant_id);
    expect(await bracketStatus(id)).toBe('complete');

    expect(await reopen(only.id)).toBe(true);
    expect(await bracketStatus(id)).toBe('live');
    const after = (await matches(id))[0];
    expect(after.winner_participant_id).toBeNull();
    expect(after.status).toBe('ready');
  });

  it('reopen is a no-op on a match that is not complete', async () => {
    const id = await seedAndStart('single_elimination', 2);
    const only = (await matches(id))[0];
    expect(await reopen(only.id)).toBe(false); // still 'ready', nothing to undo
  });
});
