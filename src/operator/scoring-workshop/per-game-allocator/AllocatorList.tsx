/**
 * @fileoverview List view for the per-game allocator room.
 *
 * Two sections rendered as scannable lists (not grids): "Templates"
 * (officials, read-only, clone-to-edit) and "Yours" (user's own,
 * editable). List style scales as the count grows — a user with 50
 * saved variations is the right design target, not 6.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { AllocatorRow } from './useAllocatorRoom';

export interface AllocatorListProps {
  readonly officials: AllocatorRow[];
  readonly mine: AllocatorRow[];
  readonly onCloneOfficial: (id: string) => void;
  readonly onEditMine: (id: string) => void;
  readonly onDeleteMine: (id: string) => void;
}

export function AllocatorList({
  officials,
  mine,
  onCloneOfficial,
  onEditMine,
  onDeleteMine,
}: AllocatorListProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Yours</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You don't have any yet. Create one from a template or start with
            Empty Starter.
          </p>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {mine.map((row) => (
                <RowItem
                  key={row.id}
                  name={row.name}
                  description={row.description}
                  actions={
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        loadingText="none"
                        onClick={() => onEditMine(row.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        loadingText="none"
                        onClick={() => onDeleteMine(row.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  }
                />
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Templates</h2>
        <p className="text-sm text-muted-foreground">
          Official starting points. Read-only. Clone one to start a variation
          of your own.
        </p>
        <Card>
          <CardContent className="divide-y p-0">
            {officials.map((row) => (
              <RowItem
                key={row.id}
                name={row.name}
                description={row.description}
                actions={
                  <Button
                    size="sm"
                    loadingText="none"
                    onClick={() => onCloneOfficial(row.id)}
                  >
                    Make a copy
                  </Button>
                }
              />
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function RowItem({
  name,
  description,
  actions,
}: {
  readonly name: string;
  readonly description: string | null;
  readonly actions: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{name}</div>
        {description && (
          <div className="truncate text-sm text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      <div className="flex-none">{actions}</div>
    </div>
  );
}
