/**
 * @fileoverview Tests for LineupSwapWaitingBanner — the initiator-side
 * "waiting for the opponent to approve" banner (lineup-swap recalibration,
 * Unit 5).
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { LineupSwapWaitingBanner } from '../LineupSwapWaitingBanner';

describe('LineupSwapWaitingBanner', () => {
  it('renders nothing when show is false', () => {
    const { container } = renderWithProviders(
      <LineupSwapWaitingBanner
        show={false}
        position={3}
        newPlayerName="Jane Doe"
        opponentLabel="Sharks"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names the incoming player, position, and approving opponent when shown', () => {
    renderWithProviders(
      <LineupSwapWaitingBanner
        show
        position={3}
        newPlayerName="Jane Doe"
        opponentLabel="Sharks"
      />,
    );
    expect(screen.getByText(/Lineup change pending/i)).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Sharks')).toBeInTheDocument();
    expect(screen.getByText(/position 3/i)).toBeInTheDocument();
  });
});
