/**
 * @fileoverview PositionsStep — assign team schedule positions (shuffle or manual)
 *
 * Loads the season's teams on mount, seeds sequential positions (adding a BYE
 * row if the team count is odd), and lets the LO shuffle or edit position
 * numbers directly. The value is stored in form data for ReviewStep to pick up.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/supabaseClient';
import { assignRandomPositions } from '@/utils/scheduleGenerator';
import type { WizardStepProps } from '@/components/wizard';
import type { MatchupsWizardFormData, MatchupTeamPosition } from '../matchupsWizardTypes';

/**
 * Controlled position input with a local draft buffer.
 *
 * Why: the committed value in the parent must always be a valid
 * non-NaN number in [1..max]. But while the user is typing, the input
 * may briefly be empty or out of range. A fully-controlled input that
 * rejects invalid typing makes the field feel frozen — the user clears
 * it, but state won't let the visual clear, so the field appears stuck.
 *
 * So: the input holds its own string draft. We only commit the parsed
 * number upstream on blur or Enter. If the draft is invalid on commit,
 * we snap back to the last known good value.
 */
function PositionInput({
  value,
  max,
  disabled,
  onCommit,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  // Re-sync when the upstream value changes (e.g., after a swap from
  // editing another row, or after Shuffle).
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= max && parsed !== value) {
      onCommit(parsed);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <Input
      type="number"
      min={1}
      max={max}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      disabled={disabled}
      className="text-center font-mono"
    />
  );
}

export function PositionsStep({
  value,
  onChange,
  formData,
}: WizardStepProps<MatchupTeamPosition[] | undefined, MatchupsWizardFormData>) {
  const ctx = (formData as Record<string, unknown>)._flowContext as { seasonId?: string } | undefined;
  const seasonId = ctx?.seasonId;
  const [shuffling, setShuffling] = useState(false);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams', 'matchup-positions', seasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, team_name, home_venue_id')
        .eq('season_id', seasonId!)
        // Preserve the order the LO added captains during the Teams step,
        // regardless of any subsequent team-name renames.
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!seasonId,
  });

  // Seed positions from teams the first time (or if team count changed)
  useEffect(() => {
    if (teams.length === 0) return;
    if (value && value.filter((p) => p.id !== 'BYE').length === teams.length) return;
    const needsBye = teams.length % 2 !== 0;
    const seeded: MatchupTeamPosition[] = teams.map((t, i) => ({
      id: t.id,
      team_name: t.team_name,
      home_venue_id: t.home_venue_id,
      schedule_position: i + 1,
    }));
    if (needsBye) {
      seeded.push({ id: 'BYE', team_name: 'BYE', home_venue_id: null, schedule_position: teams.length + 1 });
    }
    onChange(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  const positions = value ?? [];

  const handleShuffle = async () => {
    setShuffling(true);
    await new Promise((r) => setTimeout(r, 500));
    onChange(assignRandomPositions(positions));
    setShuffling(false);
  };

  const handlePositionCommit = (teamId: string, newPos: number) => {
    // Defensive: PositionInput already validates, but double-check.
    if (!Number.isFinite(newPos) || newPos < 1 || newPos > positions.length) return;
    const updated = positions.map((p) => ({ ...p }));
    const idx = updated.findIndex((t) => t.id === teamId);
    if (idx === -1) return;
    const oldPos = updated[idx].schedule_position;
    const swapIdx = updated.findIndex((t) => t.schedule_position === newPos);
    if (swapIdx !== -1) updated[swapIdx].schedule_position = oldPos;
    updated[idx].schedule_position = newPos;
    onChange(updated.sort((a, b) => a.schedule_position - b.schedule_position));
  };

  if (!seasonId) return <p className="text-red-600">Missing season ID from flow context.</p>;
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading teams...</p>;
  if (teams.length < 2) return <p className="text-red-600">Need at least 2 teams to generate matchups.</p>;

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={handleShuffle} disabled={shuffling}>
        <Shuffle className={`h-4 w-4 mr-2 ${shuffling ? 'animate-spin' : ''}`} />
        {shuffling ? 'Shuffling...' : 'Shuffle Teams'}
      </Button>
      <div className="space-y-2">
        {positions.map((team) => (
          <div key={team.id} className="flex items-center gap-3 p-3 border rounded-lg">
            <div className="w-20">
              <Label className="text-xs text-muted-foreground">Position</Label>
              <PositionInput
                value={team.schedule_position}
                max={positions.length}
                disabled={team.id === 'BYE'}
                onCommit={(n) => handlePositionCommit(team.id, n)}
              />
            </div>
            <p className="flex-1 font-medium">
              {team.team_name}
              {team.id === 'BYE' && (
                <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                  Auto-added for odd team count
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
