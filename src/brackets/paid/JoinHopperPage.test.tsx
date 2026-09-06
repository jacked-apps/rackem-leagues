/**
 * @fileoverview Tests for JoinHopperPage — the QR / link self-add landing page.
 *
 * The load-bearing case is the COLD SCANNER: someone who scans a code with no
 * session must come back here after signing in. If the join intent is lost in
 * that round trip they land on the dashboard and never join, and the code on
 * the wall silently does nothing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';

const mocks = vi.hoisted(() => ({ member: vi.fn(), join: vi.fn() }));

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useParams: () => ({ joinToken: 'jt-1' }),
  useLocation: () => ({ pathname: '/brackets/join/jt-1', search: '', state: null }),
}));

vi.mock('@/api/hooks/useCurrentMember', () => ({
  useCurrentMember: () => mocks.member(),
}));

const joinState = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock('@/api/hooks/useBrackets', () => ({
  useJoinHopper: () => ({ mutate: mocks.join, data: joinState.data, isPending: false }),
}));

import { JoinHopperPage } from './JoinHopperPage';

beforeEach(() => {
  vi.clearAllMocks();
  joinState.data = undefined;
});

describe('JoinHopperPage', () => {
  it('carries the join intent through sign-in for a cold scanner', () => {
    mocks.member.mockReturnValue({ data: null, isLoading: false });
    renderWithProviders(<JoinHopperPage />);

    const signIn = screen.getByRole('link', { name: /Sign in/ });
    // Without the redirect they sign in, land on the dashboard, and never join.
    expect(signIn.getAttribute('href')).toBe(
      '/login?redirect=%2Fbrackets%2Fjoin%2Fjt-1'
    );
  });

  it('does not try to join before the session is known', () => {
    mocks.member.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<JoinHopperPage />);

    expect(mocks.join).not.toHaveBeenCalled();
    expect(screen.getByText(/checking your account/i)).toBeTruthy();
  });

  it('joins a signed-in player automatically, with their own token', () => {
    mocks.member.mockReturnValue({ data: { id: 'm1' }, isLoading: false });
    renderWithProviders(<JoinHopperPage />);

    expect(mocks.join).toHaveBeenCalledWith({ joinToken: 'jt-1' });
  });

  it('sends a player whose name is taken to their profile, not into a rename here', () => {
    mocks.member.mockReturnValue({ data: { id: 'm1' }, isLoading: false });
    joinState.data = {
      ok: false,
      reason: 'name_taken',
      name: 'Tim P',
      bracket_name: 'Friday 9-Ball',
    };
    renderWithProviders(<JoinHopperPage />);

    expect(screen.getByText(/that name’s taken/i)).toBeTruthy();
    expect(screen.getByText('Tim P')).toBeTruthy();
    // The nickname belongs to their profile — changing it here would change it
    // on their league team too, so we send them there instead.
    expect(
      screen.getByRole('link', { name: /change my nickname/i }).getAttribute('href')
    ).toBe('/profile');
    expect(screen.getByRole('link', { name: /try again/i })).toBeTruthy();
  });

  it('tells a player the tournament already started', () => {
    mocks.member.mockReturnValue({ data: { id: 'm1' }, isLoading: false });
    joinState.data = { ok: false, reason: 'not_accepting', status: 'live' };
    renderWithProviders(<JoinHopperPage />);

    expect(screen.getByText(/sign-ups are closed/i)).toBeTruthy();
  });
});
