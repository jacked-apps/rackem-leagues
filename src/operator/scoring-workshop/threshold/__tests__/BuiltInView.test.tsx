/**
 * @fileoverview Tests for the built-in threshold view — shows the real formula
 * (with locked symbols) so an LO can see the calculation.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BuiltInView } from '../BuiltInView';
import { builtinFormulaLines } from '../builtinFormula';

describe('builtinFormulaLines', () => {
  it('returns the Fargo formula including a locked ^ (power) symbol', () => {
    const lines = builtinFormulaLines('fargo_start_points_for_side');
    expect(lines).not.toBeNull();
    const allTokens = lines!.flatMap((l) => l.tokens);
    expect(allTokens.some((t) => t.kind === 'locked' && t.text === '^')).toBe(true);
  });

  it('has a representation for every wired built-in formula op', () => {
    for (const op of [
      'fargo_start_points_for_side',
      'fargo_games_won',
      'games_needed_3v3_formula',
      'games_needed_5v5_formula',
      'arithmetic_round_product',
      'read_pref',
    ]) {
      expect(builtinFormulaLines(op)).not.toBeNull();
    }
  });

  it('returns null for a chart-style built-in (falls back to a blurb)', () => {
    expect(builtinFormulaLines('chart_lookup_3v3')).toBeNull();
  });
});

describe('BuiltInView', () => {
  it('renders the formula and the power symbol for a Fargo threshold', () => {
    render(
      <BuiltInView
        definition={{ operationKind: 'fargo_start_points_for_side', operationArgs: { side: 'home' } }}
      />,
    );
    expect(screen.getByText('The formula it uses')).toBeTruthy();
    expect(screen.getAllByText('^').length).toBeGreaterThan(0);
  });
});
