/**
 * @fileoverview Scoring Dialog Component
 *
 * Single-step confirmation dialog for scoring a game. The same component
 * drives all three scoring systems (BCA points, BCA percentage, Fargo) —
 * rendering is configurable: always-tracked flags, role-conditional
 * achievement buttons, and calculator-declared per-game inputs all render
 * in one Submit action.
 *
 * Field rules:
 * - Break-fault toggle: always visible. When true, the actual breaker flips
 *   to the scheduled racker — so BR/GB and runout swap which side is
 *   eligible.
 * - Win-by-forfeit toggle: always visible.
 * - BR (Break & Run): visible when winner = actual breaker.
 * - GB (Golden Break / 8-on-the-break): visible when winner = actual breaker
 *   AND the league has `golden_break_counts_as_win = true`.
 * - Runout: visible when winner = non-breaker.
 * - Per-side scoring inputs: driven by the active calculator's
 *   `scoringPopupFields()` spec (see `src/systems/calculators/types.ts`).
 *   When the spec declares `kind: 'counter'` for a side, an AdaptiveCounter
 *   renders for that side. `kind: 'fixed'` sides render nothing (the
 *   calculator handles them implicitly at compute time). When the
 *   calculator name is null, unknown, or the spec has no per-side inputs
 *   (aggregate calculators), no scoring inputs render.
 *
 * Winner points and loser points are NOT captured here — they derive at
 * read time from the league's snapshotted calculator + params.
 *
 * Branch A Unit 4 replaced the prior hardcoded
 * `pointsCalculator === 'accumulated_per_game'` string check with this
 * spec-driven path. The dormant `scoringPopupFields()` interface is now
 * a real production consumer.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { getCalculator } from '@/systems/calculators';
import { AdaptiveCounter } from './AdaptiveCounter';

/**
 * Discriminator for the achievement RadioGroup. 'none' is the explicit
 * "no achievement" option that preserves the deselect-by-tap path the
 * prior checkbox UX supported (radio buttons can't be deselected by
 * re-tapping the same option natively).
 */
type AchievementRadioValue = 'none' | 'break_and_run' | 'golden_break' | 'runout';

interface ScoringDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Game being scored */
  game: {
    gameNumber: number;
    winnerPlayerName: string;
    /**
     * True iff the clicked winner was the scheduled breaker for this game
     * (their side's action was 'breaks'). Combined with the break-fault
     * toggle to derive the actual breaker of the game-of-record.
     */
    winnerWasScheduledBreaker?: boolean;
  } | null;
  /** Break & Run checkbox state */
  breakAndRun: boolean;
  /** Golden Break checkbox state */
  goldenBreak: boolean;
  /** Whether league allows golden break to count as win */
  goldenBreakCountsAsWin: boolean;
  /** Game type for golden break label (8-ball, 9-ball, 10-ball, etc.) */
  gameType: string;
  /**
   * Resolved league handicap_type. Historically gated the ball-count input
   * on 'fargo' alone, but the active points calculator is the better cue
   * for whether per-game ball counts are needed (only the
   * `accumulated_per_game` calculator consumes them — other Fargo-handicap
   * leagues like Fargo + games-won don't). Kept for compatibility.
   */
  handicapType?: string;
  /**
   * Active league `points_calculator` name. Looked up via `getCalculator()`
   * to retrieve the calculator instance whose `scoringPopupFields(params)`
   * spec drives per-side input rendering. `null` (no points tracking) or
   * an unknown name skips per-side rendering.
   */
  pointsCalculator?: string | null;
  /**
   * Active league `points_calculator_params`. Passed to the calculator's
   * `scoringPopupFields(params)` to produce the per-side input spec. The
   * calculator handles empty params (`{}`) by falling back to its defaults
   * — the modal does not interpret the params itself.
   */
  pointsCalculatorParams?: Record<string, unknown> | null;
  /** Break-fault toggle state (always visible). */
  breakFouled?: boolean;
  /** Win-by-forfeit toggle state (always visible). */
  winByForfeit?: boolean;
  /** Runout state (role-conditional on winner = non-breaker). */
  runout?: boolean;
  /**
   * Calculator-driven per-game input value for the losing side. For Fargo
   * 10-7 (accumulated_per_game), this is the number of balls the loser
   * pocketed (0–7). null = unselected. Renamed from loserBallsPocketed
   * by Branch A.
   */
  loserValue?: number | null;
  /**
   * Calculator-driven per-game input value for the winning side. NULL when
   * the calculator declares winner side as kind: 'fixed' (no input). Future
   * calculators with a winner-side counter populate this.
   */
  winnerValue?: number | null;
  /**
   * Display name of the losing player. When provided and `winByForfeit` is
   * true, the modal renders an inline attribution disclosure ("Recorded as
   * [Loser Name]") below the forfeit Switch so scorers see which player is
   * being attributed the loss-by-forfeit. Optional — when null/undefined,
   * attribution disclosure is omitted (graceful degradation).
   */
  loserPlayerName?: string | null;
  /** Handler for Break & Run checkbox change */
  onBreakAndRunChange: (checked: boolean) => void;
  /** Handler for Golden Break checkbox change */
  onGoldenBreakChange: (checked: boolean) => void;
  /** Handler for break-fault toggle */
  onBreakFouledChange?: (checked: boolean) => void;
  /** Handler for win-by-forfeit toggle */
  onWinByForfeitChange?: (checked: boolean) => void;
  /** Handler for runout toggle */
  onRunoutChange?: (checked: boolean) => void;
  /** Handler for loser-side per-game value change */
  onLoserValueChange?: (value: number) => void;
  /** Handler for winner-side per-game value change (when calculator declares winner counter) */
  onWinnerValueChange?: (value: number) => void;
  /** Handler for cancel button */
  onCancel: () => void;
  /** Handler for confirm button */
  onConfirm: () => void;
}

/**
 * Dialog for scoring a game with special achievements.
 *
 * Break & Run and Golden Break are mutually exclusive.
 * When `handicapType === 'fargo'`, Submit is disabled until a ball count
 * has been tapped (0 is a valid explicit selection).
 */
export function ScoringDialog({
  open,
  game,
  breakAndRun,
  goldenBreak,
  goldenBreakCountsAsWin,
  gameType,
  pointsCalculator = null,
  pointsCalculatorParams = null,
  breakFouled = false,
  winByForfeit = false,
  runout = false,
  loserValue = null,
  winnerValue = null,
  loserPlayerName = null,
  onBreakAndRunChange,
  onGoldenBreakChange,
  onBreakFouledChange,
  onWinByForfeitChange,
  onRunoutChange,
  onLoserValueChange,
  onWinnerValueChange,
  onCancel,
  onConfirm,
}: ScoringDialogProps) {
  if (!game) return null;

  // Derive the actual breaker role of the game-of-record. A break foul
  // means the scheduled racker breaks again (re-rack), so role flips.
  const winnerWasScheduledBreaker = game.winnerWasScheduledBreaker ?? true;
  const winnerIsActualBreaker = winnerWasScheduledBreaker !== breakFouled;

  // Resolve the active calculator and its scoringPopupFields spec. The spec
  // tells the modal whether each side needs a counter input (kind: 'counter')
  // or contributes a fixed implicit value (kind: 'fixed', no input shown).
  // Aggregate calculators return `{ perSideInputs: null }` and produce no
  // per-side inputs at all.
  const spec = useMemo(() => {
    if (!pointsCalculator) return null;
    const calc = getCalculator(pointsCalculator);
    if (!calc) {
      console.warn(`[ScoringDialog] Unknown calculator name: ${pointsCalculator}`);
      return null;
    }
    return calc.scoringPopupFields((pointsCalculatorParams ?? {}) as never);
  }, [pointsCalculator, pointsCalculatorParams]);

  const winnerSpec = spec?.perSideInputs?.winner;
  const loserSpec = spec?.perSideInputs?.loser;
  const winnerNeedsCounter = winnerSpec?.kind === 'counter';
  const loserNeedsCounter = loserSpec?.kind === 'counter';

  // Submit is blocked when any side declares 'counter' and the value is
  // still null. value === 0 is a valid explicit choice (current Fargo UX).
  const counterValueMissing =
    (winnerNeedsCounter && winnerValue === null) ||
    (loserNeedsCounter && loserValue === null);

  // Get label for golden break based on game type
  const getGoldenBreakLabel = () => {
    if (gameType === '8-ball') return '8 on the Break';
    if (gameType === '9-ball') return '9 on the Break';
    if (gameType === '10-ball') return '10 on the Break';
    return 'Golden Break';
  };

  // When the user toggles break-fault, the eligible achievement flips. Any
  // previously-ticked achievement that's no longer applicable gets cleared
  // so submit doesn't persist an inconsistent state.
  const handleBreakFouledChange = (checked: boolean) => {
    onBreakFouledChange?.(checked);
    // The new actual-breaker role after the toggle.
    const newWinnerIsActualBreaker = winnerWasScheduledBreaker !== checked;
    if (newWinnerIsActualBreaker) {
      // Winner is now a breaker — runout no longer applies.
      if (runout) onRunoutChange?.(false);
    } else {
      // Winner is now a non-breaker — BR/GB no longer apply.
      if (breakAndRun) onBreakAndRunChange(false);
      if (goldenBreak) onGoldenBreakChange(false);
    }
  };

  // Aria-live announcement region. Updated when an auto-clear cascade
  // happens (currently only Forfeit clears a selected achievement). Locked
  // copy template per Branch A plan: "[Achievement Name] cleared because
  // forfeit was selected."
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // Derive the achievement RadioGroup's current value from the existing
  // boolean state. This keeps the source-of-truth on the per-event booleans
  // (so existing callers that pass them as props don't need to change) while
  // letting the RadioGroup render with proper screen-reader semantics.
  const achievementValue: AchievementRadioValue = breakAndRun
    ? 'break_and_run'
    : goldenBreak
      ? 'golden_break'
      : runout
        ? 'runout'
        : 'none';

  // Map a RadioGroup value back to the per-event boolean callbacks.
  // Setting any non-'none' value clears the others and sets the chosen one.
  const handleAchievementChange = (value: string) => {
    const next = value as AchievementRadioValue;
    onBreakAndRunChange(next === 'break_and_run');
    onGoldenBreakChange(next === 'golden_break');
    onRunoutChange?.(next === 'runout');
  };

  // Wraps the forfeit Switch's onCheckedChange. When forfeit toggles ON
  // and an achievement was selected, clear it AND announce the cascade.
  // (Forfeit OFF does NOT restore the prior selection — once cleared, it
  // stays cleared. Per the Branch A plan.)
  const handleWinByForfeitChange = (checked: boolean) => {
    onWinByForfeitChange?.(checked);
    if (checked && achievementValue !== 'none') {
      const labelMap: Record<Exclude<AchievementRadioValue, 'none'>, string> = {
        break_and_run: 'Break & Run',
        golden_break: getGoldenBreakLabel(),
        runout: 'Runout',
      };
      const previousLabel = labelMap[achievementValue];
      handleAchievementChange('none');
      setLiveAnnouncement(`${previousLabel} cleared because forfeit was selected.`);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Confirm Game Result</DialogTitle>
          <DialogDescription>
            Confirm the game outcome and any special achievements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Aria-live region for cascade announcements. Visually hidden;
              screen readers announce the message when it changes (e.g.,
              "Break & Run cleared because forfeit was selected"). */}
          <div role="status" aria-live="polite" className="sr-only">
            {liveAnnouncement}
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">Game {game.gameNumber}</p>
            <p className="text-lg font-semibold mt-2">
              Winner: {game.winnerPlayerName}
            </p>
          </div>

          {/* Section 1: per-side scoring inputs. Most-tapped section for
              calculators that declare counters — moved to the top so
              scorers don't have to scroll past rare modifiers. The spec's
              `kind` drives rendering: 'counter' shows an AdaptiveCounter;
              'fixed' shows nothing (calculator handles fixed implicitly).
              Aggregate calculators (no perSideInputs) produce nothing. */}
          {winnerSpec?.kind === 'counter' && (
            <AdaptiveCounter
              min={winnerSpec.min}
              max={winnerSpec.max}
              label={winnerSpec.label}
              value={winnerValue}
              onChange={(v) => onWinnerValueChange?.(v)}
            />
          )}
          {loserSpec?.kind === 'counter' && (
            <AdaptiveCounter
              min={loserSpec.min}
              max={loserSpec.max}
              label={loserSpec.label}
              value={loserValue}
              onChange={(v) => onLoserValueChange?.(v)}
            />
          )}
          {counterValueMissing && (
            <p className="text-xs text-muted-foreground">
              Tap a value to continue.
            </p>
          )}

          {/* Section 2: role-conditional achievements as a RadioGroup with
              proper screen-reader semantics. The achievements (B&R, Golden
              Break, Runout) are mutually exclusive — radio semantics
              communicate that natively. Includes an explicit "None" option
              so sighted users can deselect by tapping (radio buttons can't
              be deselected by re-tapping the same option). */}
          <div className="space-y-2">
            <Label className="text-sm font-normal">Achievement</Label>
            <RadioGroup
              value={achievementValue}
              onValueChange={handleAchievementChange}
              className="space-y-2"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="none" id="achievement-none" />
                <Label htmlFor="achievement-none" className="font-normal">
                  None
                </Label>
              </div>
              {winnerIsActualBreaker && (
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="break_and_run" id="achievement-break-and-run" />
                  <Label htmlFor="achievement-break-and-run" className="font-normal">
                    Break &amp; Run
                  </Label>
                </div>
              )}
              {winnerIsActualBreaker && goldenBreakCountsAsWin && (
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="golden_break" id="achievement-golden-break" />
                  <Label htmlFor="achievement-golden-break" className="font-normal">
                    {getGoldenBreakLabel()}
                  </Label>
                </div>
              )}
              {!winnerIsActualBreaker && (
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="runout" id="achievement-runout" />
                  <Label htmlFor="achievement-runout" className="font-normal">
                    Runout
                  </Label>
                </div>
              )}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Tap None to clear a selection.
            </p>
          </div>

          {/* Section 3: state modifiers — rare events that change game
              mechanics (re-rack semantics) or stat attribution. Bottom
              of the modal because they're tapped infrequently. */}
          <div className="flex items-center justify-between">
            <Label htmlFor="breakFouled" className="text-sm font-normal">
              Break foul (re-rack)
            </Label>
            <Switch
              id="breakFouled"
              checked={breakFouled}
              onCheckedChange={handleBreakFouledChange}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="winByForfeit" className="text-sm font-normal">
                Win by forfeit
              </Label>
              <Switch
                id="winByForfeit"
                checked={winByForfeit}
                onCheckedChange={handleWinByForfeitChange}
              />
            </div>
            {winByForfeit && loserPlayerName && (
              <p className="text-xs text-muted-foreground">
                Recorded as {loserPlayerName}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} loadingText="none">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            loadingText="Saving..."
            disabled={counterValueMissing}
          >
            Save Game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
