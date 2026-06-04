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

/**
 * Build an id → {name, team} map from both rosters. `name` prefers the nickname
 * (the mobile-primary display), falling back to "First Last"; `team` is the
 * member's team display name. Feeds `buildConfirmerAudit`.
 */
export function buildNameTeamMap(
  home: { data: unknown; teamName: string },
  away: { data: unknown; teamName: string }
): Map<string, { name: string; team: string }> {
  const map = new Map<string, { name: string; team: string }>();
  for (const side of [home, away]) {
    const players = (side.data as RosterData | undefined)?.team_players;
    players?.forEach((tp) => {
      const m = tp.members;
      if (m) {
        const name = m.nickname || `${m.first_name} ${m.last_name}`.trim();
        map.set(m.id, { name, team: side.teamName });
      }
    });
  }
  return map;
}
