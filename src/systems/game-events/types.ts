/**
 * @fileoverview Type definitions for the game-events registry.
 *
 * Game events are per-game stat-attribution facts (e.g., a Break and Run
 * attributed to the winner, an Early 8 attributed to the loser). They live
 * in a TypeScript registry so adding a new event is a one-line code change
 * — no schema migration, no modal edit, no consumer change.
 *
 * Each event declares: who the stat is attributed to, which game types it
 * applies to, role gating (e.g., Break and Run only when winner = breaker),
 * mutual exclusion (B&R and Golden Break can't both be true), and a
 * default-enabled state per game type.
 *
 * @see src/systems/game-events/index.ts (registry runtime)
 * @see docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md (Unit 1)
 */

import type { GameType } from '@/types/league';

// ============================================================================
// Attribution
// ============================================================================

/**
 * Who the stat row gets attributed to when an event fires.
 *
 * `breaker` and `scheduled-breaker` are deliberately distinct: when a player
 * commits a break-foul, the post-flip actual breaker is the OTHER player,
 * but the foul is attributed to the player who was scheduled to break (the
 * offender). That distinction matters for stat correctness.
 */
export type AttributedTo =
  | 'winner'
  | 'loser'
  | 'breaker'
  | 'non-breaker'
  | 'scheduled-breaker';

// ============================================================================
// Definition shape
// ============================================================================

/**
 * Declarative definition of a trackable per-game event. The registry holds
 * one of these per supported event; the modal, mutation, and stats queries
 * all read from this shape rather than hardcoding event names.
 */
export interface GameEventDefinition {
  /** Stable snake_case identifier. Matches `game_events.event_name` column values. */
  name: string;

  /** Display label in the modal and stats UI. */
  label: string;

  /** Optional short form for compact UI surfaces (badges, stat tiles). */
  abbreviation?: string;

  /** Game types this event applies to. Modal hides events whose gameTypes don't include the active match's game_type. */
  gameTypes: ReadonlyArray<GameType>;

  /**
   * Optional role gate. When set, the event's checkbox only renders when the
   * winner's role matches the post-break-fault flip. Examples:
   *   - 'breaker': Break and Run, Golden Break — only when winner = breaker
   *   - 'non-breaker': Runout — only when winner = non-breaker
   * Absent means no role gating (e.g., Win by Forfeit, Early 8).
   */
  winnerRequired?: 'breaker' | 'non-breaker';

  /** Who the stat row attributes to when this event fires. */
  attributedTo: AttributedTo;

  /**
   * Other event names this event is mutually exclusive with. When this event
   * is checked, peers in this list are auto-unchecked (with aria-live
   * announcement). Symmetric — declare on both sides.
   */
  mutuallyExclusiveWith?: ReadonlyArray<string>;

  /**
   * Default rendering state per game type, used as the floor when no LO
   * cascade override is present. Phase 1 ships defaults that match today's
   * modal exactly. Phase 2 layers `enabled_events` overrides on top.
   */
  enabledByDefault: Readonly<Record<GameType, boolean>>;

  /**
   * Set to true on events that semantically void the game (e.g., Win by
   * Forfeit). When checked, the modal hides ALL role-conditional events
   * (B&R, Runout, Golden Break) — a forfeited game has no actual breaker
   * so role-gating is meaningless.
   */
  suppressesRoleConditionalEvents?: boolean;
}
