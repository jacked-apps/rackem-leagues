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
  if (rounds.length === 0) {
    return <p className="text-sm text-muted-foreground">No matches yet.</p>;
  }
  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {rounds.map((matches, i) => (
        <div key={i} className="flex flex-col justify-around gap-4">
          <div className="sticky top-0 text-xs font-medium text-muted-foreground">
            Round {i + 1}
          </div>
          {matches.map((m) => (
            <MatchCell key={m.id} match={m} readOnly={readOnly} onPick={onPick} onReopen={onReopen} onToggleInProgress={onToggleInProgress} />
          ))}
        </div>
      ))}
    </div>
  );
}
