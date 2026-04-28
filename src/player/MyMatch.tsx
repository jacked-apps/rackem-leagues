/**
 * @fileoverview My Match — Live-match Jump-in (PLACEHOLDER)
 *
 * Landing page at `/my-match`. **This is a placeholder** — the real
 * feature is a live-match detector + jump-in shortcut, planned as a
 * separate brainstorm. The route exists now so the global drawer's
 * top entry resolves to a real page instead of a 404, and so the
 * idea doesn't get lost.
 *
 * Future scope (not in this branch):
 * - Detect when any team the user is on has a match with status
 *   `in_progress`, surface it prominently on this page and on the
 *   Dashboard.
 * - "Jump in" CTA → routes to that match's scoring/lineup screen
 *   (likely `/match/:id/score` or `/match/:id/lineup` depending on
 *   match state).
 * - Multi-match handling (rare — most players are on one team
 *   playing at a time, but a list shape supports the long-tail).
 * - Empty state when no live match is detected (probably a "your
 *   next scheduled match is..." view).
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';

/**
 * Live-match jump-in landing (placeholder).
 *
 * The real implementation will detect in-progress matches across the
 * user's teams and surface a one-tap "Jump in" CTA.
 */
export function MyMatch() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo="/dashboard"
        backLabel="Home"
        title="My Match"
        subtitle="Live-match jump-in — coming soon"
      />
      <div className="container mx-auto max-w-2xl px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>One-tap access to your live match</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-700">
            <p>
              When one of your teams is in the middle of a match, this page
              will show it at the top with a Jump-in button that drops you
              straight into scoring or lineup — no need to dig through My
              Teams &rarr; Schedule &rarr; the right night.
            </p>
            <p>
              The same live-match card will also appear on your Dashboard so
              it&apos;s the first thing you see when you open the app on
              league night.
            </p>
            <p className="text-xs italic text-gray-500">
              (Live-match detection + jump-in is tracked in the project
              backlog. The drawer entry is here so it doesn&apos;t get
              forgotten.)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default MyMatch;
