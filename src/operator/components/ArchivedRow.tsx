/**
 * @fileoverview ArchivedRow — one archived placeholder in the org list.
 *
 * Compact view with a single Restore action; no delete/attach affordances
 * (restore first, then act from the active list — one responsibility per
 * place). Extracted from `OrgPlaceholdersCard`.
 */

import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import type { OrgPlaceholderRow } from './orgPlaceholders';

/**
 * Archived placeholder row — compact view with a Restore button. No
 * delete/attach affordances here: restore first, then take actions from
 * the active list. Keeps each responsibility to one place.
 */
export const ArchivedRow: React.FC<{
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
