/**
 * @fileoverview Read-only formula representations of the built-in threshold
 * calculations, so an LO can SEE how each one works in the formula-editor view.
 *
 * These mirror the real implementations (see the linked source for each), shown
 * with locked symbols (`^`, `floor`, `ceil`, `|…|`, `Σ`) we haven't opened up
 * for editing yet. Display-only — the actual math still runs in the operation's
 * code; this is the transparency layer ("let me see what I'm looking at").
 *
 * @see src/utils/handicap/fargoGamesWonThresholds.ts (T = 2^(rating/100))
 * @see src/systems/threshold-charts/games-needed-3v3-formula.ts
 * @see src/systems/points-system/operations/arithmetic-round-product.ts
 */

import type { DisplayToken, FormulaLine } from './ReadOnlyFormula';

const v = (name: string): DisplayToken => ({ kind: 'var', name });
const n = (value: number): DisplayToken => ({ kind: 'const', value });
const o = (op: '+' | '-' | '*' | '/'): DisplayToken => ({ kind: 'op', op });
const lp: DisplayToken = { kind: 'lparen' };
const rp: DisplayToken = { kind: 'rparen' };
const lk = (text: string): DisplayToken => ({ kind: 'locked', text });

/** The shared FargoRate strength primitive both Fargo thresholds build on. */
const FARGO_STRENGTH: FormulaLine = {
  label: "Each player's strength (T) — from their Fargo rating",
  tokens: [n(2), lk('^'), lp, v('rating'), o('/'), n(100), rp],
};

const BUILT_IN_FORMULAS: Record<string, FormulaLine[]> = {
  fargo_start_points_for_side: [
    FARGO_STRENGTH,
    {
      label: 'Win chance vs. the opposing player',
      tokens: [v('my T'), o('/'), lp, v('my T'), o('+'), v('their T'), rp],
    },
    {
      label: 'Head start = the gap between the two teams’ expected points (floored)',
      tokens: [lk('floor'), lp, lk('|'), v('home expected points'), o('-'), v('away expected points'), lk('|'), rp],
    },
  ],
  fargo_games_won: [
    FARGO_STRENGTH,
    {
      label: 'Games to win (stronger side) = round up the expected wins',
      tokens: [lk('ceil'), lp, v('expected wins'), rp],
    },
  ],
  games_needed_3v3_formula: [
    {
      label: 'Stronger side — games to win, by the points handicap gap',
      tokens: [
        lk('ceil'), lp, lp, v('games'), o('+'), n(2), rp, o('/'), n(2), rp,
        o('+'),
        lk('floor'), lp, lk('|'), v('handicap gap'), lk('|'), o('/'), n(2), rp,
      ],
    },
  ],
  games_needed_5v5_formula: [
    {
      label: 'Base target',
      tokens: [lk('ceil'), lp, lp, v('games'), o('+'), n(1), rp, o('/'), n(2), rp],
    },
    {
      label: 'Adjusted by which percentage-gap bucket the handicap falls in',
      tokens: [lk('… + bucket adjustment( handicap gap )')],
    },
  ],
  arithmetic_round_product: [
    {
      label: 'Milestone = a percent of the win target, rounded',
      tokens: [lk('round'), lp, v('games to win'), o('*'), v('milestone percent'), rp],
    },
  ],
  read_pref: [
    {
      label: 'Reads a fixed number from your league settings',
      tokens: [v('games to win')],
    },
  ],
};

/** Returns the read-only formula lines for a built-in op, or null (use a blurb). */
export function builtinFormulaLines(operationKind: string): FormulaLine[] | null {
  return BUILT_IN_FORMULAS[operationKind] ?? null;
}
