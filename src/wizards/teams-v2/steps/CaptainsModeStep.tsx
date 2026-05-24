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

  // Build the Keep snapshot. Two filters:
  //   1. Drop teams whose captain explicitly answered "not returning".
  //   2. Drop teams that have no resolvable captain ID at all (no swap
  //      submitted AND no current captain on the previous team). The
  //      save path would fail later trying to insert teams with empty
  //      captainId; better to filter here so the min-4 check at the
  //      bottom catches the shortfall and routes to the editor.
  // captainId resolution: nextCaptainId (submitted swap) → currentCaptainId
  // (previous season's captain when no swap) → drop.
  const keepCaptains: TeamCaptainEntry[] = reup
    .filter((r) => r.returningNextSeason !== false)
    .map((r) => {
      const captainId = r.nextCaptainId ?? r.currentCaptainId ?? null;
      if (!captainId) return null;
      return {
        captainId,
        captainName: r.captainName || '',
        teamName: r.teamName,
      } satisfies TeamCaptainEntry;
    })
    .filter((c): c is TeamCaptainEntry => c !== null);

  const keepSnapshot: ModeValue = {
    mode: 'keep',
    captains: keepCaptains,
  };

  // No mount auto-fill: the summary should only reflect the operator's
  // active choices. The Keep button writes the snapshot.

  const handleKeep = () => {
    // A season can't run with fewer than MIN_TEAMS — if the captains
    // who confirmed they're returning don't clear that floor, Keep
    // can't actually keep us going. Divert to the editor (with all
    // prior teams pre-filled by re-up status) so the operator can
    // add or recover teams before continuing.
    const returningCount = keepSnapshot.captains?.length ?? 0;
    if (returningCount < MIN_TEAMS) {
      toast.warning(
        `Only ${returningCount} captain${returningCount === 1 ? '' : 's'} confirmed returning. A season needs at least ${MIN_TEAMS} teams — let's edit the lineup.`,
      );
      onChange({ mode: 'change' });
      onNext();
      return;
    }
    onChange(keepSnapshot);
    onNext();
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
                  <strong>✅</strong> — Captain confirmed team is returning.
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
            {reup.map((r) => (
              <li
                key={r.sourceTeamId}
                className="flex items-center justify-between gap-3 text-sm border-b border-border py-2"
              >
                <span className="font-medium text-foreground">{r.teamName}</span>
                <span className="text-muted-foreground flex-1 ml-2">
                  {r.captainName || <em>no captain assigned</em>}
                </span>
                <span aria-hidden className="text-base">
                  {r.returningNextSeason === true ? (
                    <span>✅</span>
                  ) : r.returningNextSeason === false ? (
                    <span>🚫</span>
                  ) : (
                    <span>❓</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-muted-foreground mt-3">
          Use the same teams this season?
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleKeep} loadingText="none">
          Keep — same teams
        </Button>
        <Button variant="outline" onClick={handleChange} loadingText="none">
          Change teams →
        </Button>
      </div>
    </div>
  );
}
