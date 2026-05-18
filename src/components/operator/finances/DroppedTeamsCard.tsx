/**
 * @fileoverview DroppedTeamsCard — LO marks teams that quit mid-season.
 *
 * Reduces the projected income formula by (price × lineup × lost_weeks)
 * for each dropped team. Per Ed: forfeits are the team's problem
 * (still owes per the formula); drops are the app's problem (no more
 * income from them, drops out of prize hunt).
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserX, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSeasonFinanceEntries, useAddFinanceEntry, useDeleteFinanceEntry } from '@/api/hooks/useSeasonFinanceEntries';
import { supabase } from '@/supabaseClient';
import { useQuery } from '@tanstack/react-query';

interface DroppedTeamsCardProps {
  seasonId: string;
  totalWeeks: number;
}

interface MinimalTeam {
  id: string;
  team_name: string;
}

export function DroppedTeamsCard({ seasonId, totalWeeks }: DroppedTeamsCardProps) {
  const { data: entries = [] } = useSeasonFinanceEntries(seasonId);
  const addEntry = useAddFinanceEntry();
  const deleteEntry = useDeleteFinanceEntry();

  // Fetch active teams for the picker
  const { data: teams = [] } = useQuery<MinimalTeam[]>({
    queryKey: ['seasonActiveTeams', seasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, team_name')
        .eq('season_id', seasonId)
        .eq('status', 'active')
        .order('team_name');
      if (error) throw error;
      return (data ?? []) as MinimalTeam[];
    },
    enabled: !!seasonId,
  });

  const droppedEntries = entries.filter((e) => e.entry_type === 'dropped_team');
  const droppedTeamIds = new Set(droppedEntries.map((e) => e.dropped_team_id));
  const availableTeams = teams.filter((t) => !droppedTeamIds.has(t.id));

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [dropWeek, setDropWeek] = useState('');

  const handleAdd = async () => {
    if (!selectedTeamId) {
      toast.error('Pick a team');
      return;
    }
    const week = parseInt(dropWeek, 10);
    if (!isFinite(week) || week < 1 || week > totalWeeks) {
      toast.error(`Week must be between 1 and ${totalWeeks}`);
      return;
    }
    const team = teams.find((t) => t.id === selectedTeamId);
    try {
      await addEntry.mutateAsync({
        seasonId,
        entryType: 'dropped_team',
        description: `${team?.team_name ?? 'Team'} dropped at week ${week}`,
        droppedTeamId: selectedTeamId,
        droppedAtWeek: week,
      });
      toast.success(`${team?.team_name ?? 'Team'} marked as dropped at week ${week}`);
      setSelectedTeamId('');
      setDropWeek('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add');
    }
  };

  const handleRemove = async (entryId: string) => {
    try {
      await deleteEntry.mutateAsync({ entryId, seasonId });
      toast.success('Drop removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserX className="h-5 w-5 text-yellow-600" />
          Teams that dropped mid-season
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {droppedEntries.length} dropped
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Mark teams that quit during the season. Calculator subtracts their
          lost weeks from the projected income. (Forfeits don't count — those
          teams still owed for the night per the formula.)
        </p>

        {/* Add form */}
        {availableTeams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label htmlFor="drop-team">Team</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger id="drop-team">
                  <SelectValue placeholder="Pick a team..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.team_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="drop-week">Dropped at week</Label>
              <Input
                id="drop-week"
                type="number"
                step="1"
                min="1"
                max={totalWeeks}
                value={dropWeek}
                onChange={(e) => setDropWeek(e.target.value)}
                placeholder={`1-${totalWeeks}`}
              />
            </div>
            <Button
              loadingText="Adding..."
              isLoading={addEntry.isPending}
              onClick={handleAdd}
              disabled={!selectedTeamId || !dropWeek}
            >
              Mark dropped
            </Button>
          </div>
        )}

        {/* Existing drops list */}
        {droppedEntries.length > 0 && (
          <div className="border-t pt-3 space-y-1">
            {droppedEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 py-2 px-2 rounded hover:bg-muted/50 text-sm"
              >
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                  <span>{entry.description}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  loadingText="none"
                  onClick={() => handleRemove(entry.id)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {availableTeams.length === 0 && droppedEntries.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No teams in this season yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
