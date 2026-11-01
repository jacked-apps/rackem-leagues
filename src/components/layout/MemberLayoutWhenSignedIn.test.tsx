/**
 * @fileoverview A public page reached from the member nav shows that nav to a
 * signed-in member, and stays bare for everyone else (What's New had no
 * sidebar or tab bar even when opened from the sidebar).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemberLayoutWhenSignedIn } from './MemberLayoutWhenSignedIn';

const auth = vi.hoisted(() => ({ user: null as object | null, member: null as object | null }));

vi.mock('@/context/useUser', () => ({ useUser: () => ({ user: auth.user }) }));
vi.mock('@/api/hooks', () => ({ useUserProfile: () => ({ member: auth.member }) }));
// The real layout pulls in the sidebar, tab bar and invite modals; a marker
// that still renders the page proves which branch was taken.
vi.mock('./MemberLayout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { MemberLayout: () => (<div data-testid="member-nav"><Outlet /></div>) };
});

function renderAt() {
  render(
    <MemoryRouter initialEntries={['/whats-new']}>
      <Routes>
        <Route element={<MemberLayoutWhenSignedIn />}>
          <Route path="whats-new" element={<p>What's New page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('MemberLayoutWhenSignedIn', () => {
  beforeEach(() => {
    auth.user = null;
    auth.member = null;
  });

  it('wraps the page in the member nav for a signed-in member', () => {
    auth.user = { id: 'u1' };
    auth.member = { id: 'm1' };
    renderAt();
    expect(screen.getByTestId('member-nav')).toBeInTheDocument();
    expect(screen.getByText("What's New page")).toBeInTheDocument();
  });

  it('shows the bare page to a signed-out visitor', () => {
    renderAt();
    expect(screen.queryByTestId('member-nav')).not.toBeInTheDocument();
    expect(screen.getByText("What's New page")).toBeInTheDocument();
  });

  it('shows the bare page to a signed-in account with no member profile yet', () => {
    auth.user = { id: 'u1' };
    renderAt();
    expect(screen.queryByTestId('member-nav')).not.toBeInTheDocument();
  });
});
