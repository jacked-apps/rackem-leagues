/**
 * @fileoverview Learn — the Phase 1 Learn hub mounted at `/learn`.
 *
 * Phase 1 hub contains the Glossary section only. Walkthroughs and Concepts
 * sections are Phase 2 (gated on evidence from the outside-LO walk).
 *
 * Public (no sign-in), like Rules: the glossary is fixed text that reads
 * nothing from the account or database, and a visitor deciding whether to
 * join or run a league can see how the app works (Ed, 2026-11-16; the Home
 * page links here). It was operator-only, then any signed-in user. Operators
 * following "Learn more →" links from glossary popovers, players and visitors
 * all share one destination. The disclaimer under the header frames the
 * definitions as "how this app uses these words," neutral to who's reading.
 *
 * Uses the shared `PageHeader` like the other public pages (About, Become a
 * League Operator). A signed-out visitor has no menu, so without its back
 * arrow this page was a dead end (Ed, 2026-11-19). Back goes to Home for a
 * visitor (My Teams would only send them to sign in) and to My Teams for a
 * member — the same rule as Become a League Operator.
 *
 * @see docs/plans/2026-05-28-001-feat-operator-help-system-phase-1-plan.md
 */

import { PageHeader } from '@/components/PageHeader';
import { useUser } from '@/context/useUser';
import { GlossaryView } from './learn/GlossaryView';

export default function Learn() {
  const { isLoggedIn } = useUser();

  return (
    <div>
      <PageHeader
        backTo={isLoggedIn ? '/my-teams' : '/'}
        backLabel={isLoggedIn ? 'Back to My Teams' : 'Back to Home'}
        title="Learn"
        subtitle="Browse pool league terminology. Search by your own word — if it's an alias we know, we'll find the canonical term."
      >
        <p className="mt-2 text-xs text-muted-foreground/80">
          <strong>Heads up:</strong> these are how we use these words{' '}
          <em>in this app</em>. Pool terminology varies across regions and
          other systems, and many terms here carry additional meanings
          elsewhere. Sticking with these definitions matters to us —
          more complex ideas build on top of them, so we work to stay
          consistent.
        </p>
      </PageHeader>
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <GlossaryView />
      </div>
    </div>
  );
}
