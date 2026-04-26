/**
 * @fileoverview Shared types for the official rulebook reader (Branch 1).
 *
 * Produced by `scripts/clean-rulebook.ts` and consumed by every module under
 * `src/rules/`. The same shape also backs the future AI helper's retrieval
 * layer, so changes here ripple across features — keep it small and stable.
 */

/** A game section in the rulebook (8-Ball, 9-Ball, etc.). */
export type Game = {
  /** URL-safe slug used in /rules/:game/:ruleId. Example: "8-ball". */
  slug: string;
  /** Human-readable name rendered in the UI. Example: "8-Ball". */
  name: string;
  /** Count of rules under this game. Used by the TOC and diagnostics. */
  ruleCount: number;
};

/** One numbered rule from the rulebook. */
export type Rule = {
  /** Rule ID as it appears in the source PDF (e.g., "6-1"). Scoped by game. */
  id: string;
  /** Slug of the game this rule belongs to. Matches a Game.slug. */
  game: string;
  /** Heading text exactly as authored, with whitespace collapsed. */
  heading: string;
  /** Body paragraphs in source order. No markup; plain text only. */
  body: string[];
  /** Ordering index within the game section (stable, 0-based). */
  order: number;
  /** Page number in the source PDF where the rule starts (for QA). */
  sourcePage?: number;
};

/** Key for the global id map: "<game-slug>:<rule-id>". Example: "8-ball:6-1". */
export type RuleKey = `${string}:${string}`;

/**
 * Metadata + lookup index for the whole rulebook. Emitted as the default
 * export of `src/officalBCARulebook/cleaned/index.ts`.
 */
export type RulebookIndex = {
  /** Publishing organization (currently always "CSI"). */
  publisher: string;
  /** Effective edition date in ISO-8601 (e.g., "2025-08-12"). */
  edition: string;
  /** Public URL of the source PDF on the publisher's own site. */
  sourcePdfUrl: string;
  /** Slug of the game shown first on a cold /rules visit. */
  defaultGame: string;
  /** List of every game present, in display order. */
  games: Game[];
  /** Deep-link lookup: "<game>:<id>" → canonical rule reference. */
  idMap: Record<RuleKey, { game: string; ruleId: string }>;
};

/**
 * Fully merged rulebook assembled at runtime by `useRulebook`. Never written
 * to disk — built by combining the index with every per-game module.
 */
export type Rulebook = {
  index: RulebookIndex;
  /** Every rule in the rulebook, keyed by game slug. */
  rulesByGame: Record<string, Rule[]>;
};
