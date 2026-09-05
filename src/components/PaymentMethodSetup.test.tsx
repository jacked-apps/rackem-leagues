// @vitest-environment jsdom
/**
 * @fileoverview Tests for the reusable PaymentMethodSetup panel — the no-charge
 * reassurance (with a caller-supplied charge timing) + the verify button.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentMethodSetup } from './PaymentMethodSetup';

describe('PaymentMethodSetup', () => {
  it('renders the no-charge reassurance with the caller-supplied charge timing', () => {
    render(
      <PaymentMethodSetup
        onVerified={vi.fn()}
        chargeTiming="charged only at checkout, when you start the tournament"
      />
    );
    expect(screen.getByText(/not/i)).toBeTruthy();
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
});
