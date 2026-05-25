/**
 * @fileoverview Pairings Generator Module — public + internal types.
 *
 * Per the locked Pairings Generator blueprint
 * (docs/league-system/modules/pairings-generator.md), this Module takes the
 * two locked lineups plus the team-geometry rules and produces the ordered
 * list of games for the night — each game naming which home player faces
 * which away player, with break/rack assignment.
 *
 * This file holds the contract surface:
 *   - `PairingsInput`  — what the Module accepts.
 *   - `GameSlot`       — what the Module returns (one record per game).
 *
 * Plus the internal stage record types (PairRecord, OrderedPairRecord)
 * used to flow data between the three composed stages (pair generation →
 * game ordering → break/rack assignment). The internal `roundIndex` field
 * is carried Stage 2 → Stage 3 and stripped by the composer before
 * returning the outer GameSlot list.
 *
 * **Output shape is variant-agnostic.** GameSlot's flat-list shape is
 * intentionally generic — each record represents ONE game (one rack to be
 * played), regardless of how the variant arrived at that list. v1's
 * round-robin variant produces one record per unique (homePos, awayPos)
 * pair (twice for DRR). Future variants (race-mode, Swiss, brackets,
 * partial RR, etc.) would produce different lists using the SAME record
 * shape — race-mode might emit N consecutive games between the same two
 * players; Swiss might emit a standings-driven subset. The contract does
 * NOT bake in "one game per unique pairing" or any other
 * round-robin-specific assumption.
 *
 * @see docs/league-system/modules/pairings-generator.md — the locked blueprint
 * @see ./index.ts — the factory + composer
 */

import type { GameGeneration } from '@/systems/team-geometry/types';

/**
 * Inputs the Pairings Generator Module accepts.
 *
 * `homeLineup` and `awayLineup` are each an ordered array of `player_id`
 * (length must equal `lineupSize`). Element index 0 = position 1,
 * element index 1 = position 2, etc. The Module trusts the caller
 * assembled these correctly; element-content validation is the caller's
 * responsibility, not the Module's.
 *
 * The Module's precondition enforces:
 *   - `lineupSize` is a positive integer
 *   - `gameGeneration` is one of the two `GameGeneration` enum values
 *   - `homeLineup.length === lineupSize`
 *   - `awayLineup.length === lineupSize`
 *
 * Anything else (null/undefined entries inside the arrays, duplicate
 * player_ids, etc.) is the caller's concern.
 */
export interface PairingsInput {
  /** Players per team for tonight's match. Positive integer. */
  readonly lineupSize: number;

  /** Single or double round-robin (delegated from Team Geometry). */
  readonly gameGeneration: GameGeneration;

  /**
   * Home team's ordered lineup. `homeLineup[i]` is the `player_id` for
   * position `i + 1`. Length must equal `lineupSize`.
   */
  readonly homeLineup: readonly string[];

  /**
   * Away team's ordered lineup. `awayLineup[i]` is the `player_id` for
   * position `i + 1`. Length must equal `lineupSize`.
   */
  readonly awayLineup: readonly string[];
}

/**
 * One game on tonight's slot list.
 *
 * Each record represents ONE game (one rack to be played) and carries
 * everything a downstream consumer needs to render and score it:
 *   - which players (`homePlayerId` / `awayPlayerId`),
 *   - which lineup positions (`homePosition` / `awayPosition`),
 *   - which game number in the sequence (`gameNumber`, 1-indexed),
 *   - and who breaks vs racks (`homeAction` / `awayAction`).
 *
 * Field shape mirrors the existing `match_games` row columns (the caller
 * maps these camelCase fields onto the snake_case DB columns at insert
 * time).
 *
 * The record is intentionally generic — see the @fileoverview note on
 * output-shape variant-agnosticism.
 */
export interface GameSlot {
  /** 1-indexed sequential game number. Contiguous, no gaps. */
  readonly gameNumber: number;

  /** Home player for this game (resolved from `homeLineup` by position). */
  readonly homePlayerId: string;

  /** Away player for this game (resolved from `awayLineup` by position). */
  readonly awayPlayerId: string;

  /** Home player's lineup position (1-indexed). */
  readonly homePosition: number;

  /** Away player's lineup position (1-indexed). */
  readonly awayPosition: number;

  /** What the home side does in this game. */
  readonly homeAction: 'breaks' | 'racks';

  /** What the away side does in this game. Always the opposite of `homeAction`. */
  readonly awayAction: 'breaks' | 'racks';
}

/**
 * **Internal** — Stage 1 (pair generation) output record.
 *
 * Carries the pair + position resolution + the round this pair belongs to
 * (`roundIndex`, 0..totalRounds-1). Round identity is what Stage 3 reads
 * to apply its per-round alternation rule — it is the structural anchor
 * that decouples Stage 2 (ordering) from Stage 3 (break/rack assignment).
 *
 * Not exported from `index.ts`; lives inside the Module.
 */
export interface PairRecord {
  readonly homePlayerId: string;
  readonly awayPlayerId: string;
  readonly homePosition: number;
  readonly awayPosition: number;
  /** Round this pair was generated in. 0..(totalRounds - 1). */
  readonly roundIndex: number;
}

/**
 * **Internal** — Stage 2 (game ordering) output record.
 *
 * `PairRecord` plus `gameNumber` (1-indexed, contiguous). Stage 3 reads
 * `roundIndex` from this record to assign break/rack; the composer strips
 * `roundIndex` from the outer `GameSlot` output.
 *
 * Not exported from `index.ts`; lives inside the Module.
 */
export interface OrderedPairRecord extends PairRecord {
  /** 1-indexed sequential game number. */
  readonly gameNumber: number;
}

// Re-export GameGeneration for callers that want it from `@/systems/pairings`.
export type { GameGeneration };
