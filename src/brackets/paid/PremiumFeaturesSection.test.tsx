// @vitest-environment jsdom
/**
 * @fileoverview Tests for PremiumFeaturesSection — the create-page checklist.
 * Turning a feature ON opens the verify popup (does not enable immediately);
 * turning one OFF is immediate; the total shows for selected features.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PremiumFeaturesSection } from './PremiumFeaturesSection';
import { PREMIUM_FEATURES } from './premiumFeatures';

function setup(overrides: Partial<Parameters<typeof PremiumFeaturesSection>[0]> = {}) {
  const onEnable = vi.fn();
  const onDisable = vi.fn();
  render(
    <PremiumFeaturesSection
      selectedKeys={[]}
      cardOnFile={null}
      saving={false}
      onEnable={onEnable}
      onDisable={onDisable}
      {...overrides}
    />
  );
  return { onEnable, onDisable };
}

describe('PremiumFeaturesSection', () => {
  it('lists every premium feature', () => {
    setup();
    for (const f of PREMIUM_FEATURES) {
      expect(screen.getByText(f.label)).toBeTruthy();
    }
  });

  it('with NO card on file, turning a feature ON opens the generic payment-method popup', async () => {
    const user = userEvent.setup();
    const { onEnable } = setup({ cardOnFile: null });
    const first = PREMIUM_FEATURES[0];

    await user.click(screen.getByLabelText(first.label));

    // Not enabled yet — the card must be set up first.
    expect(onEnable).not.toHaveBeenCalled();
    // The GENERIC setup popup appears (no feature name), with the no-charge promise.
    expect(screen.getByText(/set up a payment method/i)).toBeTruthy();
    expect(screen.getByText(/charged only at checkout/i)).toBeTruthy();
  });

  it('with a card on file, turning a feature ON enables it immediately (no popup)', async () => {
    const user = userEvent.setup();
    const { onEnable } = setup({
      cardOnFile: { paymentMethodId: 'pm1', last4: '4242', brand: 'visa' },
    });
    const first = PREMIUM_FEATURES[0];

    await user.click(screen.getByLabelText(first.label));

    expect(onEnable).toHaveBeenCalledTimes(1);
    expect(onEnable.mock.calls[0][0].key).toBe(first.key);
    expect(onEnable.mock.calls[0][1]).toBeUndefined(); // no card data — reused
    expect(screen.queryByText(/set up a payment method/i)).toBeNull();
  });

  it('turning a checked feature OFF is immediate (no popup)', async () => {
    const user = userEvent.setup();
    const first = PREMIUM_FEATURES[0];
    const { onDisable } = setup({ selectedKeys: [first.key] });

    await user.click(screen.getByLabelText(first.label));
    expect(onDisable).toHaveBeenCalledWith(first.key);
  });

  it('shows a preview total for selected features', () => {
    setup({ selectedKeys: [PREMIUM_FEATURES[0].key] });
    expect(screen.getByText(/Due at checkout/i)).toBeTruthy();
  });

  it('shows a "payment method established" indicator when a card is on file', () => {
    setup({ cardOnFile: { paymentMethodId: 'pm1', last4: '4242', brand: 'visa' } });
    expect(screen.getByText(/payment method established/i)).toBeTruthy();
  });
});
