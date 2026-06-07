/**
 * @fileoverview PlaceholderRow — one active placeholder in the org list.
 *
 * Collapsed by default: the header shows the compact nickname + the two
 * load-bearing chips (merge priority + invite status); expanding reveals full
 * detail and the Attach / Remove actions. Extracted from `OrgPlaceholdersCard`.
 */

import { useState } from 'react';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Trash2, UserPlus, Archive as ArchiveIcon } from 'lucide-react';
import { AttachPlaceholderDialog } from '@/operator/components/AttachPlaceholderDialog';
import { RemovePlaceholderDialog } from '@/operator/components/RemovePlaceholderDialog';
import type { OrgPlaceholderRow } from './orgPlaceholders';

/**
 * One placeholder, collapsed by default. Header shows identity + chips;
 * expanding reveals detail rows.
 */
export const PlaceholderRow: React.FC<{
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
