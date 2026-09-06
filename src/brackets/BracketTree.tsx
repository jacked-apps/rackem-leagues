/**
 * @fileoverview The bracket tree renderer (Unit 5).
 *
 * Lays out a bracket as horizontally-scrolling round columns. For double
 * elimination the winners / losers / grand-final sides are STACKED on one page
 * (labeled sections, losers below winners) rather than hidden behind tabs — so
 * an on-deck pair in the losers bracket is never out of sight. Single
 * elimination shows just the winners tree. Pure presentation driven by the
 * view-model; the same component backs the organizer view (interactive) and the
 * public share view (read-only).
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MatchCell } from './MatchCell';
import type { BracketView, MatchView } from './bracketViewModel';

interface BracketTreeProps {
  view: BracketView;
  readOnly: boolean;
  onPick?: (matchId: string, participantId: string) => void;
  onReopen?: (matchId: string) => void;
  onToggleInProgress?: (matchId: string, inProgress: boolean) => void;
}

export function BracketTree({
  view,
  readOnly,
  onPick,
  onReopen,
  onToggleInProgress,
}: BracketTreeProps) {
  const shared = { readOnly, onPick, onReopen, onToggleInProgress };

  // Single elimination: one tree, no section headings.
  if (!view.hasLosers && view.grandFinal.length === 0) {
    return <RoundColumns rounds={view.winners} {...shared} />;
  }

  // Double elimination: stack the sides so everything stays visible at once.
  return (
    <div className="space-y-6">
      <Section title="Winners bracket">
        <RoundColumns rounds={view.winners} {...shared} />
      </Section>
      {view.hasLosers && (
        <Section title="Losers bracket">
          <RoundColumns rounds={view.losers} {...shared} />
        </Section>
      )}
      {view.grandFinal.length > 0 && (
        <Section title="Grand Final">
          <RoundColumns rounds={[view.grandFinal]} {...shared} />
        </Section>
      )}
    </div>
  );
}

/** A labeled, horizontally-scrollable bracket section (title + divider rule). */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 border-b pb-1 text-lg font-semibold">{title}</h3>
      {children}
    </div>
  );
}

/** Render an array of rounds as side-by-side, scrollable columns. */
function RoundColumns({
  rounds,
  readOnly,
  onPick,
  onReopen,
  onToggleInProgress,
}: {
  rounds: MatchView[][];
  readOnly: boolean;
  onPick?: (matchId: string, participantId: string) => void;
  onReopen?: (matchId: string) => void;
  onToggleInProgress?: (matchId: string, inProgress: boolean) => void;
}) {
  const [showFinished, setShowFinished] = useState(false);

  if (rounds.length === 0) {
    return <p className="text-sm text-muted-foreground">No matches yet.</p>;
  }

  const lastIndex = rounds.length - 1;
  const isComplete = (matches: MatchView[]) =>
    matches.length > 0 && matches.every((m) => m.status === 'complete');

  // Finished rounds are a leading prefix (a later round can't finish first).
  // Collapse them all under ONE strip — but always keep the last round (the
  // payoff) visible, so a fully-finished bracket still shows its final.
  let completePrefix = 0;
  while (completePrefix < rounds.length && isComplete(rounds[completePrefix])) {
    completePrefix++;
  }
  const collapseCount = Math.min(completePrefix, lastIndex);
  const firstVisible = showFinished ? 0 : collapseCount;

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {collapseCount > 0 && !showFinished && (
        <CollapsedRounds count={collapseCount} onExpand={() => setShowFinished(true)} />
      )}
      {rounds.map((matches, i) => {
        if (i < firstVisible) return null; // inside the collapsed group
        // The one collapse control lives on the first finished round's header.
        const showCollapse = showFinished && collapseCount > 0 && i === 0;
        return (
          <div key={i} className="flex flex-col justify-around gap-4">
            <div className="sticky top-0 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              Round {i + 1}
              {showCollapse && (
                <button
                  type="button"
                  onClick={() => setShowFinished(false)}
                  className="hover:text-foreground"
                  title="Hide finished rounds"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {matches.map((m) => (
              <MatchCell key={m.id} match={m} readOnly={readOnly} onPick={onPick} onReopen={onReopen} onToggleInProgress={onToggleInProgress} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** All finished rounds folded into one narrow, tap-to-expand strip. */
function CollapsedRounds({ count, onExpand }: { count: number; onExpand: () => void }) {
  const label = count === 1 ? 'Round 1 ✓' : `Rounds 1–${count} ✓`;
  return (
    <button
      type="button"
      onClick={onExpand}
      title="Show finished rounds"
      className="flex shrink-0 flex-col items-center justify-center gap-2 self-stretch rounded-md border border-dashed px-1 py-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <ChevronRight className="h-4 w-4" />
      <span className="[writing-mode:vertical-rl]">{label}</span>
    </button>
  );
}
