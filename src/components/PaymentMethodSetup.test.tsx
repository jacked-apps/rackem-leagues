// @vitest-environment jsdom
/**
 * @fileoverview Tests for the reusable PaymentMethodSetup panel — the no-charge
 * reassurance (with a caller-supplied charge timing) + the verify button.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentMethodSetup } from './PaymentMethodSetup';

describe('PaymentMethodSetup', () => {
  it('is domain-neutral by default (no tournament/feature language)', () => {
    render(<PaymentMethodSetup onVerified={vi.fn()} />);
    // Generic reassurance always present…
    expect(screen.getByText(/charging your card now/i)).toBeTruthy();
    // …and no baked-in context leaks (those come from the caller's chargeTiming).
    expect(screen.queryByText(/premium features/i)).toBeNull();
    expect(screen.queryByText(/tournament/i)).toBeNull();
  });

  it('appends the caller-supplied charge timing when provided', () => {
    render(
      <PaymentMethodSetup
        onVerified={vi.fn()}
        chargeTiming="You're charged only at checkout, when you start the tournament."
      />
    );
    expect(screen.getByText(/charged only at checkout/i)).toBeTruthy();
  });

  it('uses the given verify button text', () => {
    render(<PaymentMethodSetup onVerified={vi.fn()} verifyButtonText="Verify card" />);
    expect(screen.getByRole('button', { name: /verify card/i })).toBeTruthy();
  });

  it('offers an optional card-name field (for keeping >1 card later)', () => {
    render(<PaymentMethodSetup onVerified={vi.fn()} />);
    expect(screen.getByLabelText(/card name \(optional\)/i)).toBeTruthy();
  });

  it('explains card safety in plain language via an info button', async () => {
    const user = userEvent.setup();
    render(<PaymentMethodSetup onVerified={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '?' }));
    expect(screen.getByText(/never saved on our site/i)).toBeTruthy();
  });
});
