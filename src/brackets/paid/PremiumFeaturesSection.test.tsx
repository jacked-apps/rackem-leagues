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

  it('turning a feature ON opens the verify popup instead of enabling immediately', async () => {
    const user = userEvent.setup();
    const { onEnable } = setup();
    const first = PREMIUM_FEATURES[0];

    await user.click(screen.getByLabelText(first.label));

    // Not enabled yet — the popup must be confirmed first.
    expect(onEnable).not.toHaveBeenCalled();
    // The popup shows the feature blurb (appears in the dialog portal).
    const blurbs = screen.getAllByText(first.blurb);
    expect(blurbs.length).toBeGreaterThan(0);
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
    expect(screen.getByText(/Due when you start/i)).toBeTruthy();
  });
});
