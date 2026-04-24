/**
 * @fileoverview OrgPlaceholdersCard
 *
 * LO-facing list of every placeholder in the organization. Displays identity,
 * team membership, game count, has-stats classification (amber vs gray chip),
 * creator, and pending-invite status — all the context an LO needs to decide
 * whether a placeholder still needs merging.
 *
 * Lives on the PlayerManagement page as a Phase E addition. The interactive
 * merge picker lands in a follow-up commit; this commit delivers the list
 * surface.
 *
 * Data via get_org_placeholders_for_merge(orgId) — see migration
 * 20260422000016.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, AlertCircle } from 'lucide-react';
import { logger } from '@/utils/logger';

/**
 * One placeholder row with the context the LO sees before deciding to merge.
 */
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
  /** LO's organization id — scope filter for the RPC. */
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
    staleTime: 1000 * 60, // 1 min — LO operations are infrequent
  });

  const needsMergeCount = placeholders.filter((p) => p.has_stats).length;
  const noStatsCount = placeholders.length - needsMergeCount;

  return (
    <Card className="rounded-none lg:rounded-xl">
      <CardHeader className="p-4 lg:p-6">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Placeholders
        </CardTitle>
        {/* Summary chips — amber-first count communicates priority */}
        {!isLoading && placeholders.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              {needsMergeCount} needs merge
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {noStatsCount} no stats
            </span>
          </div>
        )}
      </CardHeader>

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
          <ul className="divide-y divide-gray-100">
            {placeholders.map((p) => (
              <PlaceholderRow key={p.member_id} placeholder={p} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Single placeholder row. Amber border when the placeholder has stats
 * (priority merge target). Gray otherwise. Chips fold when data is absent.
 */
const PlaceholderRow: React.FC<{ placeholder: OrgPlaceholderRow }> = ({
  placeholder: p,
}) => {
  return (
    <li
      className={`py-3 ${
        p.has_stats ? 'border-l-4 border-l-amber-400 pl-3 -ml-3' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Name line — nickname inline if set, system player number as suffix */}
          <p className="font-medium text-gray-900 truncate">
            {p.first_name}
            {p.nickname ? ` "${p.nickname}"` : ''}{' '}
            {p.last_name}
            {p.system_player_number !== null && (
              <span className="text-xs text-gray-400 font-normal ml-1">
                #P{p.system_player_number}
              </span>
            )}
          </p>

          {/* Chip row: stats, games, invite, teams count */}
          <div className="flex flex-wrap gap-1 mt-1">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                p.has_stats
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {p.has_stats ? 'Needs merge' : 'No stats'}
            </span>
            {p.game_count > 0 && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                {p.game_count} game{p.game_count === 1 ? '' : 's'}
              </span>
            )}
            {p.has_pending_invite && (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                Invite pending
              </span>
            )}
            {p.teams.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {p.teams.length} team{p.teams.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {/* Meta line: email + creator attribution when we know them */}
          <p className="text-xs text-gray-500 mt-1 truncate">
            {p.email && <span>{p.email} · </span>}
            {p.creator_name
              ? `Created by ${p.creator_name}`
              : 'Creator unknown'}
          </p>
        </div>
      </div>
    </li>
  );
};
