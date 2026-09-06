/**
 * @fileoverview Types for the tournament bracket engine (Free Tier v1).
 *
 * These describe the pure, in-memory output of the generation engine
 * (src/utils/bracket/*) BEFORE it is persisted. Matches reference participants
 * by SEED number (1..N) and reference each other by a local string `key`; the
 * data layer (Unit 3) maps seeds → participant uuids and keys → match uuids on
 * insert. Keeping the engine free of uuids/DB concerns makes it pure and
 * deterministic (seeded generation is identical across runs).
 */

/** Elimination format. Mirrors the `brackets.format` CHECK values. */
export type BracketFormat = 'single_elimination' | 'double_elimination';

/** How the initial seed order is derived. Mirrors `brackets.seeding_mode`. */
export type SeedingMode = 'seeded' | 'random';

/** Which tree a match belongs to. Mirrors `bracket_matches.side`. */
export type MatchSide = 'winners' | 'losers' | 'grand_final';

/** Match lifecycle. Mirrors `bracket_matches.status`. */
export type MatchStatus = 'pending' | 'ready' | 'complete';

/** A slot within a match. Mirrors `bracket_matches.*_slot`. */
export type MatchSlot = 'home' | 'away';

/**
 * One generated match node. `homeSeed`/`awaySeed`/`winnerSeed` are seed numbers
 * (1..N) or null when the slot is not yet filled. Pointer fields reference
 * another match's `key`.
 */
export interface GeneratedMatch {
  /** Unique within a single generation, e.g. "W1-0", "L2-1", "GF", "GFR". */
  key: string;
  round: number;
  side: MatchSide;
  /** Position within the round (0-based). */
  slot: number;
  homeSeed: number | null;
  awaySeed: number | null;
  winnerSeed: number | null;
  status: MatchStatus;
  /** Where the winner advances (null for a terminal match). */
  nextMatchKey: string | null;
  nextMatchSlot: MatchSlot | null;
  /** Where the loser drops (double-elim only; null in single-elim). */
  loserNextMatchKey: string | null;
  loserNextMatchSlot: MatchSlot | null;
  /** The conditional grand-final decider node (double-elim, reset enabled). */
  isResetMatch: boolean;
}

/** Options for {@link generateBracket}. */
export interface GenerateBracketOptions {
  format: BracketFormat;
  /** Double-elim only: append a conditional grand-final reset match. */
  grandFinalReset?: boolean;
}

/**
 * The engine's output: the ordered list of match nodes making up the tree.
 * Participant order is the caller's already-resolved seed order (index 0 =
 * seed 1). The engine does not shuffle — seeding-mode resolution happens before
 * generation so a persisted bracket is never re-derived.
 */
export type GeneratedBracket = GeneratedMatch[];
