/**
 * @fileoverview CaptainsModeStep — "Same teams?" gate (next-season only).
 *
 * Same shape as the other Keep/Change gates:
 *   Keep   → snapshot the previous-season team list from reupResponses
 *            + auto-advance; CaptainsTeamsStep hidden via showIf.
 *   Change → mode='change' + auto-advance; CaptainsTeamsStep renders
 *            so the LO can add/remove/rename teams.
 *
 * For first-season flows the step's `showIf` hides it (no previous
 * teams to confirm) so the original CaptainsTeamsStep runs alone.
 *
 * Note: the snapshot pre-fills team NAMES from the previous season,
 * but captain IDs need to be resolved against the re-up data — that
 * resolution happens at save time in useSaveTeamsV2.
 */

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InfoButton } from '@/components/InfoButton';
import type { WizardStepProps } from '@/components/wizard';
import type { TeamsWizardFormData, TeamCaptainEntry } from '../teamsWizardTypes';

const MIN_TEAMS = 4;

type ModeValue = NonNullable<TeamsWizardFormData['captains-mode']>;

interface ReupEntry {
  sourceTeamId: string;
  teamName: string;
  captainName: string;
  currentCaptainId: string | null;
  returningNextSeason: boolean | null;
  nextCaptainId: string | null;
  nextCaptainName: string | null;
}

interface FlowContextShape {
  reupResponses?: ReupEntry[];
}

export function CaptainsModeStep({
  onChange,
  onNext,
  formData,
}: WizardStepProps<ModeValue | undefined, TeamsWizardFormData>) {
  const flowContext = (formData as Record<string, unknown>)._flowContext as
    | FlowContextShape
    | undefined;

  const reup = flowContext?.reupResponses ?? [];

  // Two distinct snapshots — the operator picks WHICH semantic they
  // want via the buttons below:
  //
  //   ignoreReupSnapshot — pure roll-forward: every prior team comes
  //     back with its ORIGINAL captain (currentCaptainId), even if
  //     the captain said they're not returning or asked for a swap.
  //     "Pretend the re-up never happened."
  //
  //   applyReupSnapshot — honor what captains submitted: drop
  //     not-returning teams, use nextCaptainId for swaps. The
  //     "trust the re-up data" path.
  //
  // When the re-up data has no swaps and no not-returning answers the
  // two snapshots are identical, and the UI collapses to a single
  // "Keep — same teams" button.

  const ignoreReupCaptains: TeamCaptainEntry[] = reup
    .map((r) => {
      const captainId = r.currentCaptainId ?? null;
      if (!captainId) return null;
      return {
        captainId,
        captainName: r.captainName || '',
        teamName: r.teamName,
      } satisfies TeamCaptainEntry;
    })
    .filter((c): c is TeamCaptainEntry => c !== null);

  const applyReupCaptains: TeamCaptainEntry[] = reup
    .filter((r) => r.returningNextSeason !== false)
    .map((r) => {
      const captainId = r.nextCaptainId ?? r.currentCaptainId ?? null;
      if (!captainId) return null;
      // Use the NEW captain's name when a swap was submitted; else the
      // old captain. Keeps the snapshot's name field aligned with the
      // captainId it carries — prevents log/UI confusion later.
      const captainName = r.nextCaptainId
        ? r.nextCaptainName || ''
        : r.captainName || '';
      return {
        captainId,
        captainName,
        teamName: r.teamName,
      } satisfies TeamCaptainEntry;
    })
    .filter((c): c is TeamCaptainEntry => c !== null);

  // Whether the two snapshots differ — drives the 2-vs-3 button UI.
  // No swaps AND no not-returning answers means "Apply" and "Ignore"
  // produce identical outputs; only one button is meaningful.
  const hasReupChanges =
    reup.some((r) => r.returningNextSeason === false) ||
    reup.some((r) => !!r.nextCaptainId);

  const advanceWith = (snapshot: ModeValue) => {
    const count = snapshot.captains?.length ?? 0;
    if (count < MIN_TEAMS) {
      toast.warning(
        `Only ${count} team${count === 1 ? '' : 's'} would carry forward. A season needs at least ${MIN_TEAMS} — let's edit the lineup.`,
      );
      onChange({ mode: 'change' });
      onNext();
      return;
    }
    onChange(snapshot);
    onNext();
  };

  // Single Keep — only used in the "no re-up changes" 2-button mode.
  const handleKeep = () => {
    advanceWith({ mode: 'keep', captains: applyReupCaptains });
  };

  const handleKeepIgnoreReup = () => {
    advanceWith({ mode: 'keep', captains: ignoreReupCaptains });
  };

  const handleApplyReup = () => {
    advanceWith({ mode: 'keep', captains: applyReupCaptains });
  };

  const handleChange = () => {
    onChange({ mode: 'change' });
    onNext();
  };

  // Show ALL teams (returning + unanswered), not just returningTeams,
  // so the operator can see every captain's status side-by-side and
  // make a better-informed Keep/Change decision.
  const totalCount = reup.length;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <Label className="text-base">Teams</Label>
        <p className="text-foreground mt-1">
          You had <strong>{totalCount} team{totalCount === 1 ? '' : 's'}</strong>{' '}
          last season:
        </p>

        <div className="mt-3">
          {/* Column header — mirrors each row's flex layout so the
              three columns (team / captain / response) line up under
              their titles. */}
          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground border-b-2 border-border py-2">
            <span>Team Name</span>
            <span className="flex-1 ml-2">Captain</span>
            <span className="flex items-center gap-1">
              Response
              <InfoButton title="Response Icons" size="sm">
                <p>
                  <strong>✅</strong> — Captain confirmed team is returning (same captain).
                </p>
                <p className="mt-2">
                  <strong>🔄</strong> — Returning, but with a <strong>new captain</strong>.
                </p>
                <p className="mt-2">
                  <strong>🚫</strong> — Captain <strong>NOT</strong> returning next season.
                </p>
                <p className="mt-2">
                  <strong>❓</strong> — No response yet.
                </p>
              </InfoButton>
            </span>
          </div>

          <ul className="space-y-1">
            {reup.map((r) => {
              const isNotReturning = r.returningNextSeason === false;
              const isSwap =
                r.returningNextSeason === true && !!r.nextCaptainId;
              return (
                // Responsive row: mobile stacks the team name on top
                // with captain + icon on a second line; desktop puts
                // everything on a single line. Smaller font on mobile
                // so a single row fits comfortably even at narrow
                // viewport widths.
                <li
                  key={r.sourceTeamId}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-3 text-xs sm:text-sm border-b py-2 px-2 ${
                    isNotReturning
                      ? 'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800'
                      : isSwap
                      ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800'
                      : 'border-border'
                  }`}
                >
                  <span
                    className={`font-medium ${
                      isNotReturning
                        ? 'text-red-900 dark:text-red-200'
                        : isSwap
                        ? 'text-blue-900 dark:text-blue-200'
                        : 'text-foreground'
                    }`}
                  >
                    {r.teamName}
                  </span>
                  {/* Captain + icon share a row on mobile (so they
                      hug the bottom of the card together), and merge
                      back into the single-line layout on sm:+ */}
                  <div className="flex items-center justify-between gap-2 sm:flex-1 sm:ml-2">
                    <span
                      className={`${
                        isNotReturning
                          ? 'text-red-800 dark:text-red-300'
                          : isSwap
                          ? 'text-blue-800 dark:text-blue-300'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {isSwap ? (
                        <>
                          <span className="line-through opacity-70">
                            {r.captainName}
                          </span>
                          {' → '}
                          <strong>{r.nextCaptainName || 'new captain'}</strong>
                        </>
                      ) : (
                        r.captainName || <em>no captain assigned</em>
                      )}
                    </span>
                    <span aria-hidden className="text-base flex-shrink-0">
                      {isSwap ? (
                        <span>🔄</span>
                      ) : r.returningNextSeason === true ? (
                        <span>✅</span>
                      ) : isNotReturning ? (
                        <span>🚫</span>
                      ) : (
                        <span>❓</span>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-sm text-muted-foreground mt-3">
          {hasReupChanges
            ? 'Captains made changes via the re-up sheet. How do you want to handle them?'
            : 'Use the same teams this season?'}
        </p>
      </div>

      {hasReupChanges ? (
        // 3-button mode: the re-up data shows actual changes (swaps or
        // not-returning), so the operator picks how to handle them.
        <div className="flex flex-col gap-3">
          <Button onClick={handleKeepIgnoreReup} loadingText="none" className="justify-start">
            Keep all teams (ignore re-up)
          </Button>
          <Button onClick={handleApplyReup} loadingText="none" className="justify-start">
            Update with re-up changes
          </Button>
          <Button variant="outline" onClick={handleChange} loadingText="none" className="justify-start">
            Edit teams manually →
          </Button>
        </div>
      ) : (
        // 2-button mode: no swaps + no not-returning means both Keep
        // semantics produce the same output. Simpler UI.
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleKeep} loadingText="none">
            Keep — same teams
          </Button>
          <Button variant="outline" onClick={handleChange} loadingText="none">
            Change teams →
          </Button>
        </div>
      )}
    </div>
  );
}
