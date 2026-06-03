/**
 * @fileoverview Handicap Systems Module — strength-encoding variants.
 *
 * Per the locked Handicap Systems blueprint
 * (`docs/league-system/modules/handicap-systems/README.md`), this Module wraps
 * the rating encoding (Points / Percentage / FargoRate / Skill Level) — the
 * thing that produces a single numeric value per player representing strength.
 * Each variant defines its own value range, validation rules, display format,
 * and (where applicable) history-based computation.
 *
 * The Module is selection-pattern — exactly one variant is active per league.
 * The current league's variant is determined by the `handicap_type` preference
 * (`'points' | 'percentage' | 'fargo' | 'skill_level'`).
 *
 * **Phase A scope:** create the interface here + the 4 variant implementations
 * in sibling files. Phase B wires `handicapSystem: HandicapSystem` into
 * SystemModule alongside the existing `rating` capability. Phase C swaps
 * consumers from `systemModule.rating.X` to `systemModule.handicapSystem.X`.
 * Phase D removes the legacy `rating` field.
 *
 * @see docs/league-system/modules/handicap-systems/README.md — the locked blueprint
 */

import type { PlayerHistoryContext, RatingValidationResult, RatingValue } from '../types';
import type { HandicapEntryModule } from './handicapEntry';

/**
 * Handicap encoding type — the discriminator that selects which variant a league uses.
 *
 * - `'points'` — integer ±2 (BCA 3v3 today)
 * - `'percentage'` — 0–100 (BCA 5v5 today)
 * - `'fargo'` — integer 100–850 (FargoRate 10-Point 5-Man today)
 * - `'skill_level'` — reserved; APA Skill Level 1–9; not yet implemented
 */
export type HandicapType = 'points' | 'percentage' | 'fargo' | 'skill_level';

/**
 * The Handicap System Module — strength-encoding capability for a single variant.
 *
 * A Handicap System has:
 * - A discriminator (`kind`) identifying which encoding this is
 * - A flag (`requiresManualEntry`) — true for externally-sourced encodings (FargoRate),
 *   false for internally-computed ones (Points, Percentage)
 * - A `displayFormat` function that turns a numeric rating into its display string
 *   (e.g., `+2` for Points, `85%` for Percentage, `575` for FargoRate)
 * - A `validate` function that parses unknown input (form fields, DB values) into a
 *   typed RatingValue or returns a human-readable error message
 * - An optional `computeFromHistory` function — only for internally-computed encodings;
 *   takes recent game history and returns a derived RatingValue (or null if insufficient
 *   data). FargoRate (manual-entry only) leaves this undefined.
 */
export interface HandicapSystem {
  /** Discriminator: which encoding variant this is. */
  readonly kind: HandicapType;

  /**
   * True for externally-sourced encodings (operator manually enters the rating at
   * lineup-lock time, e.g., from a FargoRate report). False for internally-computed
   * encodings (the app derives the rating from match history).
   */
  readonly requiresManualEntry: boolean;

  /**
   * Compute a rating from a player's recent game history. Defined for
   * internally-computed encodings (Points, Percentage); undefined for
   * externally-sourced ones (FargoRate, Skill Level reserved).
   *
   * Returns null when the player has insufficient history for the variant's
   * formula (e.g., not enough weeks played).
   */
  computeFromHistory?: (ctx: PlayerHistoryContext) => RatingValue | null;

  /**
   * Format a numeric rating for display in UI / reports.
   *
   * @example
   *   Points: `+2`, `-1`, `0`
   *   Percentage: `85%`, `30%`
   *   FargoRate: `575`, `425`
   */
  displayFormat: (value: RatingValue) => string;

  /**
   * Parse unknown input (string/number/null from a form field or DB value) into a
   * validated RatingValue. UI uses the error message when ok is false.
   */
  validate: (value: unknown) => RatingValidationResult;

  /**
   * UI-side dials for the lineup-page handicap-entry surface. Replaces the
   * lineup-side peeks at `handicap_type` per the UI modularity audit
   * (`docs/brainstorms/2026-06-03-ui-modularity-audit-requirements.md`).
   *
   * Per Ed's reframing: Fargo today = manual-entry module with dials set to
   * {min:100, max:1000, integer, source:'manual'}. When the FargoRate API
   * access lands, source flips to 'api' and an adapter wires in — same
   * module, different dials. The same shape is also the fallback for LOs
   * with unrecognized systems (letter-grade scales, custom enums).
   *
   * @see ./handicapEntry.ts — the HandicapEntryModule interface
   */
  readonly handicapEntry: HandicapEntryModule;
}

// Re-export the entry module type for convenience so consumers can do
// `import type { HandicapSystem, HandicapEntryModule } from '...'`.
export type { HandicapEntryModule } from './handicapEntry';
