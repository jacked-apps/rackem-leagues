/**
 * @fileoverview CaptainsTeamsStep — pick captains, auto-create teams
 *
 * Each captain creates a team (default "Team N", editable by LO).
 * MemberCombobox with placeholder creation for unregistered captains.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MemberCombobox } from '@/components/MemberCombobox';
import { getAllMembers } from '@/api/queries/members';
import type { WizardStepProps } from '@/components/wizard';
import type { TeamsWizardFormData, TeamCaptainEntry } from '../teamsWizardTypes';

export function CaptainsTeamsStep({
  value,
  onChange,
}: WizardStepProps<TeamCaptainEntry[] | undefined, TeamsWizardFormData>) {
  const captains = value ?? [];
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const { data: allMembers = [] } = useQuery({
    queryKey: ['all-members'],
    queryFn: () => getAllMembers(),
  });

  const excludeIds = captains.map((c) => c.captainId);

  const addCaptain = (memberId: string) => {
    const member = allMembers.find((m) => m.id === memberId);
    if (!member) return;
    const captainName = `${member.first_name} ${member.last_name}`;
    const teamNumber = captains.length + 1;
    onChange([
      ...captains,
      { captainId: memberId, captainName, teamName: `Team ${teamNumber}` },
    ]);
    setSelectedMemberId('');
  };

  const removeCaptain = (i: number) => onChange(captains.filter((_, idx) => idx !== i));

  const updateTeamName = (i: number, name: string) =>
    onChange(captains.map((c, idx) => (idx === i ? { ...c, teamName: name } : c)));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 space-y-1">
        <p>
          Each captain here creates a team. Count of captains = count of teams.
        </p>
        <p>
          <strong>Captains can</strong> rename their team and add/remove roster
          players themselves, anytime.
        </p>
        <p>
          <strong>You (the operator) can</strong> do everything a captain can
          from the Team Management page. Finish this wizard first, then head
          to Team Management to flesh out each team's roster.
        </p>
        <p>
          <strong>Only operators can</strong> change who the captain of a team is.
        </p>
      </div>

      <div className="flex items-center gap-1">
        <p className="font-medium text-gray-900">Team Captains</p>
      </div>

      <MemberCombobox
        members={allMembers}
        value={selectedMemberId}
        onValueChange={(id) => { if (id) addCaptain(id); }}
        placeholder="Search for a registered player..."
        excludeIds={excludeIds}
        allowCreatePlaceholder={true}
      />

      {captains.length > 0 && (
        <div className="space-y-2">
          {captains.map((captain, i) => (
            <div key={captain.captainId} className="p-3 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                {editingIndex === i ? (
                  <>
                    <Input
                      value={captain.teamName}
                      onChange={(e) => updateTeamName(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setEditingIndex(null); }}
                      autoFocus
                      className="flex-1"
                    />
                    <Button variant="outline" onClick={() => setEditingIndex(null)}>
                      Done
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{captain.teamName}</span>
                    <Button variant="ghost" onClick={() => setEditingIndex(i)}>
                      Rename
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-600">
                  Captain: {captain.captainName}
                </span>
                <Button variant="ghost" onClick={() => removeCaptain(i)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-500">
        {captains.length === 0 ? 'Add at least 2 captains to create teams.' :
          `${captains.length} team${captains.length === 1 ? '' : 's'} ready.`}
      </p>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <strong>Add every team before continuing.</strong>{' '}
        After the next step the schedule is generated from these teams —
        adding more teams later means resetting and regenerating matchups
        (unless a new team fills a BYE slot for odd counts).
      </div>
    </div>
  );
}
