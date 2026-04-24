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

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Users, AlertCircle } from 'lucide-react';
import { logger } from '@/utils/logger';

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
  created_at: string;
}

interface OrgPlaceholdersCardProps {
  organizationId: string;
}

async function fetchOrgPlaceholders(orgId: string): Promise<OrgPlaceholderRow[]> {
  const { data, error } = await supabase.rpc('get_org_placeholders_for_merge', {
    p_org_id: orgId,
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
  const { data: placeholders = [], isLoading, error } = useQuery({
    queryKey: ['org-placeholders-for-merge', organizationId],
    queryFn: () => fetchOrgPlaceholders(organizationId),
    enabled: !!organizationId,
    staleTime: 1000 * 60,
  });

  const needsMergeCount = placeholders.filter((p) => p.has_stats).length;
  const noStatsCount = placeholders.length - needsMergeCount;

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
              <CardTitle className="flex items-center gap-2 text-left">
                <Users className="h-5 w-5 text-blue-600" />
                Placeholders
                <span className="ml-auto flex items-center gap-2 flex-wrap">
                  {!isLoading && placeholders.length > 0 && (
                    <>
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        {needsMergeCount} needs merge
                      </span>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {noStatsCount} no stats
                      </span>
                    </>
                  )}
                </span>
              </CardTitle>
            </CardHeader>
          </AccordionTrigger>

          <AccordionContent>
            <CardContent className="p-4 lg:p-6 pt-0">
              {isLoading ? (
                <p className="text-sm text-gray-500">Loading placeholders…</p>
              ) : error ? (
                <div className="flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <span>Could not load placeholders. Refresh to retry.</span>
                </div>
              ) : placeholders.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No placeholder players in your organization.
                </p>
              ) : (
                // Inner accordion: one AccordionItem per row. Each row stays
                // compact until the LO clicks to expand it for full detail.
                <Accordion type="multiple" className="divide-y divide-gray-100">
                  {placeholders.map((p) => (
                    <PlaceholderRow key={p.member_id} placeholder={p} />
                  ))}
                </Accordion>
              )}
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
};

/**
 * One placeholder, collapsed by default. Header shows identity + chips;
 * expanding reveals detail rows.
 */
const PlaceholderRow: React.FC<{ placeholder: OrgPlaceholderRow }> = ({
  placeholder: p,
}) => {
  // Nicknames are the mobile display format — capped at ~12 chars at creation
  // so they stay readable at large sizes without squishing. Full names and
  // system_player_number stay behind the expand to respect that space budget.
  const compactName = p.nickname?.trim() || p.first_name;
  const fullName = `${p.first_name} ${p.last_name}`;

  return (
    <AccordionItem
      value={p.member_id}
      className={`border-b-0 ${
        p.has_stats ? 'border-l-4 border-l-amber-400 pl-3 -ml-3' : ''
      }`}
    >
      <AccordionTrigger className="py-3 hover:no-underline">
        {/* Single compact row. Large nickname + only the two most load-bearing
            chips (merge priority + invite status). Everything else lives
            behind the expand. */}
        <div className="flex-1 min-w-0 flex items-center gap-2 text-left">
          <span className="text-lg font-semibold text-gray-900 truncate">
            {compactName}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${
              p.has_stats
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {p.has_stats ? 'Needs merge' : 'No stats'}
          </span>
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
          <p className="text-gray-700">
            <span className="text-gray-500">Name:</span>{' '}
            <span className="font-medium">{fullName}</span>
            {p.system_player_number !== null && (
              <span className="text-gray-400 ml-2">
                #P{p.system_player_number}
              </span>
            )}
          </p>

          {p.email && (
            <p className="text-gray-700">
              <span className="text-gray-500">Email:</span>{' '}
              <span className="font-medium">{p.email}</span>
            </p>
          )}

          {p.game_count > 0 && (
            <p className="text-gray-700">
              <span className="text-gray-500">Games played:</span>{' '}
              <span className="font-medium">{p.game_count}</span>
            </p>
          )}

          {p.teams.length > 0 && (
            <p className="text-gray-700">
              <span className="text-gray-500">Teams:</span>{' '}
              <span className="font-medium">
                {p.teams
                  .map((t) => `${t.team_name}${t.is_captain ? ' (captain)' : ''}`)
                  .join(', ')}
              </span>
            </p>
          )}

          {p.creator_name && (
            <p className="text-gray-700">
              <span className="text-gray-500">Created by:</span>{' '}
              <span className="font-medium">{p.creator_name}</span>
            </p>
          )}

          <p className="text-gray-500 text-xs pt-1">
            Created {new Date(p.created_at).toLocaleDateString()}
          </p>

          {/* Merge button slot — wired up in Phase E part 2 */}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
