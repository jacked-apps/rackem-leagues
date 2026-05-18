/**
 * @fileoverview Multi-step wizard shell for "Start Next Season".
 *
 * Owns the cross-step form state (dates / teams / venues) and the
 * step-to-step navigation. Step components live alongside this file
 * and are mounted one at a time. Schedule + Matchups steps reuse
 * the existing first-time-league components (mounted in later units).
 *
 * State shape mirrors the prefill structure with overrides applied
 * as the operator progresses through each step. On final activation,
 * we serialize this state into the create_season_from_previous RPC
 * call (Unit 6).
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NewSeasonPrefill } from '@/api/queries/newSeasonPrefill';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { NewSeasonDatesStep } from './NewSeasonDatesStep';
import { NewSeasonTeamsStep, type TeamDecision } from './NewSeasonTeamsStep';
import { NewSeasonVenuesStep, type VenueDecision } from './NewSeasonVenuesStep';
import { useCreateSeasonFromPrevious } from '@/api/hooks/useCreateSeasonFromPrevious';
import {
  formatLocalDate,
  parseLocalDate,
} from '@/utils/formatters';

export interface NewSeasonWizardState {
  startDate: string; // ISO yyyy-mm-dd
  weekCount: number;
  seasonName: string; // derived but editable
  teams: TeamDecision[];
  venues: VenueDecision[];
}

interface NewSeasonWizardProps {
  prefill: NewSeasonPrefill;
}

const STEP_LABELS = ['Dates', 'Teams', 'Venues', 'Review'];

export function NewSeasonWizard({ prefill }: NewSeasonWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<NewSeasonWizardState>(() =>
    buildInitialState(prefill),
  );

  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEP_LABELS.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-between text-sm">
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={
              i === stepIndex
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground'
            }
          >
            {i + 1}. {label}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEP_LABELS[stepIndex]}</CardTitle>
        </CardHeader>
        <CardContent>
          {stepIndex === 0 && (
            <NewSeasonDatesStep
              prefill={prefill}
              value={state}
              onChange={(patch) => setState((s) => ({ ...s, ...patch }))}
            />
          )}
          {stepIndex === 1 && (
            <NewSeasonTeamsStep
              prefill={prefill}
              teams={state.teams}
              onChange={(teams) => setState((s) => ({ ...s, teams }))}
            />
          )}
          {stepIndex === 2 && (
            <NewSeasonVenuesStep
              prefill={prefill}
              venues={state.venues}
              onChange={(venues) => setState((s) => ({ ...s, venues }))}
            />
          )}
          {stepIndex === 3 && (
            <NewSeasonReviewStep prefill={prefill} state={state} />
          )}
        </CardContent>
      </Card>

      {/* Nav */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          loadingText="none"
          onClick={goBack}
          disabled={stepIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        {stepIndex < STEP_LABELS.length - 1 ? (
          <Button
            loadingText="none"
            onClick={goNext}
            disabled={!canAdvance(stepIndex, state)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          // Final step's activate button is rendered inside the
          // review step itself so it can manage its own loading state.
          null
        )}
      </div>
    </div>
  );
}

/**
 * Build the initial wizard state from the prefill snapshot.
 * - startDate: same day-of-week as previous end_date, but one week
 *   later (so a Monday-ending season rolls into the next Monday)
 * - weekCount: previous season's length
 * - seasonName: derived in the Dates step from startDate
 * - teams: all returning teams checked, captain auto-selected when
 *   the previous captain is still available
 * - venues: all previous-season venues checked
 */
function buildInitialState(prefill: NewSeasonPrefill): NewSeasonWizardState {
  const prevEnd = new Date(prefill.previousSeason.end_date);
  const nextStart = new Date(prevEnd.getTime());
  nextStart.setDate(nextStart.getDate() + 7);
  const startDate = nextStart.toISOString().slice(0, 10);

  const teams: TeamDecision[] = prefill.returningTeams.map((t) => ({
    sourceTeamId: t.id,
    included: true,
    captainId: t.captain_id, // operator must pick if null
    teamName: t.team_name,
    homeVenueId: t.home_venue_id,
  }));

  const venues: VenueDecision[] = prefill.leagueVenues.map((v) => ({
    venueId: v.venue_id,
    included: true,
  }));

  return {
    startDate,
    weekCount: prefill.previousSeason.season_length,
    seasonName: '', // filled by Dates step via deriveDateFields
    teams,
    venues,
  };
}

/**
 * Per-step gate. Used to disable the Next button when the current
 * step's required fields aren't satisfied.
 */
function canAdvance(stepIndex: number, state: NewSeasonWizardState): boolean {
  switch (stepIndex) {
    case 0: // Dates
      return !!state.startDate && state.weekCount > 0 && !!state.seasonName;
    case 1: // Teams — at least one team checked AND every checked team has captain
      return (
        state.teams.some((t) => t.included) &&
        state.teams.every((t) => !t.included || !!t.captainId)
      );
    case 2: // Venues — at least one checked
      return state.venues.some((v) => v.included);
    default:
      return true;
  }
}

/**
 * Final wizard step — summary of what will be created + the Activate
 * button. Fires the create_season_from_previous RPC and navigates
 * to the new season on success.
 */
function NewSeasonReviewStep({
  prefill,
  state,
}: {
  prefill: NewSeasonPrefill;
  state: NewSeasonWizardState;
}) {
  const navigate = useNavigate();
  const createMutation = useCreateSeasonFromPrevious();

  const includedTeams = useMemo(
    () => state.teams.filter((t) => t.included),
    [state.teams],
  );
  const includedVenues = useMemo(
    () => state.venues.filter((v) => v.included),
    [state.venues],
  );
  const droppedTeamCount = state.teams.length - includedTeams.length;

  // End date derived from start + week count, same logic as the
  // Dates step (no need to share — cheap).
  const endDate = useMemo(() => {
    if (!state.startDate || !state.weekCount) return '';
    const start = parseLocalDate(state.startDate);
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + state.weekCount * 7 - 1);
    return formatLocalDate(end);
  }, [state.startDate, state.weekCount]);

  const handleActivate = async () => {
    try {
      const result = await createMutation.mutateAsync({
        leagueId: prefill.league.id,
        previousSeasonId: prefill.previousSeason.id,
        seasonName: state.seasonName,
        startDate: state.startDate,
        endDate,
        seasonLength: state.weekCount,
        teams: includedTeams.map((t) => ({
          source_team_id: t.sourceTeamId,
          captain_id: t.captainId!, // gate above ensures non-null
          team_name: t.teamName,
          home_venue_id: t.homeVenueId,
        })),
        venueIds: includedVenues.map((v) => v.venueId),
      });

      toast.success(
        `Season "${state.seasonName}" created — ${result.teams_created} team${
          result.teams_created === 1 ? '' : 's'
        }, ${result.players_carried} player${
          result.players_carried === 1 ? '' : 's'
        } carried forward.`,
      );

      // Navigate back to the league page — operator can review the
      // new upcoming season and activate it via the existing flow.
      navigate(`/league/${prefill.league.id}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to create season: ${msg}`);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Review the changes below, then activate the new season. The
        new season will be created as <strong>upcoming</strong> — you
        can adjust details further from the league page or move
        straight to scheduling.
      </p>

      <div className="grid gap-3 text-sm">
        <ReviewRow label="Season name" value={state.seasonName} />
        <ReviewRow label="Start date" value={state.startDate} />
        <ReviewRow label="End date" value={endDate} />
        <ReviewRow label="Week count" value={String(state.weekCount)} />
        <ReviewRow
          label="Teams"
          value={`${includedTeams.length} returning${
            droppedTeamCount > 0
              ? ` (${droppedTeamCount} dropped)`
              : ''
          }`}
        />
        <ReviewRow
          label="Venues"
          value={`${includedVenues.length} carrying forward`}
        />
      </div>

      <div className="flex justify-end">
        <Button
          loadingText="Creating..."
          isLoading={createMutation.isPending}
          onClick={handleActivate}
          size="lg"
        >
          Create Season
        </Button>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
