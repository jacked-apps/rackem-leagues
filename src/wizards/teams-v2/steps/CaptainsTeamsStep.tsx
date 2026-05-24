/**
 * @fileoverview CaptainsTeamsStep — pick captains, auto-create teams
 *
 * Each captain creates a team (default "Team N", editable by LO).
 * MemberCombobox with placeholder creation for unregistered captains.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { InfoButton } from '@/components/InfoButton';
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
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
  // TIME with ALL the previous season's teams — not just confirmed-
  // returning ones. The operator sees every team they had + each
  // captain's re-up status as a flag, and removes the ones that
  // aren't coming back. Starting from scratch when 80% of teams
  // typically return is way more work than the operator should do.
  //
  // captainId resolution: re-up's next_captain_id (if a swap was
  // submitted) → previous season's captain_id → skip if neither.
  //
  // We deliberately do NOT cross-check `fetchedMembers` here.
  // `getAllMembers(orgId)` filters by org assignment, and placeholder
  // pool members (the captains in dev seeds) often have no org_id set,
  // so the filter drops them — leaving the operator with an empty
  // editor. The re-up context already carries `captainName`, which is
  // everything the row needs to render.
  //
  // Pre-fill fires ONCE per mount when:
  //   - reupResponses is present (next-season flow)
  //   - captains is empty (no in-progress edits to clobber)
  // The mount-once guard via `didPrefillRef` lets the operator REMOVE
  // captains later without the effect re-populating them. A full
  // unmount/remount (e.g., navigating back to the league and re-
  // entering the wizard) resets the ref and re-pre-fills, which is
  // the recovery path operators expect.
  const didPrefillRef = useRef(false);
  useEffect(() => {
    if (didPrefillRef.current) return;
    if (!flowContext?.reupResponses?.length) return;
    didPrefillRef.current = true;

    if (captains.length > 0) return; // operator already has rows — keep them

    const prefill: TeamCaptainEntry[] = [];
    for (const entry of flowContext.reupResponses) {
      const captainId = entry.nextCaptainId ?? entry.currentCaptainId ?? null;
      if (!captainId) continue; // no captain to pre-fill against
      // When the re-up included a captain swap, pre-fill the NEW name
      // (otherwise the row reads as the old captain even though the
      // captainId pointed at the swap target). Falls back to the
      // current captain's name when no swap was submitted.
      const captainName = entry.nextCaptainId
        ? entry.nextCaptainName || 'Unknown captain'
        : entry.captainName || 'Unknown captain';
      prefill.push({
        captainId,
        captainName,
        teamName: entry.teamName,
      });
    }

    if (prefill.length > 0) {
      onChange(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowContext?.reupResponses]);

  // Map captainId → re-up status icon for per-row display in the team
  // list below. The captainId on the prefilled entry is either the
  // re-up's next-captain (if submitted) or the previous-season captain.
  // We match by EITHER id so swapped-captain teams still light up.
  const reupStatusByCaptainId = useMemo(() => {
    const map = new Map<string, boolean | null>();
    for (const r of flowContext?.reupResponses ?? []) {
      if (r.currentCaptainId) map.set(r.currentCaptainId, r.returningNextSeason);
      if (r.nextCaptainId) map.set(r.nextCaptainId, r.returningNextSeason);
    }
    return map;
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
  };

  const handlePlaceholderCreated = (newMember: PartialMember) => {
    setNewPlaceholders((prev) => [...prev, newMember]);
    justAddedIdsRef.current.add(newMember.id);
    addCaptainFromMember(newMember);
    setShowAddPanel(false);
  };

  const handleAddByMemberId = (memberId: string) => {
    if (justAddedIdsRef.current.has(memberId)) {
      justAddedIdsRef.current.delete(memberId);
      return;
    }
    const member = allMembers.find((m) => m.id === memberId);
    if (!member) return;
    addCaptainFromMember(member);
    setShowAddPanel(false);
  };

  const removeCaptain = (i: number) => {
    onChange(captains.filter((_, idx) => idx !== i));
    setEditingIndex(null);
  };

  /** Apply pending edits from the inline editor to a single captain row. */
  const saveEdit = (i: number, draft: TeamCaptainEntry) => {
    onChange(captains.map((c, idx) => (idx === i ? draft : c)));
    setEditingIndex(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-foreground">
        <p>
          Each captain creates a team. Rosters can be filled in later.
        </p>
        <InfoButton title="How teams work in this wizard" size="sm">
          <p>Each captain here creates a team — count of captains = count of teams.</p>
          <p className="mt-2">
            <strong>Captains can</strong> rename their team and add/remove roster
            players themselves, anytime.
          </p>
          <p className="mt-2">
            <strong>You (the operator) can</strong> do everything a captain can
            from the Team Management page. Finish this wizard first, then head
            there to flesh out each team&rsquo;s roster if you want — or just
            leave it to the captains. Totally fine to let them do the work.
          </p>
          <p className="mt-2">
            <strong>Only operators can</strong> change who the captain of a team is.
          </p>
        </InfoButton>
      </div>

      <p className="font-medium text-foreground">
        Team Captains{captains.length > 0 ? ` (${captains.length})` : ''}
      </p>

      {/* Loud, impossible-to-miss notice when below the 4-team floor.
          Red border + red bg so it stands out against the rest of the
          page. Hides once the operator clears the threshold. */}
      {captains.length < 4 && (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/30 p-4 text-base font-medium text-red-900 dark:text-red-200">
          ⚠️ A season needs at least <strong>4 teams</strong>. You have{' '}
          <strong>{captains.length}</strong>. Add{' '}
          <strong>{4 - captains.length} more</strong> below before continuing.
        </div>
      )}

      {captains.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          No teams yet. Use the buttons below to add your first one.
        </p>
      )}

      {captains.length > 0 && (
        <div className="space-y-2">
          {captains.map((captain, i) =>
            editingIndex === i ? (
              <TeamEditCard
                key={captain.captainId}
                captain={captain}
                allMembers={allMembers}
                excludeIds={excludeIds.filter((id) => id !== captain.captainId)}
                onSave={(draft) => saveEdit(i, draft)}
                onRemove={() => removeCaptain(i)}
                onCancel={() => setEditingIndex(null)}
              />
            ) : (
              <TeamDisplayCard
                key={captain.captainId}
                captain={captain}
                reupStatus={reupStatusByCaptainId.get(captain.captainId)}
                onEdit={() => setEditingIndex(i)}
              />
            ),
          )}
        </div>
      )}

      {showAddPanel ? (
        <AddTeamPanel
          allMembers={allMembers}
          excludeIds={excludeIds}
          onAdd={handleAddByMemberId}
          onPlaceholderCreated={handlePlaceholderCreated}
          onCancel={() => setShowAddPanel(false)}
        />
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setShowAddPanel(true)} loadingText="none">
            <Plus className="size-4" /> Add a team
          </Button>
          <Button variant="outline" disabled className="opacity-70" loadingText="none">
            📋 Copy team from another league
            <Badge variant="secondary" className="ml-2">Coming soon</Badge>
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {captains.length < 4
          ? `${4 - captains.length} more team${4 - captains.length === 1 ? '' : 's'} needed to continue.`
          : `${captains.length} team${captains.length === 1 ? '' : 's'} ready.`}
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

/** Read-only row for a team. The Edit button flips it to TeamEditCard. */
function TeamDisplayCard({
  captain,
  reupStatus,
  onEdit,
}: {
  captain: TeamCaptainEntry;
  reupStatus: boolean | null | undefined;
  onEdit: () => void;
}) {
  const showStatus = reupStatus !== undefined;
  return (
    <div className="p-3 border rounded-lg flex items-center gap-3">
      <div className="flex-1">
        <div className="font-medium text-foreground">{captain.teamName}</div>
        <div className="text-sm text-muted-foreground">
          Captain: {captain.captainName}
        </div>
      </div>
      {showStatus && (
        <span aria-hidden className="text-base">
          {reupStatus === true ? '✅' : reupStatus === false ? '🚫' : '❓'}
        </span>
      )}
      <Button variant="ghost" onClick={onEdit} loadingText="none">
        <Pencil className="size-4" />
        Edit
      </Button>
    </div>
  );
}

/** Inline editor: rename, swap captain, or remove the team. */
function TeamEditCard({
  captain,
  allMembers,
  excludeIds,
  onSave,
  onRemove,
  onCancel,
}: {
  captain: TeamCaptainEntry;
  allMembers: PartialMember[];
  excludeIds: string[];
  onSave: (draft: TeamCaptainEntry) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [teamName, setTeamName] = useState(captain.teamName);
  const [captainId, setCaptainId] = useState(captain.captainId);
  const [captainName, setCaptainName] = useState(captain.captainName);

  const handleSave = () => {
    if (!teamName.trim()) return;
    onSave({ captainId, captainName, teamName: teamName.trim() });
  };

  return (
    <div className="p-3 border-2 border-primary rounded-lg space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`edit-team-${captain.captainId}`} className="text-sm">
          Team name
        </Label>
        <Input
          id={`edit-team-${captain.captainId}`}
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Captain</Label>
        {/* Reads the LOCAL draft (`captainName`), not the prop, so the
            row reflects the just-picked captain instead of looking
            stuck on the original until Save lands. */}
        <p className="text-sm text-muted-foreground">
          Captain:{' '}
          <strong className="text-foreground">{captainName}</strong>
          {captainId !== captain.captainId && (
            <span className="ml-2 text-xs italic text-amber-700 dark:text-amber-400">
              (changed — click Save to confirm)
            </span>
          )}
        </p>
        <MemberCombobox
          members={allMembers}
          value=""
          onValueChange={(id) => {
            const m = allMembers.find((mm) => mm.id === id);
            if (!m) return;
            setCaptainId(m.id);
            setCaptainName(`${m.first_name} ${m.last_name}`);
          }}
          placeholder="Search to swap captain..."
          excludeIds={excludeIds}
          allowCreatePlaceholder={false}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave} loadingText="none">Save</Button>
        <Button variant="destructive" onClick={onRemove} loadingText="Removing">
          Remove team
        </Button>
        <Button variant="outline" onClick={onCancel} loadingText="none">
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Inline panel revealed when "+ Add a team" is clicked. Wraps
 *  MemberCombobox so first-season + add-via-keep flows share one UI. */
function AddTeamPanel({
  allMembers,
  excludeIds,
  onAdd,
  onPlaceholderCreated,
  onCancel,
}: {
  allMembers: PartialMember[];
  excludeIds: string[];
  onAdd: (memberId: string) => void;
  onPlaceholderCreated: (m: PartialMember) => void;
  onCancel: () => void;
}) {
  return (
    <div className="p-3 border-2 border-primary rounded-lg space-y-3">
      <Label className="text-sm font-medium">Add a captain</Label>
      <MemberCombobox
        members={allMembers}
        value=""
        onValueChange={(id) => { if (id) onAdd(id); }}
        placeholder="Search for a registered player..."
        excludeIds={excludeIds}
        allowCreatePlaceholder={true}
        onPlaceholderCreated={onPlaceholderCreated}
      />
      <p className="text-xs text-muted-foreground">
        Picking a captain creates a new team with the default name
        &ldquo;Team N&rdquo; — you can rename it via Edit.
      </p>
      <Button variant="outline" onClick={onCancel} loadingText="none">
        Cancel
      </Button>
    </div>
  );
}
