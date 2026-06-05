/**
 * @fileoverview Team-visible dissent flag (many-eyes Layer-2 / Unit 5).
 *
 * Per Ed's restructure (2026-05-26), the flag is now an informational notice
 * that surfaces a SPECIFIC integrity concern: someone vouched a result that
 * differs from what's currently recorded. The structure mirrors the
 * confirm/deny modals' clarity — show what's recorded, show who agrees, name
 * who disagrees, urge verification + vacate-to-correct.
 *
 * Visual style (shadcn `Alert` `warning` variant) is a placeholder pending
 * manual testing — Ed will decide whether it should match the existing
 * confirm/vacate modal look (consistency) or stay visually distinct (because
 * it's a different *kind* of thing — a recorded conflict, not an action).
 *
 * Live-trigger note: in Phase 2 as built, no code path produces a confirmation
 * row whose snapshot differs from `match_games`'s current result. The dissent
 * flag is plumbing for Phase 3 (tap-to-peek + record-different) which will
 * connect the trigger. The component + integration are committed so when that
 * trigger lights up, no wiring is needed.
 *
 * Rendering policy lives in `ScoreMatch`: it filters the derived
 * `GameDissent[]` to those whose dissenter's side matches the viewer's side,
 * then renders one `<DissentFlag />` per game.
 */

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { ResultLike } from '@/utils/match/deriveDissents';

// ── Copy (Ed's spec — keep tight, factual; no fancy wording) ───────────────
const TITLE = (gameNumber: number) => `Game ${gameNumber} — Conflict!`;
const RECORDED_LABEL = 'Recorded result:';
const NO_ACHIEVEMENTS = 'none';
const CALL_TO_ACTION =
  'Please verify all scoring details are correct. Vacate the score to make any corrections.';

export interface DissentFlagProps {
  /** 1-based game number for the heading. */
  gameNumber: number;
  /** The currently-recorded official result (from `match_games`). */
  recordedResult: ResultLike;
  /** Resolved display name for `recordedResult.winner_player_id`. */
  winnerPlayerName: string;
  /** Display names of confirmers whose vouch matches the recorded result. */
  agreeingConfirmerNames: string[];
  /** Display names of confirmers whose vouch differs from the recorded result. */
  disagreeingConfirmerNames: string[];
}

/** Compact "Break & Run, Golden Break" string of only the truthy flags. */
function formatExtras(r: ResultLike): string {
  const parts: string[] = [];
  if (r.break_and_run) parts.push('Break & Run');
  if (r.golden_break) parts.push('Golden Break');
  if (r.break_fouled) parts.push('Break Fouled');
  if (r.runout) parts.push('Runout');
  if (r.win_by_forfeit) parts.push('Forfeit');
  return parts.join(', ');
}

function disagreersLine(names: string[]): string {
  if (names.length === 0) return '';
  const verb = names.length === 1 ? 'disagrees' : 'disagree';
  return `${names.join(', ')} ${verb}.`;
}

export function DissentFlag({
  gameNumber,
  recordedResult,
  winnerPlayerName,
  agreeingConfirmerNames,
  disagreeingConfirmerNames,
}: DissentFlagProps) {
  const extras = formatExtras(recordedResult);
  const hasPoints =
    recordedResult.winner_value != null || recordedResult.loser_value != null;

  return (
    <Alert variant="warning">
      <AlertTitle>{TITLE(gameNumber)}</AlertTitle>
      <AlertDescription>
        <div>
          <p className="font-medium">{RECORDED_LABEL}</p>
          <p>Winner: {winnerPlayerName}</p>
          <p>Achievements: {extras || NO_ACHIEVEMENTS}</p>
          {hasPoints && (
            <p>
              Points: W {recordedResult.winner_value ?? '—'} / L{' '}
              {recordedResult.loser_value ?? '—'}
            </p>
          )}
        </div>
        <div className="mt-2">
          {agreeingConfirmerNames.length > 0 && (
            <p>{agreeingConfirmerNames.length} agree.</p>
          )}
          <p>{disagreersLine(disagreeingConfirmerNames)}</p>
        </div>
        <p className="mt-2">{CALL_TO_ACTION}</p>
      </AlertDescription>
    </Alert>
  );
}
