/**
 * @fileoverview Guards "the door is in the nav, so the room has the nav."
 *
 * Every page a signed-in member reaches from the sidebar, drawer or a member
 * page must sit inside MemberLayout, or it renders with no sidebar / tab bar
 * and no way back (What's New did, 2026-11-01). Public pages qualify too —
 * MemberLayout's nav gates itself on login, so visitors see minimal chrome.
 */

import { describe, it, expect } from 'vitest';
import type { RouteObject } from 'react-router-dom';
import { router } from './NavRoutes';
import { MemberLayout } from '../components/layout/MemberLayout';
import { NAV_ENTRIES } from '../components/layout/navEntries';

/** Paths a signed-in member can navigate to from the member nav or Profile. */
const MEMBER_REACHED = [
  'whats-new',
  'whats-new/:version',
  'rules',
  'learn',
  'pricing',
  'become-league-operator',
  'league-operator-application',
  'my-teams',
  'stats',
  'messages',
  'brackets',
  'profile',
  'reup',
  'about',
  // Every menu entry in navEntries is a door too — '' is Home (the index route).
  ...NAV_ENTRIES.map((e) => e.path.replace(/^\//, '')),
];

/** Route paths under `routes`; an index route is reported as ''. */
function pathsUnder(routes: RouteObject[]): string[] {
  return routes.flatMap((r) => [
    ...(r.path ? [r.path] : r.index ? [''] : []),
    ...pathsUnder(r.children ?? []),
  ]);
}

describe('member-reached pages keep the member nav', () => {
  const top = router.routes[0].children ?? [];
  const layout = top.find(
    (r) => (r.element as { type?: unknown } | undefined)?.type === MemberLayout,
  );
  const inside = pathsUnder(layout?.children ?? []);

  it.each([...new Set(MEMBER_REACHED)])('/%s renders inside MemberLayout', (path) => {
    expect(inside).toContain(path);
  });
});

describe('the operator application needs a member profile', () => {
  // Submitting writes created_by = member.id, so a brand-new account (signed
  // in, no profile yet) must go through Complete Profile first — which carries
  // ?redirect back to the application (Ed, 2026-11-19). Auth-only let them
  // fill the whole form and then fail on submit.
  function findRoute(routes: RouteObject[], path: string): RouteObject | undefined {
    for (const r of routes) {
      if (r.path === path) return r;
      const hit = findRoute(r.children ?? [], path);
      if (hit) return hit;
    }
    return undefined;
  }

  it('/league-operator-application requires a completed member profile', () => {
    const route = findRoute(router.routes, 'league-operator-application');
    const props = (route?.element as { props?: Record<string, unknown> } | undefined)?.props;
    expect(props?.requireAuth).toBe(true);
    expect(props?.requireApprovedApplication).toBe(true);
  });
});
