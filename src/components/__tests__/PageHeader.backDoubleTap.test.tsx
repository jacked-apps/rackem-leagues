/**
 * @fileoverview The header back arrow ignores a double click across pages.
 *
 * Ed, 2026-11-10: a double click on a league page's back arrow went back to
 * the LO dashboard AND then on to My Teams, because the dashboard's back arrow
 * sits in the same spot. The second click lands on a different page's arrow,
 * so only a lock shared by every back arrow can catch it.
 */

import { describe, it, expect, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { pauseBetweenTaps, renderWithProviders, screen, fireEvent } from '@/test/utils';

vi.mock('@/api/hooks/useUserProfile', () => ({ useUserProfile: () => ({ member: null }) }));
vi.mock('@/api/hooks/useOrganizations', () => ({ useOrganization: () => ({ data: null }) }));
vi.mock('@/components/layout/AppDrawer', () => ({ AppDrawer: () => null }));

import { PageHeader } from '../PageHeader';

/** League page → dashboard → My Teams, each with a back arrow in the same spot. */
function renderPages() {
  renderWithProviders(
    <Routes>
      <Route path="/league" element={<PageHeader title="League" backTo="/dashboard" backLabel="Dashboard" />} />
      <Route path="/dashboard" element={<PageHeader title="Dashboard" backTo="/my-teams" backLabel="My Teams" />} />
      <Route path="/my-teams" element={<PageHeader title="My Teams" />} />
    </Routes>,
    { initialRoute: '/league' }
  );
}

describe('PageHeader back arrow double-tap lock', () => {
  it('a double click goes back one page, not two', () => {
    renderPages();
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    fireEvent.click(screen.getByRole('link', { name: 'My Teams' }));

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('two separate clicks still go back two pages', async () => {
    renderPages();
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    await pauseBetweenTaps();
    fireEvent.click(screen.getByRole('link', { name: 'My Teams' }));

    expect(screen.getByRole('heading', { name: 'My Teams' })).toBeInTheDocument();
  });
});
