/**
 * @fileoverview CaptainsTeamsStep — pick captains, auto-create teams
 *
 * Each captain creates a team (default "Team N", editable by LO).
 * MemberCombobox with placeholder creation for unregistered captains.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MemberCombobox } from '@/components/MemberCombobox';
import { getAllMembers } from '@/api/queries/members';
import { queryKeys } from '@/api/queryKeys';
import { useCurrentMember } from '@/api/hooks';
import type { PartialMember } from '@/types/member';
import type { WizardStepProps, FlowContext } from '@/components/wizard';
import type { TeamsWizardFormData, TeamCaptainEntry } from '../teamsWizardTypes';

export function CaptainsTeamsStep({
  value,
  onChange,
  formData,
}: WizardStepProps<TeamCaptainEntry[] | undefined, TeamsWizardFormData>) {
  const captains = value ?? [];
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newPlaceholders, setNewPlaceholders] = useState<PartialMember[]>([]);

  // Tracks IDs added via handlePlaceholderCreated so the follow-up
  // onValueChange from MemberCombobox (which fires in the same sync tick
  // and would re-enter addCaptain with stale state) is a no-op.
  const justAddedIdsRef = useRef<Set<string>>(new Set());

  // Flow context is injected into formData._flowContext by
  // WizardFlowStageRenderer. Tells us which org we're scoped to (works
  // for both the first-time route `/create-league/:orgId` AND the
  // next-season route `/operator/start-next-season/:leagueId` which
  // has no orgId in the URL) AND carries any re-up responses to
  // pre-fill the captain list with.
  const flowContext = (formData as Record<string, unknown> | undefined)?.['_flowContext'] as FlowContext | undefined;

  // Resolve the org for the member-picker scope. Fallback chain:
  //   1. flow context (set explicitly by the page mounting the wizard)
  //   2. URL params (works on `/create-league/:orgId`)
  //   3. currentMember.organization_id (only populated for placeholders;
  //      registered LOs reach orgs via organization_staff and have
  //      organization_id = NULL — so this is a weak last-resort)
  const { orgId: routeOrgId } = useParams<{ orgId: string }>();
  const { data: currentMember } = useCurrentMember();
  const orgId =
    flowContext?.organizationId ?? routeOrgId ?? currentMember?.organization_id ?? undefined;

  const { data: fetchedMembers = [] } = useQuery({
    queryKey: [...queryKeys.members.all, 'org', orgId ?? 'none'],
    queryFn: () => getAllMembers(orgId),
    enabled: !!orgId,
  });

  // Merge fetched members with locally-created placeholders so newly-added
  // placeholders appear in the dropdown immediately, before TanStack Query's
  // background refetch lands. Dedup guards against the moment both sources
  // contain the same member.
  const allMembers = useMemo(() => {
    const existingIds = new Set(fetchedMembers.map((m) => m.id));
    const uniqueNew = newPlaceholders.filter((p) => !existingIds.has(p.id));
    return [...fetchedMembers, ...uniqueNew];
  }, [fetchedMembers, newPlaceholders]);

  const excludeIds = captains.map((c) => c.captainId);

  // Re-up pre-fill: when the flow context has reupResponses (next-season
  // wizard fed by the captain re-up sheet), seed the captain list ONE
  // TIME with the previous season's teams whose captains submitted a
  // "returning" answer. Teams that answered "not returning" OR didn't
  // answer at all are intentionally omitted — the operator can still
  // add them back via the normal picker if they have inside info.
  // Pre-fill respects nextCaptainId (captain changes) and falls back
  // to the source team's captain otherwise.
  //
  // Fires only when:
  //   - reupResponses is present in context (next-season flow)
  //   - captain list is empty (no in-progress state to clobber)
  //   - the member list has loaded (we need their names + a way to
  //     verify the captain is still in the org)
  const prefillFiredRef = useRef(false);
  useEffect(() => {
    if (prefillFiredRef.current) return;
    if (!flowContext?.reupResponses?.length) return;
    if (captains.length > 0) return;
    if (fetchedMembers.length === 0) return;

    const prefill: TeamCaptainEntry[] = [];
    for (const entry of flowContext.reupResponses) {
      if (entry.returningNextSeason !== true) continue; // skip "not returning" + "no response"
      // Look up the chosen captain (re-up's next_captain_id or the
      // previous captain). We need their member row for the name.
      const captainId = entry.nextCaptainId ?? null;
      if (!captainId) continue; // pre-fill needs a concrete captain id
      const member = fetchedMembers.find((m) => m.id === captainId);
      if (!member) continue; // captain not in current member list — skip
      prefill.push({
        captainId: member.id,
        captainName: `${member.first_name} ${member.last_name}`,
        teamName: entry.teamName, // carry forward the previous name
      });
    }

    if (prefill.length > 0) {
      onChange(prefill);
    }
    prefillFiredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedMembers.length, flowContext?.reupResponses?.length]);

  // Tally of teams the re-up sheet said are NOT returning (or didn't
  // respond) — surfaced as an informational banner so the operator
  // knows what's been omitted from the pre-fill and can decide
  // whether to add any back manually.
  const reupOmissions = useMemo(() => {
    if (!flowContext?.reupResponses?.length) return null;
    const notReturning = flowContext.reupResponses.filter(
      (r) => r.returningNextSeason === false,
    );
    const noResponse = flowContext.reupResponses.filter(
      (r) => r.returningNextSeason === null,
    );
    if (notReturning.length === 0 && noResponse.length === 0) return null;
    return { notReturning, noResponse };
  }, [flowContext?.reupResponses]);

  // Shared add path: takes the full member object so callers who already
  // have it (e.g. placeholder creation) don't depend on the allMembers
  // memo having refreshed yet.
  const addCaptainFromMember = (member: PartialMember) => {
    if (captains.some((c) => c.captainId === member.id)) return;
    const captainName = `${member.first_name} ${member.last_name}`;
    const teamNumber = captains.length + 1;
    onChange([
      ...captains,
      { captainId: member.id, captainName, teamName: `Team ${teamNumber}` },
    ]);
    setSelectedMemberId('');
  };

  const addCaptain = (memberId: string) => {
    // Skip if this ID was just added via placeholder creation in the
    // same sync tick. Consume the sentinel so later real selections work.
    if (justAddedIdsRef.current.has(memberId)) {
      justAddedIdsRef.current.delete(memberId);
      return;
    }
    const member = allMembers.find((m) => m.id === memberId);
    if (!member) return;
    addCaptainFromMember(member);
  };

  const handlePlaceholderCreated = (newMember: PartialMember) => {
    setNewPlaceholders((prev) => [...prev, newMember]);
    justAddedIdsRef.current.add(newMember.id);
    addCaptainFromMember(newMember);
  };

  const removeCaptain = (i: number) => onChange(captains.filter((_, idx) => idx !== i));

  const updateTeamName = (i: number, name: string) =>
    onChange(captains.map((c, idx) => (idx === i ? { ...c, teamName: name } : c)));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground space-y-1">
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
          there to flesh out each team's roster if you want — or just leave
          it to the captains. Totally fine to let them do the work.
        </p>
        <p>
          <strong>Only operators can</strong> change who the captain of a team is.
        </p>
      </div>

      {reupOmissions && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 p-3 text-sm space-y-1">
          <div className="flex items-center gap-2 font-medium text-yellow-900 dark:text-yellow-300">
            <AlertTriangle className="h-4 w-4" />
            From the re-up sheet
          </div>
          {reupOmissions.notReturning.length > 0 && (
            <p className="text-yellow-800 dark:text-yellow-400">
              <strong>Not returning</strong> (omitted from pre-fill):{' '}
              {reupOmissions.notReturning.map((r) => r.teamName).join(', ')}
            </p>
          )}
          {reupOmissions.noResponse.length > 0 && (
            <p className="text-yellow-800 dark:text-yellow-400">
              <strong>No response yet</strong> (omitted from pre-fill — captain
              didn't confirm):{' '}
              {reupOmissions.noResponse.map((r) => r.teamName).join(', ')}
            </p>
          )}
          <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">
            You can add any of these back manually below if you have inside
            info that contradicts the re-up sheet.
          </p>
        </div>
      )}

      <div className="flex items-center gap-1">
        <p className="font-medium text-foreground">Team Captains</p>
      </div>

      <MemberCombobox
        members={allMembers}
        value={selectedMemberId}
        onValueChange={(id) => { if (id) addCaptain(id); }}
        placeholder="Search for a registered player..."
        excludeIds={excludeIds}
        allowCreatePlaceholder={true}
        onPlaceholderCreated={handlePlaceholderCreated}
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
                <span className="flex-1 text-sm text-muted-foreground">
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

      <p className="text-sm text-muted-foreground">
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
