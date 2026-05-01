/**
 * @fileoverview InactiveSlotsSection
 *
 * Lists bye/withdrawn team rows for a season and exposes a "Replace"
 * action per row so the operator can fill empty slots with a new active
 * team. The Replace action reuses the existing TeamEditorModal in
 * "replace mode" (see modal's replacingTeamId prop).
 *
 * Reference: docs/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md (Unit 2.6)
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/api/queryKeys';

export interface InactiveTeamSlot {
  id: string;
  team_name: string;
  status: 'bye' | 'withdrawn' | 'forfeited';
  withdrawn_at: string | null;
}

export interface InactiveSlotsSectionProps {
  seasonId: string;
  /** Called with the slot's team id when the LO clicks Replace. */
  onReplace: (slotTeamId: string) => void;
}

export const InactiveSlotsSection: React.FC<InactiveSlotsSectionProps> = ({
  seasonId,
  onReplace,
}) => {
  const [expanded, setExpanded] = useState(false);

  const { data: slots = [], isLoading } = useQuery({
    queryKey: [...queryKeys.teams.bySeason(seasonId), 'inactiveSlots'],
    queryFn: async (): Promise<InactiveTeamSlot[]> => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, team_name, status, withdrawn_at')
        .eq('season_id', seasonId)
        .in('status', ['bye', 'withdrawn'])
        .order('withdrawn_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as InactiveTeamSlot[];
    },
  });

  if (isLoading || slots.length === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-base font-semibold text-foreground">
          Inactive Slots ({slots.length})
        </h3>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground mb-2">
            BYE slots and withdrawn teams. Replace an inactive slot with a
            new team — its scheduled matches will transfer to the new team
            so they can play those weeks.
          </p>
          {slots.map(slot => (
            <div
              key={slot.id}
              className="flex items-center justify-between gap-3 p-2 border border-border rounded"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {slot.team_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: {slot.status}
                  {slot.withdrawn_at &&
                    ` · withdrawn ${new Date(slot.withdrawn_at).toLocaleDateString()}`}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReplace(slot.id)}
                loadingText="none"
              >
                Replace
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
