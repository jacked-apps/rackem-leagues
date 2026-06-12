/**
 * @fileoverview Tests for the state-driven My Match bottom-nav tab (Unit 3).
 *
 * Drives `useMyMatchSurfaces` through its postures and asserts the tab's
 * rendering + tap behavior: actionable tiers render a Link to the match's
 * lineup page (with the live dot on Tier 1), while the non-actionable postures
 * render a non-navigating button — silent during hydration, dim + toast on
 * Tier 4 / error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/utils';

const { surfacesMock } = vi.hoisted(() => ({ surfacesMock: vi.fn() }));
vi.mock('@/api/hooks/useMyMatchSurfaces', () => ({
  useMyMatchSurfaces: (id: unknown) => surfacesMock(id),
}));

const { toastMock } = vi.hoisted(() => {
  const fn: any = vi.fn();
  fn.error = vi.fn();
  return { toastMock: fn };
});
vi.mock('sonner', () => ({ toast: toastMock }));

import { MyMatchTab } from './MyMatchTab';

/** Default surfaces shape (Tier 4); spread overrides per test. */
function surfaces(o: Record<string, unknown> = {}) {
  return {
    tier: 4,
    destinationMatchId: null,
    showLiveDot: false,
    drawerItems: [],
    isHydrating: false,
    isError: false,
    ...o,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  surfacesMock.mockReturnValue(surfaces());
});

describe('MyMatchTab — actionable tiers (Link)', () => {
  it('Tier 1: links to the live match lineup, shows the live dot, no toast', () => {
    surfacesMock.mockReturnValue(surfaces({ tier: 1, destinationMatchId: 'm1', showLiveDot: true }));
    renderWithProviders(<MyMatchTab memberId="member-1" />);

    const link = screen.getByRole('link', { name: /my match, live match in progress/i });
    expect(link.getAttribute('href')).toBe('/match/m1/lineup');
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('Tier 2/3: links to the lineup with no live dot in the accessible name', () => {
    surfacesMock.mockReturnValue(surfaces({ tier: 2, destinationMatchId: 'm2', showLiveDot: false }));
    renderWithProviders(<MyMatchTab memberId="member-1" />);

    const link = screen.getByRole('link', { name: 'My Match' });
    expect(link.getAttribute('href')).toBe('/match/m2/lineup');
  });

  it('marks the tab active on a match route', () => {
    surfacesMock.mockReturnValue(surfaces({ tier: 1, destinationMatchId: 'm1', showLiveDot: true }));
    renderWithProviders(<MyMatchTab memberId="member-1" />, { initialRoute: '/match/m1/lineup' });

    const link = screen.getByRole('link', { name: /my match/i });
    expect(link.getAttribute('aria-current')).toBe('page');
  });
});

describe('MyMatchTab — non-actionable postures (button)', () => {
  it('Tier 4: renders a disabled-looking button that toasts on tap, no navigation', () => {
    surfacesMock.mockReturnValue(surfaces({ tier: 4 }));
    renderWithProviders(<MyMatchTab memberId="member-1" />);

    expect(screen.queryByRole('link')).toBeNull();
    const btn = screen.getByRole('button', { name: 'My Match' });
    expect(btn.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(btn);
    expect(toastMock).toHaveBeenCalledWith('No current matches');
  });

  it('Hydrating: neutral button, NOT aria-disabled, tap is a silent no-op', () => {
    surfacesMock.mockReturnValue(surfaces({ isHydrating: true }));
    renderWithProviders(<MyMatchTab memberId="member-1" />);

    const btn = screen.getByRole('button', { name: 'My Match' });
    expect(btn.getAttribute('aria-disabled')).toBeNull();

    fireEvent.click(btn);
    expect(toastMock).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('Error: dim button that fires an error toast on tap', () => {
    surfacesMock.mockReturnValue(surfaces({ isError: true }));
    renderWithProviders(<MyMatchTab memberId="member-1" />);

    const btn = screen.getByRole('button', { name: 'My Match' });
    expect(btn.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(btn);
    expect(toastMock.error).toHaveBeenCalledTimes(1);
    expect(toastMock).not.toHaveBeenCalledWith('No current matches');
  });
});
