/**
 * @fileoverview The bracket tree renderer (Unit 5).
 *
 * Lays out a bracket as horizontally-scrolling round columns. For double
 * elimination the three sides (winners / losers / grand final) are shown on a
 * tabbed surface — the v1 mobile-friendly layout (both trees need not be
 * visible at once). Single elimination shows just the winners tree. Pure
 * presentation driven by the view-model; the same component backs the
 * organizer view (interactive) and the public share view (read-only).
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MatchCell } from './MatchCell';
import type { BracketView, MatchView } from './bracketViewModel';

interface BracketTreeProps {
  view: BracketView;
  readOnly: boolean;
  onPick?: (matchId: string, participantId: string) => void;
  onReopen?: (matchId: string) => void;
}

export function BracketTree({ view, readOnly, onPick, onReopen }: BracketTreeProps) {
  // Single elimination: one tree, no tabs.
  if (!view.hasLosers && view.grandFinal.length === 0) {
    return <RoundColumns rounds={view.winners} readOnly={readOnly} onPick={onPick} onReopen={onReopen} />;
  }

  return (
    <Tabs defaultValue="winners" className="w-full">
      <TabsList>
        <TabsTrigger value="winners">Winners</TabsTrigger>
        {view.hasLosers && <TabsTrigger value="losers">Losers</TabsTrigger>}
        {view.grandFinal.length > 0 && (
          <TabsTrigger value="grand_final">Grand Final</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="winners">
        <RoundColumns rounds={view.winners} readOnly={readOnly} onPick={onPick} onReopen={onReopen} />
      </TabsContent>
      {view.hasLosers && (
        <TabsContent value="losers">
          <RoundColumns rounds={view.losers} readOnly={readOnly} onPick={onPick} onReopen={onReopen} />
        </TabsContent>
      )}
      {view.grandFinal.length > 0 && (
        <TabsContent value="grand_final">
          <RoundColumns rounds={[view.grandFinal]} readOnly={readOnly} onPick={onPick} onReopen={onReopen} />
        </TabsContent>
      )}
    </Tabs>
  );
}

/** Render an array of rounds as side-by-side, scrollable columns. */
function RoundColumns({
  rounds,
  readOnly,
  onPick,
  onReopen,
}: {
  rounds: MatchView[][];
  readOnly: boolean;
  onPick?: (matchId: string, participantId: string) => void;
  onReopen?: (matchId: string) => void;
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
            <MatchCell key={m.id} match={m} readOnly={readOnly} onPick={onPick} onReopen={onReopen} />
          ))}
        </div>
      ))}
    </div>
  );
}
