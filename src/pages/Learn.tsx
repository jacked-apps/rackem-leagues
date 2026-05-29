/**
 * @fileoverview Learn — the Phase 1 Learn hub mounted at `/learn`.
 *
 * Phase 1 hub contains the Glossary section only. Walkthroughs and Concepts
 * sections are Phase 2 (gated on evidence from the outside-LO walk).
 *
 * Route is wrapped in `withAuth` (any signed-in user). Originally scoped
 * operator-only, but operators following "Learn more →" links from
 * glossary popovers AND players reading the same content benefit from the
 * shared destination — the disclaimer in the page header frames the
 * definitions as "how this app uses these words," neutral to who's reading.
 *
 * @see docs/plans/2026-05-28-001-feat-operator-help-system-phase-1-plan.md
 */

import { GlossaryView } from './learn/GlossaryView';

export default function Learn() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Learn</h1>
        <p className="text-muted-foreground">
          Browse pool league terminology. Search by your own word — if it's
          an alias we know, we'll find the canonical term.
        </p>
        <p className="text-xs text-muted-foreground/80">
          <strong>Heads up:</strong> these are how we use these words{' '}
          <em>in this app</em>. Pool terminology varies across regions and
          other systems — some words here have additional meanings outside
          the app, and some won't match how you've heard them used elsewhere.
          We try to use them strictly here for consistency.
        </p>
      </header>
      <GlossaryView />
    </div>
  );
}
