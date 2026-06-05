/**
 * @fileoverview Pure lineup transforms for the LO Setup phase — kept out of the
 * component file so they're independently testable (and so the component file
 * only exports components, per react-refresh).
 */

import type { LineupPlayer } from '@/api/mutations/matchLineups';

/** Per-position selection on one side: chosen player + handicap (held as a string). */
export type SideLineup = Record<number, { playerId: string; handicap: string }>;

/** Build a {player{n}_id, player{n}_handicap} row for the completeness check. */
export function toLineupRow(side: SideLineup, lineupSize: number): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (let n = 1; n <= lineupSize; n++) {
    row[`player${n}_id`] = side[n]?.playerId || null;
    row[`player${n}_handicap`] = side[n]?.handicap ? Number(side[n].handicap) : null;
  }
  return row;
}

/** Convert a side's selections to the LineupPlayer[] `loSaveLineups` expects. */
export function toLineupPlayers(side: SideLineup, lineupSize: number): LineupPlayer[] {
  const players: LineupPlayer[] = [];
  for (let n = 1; n <= lineupSize; n++) {
    const slot = side[n];
    if (slot?.playerId) {
      players.push({ position: n, playerId: slot.playerId, handicap: Number(slot.handicap) || 0 });
    }
  }
  return players;
}
