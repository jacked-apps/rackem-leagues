/**
 * @fileoverview OrgPlaceholdersCard
 *
 * LO-facing list of every placeholder in the organization. The card is
 * collapsible — closed by default so it doesn't dominate the page. Each
 * placeholder row is individually expandable to reveal full detail
 * (team names, email, creator, dates) without cluttering the default
 * compact view.
 *
 * Design notes for readability on mobile:
 *   - Card stays compact when closed (title + summary chips)
 *   - Opening reveals the row list (each row stays compact itself)
 *   - Clicking a row expands it to show more info
 *   - Nothing auto-opens — LO chooses what to look at
 *
 * Data via get_org_placeholders_for_merge(orgId) — migration 20260422000016.
 * Phase E: merge picker lands in a follow-up commit.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Users, AlertCircle, Trash2, UserPlus, Archive as ArchiveIcon, RotateCcw } from 'lucide-react';
import { InfoButton } from '@/components/InfoButton';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { useUser } from '@/context/useUser';
import { AttachPlaceholderDialog } from '@/operator/components/AttachPlaceholderDialog';
import { RemovePlaceholderDialog } from '@/operator/components/RemovePlaceholderDialog';
import { UnmergePlayerDialog } from '@/operator/components/UnmergePlayerDialog';

export interface OrgPlaceholderRow {
  member_id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  system_player_number: number | null;
  email: string | null;
  has_stats: boolean;
  game_count: number;
  teams: { team_id: string; team_name: string; is_captain: boolean }[];
  creator_name: string | null;
  has_pending_invite: boolean;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
}

interface OrgPlaceholdersCardProps {
  organizationId: string;
}

async function fetchOrgPlaceholders(
  orgId: string,
  includeArchived: boolean,
): Promise<OrgPlaceholderRow[]> {
  const { data, error } = await supabase.rpc('get_org_placeholders_for_merge', {
    p_org_id: orgId,
    p_include_archived: includeArchived,
  });
  if (error) {
    logger.error('Failed to fetch org placeholders', { error: error.message });
    throw error;
  }
  return (data as OrgPlaceholderRow[]) ?? [];
}

export const OrgPlaceholdersCard: React.FC<OrgPlaceholdersCardProps> = ({
  organizationId,
}) => {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [showUnmerge, setShowUnmerge] = useState(false);

  // Active placeholders (archived excluded)
  const { data: placeholders = [], isLoading, error } = useQuery({
    queryKey: ['org-placeholders-for-merge', organizationId],
    queryFn: () => fetchOrgPlaceholders(organizationId, false),
    enabled: !!organizationId,
    staleTime: 1000 * 60,
  });

  // Archived placeholders — shown in a separate sub-section below.
  // Lazy: we fetch only when the main card is expanded to avoid an extra
  // query for LOs who never look at archived.
  const { data: archived = [] } = useQuery({
    queryKey: ['org-placeholders-archived', organizationId],
    queryFn: async () => {
      const all = await fetchOrgPlaceholders(organizationId, true);
      return all.filter((p) => p.is_archived);
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60,
  });

  const runRpc = async (
    rpcName: 'archive_placeholder' | 'restore_placeholder',
    memberId: string,
  ) => {
    if (!user) throw new Error('Not authenticated');
    const { data: callerMember } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!callerMember) throw new Error('No member record for caller');
    const { data, error: rpcError } = await supabase.rpc(rpcName, {
      p_member_id: memberId,
      p_actor_member_id: callerMember.id,
      p_organization_id: organizationId,
    });
    if (rpcError) throw rpcError;
    const result = (data as { success: boolean; error_message: string | null }[])?.[0];
    if (!result?.success) {
      throw new Error(result?.error_message ?? `${rpcName} failed`);
    }
  };

  const restoreMutation = useMutation({
    mutationFn: (memberId: string) => runRpc('restore_placeholder', memberId),
    onSuccess: () => {
      toast.success('Restored');
      queryClient.invalidateQueries({ queryKey: ['org-placeholders-for-merge', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['org-placeholders-archived', organizationId] });
    },
    onError: (err) => toast.error((err as Error).message || 'Restore failed'),
  });

  const totalCount = placeholders.length;
  const activeWithStatsCount = placeholders.filter((p) => p.has_stats).length;
  // "No stats on a team" = placeholder who hasn't played yet but IS
  // assigned to a team — a new addition, healthy state.
  const noStatsCount = placeholders.filter(
    (p) => !p.has_stats && p.teams.length > 0,
  ).length;
  // Unused = no team AND no stats. Data anomaly — every placeholder should
  // exist because someone is (or is about to be) playing. Unused ones
  // clutter player dropdowns and need LO cleanup. Sorted to top, red.
  const unusedCount = placeholders.filter(
    (p) => !p.has_stats && p.teams.length === 0,
  ).length;

  // Sort: Unused first (anomalies), then Has stats (priority action),
  // then the rest. RPC's server-side order stays as a tiebreaker.
  const sortedPlaceholders = useMemo(() => {
    const priority = (p: OrgPlaceholderRow): number => {
      if (!p.has_stats && p.teams.length === 0) return 0; // unused — top
      if (p.has_stats) return 1;                           // needs merge
      return 2;                                             // healthy
    };
    return [...placeholders].sort((a, b) => priority(a) - priority(b));
  }, [placeholders]);

  return (
    <Card className="rounded-none lg:rounded-xl">
      {/* Outer accordion: the whole section collapses. The card header stays
          visible with summary chips so the LO sees queue size at a glance
          even when closed — aligning with the "see the whole page without
          scrolling" goal. */}
      <Accordion type="single" collapsible>
        <AccordionItem value="placeholders" className="border-b-0">
          <AccordionTrigger className="p-4 lg:p-6 hover:no-underline">
            <CardHeader className="p-0 w-full">
              {/* Title is bigger than row names (row nicknames are text-lg;
                  title is text-xl) — hierarchy is legible at a glance. */}
              <CardTitle className="flex items-center gap-2 text-left text-xl">
                <Users className="h-5 w-5 text-blue-600" />
                Placeholders
                {/* Inline help. onClick stop-propagates so the question-mark
                    doesn't toggle the parent accordion when the LO just
                    wants to read the popup. */}
                <span
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <InfoButton title="About placeholders" size="sm">
                    <p>
                      A placeholder represents a real player who hasn't
                      registered (or never wants to). They have stats,
                      handicaps, and team memberships just like registered
                      users — they just don't have an account.
                    </p>
                    <p className="mt-2 font-medium">From this section you can:</p>
                    <ul className="mt-1 list-disc list-inside space-y-1">
                      <li>
                        <strong>Attach</strong> — link a placeholder to a
                        registered user. Their teams and history move to the
                        user's account.
                      </li>
                      <li>
                        <strong>Remove</strong> — for unused placeholders
                        (no team, no stats), permanent delete. For everyone
                        else, archive.
                      </li>
                      <li>
                        <strong>Archive</strong> — soft-inactivate a
                        placeholder who left the league. Data is preserved,
                        they just stop showing up in active dropdowns.
                        Restore from the Archived section any time.
                      </li>
                      <li>
                        <strong>Unmerge</strong> — at the bottom of this
                        card, reverse a wrong attach. Look up the player,
                        review what was merged, confirm the specific reversal.
                      </li>
                    </ul>
                  </InfoButton>
                </span>
                {/* Summary when closed: total only — the overview number the
                    LO cares about at the section level. Breakdown lives
                    inside once they open the section. */}
                {!isLoading && totalCount > 0 && (
                  <span className="ml-auto inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800">
                    {totalCount} total
                  </span>
                )}
              </CardTitle>
            </CardHeader>
          </AccordionTrigger>

          <AccordionContent>
            <CardContent className="p-4 lg:p-6 pt-0">
              {/* Detailed breakdown visible only when expanded — the
                  numbers the LO uses to triage their queue. Unused comes
                  first in the chip row (and in solid red) because those
                  are the ones that shouldn't exist at all. */}
              {!isLoading && totalCount > 0 && (
                <div className="flex flex-wrap gap-2 pb-3 mb-3 border-b border-gray-100">
                  {unusedCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                      {unusedCount} unused (no team)
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    {activeWithStatsCount} playing
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                    {noStatsCount} on team (no stats yet)
                  </span>
                </div>
              )}

              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading placeholders…</p>
              ) : error ? (
                <div className="flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <span>Could not load placeholders. Refresh to retry.</span>
                </div>
              ) : placeholders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No placeholder players in your organization.
                </p>
              ) : (
                // Inner accordion: one AccordionItem per row. Each row stays
                // compact until the LO clicks to expand it for full detail.
                <Accordion type="multiple" className="divide-y divide-gray-100">
                  {sortedPlaceholders.map((p) => (
                    <PlaceholderRow
                      key={p.member_id}
                      placeholder={p}
                      organizationId={organizationId}
                    />
                  ))}
                </Accordion>
              )}

              {/* Archived sub-section — collapsed by default. Keeps
                  inactive placeholders queryable without adding them to
                  the top-level active list. Only renders if there's
                  something to show. */}
              {archived.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border">
                  <Accordion type="single" collapsible>
                    <AccordionItem value="archived" className="border-b-0">
                      <AccordionTrigger className="py-2 hover:no-underline">
                        <div className="flex items-center gap-2 text-left">
                          <span className="text-base font-semibold text-foreground">
                            Archived
                          </span>
                          <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs text-foreground">
                            {archived.length}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Accordion type="multiple" className="divide-y divide-gray-100 mt-1">
                          {archived.map((p) => (
                            <ArchivedRow
                              key={p.member_id}
                              placeholder={p}
                              onRestore={() => restoreMutation.mutate(p.member_id)}
                              isRestoring={
                                restoreMutation.isPending &&
                                restoreMutation.variables === p.member_id
                              }
                            />
                          ))}
                        </Accordion>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}
              {/* Unmerge entry point — quiet, lives at the very bottom so
                  it's there when needed but doesn't invite casual use.
                  The actual flow is a deliberate three-stage dialog
                  (player lookup → review with synopsis → confirm).
                  Only renders when there are placeholders to manage. */}
              {totalCount > 0 && (
                <div className="mt-6 pt-3 border-t border-gray-100 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setShowUnmerge(true)}
                  >
                    Unmerge a player…
                  </Button>
                </div>
              )}
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Unmerge dialog — only mounts when the LO triggers it. */}
      {showUnmerge && (
        <UnmergePlayerDialog
          open={showUnmerge}
          onOpenChange={setShowUnmerge}
          organizationId={organizationId}
        />
      )}
    </Card>
  );
};

/**
 * One placeholder, collapsed by default. Header shows identity + chips;
 * expanding reveals detail rows.
 */
const PlaceholderRow: React.FC<{
  placeholder: OrgPlaceholderRow;
  organizationId: string;
}> = ({ placeholder: p, organizationId }) => {
  const [showAttach, setShowAttach] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  // Nicknames are the mobile display format — capped at ~12 chars at creation
  // so they stay readable at large sizes without squishing. Full names and
  // system_player_number stay behind the expand to respect that space budget.
  const compactName = p.nickname?.trim() || p.first_name;
  const fullName = `${p.first_name} ${p.last_name}`;
  // Unused = no team AND no stats. Safe-to-delete cruft. Flagged with a
  // dashed red border so the LO recognizes them at a glance without the
  // harshness of a solid red (they're not errors, just housekeeping).
  const isUnused = !p.has_stats && p.teams.length === 0;

  return (
    <AccordionItem
      value={p.member_id}
      className={`border-b-0 ${
        isUnused
          ? // Unused = anomaly. Full red treatment: border all around,
            // light-red background. Visually loud because it shouldn't
            // be there.
            'border border-red-300 bg-red-50 rounded-md px-3 my-1'
          : p.has_stats
            ? 'border-l-4 border-l-amber-400 pl-3 -ml-3'
            : ''
      }`}
    >
      <AccordionTrigger className="py-3 hover:no-underline">
        {/* Single compact row. Large nickname + only the two most load-bearing
            chips (merge priority + invite status). Everything else lives
            behind the expand. */}
        <div className="flex-1 min-w-0 flex items-center gap-2 text-left">
          <span className="text-lg font-semibold text-foreground truncate">
            {compactName}
          </span>
          {p.has_stats ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 shrink-0">
              Has stats
            </span>
          ) : isUnused ? (
            <span className="inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white shrink-0">
              Unused
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground shrink-0">
              No stats
            </span>
          )}
          {p.has_pending_invite && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 shrink-0">
              Invite pending
            </span>
          )}
        </div>
      </AccordionTrigger>

      <AccordionContent>
        {/* Full detail reveal. Real name + #P number here, not in the compact
            header — same rationale as nicknames: keep the closed list
            scannable on phones. */}
        <div className="pt-1 pb-3 space-y-1 text-sm">
          <p className="text-foreground">
            <span className="text-muted-foreground">Name:</span>{' '}
            <span className="font-medium">{fullName}</span>
            {p.system_player_number !== null && (
              <span className="text-muted-foreground ml-2">
                #P{p.system_player_number}
              </span>
            )}
          </p>

          {p.email && (
            <p className="text-foreground">
              <span className="text-muted-foreground">Email:</span>{' '}
              <span className="font-medium">{p.email}</span>
            </p>
          )}

          {p.game_count > 0 && (
            <p className="text-foreground">
              <span className="text-muted-foreground">Games played:</span>{' '}
              <span className="font-medium">{p.game_count}</span>
            </p>
          )}

          {p.teams.length > 0 && (
            <p className="text-foreground">
              <span className="text-muted-foreground">Teams:</span>{' '}
              <span className="font-medium">
                {p.teams
                  .map((t) => `${t.team_name}${t.is_captain ? ' (captain)' : ''}`)
                  .join(', ')}
              </span>
            </p>
          )}

          {p.creator_name && (
            <p className="text-foreground">
              <span className="text-muted-foreground">Created by:</span>{' '}
              <span className="font-medium">{p.creator_name}</span>
            </p>
          )}

          <p className="text-muted-foreground text-xs pt-1">
            Created {new Date(p.created_at).toLocaleDateString()}
          </p>

          {/* Attach — LO-initiated direct merge to an existing registered
              user. Available for every placeholder (including Unused —
              captain may have typed someone's name before ever putting
              them on a team; if that person later registers, attach
              still records the identity link even when there's nothing
              material to transfer). */}
          {/* Two actions: Attach routes a placeholder to a registered user;
              Remove is a smart router that shows a delete vs archive
              confirmation based on whether the placeholder has preservable
              state (stats or team). */}
          <div className="pt-2 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAttach(true)}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Attach
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={
                isUnused
                  ? 'text-red-700 hover:text-red-800 hover:bg-red-50 border-red-200'
                  : ''
              }
              onClick={() => setShowRemove(true)}
            >
              {isUnused ? (
                <>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Remove
                </>
              ) : (
                <>
                  <ArchiveIcon className="h-3.5 w-3.5 mr-1" />
                  Remove
                </>
              )}
            </Button>
          </div>
        </div>
      </AccordionContent>

      {/* Dialogs — sibling to the accordion so they stay open independent
          of its collapsed state. Only mount when triggered. */}
      {showAttach && (
        <AttachPlaceholderDialog
          open={showAttach}
          onOpenChange={setShowAttach}
          placeholderId={p.member_id}
          placeholderNickname={p.nickname?.trim() || p.first_name}
          placeholderFullName={`${p.first_name} ${p.last_name}`}
          organizationId={organizationId}
        />
      )}
      {showRemove && (
        <RemovePlaceholderDialog
          open={showRemove}
          onOpenChange={setShowRemove}
          placeholderId={p.member_id}
          placeholderNickname={p.nickname?.trim() || p.first_name}
          hasStats={p.has_stats}
          teamCount={p.teams.length}
          organizationId={organizationId}
        />
      )}
    </AccordionItem>
  );
};


/**
 * Archived placeholder row — compact view with a Restore button. No
 * delete/attach affordances here: restore first, then take actions from
 * the active list. Keeps each responsibility to one place.
 */
const ArchivedRow: React.FC<{
  placeholder: OrgPlaceholderRow;
  onRestore: () => void;
  isRestoring: boolean;
}> = ({ placeholder: p, onRestore, isRestoring }) => {
  const compactName = p.nickname?.trim() || p.first_name;
  const fullName = `${p.first_name} ${p.last_name}`;
  return (
    <AccordionItem
      value={p.member_id}
      className="border-b-0 opacity-75"
    >
      <AccordionTrigger className="py-2 hover:no-underline">
        <div className="flex-1 min-w-0 flex items-center gap-2 text-left">
          <span className="text-base font-medium text-foreground truncate">
            {compactName}
          </span>
          <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs text-foreground shrink-0">
            Archived
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="pt-1 pb-2 space-y-1 text-sm">
          <p className="text-foreground">
            <span className="text-muted-foreground">Name:</span>{" "}
            <span className="font-medium">{fullName}</span>
          </p>
          {p.email && (
            <p className="text-foreground">
              <span className="text-muted-foreground">Email:</span>{" "}
              <span className="font-medium">{p.email}</span>
            </p>
          )}
          {p.game_count > 0 && (
            <p className="text-foreground">
              <span className="text-muted-foreground">Games played:</span>{" "}
              <span className="font-medium">{p.game_count}</span>
            </p>
          )}
          {p.archived_at && (
            <p className="text-muted-foreground text-xs">
              Archived {new Date(p.archived_at).toLocaleDateString()}
            </p>
          )}
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRestore}
              isLoading={isRestoring}
              loadingText="Restoring…"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Restore
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
