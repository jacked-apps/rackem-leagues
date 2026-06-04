/**
 * @fileoverview List view for the per-game allocator room.
 *
 * Two sections: "Templates" (officials, read-only) and "Yours" (user's
 * own, editable). Each official offers a "Make a copy I can edit"
 * action; each user row offers Edit and Delete.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        <h2 className="text-lg font-semibold">Templates</h2>
        <p className="text-sm text-muted-foreground">
          Official starting points. Read-only. Clone one to start a variation
          of your own.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {officials.map((row) => (
            <Card key={row.id}>
              <CardHeader>
                <CardTitle className="text-base">{row.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {row.description && (
                  <p className="text-sm text-muted-foreground">{row.description}</p>
                )}
                <Button
                  size="sm"
                  loadingText="none"
                  onClick={() => onCloneOfficial(row.id)}
                >
                  Make a copy I can edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Yours</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You haven't saved any variations yet. Clone a template above to
            start one.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {mine.map((row) => (
              <Card key={row.id}>
                <CardHeader>
                  <CardTitle className="text-base">{row.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {row.description && (
                    <p className="text-sm text-muted-foreground">
                      {row.description}
                    </p>
                  )}
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
