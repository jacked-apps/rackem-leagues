/**
 * @fileoverview Setup phase of the LO manual-scoring page.
 *
 * One operator enters BOTH lineups (mirroring the live lineup UI, two columns —
 * stacked on narrow viewports), can override any handicap, then clicks
 * "Setup Match" which persists + locks both lineups and creates the games
 * (`loSaveLineups` → `loSetupMatch`). Pre-fills handicaps from the same source
 * the live lineup page uses; the LO is authoritative so any value is editable.
 *
 * @see docs/plans/2026-06-03-001-feat-lo-manual-match-scoring-plan.md — Unit 5
 */

import { useMemo, useState } from 'react';
import { useTeamDetails } from '@/api/hooks';
import { usePlayerHandicaps } from '@/api/hooks/usePlayerHandicaps';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayerSelectionRow } from '@/components/lineup/PlayerSelectionRow';
import { computeLineupCompleteness } from '@/utils/lineup';
import { loSaveLineups, loSetupMatch } from '@/api/mutations/loManualScoring';
import type { SystemOverrides } from '@/types/systemOverrides';
import {
  toLineupRow,
  toLineupPlayers,
  type SideLineup,
} from './lineupTransforms';

export interface SetupPhaseProps {
  matchId: string;
  leagueId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  lineupSize: number;
  handicapType: string;
  handicapVariant: 'standard' | 'reduced' | 'none';
  gameType: string;
  winCondition?: 'games' | 'points';
  mechanism?: 'extra_games' | 'start_points' | 'race_length_adjustment' | 'none';
  gameGeneration?: string;
  systemOverrides?: SystemOverrides;
  /** Called after a successful Setup Match (host re-fetches → Entry phase). */
  onSetupComplete: () => void;
}

interface RosterPlayer {
  id: string;
  name: string;
}

/** One team's lineup column. */
function LineupColumn({
  teamName,
  roster,
  handicaps,
  side,
  setSide,
  lineupSize,
  handicapType,
}: {
  teamName: string;
  roster: RosterPlayer[];
  handicaps: Map<string, { value: number | null }>;
  side: SideLineup;
  setSide: React.Dispatch<React.SetStateAction<SideLineup>>;
  lineupSize: number;
  handicapType: string;
}) {
  const rosterIds = roster.map((p) => p.id);
  const nameById = useMemo(() => new Map(roster.map((p) => [p.id, p.name])), [roster]);

  const selectPlayer = (position: number, playerId: string) => {
    const prefill = handicaps.get(playerId)?.value ?? 0;
    setSide((prev) => ({ ...prev, [position]: { playerId, handicap: String(prefill) } }));
  };
  const clearPlayer = (position: number) => {
    setSide((prev) => {
      const next = { ...prev };
      delete next[position];
      return next;
    });
  };
  const changeHandicap = (position: number, value: string) => {
    setSide((prev) => ({
      ...prev,
      [position]: { playerId: prev[position]?.playerId ?? '', handicap: value },
    }));
  };

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-base">{teamName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: lineupSize }, (_, i) => i + 1).map((position) => {
          const otherPlayerIds = Object.entries(side)
            .filter(([p]) => Number(p) !== position)
            .map(([, v]) => v.playerId)
            .filter(Boolean);
          return (
            <PlayerSelectionRow
              key={position}
              position={position}
              playerId={side[position]?.playerId ?? ''}
              handicap={Number(side[position]?.handicap ?? 0)}
              locked={false}
              handicapType={handicapType}
              availablePlayerIds={rosterIds}
              otherPlayerIds={otherPlayerIds}
              getPlayerDisplayName={(id) => nameById.get(id) ?? id}
              onPlayerChange={selectPlayer}
              onClearPlayer={clearPlayer}
              isSubstitute={false}
              manualHandicapValue={side[position]?.handicap ?? ''}
              onManualHandicapChange={changeHandicap}
              editableOverride
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

export function SetupPhase(props: SetupPhaseProps) {
  const {
    matchId,
    leagueId,
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    lineupSize,
    handicapType,
    handicapVariant,
    gameType,
    winCondition,
    mechanism,
    gameGeneration,
    systemOverrides,
    onSetupComplete,
  } = props;

  const [home, setHome] = useState<SideLineup>({});
  const [away, setAway] = useState<SideLineup>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const homeTeam = useTeamDetails(homeTeamId);
  const awayTeam = useTeamDetails(awayTeamId);

  const homeRoster = useRoster(homeTeam.data);
  const awayRoster = useRoster(awayTeam.data);

  const gt = gameType as 'eight_ball' | 'nine_ball' | 'ten_ball';
  const { handicaps: homeHandicaps } = usePlayerHandicaps({
    playerIds: homeRoster.map((p) => p.id),
    handicapType,
    handicapVariant,
    gameType: gt,
    leagueId,
    matchId,
  });
  const { handicaps: awayHandicaps } = usePlayerHandicaps({
    playerIds: awayRoster.map((p) => p.id),
    handicapType,
    handicapVariant,
    gameType: gt,
    leagueId,
    matchId,
  });

  const homeComplete = computeLineupCompleteness(toLineupRow(home, lineupSize), lineupSize).complete;
  const awayComplete = computeLineupCompleteness(toLineupRow(away, lineupSize), lineupSize).complete;
  const canSetup = homeComplete && awayComplete && !submitting;

  const handleSetup = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await loSaveLineups({
        matchId,
        homeTeamId,
        awayTeamId,
        homePlayers: toLineupPlayers(home, lineupSize),
        awayPlayers: toLineupPlayers(away, lineupSize),
      });
      await loSetupMatch({
        matchId,
        leagueId,
        lineupSize,
        handicapType,
        winCondition,
        mechanism,
        gameGeneration,
        systemOverrides,
        gameType,
      });
      onSetupComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-4 lg:flex-row">
        <LineupColumn
          teamName={homeTeamName}
          roster={homeRoster}
          handicaps={homeHandicaps}
          side={home}
          setSide={setHome}
          lineupSize={lineupSize}
          handicapType={handicapType}
        />
        <LineupColumn
          teamName={awayTeamName}
          roster={awayRoster}
          handicaps={awayHandicaps}
          side={away}
          setSide={setAway}
          lineupSize={lineupSize}
          handicapType={handicapType}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleSetup}
        disabled={!canSetup}
        isLoading={submitting}
        loadingText="Setting up…"
        size="lg"
        className="w-full"
      >
        {canSetup ? 'Setup Match' : 'Fill both lineups to set up the match'}
      </Button>
    </div>
  );
}

/** Map a team-details payload to a flat roster of {id, name}. */
function useRoster(teamData: unknown): RosterPlayer[] {
  return useMemo(() => {
    const players = (teamData as { team_players?: Array<{ members?: { id: string; nickname: string | null; first_name: string; last_name: string } }> } | undefined)?.team_players;
    if (!players) return [];
    return players
      .map((tp) => tp.members)
      .filter((m): m is NonNullable<typeof m> => !!m)
      .map((m) => ({ id: m.id, name: m.nickname || `${m.first_name} ${m.last_name}`.trim() }));
  }, [teamData]);
}
