/**
 * @fileoverview Build the events payload for the score_game_with_events rpc
 * from the scoring modal's current state.
 *
 * Branch B Phase 1 maps the existing modal's individual boolean state
 * (breakAndRun, goldenBreak, runout, winByForfeit, breakFouled) onto the
 * registry's named events with proper attribution. Phase 2 will replace this
 * mapping with a direct events Map prop on the modal — at that point this
 * helper either disappears or simplifies to a near-noop.
 *
 * Attribution rules come from the registry. For each truthy event:
 *   - attributedTo='winner'           → winnerPlayerId
 *   - attributedTo='loser'            → loser (computed from match context)
 *   - attributedTo='breaker'          → post-flip actual breaker
 *   - attributedTo='non-breaker'      → post-flip actual non-breaker
 *   - attributedTo='scheduled-breaker' → pre-flip scheduled breaker
 *
 * The scheduled-breaker is whoever has `home_action = 'breaks'` (or the
 * away equivalent) on the match_games row. The actual breaker is the
 * scheduled breaker XOR break_fouled.
 *
 * @see docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md (Unit 6)
 */

import { getGameEvent } from './index';
import type { AttributedTo } from './types';

interface ScoringContext {
  breakAndRun: boolean;
  goldenBreak: boolean;
  runout: boolean;
  winByForfeit: boolean;
  breakFouled: boolean;
  /** UUID of the winning player (selected in the modal). */
  winnerPlayerId: string;
  /** True if the winner is the scheduled breaker for this game. Combined with breakFouled to determine actual breaker. */
  winnerWasScheduledBreaker: boolean;
  /** Home / away player ids on the match_games row (used to derive loser, breaker). */
  homePlayerId: string | null;
  awayPlayerId: string | null;
  /** Which side breaks per the match_games row. Used to identify scheduled-breaker. */
  homeAction: 'breaks' | 'racks';
}

interface ScoringEventRow {
  event_name: string;
  attributed_player_id: string | null;
}

/**
 * Build the array of `{event_name, attributed_player_id}` rows for the
 * score_game_with_events rpc. Each entry corresponds to one game_events
 * row that the rpc will INSERT atomically with the match_games UPDATE.
 */
export function buildScoringEventsPayload(ctx: ScoringContext): ScoringEventRow[] {
  const events: ScoringEventRow[] = [];

  // Determine loser and breaker player ids for attribution.
  const loserPlayerId =
    ctx.winnerPlayerId === ctx.homePlayerId ? ctx.awayPlayerId : ctx.homePlayerId;

  const scheduledBreakerId =
    ctx.homeAction === 'breaks' ? ctx.homePlayerId : ctx.awayPlayerId;

  // actualBreaker = scheduledBreaker XOR breakFouled.
  // If break was fouled, the OTHER player is the actual breaker.
  const actualBreakerId = ctx.breakFouled
    ? (scheduledBreakerId === ctx.homePlayerId ? ctx.awayPlayerId : ctx.homePlayerId)
    : scheduledBreakerId;
  const actualNonBreakerId =
    actualBreakerId === ctx.homePlayerId ? ctx.awayPlayerId : ctx.homePlayerId;

  const resolveAttribution = (attributedTo: AttributedTo): string | null => {
    switch (attributedTo) {
      case 'winner':
        return ctx.winnerPlayerId;
      case 'loser':
        return loserPlayerId;
      case 'breaker':
        return actualBreakerId;
      case 'non-breaker':
        return actualNonBreakerId;
      case 'scheduled-breaker':
        return scheduledBreakerId;
    }
  };

  // Map modal state to registry event names. Each truthy bool produces one row.
  const truthyEvents: Array<{ name: string; truthy: boolean }> = [
    { name: 'break_and_run', truthy: ctx.breakAndRun },
    { name: 'golden_break', truthy: ctx.goldenBreak },
    { name: 'runout', truthy: ctx.runout },
    { name: 'win_by_forfeit', truthy: ctx.winByForfeit },
    { name: 'break_fouled', truthy: ctx.breakFouled },
  ];

  for (const { name, truthy } of truthyEvents) {
    if (!truthy) continue;
    const definition = getGameEvent(name);
    if (!definition) continue; // registry not populated; defensive
    events.push({
      event_name: name,
      attributed_player_id: resolveAttribution(definition.attributedTo),
    });
  }

  return events;
}
