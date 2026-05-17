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

  it('renders the announcement-non-staff fallback copy when contextName is absent', () => {
    renderWithProviders(<ReadOnlyBanner reason="announcement-non-staff" />);

    const banner = screen.getByTestId('read-only-banner');
    expect(banner.getAttribute('data-reason')).toBe('announcement-non-staff');
    expect(screen.getByText(/announcements channel/i)).toBeInTheDocument();
    expect(screen.getByText(/only league staff can post here/i)).toBeInTheDocument();
  });

  it('interpolates the org/league name into the announcement banner when contextName is passed (Unit 18)', () => {
    renderWithProviders(
      <ReadOnlyBanner reason="announcement-non-staff" contextName="Tester Org" />,
    );

    expect(screen.getByText(/only staff from tester org can post here/i)).toBeInTheDocument();
    // Generic fallback should NOT appear when contextName is provided.
    expect(screen.queryByText(/only league staff can post here/i)).not.toBeInTheDocument();
  });

  it('ignores contextName for past-member (copy stays generic)', () => {
    renderWithProviders(
      <ReadOnlyBanner reason="past-member" contextName="Tester Org" />,
    );

    expect(screen.queryByText(/tester org/i)).not.toBeInTheDocument();
    expect(screen.getByText(/can read history but can/i)).toBeInTheDocument();
  });
});
