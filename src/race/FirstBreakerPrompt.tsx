/**
 * @fileoverview The one question a race asks before it starts: who breaks?
 *
 * However that was settled at the table — lag, a flip, roshambo — already
 * happened. This records the answer, and after it the break rule takes over and
 * nobody is asked again. That is why it is two buttons and no explanation of
 * how to decide: the app is not refereeing, it is writing down.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RaceSeat } from './types';

interface FirstBreakerPromptProps {
  home: RaceSeat;
  away: RaceSeat;
  breakRule: string;
  onChoose: (side: 'home' | 'away') => void;
  disabled?: boolean;
}

export function FirstBreakerPrompt({
  home,
  away,
  breakRule,
  onChoose,
  disabled,
}: FirstBreakerPromptProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who breaks first?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1"
            variant="outline"
            disabled={disabled}
            onClick={() => onChoose('home')}
          >
            {home.displayName}
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            disabled={disabled}
            onClick={() => onChoose('away')}
          >
            {away.displayName}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {breakRule === 'winner_breaks'
            ? 'After this, the winner of each game breaks the next one.'
            : 'After this, the break passes back and forth every game.'}
        </p>
      </CardContent>
    </Card>
  );
}
