/**
 * @fileoverview Unit tests for ReadOnlyBanner.
 *
 * Covers both reason values render distinct copy + the data-reason
 * attribute is exposed for downstream wiring tests.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';

import { ReadOnlyBanner } from '../ReadOnlyBanner';

describe('ReadOnlyBanner', () => {
  it('renders the past-member copy when reason is past-member', () => {
    renderWithProviders(<ReadOnlyBanner reason="past-member" />);

    const banner = screen.getByTestId('read-only-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.getAttribute('data-reason')).toBe('past-member');
    expect(screen.getByText(/past member/i)).toBeInTheDocument();
    expect(screen.getByText(/can read history but can/i)).toBeInTheDocument();
  });

  it('renders the announcement-non-staff copy when reason is announcement-non-staff', () => {
    renderWithProviders(<ReadOnlyBanner reason="announcement-non-staff" />);

    const banner = screen.getByTestId('read-only-banner');
    expect(banner.getAttribute('data-reason')).toBe('announcement-non-staff');
    expect(screen.getByText(/announcements channel/i)).toBeInTheDocument();
    expect(screen.getByText(/only league staff can post here/i)).toBeInTheDocument();
  });
});
