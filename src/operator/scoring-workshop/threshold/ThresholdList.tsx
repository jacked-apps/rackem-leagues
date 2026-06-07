/**
 * @fileoverview List view for the threshold room. "Yours" (editable) +
 * "Templates" (officials, read-only, clone-to-edit). Mirrors `TriggerList`.
 * Display name is the LO's `label`; the generic key is never shown.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ThresholdRoomRow } from './useThresholdRoom';

export interface ThresholdListProps {
  readonly officials: ThresholdRoomRow[];
  readonly mine: ThresholdRoomRow[];
  readonly onCloneOfficial: (id: string) => void;
  readonly onEditMine: (id: string) => void;
  readonly onDeleteMine: (id: string) => void;
}

export function ThresholdList({
  officials,
  mine,
  onCloneOfficial,
  onEditMine,
  onDeleteMine,
}: ThresholdListProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Yours</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You don't have any yet. Make a copy of a template to start.
          </p>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {mine.map((row) => (
                <RowItem
                  key={row.id}
                  label={row.label}
                  description={row.description}
                  actions={
                    <div className="flex gap-2">
                      <Button size="sm" loadingText="none" onClick={() => onEditMine(row.id)}>
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
          Official starting points. Read-only. Make a copy to start a variation of your own.
        </p>
        <Card>
          <CardContent className="divide-y p-0">
            {officials.map((row) => (
              <RowItem
                key={row.id}
                label={row.label}
                description={row.description}
                actions={
                  <Button size="sm" loadingText="none" onClick={() => onCloneOfficial(row.id)}>
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
  label,
  description,
  actions,
}: {
  readonly label: string;
  readonly description: string | null;
  readonly actions: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        {description && (
          <div className="truncate text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      <div className="flex-none">{actions}</div>
    </div>
  );
}
