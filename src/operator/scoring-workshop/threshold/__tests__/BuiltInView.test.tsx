/**
 * @fileoverview Tests for the built-in threshold view — shows the actual source
 * code of the calculation, read-only.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BuiltInView } from '../BuiltInView';
import { builtinCode } from '../builtinCode';

describe('builtinCode', () => {
  it('returns the real tiny-program source for the 3v3 points formula (its if/then math)', () => {
    const code = builtinCode('games_needed_3v3_formula');
    expect(code).not.toBeNull();
    // The actual midpoint program — contains its real variable + branch.
    expect(code).toContain('midpoint');
    expect(code).toContain('Number.isInteger');
  });

  it('returns the operation compute source for the simpler built-ins', () => {
    expect(builtinCode('read_pref')).toContain('=>');
    expect(builtinCode('arithmetic_round_product')).toContain('=>');
  });
});

describe('BuiltInView', () => {
  it('renders the real code, read-only, for a Fargo threshold', () => {
    render(
      <BuiltInView
        definition={{ operationKind: 'fargo_games_won', operationArgs: { output_field: 'games_to_win' } }}
      />,
    );
    expect(screen.getByText('The code it runs')).toBeTruthy();
    // The Fargo tiny program references the rating arrays.
    expect(screen.getByText(/homeRatings/)).toBeTruthy();
  });
});
