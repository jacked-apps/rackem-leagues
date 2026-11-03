/**
 * @fileoverview Tests for the who-breaks prompt — the three states of propose /
 * confirm, seen from the viewer's side.
 *
 * The engine decides what a tap means (propose, change, confirm); this prompt
 * decides which taps a player is OFFERED. The rule that matters: the player who
 * did not pick gets Confirm and nothing else — the app does not referee, so they
 * cannot overrule the pick from their phone. And every state is said in names
 * and words, because the product owner is colourblind and so are some players.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { FirstBreakerPrompt } from '../FirstBreakerPrompt';
import type { BreakerProposal, RaceSeat } from '../types';

const home: RaceSeat = { memberId: 'h', side: 'home', displayName: 'Ace', goal: 5 };
const away: RaceSeat = { memberId: 'a', side: 'away', displayName: 'Bee', goal: 5 };

/** Render the prompt as the HOME player, with a given proposal. */
function renderAsHome(proposal: BreakerProposal | null) {
  const onChoose = vi.fn();
  renderWithProviders(
    <FirstBreakerPrompt
      home={home}
      away={away}
      breakRule="winner_breaks"
      mySide="home"
      proposal={proposal}
      onChoose={onChoose}
    />
  );
  return onChoose;
}

describe('FirstBreakerPrompt', () => {
  it('offers both names when nobody has picked', async () => {
    const onChoose = renderAsHome(null);

    expect(screen.queryByText(/waiting for/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bee' }));
    expect(onChoose).toHaveBeenCalledWith('away');
  });

  it('shows my pick in words, waits for the other player, and lets me change it', async () => {
    const onChoose = renderAsHome({ side: 'away', bySide: 'home' });

    expect(screen.getByText('You picked Bee. Waiting for Bee to confirm.')).toBeInTheDocument();
    // The pick is named in the button's label, not only by its fill.
    const picked = screen.getByRole('button', { name: 'Bee (your pick)' });
    expect(picked).toHaveAttribute('aria-pressed', 'true');

    // Both buttons stay live, so a wrong tap can be changed before confirm.
    await userEvent.click(screen.getByRole('button', { name: 'Ace' }));
    expect(onChoose).toHaveBeenCalledWith('home');
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
  });

  it('gives the other player Confirm only — no way to pick a different side', async () => {
    const onChoose = renderAsHome({ side: 'away', bySide: 'away' });

    expect(screen.getByText('Bee picked Bee to break.')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Bee breaks' }));
    // Confirming is start_race with the SAME side the proposer named.
    expect(onChoose).toHaveBeenCalledWith('away');
  });

  it('disables every button while a tap is in flight', () => {
    renderWithProviders(
      <FirstBreakerPrompt
        home={home}
        away={away}
        breakRule="alternate"
        mySide="away"
        proposal={{ side: 'home', bySide: 'home' }}
        onChoose={vi.fn()}
        disabled
      />
    );
    expect(screen.getByRole('button', { name: 'Confirm Ace breaks' })).toBeDisabled();
  });
});
