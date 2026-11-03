/**
 * @fileoverview The one question a race asks before it starts: who breaks?
 *
 * However that was settled at the table — lag, a flip, roshambo — already
 * happened. This records the answer, and it takes BOTH players: one names who
 * breaks, the other confirms it (the engine's `start_race` is propose /
 * confirm). After that the break rule takes over and nobody is asked again.
 *
 * Three states, seen from the viewer's side:
 *  - nobody has picked: two name buttons
 *  - I picked: my pick + "Waiting for <them> to confirm", and the two buttons
 *    stay live so I can change it until they do
 *  - they picked: their pick + a Confirm button, and nothing else — the app
 *    does not referee, so a disagreement is sorted out at the table and the
 *    proposer changes it
 *
 * Every state is told in names and words, never colour alone.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BreakerProposal, RaceSeat, RaceSide } from './types';

interface FirstBreakerPromptProps {
  home: RaceSeat;
  away: RaceSeat;
  breakRule: string;
  /** The viewer's side. Only players see this prompt. */
  mySide: RaceSide;
  /** The pending pick, if one player has made it. */
  proposal: BreakerProposal | null;
  /** Propose, change, or confirm — the engine tells them apart. */
  onChoose: (side: RaceSide) => void;
  disabled?: boolean;
}

export function FirstBreakerPrompt({
  home,
  away,
  breakRule,
  mySide,
  proposal,
  onChoose,
  disabled,
}: FirstBreakerPromptProps) {
  const seat = (side: RaceSide) => (side === 'home' ? home : away);
  const opponent = seat(mySide === 'home' ? 'away' : 'home');
  const picked = proposal ? seat(proposal.side) : null;
  const theyPicked = proposal !== null && proposal.bySide !== mySide;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who breaks first?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {theyPicked && picked ? (
          <>
            <p className="text-sm">
              {opponent.displayName} picked {picked.displayName} to break.
            </p>
            <Button
              className="w-full"
              // The mutation is fire-and-forget; the parent's busy flag disables it.
              loadingText="none"
              disabled={disabled}
              onClick={() => onChoose(picked.side)}
            >
              Confirm {picked.displayName} breaks
            </Button>
            <p className="text-xs text-muted-foreground">
              Not right? Sort it out at the table — {opponent.displayName} can change it.
            </p>
          </>
        ) : (
          <>
            {picked ? (
              <p className="text-sm">
                You picked {picked.displayName}. Waiting for {opponent.displayName} to
                confirm.
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              {[home, away].map((s) => (
                <Button
                  key={s.side}
                  className="flex-1"
                  variant={picked?.side === s.side ? 'default' : 'outline'}
                  loadingText="none"
                  disabled={disabled}
                  aria-pressed={picked?.side === s.side}
                  onClick={() => onChoose(s.side)}
                >
                  {/* The words carry the pick; the filled button only echoes it. */}
                  {picked?.side === s.side ? `${s.displayName} (your pick)` : s.displayName}
                </Button>
              ))}
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          {breakRule === 'winner_breaks'
            ? 'After this, the winner of each game breaks the next one.'
            : 'After this, the break passes back and forth every game.'}
        </p>
      </CardContent>
    </Card>
  );
}
