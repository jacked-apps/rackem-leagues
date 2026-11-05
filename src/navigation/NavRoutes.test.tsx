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
];

function pathsUnder(routes: RouteObject[]): string[] {
  return routes.flatMap((r) => [...(r.path ? [r.path] : []), ...pathsUnder(r.children ?? [])]);
}

describe('member-reached pages keep the member nav', () => {
  const top = router.routes[0].children ?? [];
  const layout = top.find(
    (r) => (r.element as { type?: unknown } | undefined)?.type === MemberLayout,
  );
  const inside = pathsUnder(layout?.children ?? []);

  it.each(MEMBER_REACHED)('/%s renders inside MemberLayout', (path) => {
    expect(inside).toContain(path);
  });
});
