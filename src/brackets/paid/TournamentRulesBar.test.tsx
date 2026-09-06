/**
 * @fileoverview Tests for TournamentRulesBar — the rules line under the name.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { TournamentRulesBar } from './TournamentRulesBar';

describe('TournamentRulesBar', () => {
  it('shows the format, the losses that knock you out, and the game', () => {
    renderWithProviders(
      <TournamentRulesBar
        bracket={{
          format: 'double_elimination',
          grand_final_reset: true,
          game_type: 'nine_ball',
        }}
      />
    );

    expect(screen.getByText('Double elimination')).toBeTruthy();
    expect(screen.getByText('Two losses')).toBeTruthy();
    expect(screen.getByText('9-Ball')).toBeTruthy();
    expect(screen.getByText(/beaten twice/i)).toBeTruthy();
  });

  it('drops the grand-final rule where it cannot apply', () => {
    renderWithProviders(
      <TournamentRulesBar
        bracket={{
          format: 'single_elimination',
          grand_final_reset: true,
          game_type: null,
        }}
      />
    );

    expect(screen.getByText('One loss')).toBeTruthy();
    expect(screen.queryByText(/beaten twice/i)).toBeNull();
  });
});
