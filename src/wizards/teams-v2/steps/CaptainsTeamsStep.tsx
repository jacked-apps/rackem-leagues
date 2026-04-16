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
import { InfoButton } from '@/components/InfoButton';
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
      <div className="flex items-center gap-1">
        <p className="font-medium text-gray-900">Team Captains</p>
        <InfoButton title="Captains & Teams" size="sm">
          <div className="space-y-2">
            <p>Each captain creates a team. Count of captains = count of teams.</p>
            <p><strong>Captains can:</strong> rename team, add/remove roster players.</p>
            <p><strong>Only LOs can:</strong> change who the captain is.</p>
            <p>To build full rosters now, use the Team Management page after the wizard.</p>
          </div>
        </InfoButton>
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
            <div key={captain.captainId} className="flex items-center gap-2 p-3 border rounded-lg">
              <Input
                value={captain.teamName}
                onChange={(e) => updateTeamName(i, e.target.value)}
                className="flex-1"
              />
              <span className="text-sm text-gray-600 whitespace-nowrap">
                Captain: {captain.captainName}
              </span>
              <Button variant="ghost" onClick={() => removeCaptain(i)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-500">
        {captains.length === 0 ? 'Add at least 2 captains to create teams.' :
          `${captains.length} team${captains.length === 1 ? '' : 's'} ready.`}
      </p>
    </div>
  );
}
