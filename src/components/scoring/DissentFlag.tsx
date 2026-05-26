/**
 * @fileoverview Team-visible dissent flag (many-eyes Layer-2 / Unit 5).
 *
 * A calm, persistent inline notice the dissenter's team sees when one of their
 * teammates vouched a different result for a game than what's currently
 * official. This is a CONVERSATION PROMPT, not an argument-solver — there are
 * no resolve/auto-revert buttons. Correction is the existing
 * vacate-and-rescore path. A single dissent never re-opens or un-officials a
 * game.
 *
 * Rendering policy lives in the consumer (`ScoreMatch`): it filters the
 * derived `GameDissent[]` to those whose dissenter's side matches the
 * viewer's side, then renders one `<DissentFlag />` per game.
 *
 * Visual: shadcn `Alert` with the project's `warning` variant — established
 * calm tone, dark-mode aware. The "deny" word in the brainstorm example is
 * intentionally avoided in the default copy (a dissent is a differing vouch,
 * not an active rejection); the exact wording is a UI-copy decision and easy
 * to swap from the constants below.
 */

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

// ── Copy (deferrable to Ed — UI-visible strings) ───────────────────────────
// These are the only user-facing strings in the flag. Swap to taste — the
// component shape is stable.
const TITLE_VERB = 'confirmed a different result';
const AGREE_PREFIX = 'Also confirmed by';
const CALL_TO_ACTION = 'Talk it over at the table; if needed, vacate and re-score.';

export interface DissentFlagProps {
  /** 1-based game number for the heading. */
  gameNumber: number;
  /** Display name of the person whose vouch differs from official. */
  dissenterName: string;
  /** Display names of confirmers who agreed with the official result. May be empty. */
  agreeingConfirmerNames: string[];
}

/**
 * One dissent flag for one game. Rendered inline above (or near) the games
 * list. Stateless and pure — keeps re-renders cheap when many games run.
 */
export function DissentFlag({
  gameNumber,
  dissenterName,
  agreeingConfirmerNames,
}: DissentFlagProps) {
  const agreeLine =
    agreeingConfirmerNames.length > 0
      ? `${AGREE_PREFIX} ${agreeingConfirmerNames.join(', ')}.`
      : null;

  return (
    <Alert variant="warning">
      <AlertTitle>
        Game {gameNumber} — {dissenterName} {TITLE_VERB}
      </AlertTitle>
      <AlertDescription>
        {agreeLine && <p>{agreeLine}</p>}
        <p>{CALL_TO_ACTION}</p>
      </AlertDescription>
    </Alert>
  );
}
