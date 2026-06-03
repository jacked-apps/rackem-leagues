/**
 * @fileoverview HandicapEntryModule — the UI-side dials for the
 * lineup page's handicap-entry surface.
 *
 * Per the UI modularity audit at
 * `docs/brainstorms/2026-06-03-ui-modularity-audit-requirements.md`,
 * the lineup page peeks at `handicap_type` to decide input widget
 * type, validation bounds, placeholder text, column header, etc.
 * This module collapses all those decisions into per-system config
 * the UI reads from.
 *
 * Per Ed's reframing: **Fargo today = manual-entry module with dials
 * set to Fargo.** When the FargoRate API access lands, `source` flips
 * to 'api' and an adapter wires in — same module, different dials.
 * The same shape also serves as the fallback for LOs with custom
 * systems (letter-grade scales, percentile scales, etc.).
 */

/**
 * Which kind of input widget renders for capturing this system's
 * handicap value on the lineup page.
 */
export type HandicapInputKind = 'select' | 'number' | 'text';

/**
 * Where the value comes from at lineup time.
 * - `'manual'` — captain (or LO) types it in. FargoRate today;
 *   any custom-system fallback.
 * - `'auto-from-history'` — derived from match history. BCA Points,
 *   BCA Percentage.
 * - `'api'` — fetched from an external service. FargoRate FUTURE
 *   (when API access lands).
 */
export type HandicapValueSource = 'manual' | 'auto-from-history' | 'api';

/**
 * Numeric range for a `'number'`-kind input.
 */
export interface HandicapNumericRange {
  readonly min: number;
  readonly max: number;
  /** Whether to constrain to integer values. */
  readonly integer: boolean;
}

/**
 * A single option for a `'select'`-kind input — typically used by
 * Points (`-2`, `-1`, `0`, `+1`, `+2`).
 */
export interface HandicapEnumOption {
  readonly value: number;
  /** Display label for the dropdown (e.g. `'+2'`). */
  readonly label: string;
}

/**
 * UI-side dials for the lineup-page handicap-entry surface.
 *
 * The lineup page reads these to choose a widget, set its bounds,
 * format the value for display, and render the column header. The
 * system-specific knowledge lives here; the page renders the same
 * generic JSX driven by these dials.
 */
export interface HandicapEntryModule {
  /** Widget kind for the per-player handicap input. */
  readonly inputKind: HandicapInputKind;

  /**
   * Numeric range — required when `inputKind === 'number'`, null for
   * select/text widgets.
   */
  readonly range: HandicapNumericRange | null;

  /**
   * Enumerated options — required when `inputKind === 'select'`, null
   * for number/text widgets.
   */
  readonly enumValues: ReadonlyArray<HandicapEnumOption> | null;

  /**
   * Text shown in the empty input — e.g. `'%'` for Percentage,
   * `'—'` for FargoRate.
   */
  readonly placeholderText: string;

  /**
   * Header text for the handicap column on the lineup page —
   * e.g. `'Fargo'`, `'H/C'`, `'Skill'`.
   */
  readonly columnHeader: string;

  /**
   * Layout hint for column width. Fargo (3-digit values) wants 'wide';
   * Points (±2) wants 'narrow'.
   */
  readonly columnWidth: 'narrow' | 'wide';

  /**
   * How to render a numeric value for display. Different from
   * `HandicapSystem.displayFormat` only in that this one accepts null
   * (for empty inputs) and returns a placeholder string.
   */
  readonly displayFormat: (value: number | null) => string;

  /**
   * Where the value comes from at lineup time. The lineup UI uses
   * this to decide whether to show a manual-entry widget vs. just
   * reading a derived value from the player record. Future API-backed
   * Fargo flips this to 'api' + sets the apiAdapter below.
   */
  readonly source: HandicapValueSource;

  /**
   * Future hook: when `source === 'api'`, this adapter knows how to
   * fetch the rating from the external service. Today undefined for
   * every system (manual + auto-from-history don't need it).
   */
  readonly apiAdapter?: HandicapApiAdapter;
}

/**
 * Future-hook interface for systems whose ratings come from an
 * external API (FargoRate when access lands). Today no system
 * implements this — included so the contract is visible.
 */
export interface HandicapApiAdapter {
  /** Human-readable name of the external service, for error messages. */
  readonly serviceName: string;
  /**
   * Fetch a rating for a player by some external identifier. Returns
   * null if not found / not available. Never throws — failures
   * surface as null per the "nothing breaks scoring" principle.
   */
  readonly fetchRating: (externalId: string) => Promise<number | null>;
}
