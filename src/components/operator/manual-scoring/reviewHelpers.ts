/**
 * @fileoverview Pure helpers for the LO review/correct surface (v2).
 *
 * Kept out of the component file for testability. These shape the raw
 * `match_games` + `game_confirmations` rows into what the review surface renders:
 * the per-game achievement chips, the per-game confirmation slice, and the
 * id → {name, team} map the confirmer-audit derive needs.
 *
 * @see docs/plans/2026-06-04-001-feat-lo-match-review-correction-plan.md — Unit 6
 * @see src/utils/match/confirmerAudit.ts — the audit derive these feed
 */

import type { EntryGame } from './entryHelpers';
import type { ConfirmationForAudit } from '@/utils/match/confirmerAudit';
import type { LoGameResult } from '@/api/mutations/loManualScoring';

/**
 * A `match_games` row as the review surface reads it — the Entry fields plus the
 * official-confirmer columns (uuid member ids; the audit's source of truth).
 */
export interface ReviewGame extends EntryGame {
  confirmed_by_home: string | null;
  confirmed_by_away: string | null;
}

/**
 * Truthy achievement labels for a scored game, in display order. Empty when the
 * game has no extras (the caller hides the chip row entirely — "only when
 * present"). Mirrors the live `formatExtras` ordering for consistency.
 */
export function achievementChips(game: EntryGame): string[] {
  const chips: string[] = [];
  if (game.break_and_run) chips.push('Break & Run');
  if (game.golden_break) chips.push('Golden Break');
  if (game.break_fouled) chips.push('Break Fouled');
  if (game.runout) chips.push('Runout');
  if (game.win_by_forfeit) chips.push('Forfeit');
  return chips;
}

/**
 * Snapshot a scored game's result into the shape `loRestoreGame` needs to undo a
 * vacate. Captured BEFORE the vacate wipes the columns; held in memory so an Undo
 * re-writes the exact pre-vacate result.
 */
export function gameToSnapshot(game: ReviewGame): LoGameResult {
  return {
    winnerTeamId: game.winner_team_id ?? '',
    winnerPlayerId: game.winner_player_id ?? '',
    breakAndRun: !!game.break_and_run,
    goldenBreak: !!game.golden_break,
    breakFouled: !!game.break_fouled,
    runout: !!game.runout,
    winByForfeit: !!game.win_by_forfeit,
    winnerValue: game.winner_value ?? null,
    loserValue: game.loser_value ?? null,
  };
}

/** A `game_confirmations` row narrowed to what this surface threads around. */
export interface ConfirmationRow extends ConfirmationForAudit {
  game_id: string | null;
}

/** This game's confirmations (the audit derive scopes the rest itself). */
export function confirmationsForGame(
  confirmations: readonly ConfirmationRow[],
  gameId: string
): ConfirmationRow[] {
  return confirmations.filter((c) => c.game_id === gameId);
}

/** A team roster as `useTeamDetails` returns it (only the bits we read). */
interface RosterData {
  team_players?: Array<{
    members?: {
      id: string;
      nickname: string | null;
      first_name: string;
      last_name: string;
    } | null;
  }> | null;
}

/** A resolved roster member: nickname-preferred `name` + always-full `fullName`. */
export interface NameTeamEntry {
  /** Nickname-preferred (mobile-primary) — used for the compact matchup line. */
  name: string;
  /** Always "First Last" — used for the confirmer list (dispute adjudication). */
  fullName: string;
  team: string;
}

/**
 * Build an id → {name, fullName, team} map from both rosters. `name` prefers the
 * nickname (the mobile-primary matchup display); `fullName` is always "First
 * Last" (the confirmer audit wants real identities, not nicknames); `team` is the
 * member's team display name.
 */
export function buildNameTeamMap(
  home: { data: unknown; teamName: string },
  away: { data: unknown; teamName: string }
): Map<string, NameTeamEntry> {
  const map = new Map<string, NameTeamEntry>();
  for (const side of [home, away]) {
    const players = (side.data as RosterData | undefined)?.team_players;
    players?.forEach((tp) => {
      const m = tp.members;
      if (m) {
        const fullName = `${m.first_name} ${m.last_name}`.trim();
        map.set(m.id, { name: m.nickname || fullName, fullName, team: side.teamName });
      }
    });
  }
  return map;
}

/**
 * Project a {@link NameTeamEntry} map down to the `{name, team}` shape
 * `buildConfirmerAudit` expects, with **full names** as `name` — so the confirmer
 * list shows real identities rather than nicknames.
 */
export function fullNameTeamMap(
  map: ReadonlyMap<string, NameTeamEntry>
): Map<string, { name: string; team: string }> {
  const out = new Map<string, { name: string; team: string }>();
  for (const [id, e] of map) out.set(id, { name: e.fullName, team: e.team });
  return out;
}
