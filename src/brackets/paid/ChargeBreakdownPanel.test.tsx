/**
 * @fileoverview Tests for ChargeBreakdownPanel — what the organizer is paying for.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { ChargeBreakdownPanel } from './ChargeBreakdownPanel';
import { PREMIUM_FEATURES } from './premiumFeatures';

describe('ChargeBreakdownPanel', () => {
  it('summarises the charge without being opened', () => {
    renderWithProviders(
      <ChargeBreakdownPanel featureKeys={['real_players', 'payment_tracker']} />
    );
    expect(screen.getByText(/2 features · \$2\.00/)).toBeTruthy();
  });

  it('itemises the features when opened', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ChargeBreakdownPanel featureKeys={['real_players', 'payment_tracker']} />
    );

    await user.click(screen.getByRole('button', { name: /2 features/ }));

    expect(await screen.findByText('Real players & sign-up')).toBeTruthy();
    expect(screen.getByText('Entry-fee tracker')).toBeTruthy();
    expect(screen.getByText('Charged at start')).toBeTruthy();
  });

  it('shows the cap as its own line so the items add up to the total', async () => {
    const user = userEvent.setup();
    // Everything bought: the items come to more than the capped price, and a
    // list that doesn't reconcile reads like a bug.
    renderWithProviders(
      <ChargeBreakdownPanel featureKeys={PREMIUM_FEATURES.map((f) => f.key)} />
    );

    await user.click(screen.getByRole('button', { name: /features/ }));

    expect(await screen.findByText(/everything-included discount/i)).toBeTruthy();
    expect(screen.getByText(/capped at \$5\.00/)).toBeTruthy();
  });

  it('says nothing about a discount that did not happen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChargeBreakdownPanel featureKeys={['real_players']} />);

    await user.click(screen.getByRole('button', { name: /1 feature/ }));
    expect(screen.queryByText(/discount/i)).toBeNull();
  });

  it('renders nothing for a tournament that bought nothing', () => {
    const { container } = renderWithProviders(<ChargeBreakdownPanel featureKeys={[]} />);
    expect(container.textContent).toBe('');
  });
});
