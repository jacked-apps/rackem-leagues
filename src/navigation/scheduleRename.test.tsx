/**
 * @fileoverview The season dates page moved from `.../manage-schedule` to
 * `.../schedule` (2026-11-19). An operator's bookmark to the old address must
 * still land on the page, with its league and season intact, not on a
 * "No routes matched" screen.
 *
 * The redirect is pulled out of the REAL router (not re-typed here), so this
 * fails if the old route is deleted or its redirect stops pointing at the new
 * page.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation, type RouteObject } from 'react-router-dom';
import { router } from './NavRoutes';

const OLD_PATH = 'league/:leagueId/season/:seasonId/manage-schedule';
const NEW_PATH = 'league/:leagueId/season/:seasonId/schedule';

/** Every route object in the real router, flattened. */
function allRoutes(routes: RouteObject[]): RouteObject[] {
  return routes.flatMap((r) => [r, ...allRoutes(r.children ?? [])]);
}

/** Stand-in for the dates page: shows where we landed. */
function Landed() {
  return <p>landed on {useLocation().pathname}</p>;
}

describe('season dates page rename', () => {
  const routes = allRoutes(router.routes);

  it('serves the dates page at the new /schedule address', () => {
    expect(routes.map((r) => r.path)).toContain(NEW_PATH);
  });

  it('sends the old /manage-schedule address to /schedule, keeping league and season', async () => {
    const oldRoute = routes.find((r) => r.path === OLD_PATH);
    expect(oldRoute, 'old route missing from the router').toBeDefined();

    const memory = createMemoryRouter(
      [
        { path: `/${OLD_PATH}`, element: oldRoute!.element },
        { path: `/${NEW_PATH}`, element: <Landed /> },
      ],
      { initialEntries: ['/league/L1/season/S1/manage-schedule'] },
    );
    render(<RouterProvider router={memory} />);

    expect(await screen.findByText('landed on /league/L1/season/S1/schedule')).toBeInTheDocument();
  });
});
