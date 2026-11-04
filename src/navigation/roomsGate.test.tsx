/**
 * @fileoverview The Game Room's gate — routes and doors hide TOGETHER.
 *
 * The half-gated bug (CLAUDE.md, 2026-06-21): a route behind `!isProduction`
 * whose button was not, so production showed a door to a room that was gone.
 * This file pins the two things that keep that from happening here:
 *
 *  1. Every `rooms/**` route in NavRoutes is wrapped in `NonProdGate`.
 *  2. `NonProdGate` renders its child off production and redirects home on it.
 *
 * The menu's "Rooms" door is NOT here: it is one entry in the shared menu
 * list (`src/components/layout/navEntries.ts`, from the menu-favorites PR),
 * gated `!isProduction` like these routes, and its own test pins that. Keeping
 * the door out of the drawer/sidebar files on this branch is what lets the two
 * PRs merge in either order without a conflict.
 *
 * Plus the funnel: signed out, `/rooms/join/x` goes to login with the join
 * URL as the redirect target (existing ProtectedRoute behaviour, pinned for
 * this route because the QR on the table depends on it).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { renderWithProviders } from '@/test/utils';

// One mutable flag behind a getter, so each test can flip the environment
// without re-importing the modules that read it.
const env = vi.hoisted(() => ({ production: false }));
vi.mock('@/config/environment', () => ({
  get isProduction() {
    return env.production;
  },
  get isStaging() {
    return !env.production;
  },
  isDevelopment: false,
  env: 'staging',
  ENV_BANNER_CONFIG: {},
  applyEnvironmentBranding: () => {},
}));

// Route modules can pull these hooks in; none of it matters to the gate.
vi.mock('@/api/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    member: { id: 'm1', first_name: 'Pat', last_name: 'Player' },
    loading: false,
    canAccessLeagueOperatorFeatures: () => false,
  }),
  useIsOperator: () => false,
}));
vi.mock('@/api/hooks/useOrganizations', () => ({ useOrganizations: () => ({ organizations: [] }) }));
vi.mock('@/api/hooks/useMessages', () => ({ useUnreadMessageCount: () => ({ data: 0 }) }));
vi.mock('@/hooks/usePendingReportsCount', () => ({ usePendingReportsCount: () => 0 }));
vi.mock('@/api/hooks/usePendingJoinRequestCount', () => ({ usePendingJoinRequestCount: () => 0 }));
vi.mock('@/api/hooks/useMyMatchSurfaces', () => ({
  useMyMatchSurfaces: () => ({
    tier: 4, destinationMatchId: null, showLiveDot: false, drawerItems: [], isHydrating: false, isError: false,
  }),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import { NonProdGate } from '@/components/NonProdGate';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { router } from './NavRoutes';

const ROOM_PATHS = ['rooms', 'rooms/join/:joinToken', 'rooms/:roomId'];

/** Every route object in the tree, flattened. */
function allRoutes(routes: RouteObject[]): RouteObject[] {
  return routes.flatMap((r) => [r, ...allRoutes(r.children ?? [])]);
}

beforeEach(() => {
  env.production = false;
});

describe('Game Room gate — routes', () => {
  it('every rooms/** route in NavRoutes is wrapped in NonProdGate', () => {
    const routes = allRoutes(router.routes);
    for (const path of ROOM_PATHS) {
      const route = routes.find((r) => r.path === path);
      expect(route, path).toBeDefined();
      const element = route!.element as React.ReactElement;
      expect(element.type, `${path} is not gated`).toBe(NonProdGate);
    }
  });

  it('NonProdGate renders its child off production and redirects home on it', () => {
    const Probe = () => <p>{useLocation().pathname}</p>;
    const tree = (
      <MemoryRouter initialEntries={['/rooms']}>
        <Routes>
          <Route path="/" element={<p>HOME</p>} />
          <Route path="/rooms" element={<NonProdGate><p>ROOMS PAGE</p></NonProdGate>} />
        </Routes>
        <Probe />
      </MemoryRouter>
    );

    const open = render(tree);
    expect(screen.getByText('ROOMS PAGE')).toBeInTheDocument();
    open.unmount();

    env.production = true;
    render(tree);
    expect(screen.queryByText('ROOMS PAGE')).toBeNull();
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });

  it('signed out, /rooms/join/x redirects to login with the join URL as the redirect target', () => {
    const Probe = () => {
      const l = useLocation();
      return <p>{l.pathname + l.search}</p>;
    };
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<Probe />} />
        <Route
          path="/rooms/join/:joinToken"
          element={<ProtectedRoute requireAuth><p>JOIN PAGE</p></ProtectedRoute>}
        />
      </Routes>,
      { userContext: { isLoggedIn: false, user: null, loading: false }, initialRoute: '/rooms/join/x' }
    );
    expect(screen.queryByText('JOIN PAGE')).toBeNull();
    expect(screen.getByText(`/login?redirect=${encodeURIComponent('/rooms/join/x')}`)).toBeInTheDocument();
  });
});
