/**
 * @fileoverview Trigger Room — page container.
 *
 * Second standalone work room of the Scoring System Workshop. Mounts
 * at `/operator/scoring-workshop/trigger`. Mirrors the per-game
 * allocator's `AllocatorRoomPage` 1:1 in shape — the two rooms are
 * independent at runtime and share only the `ExpressionBuilder` widget.
 */

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useUserProfile } from '@/api/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { TriggerList } from './TriggerList';
import { TriggerEditor } from './TriggerEditor';
import { useTriggerRoom, type TriggerRow } from './useTriggerRoom';

type Mode = 'list' | 'edit';

export default function TriggerRoomPage() {
  const { member } = useUserProfile();
  const memberId = member?.id ?? null;
  const room = useTriggerRoom(memberId);
  const [mode, setMode] = useState<Mode>('list');
  const [editing, setEditing] = useState<TriggerRow | null>(null);

  const handleCloneOfficial = async (sourceId: string) => {
    const source = room.officials.find((r) => r.id === sourceId);
    if (!source) return;
    const newName = `Copy of ${source.name}`;
    const newId = await room.cloneOfficial(sourceId, newName);
    if (!newId) return;
    const cloned = room.mine.find((r) => r.id === newId);
    if (cloned) {
      setEditing(cloned);
      setMode('edit');
    }
  };

  const handleEditMine = (id: string) => {
    const row = room.mine.find((r) => r.id === id);
    if (!row) return;
    setEditing(row);
    setMode('edit');
  };

  const handleDeleteMine = async (id: string) => {
    await room.remove(id);
  };

  const handleSave = async (row: TriggerRow): Promise<boolean> => {
    const ok = await room.upsert(row);
    if (ok) {
      setMode('list');
      setEditing(null);
    }
    return ok;
  };

  const handleCancel = () => {
    setMode('list');
    setEditing(null);
  };

  return (
    <div className="container mx-auto space-y-6 p-4">
      <PageHeader
        title="Trigger — Workshop"
        subtitle="The second room of the Scoring System Workshop. Build standalone trigger variations — match start credits, mid-match bonuses, end-of-match awards."
        backTo={mode === 'list' ? '/operator/scoring-workshop' : undefined}
        backLabel={mode === 'list' ? 'Workshop' : 'Back to list'}
        onBackClick={mode === 'edit' ? handleCancel : undefined}
      />
      {room.loading && <p>Loading…</p>}
      {room.error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            {room.error}
          </CardContent>
        </Card>
      )}
      {!room.loading && !room.error && mode === 'list' && (
        <TriggerList
          officials={room.officials}
          mine={room.mine}
          onCloneOfficial={handleCloneOfficial}
          onEditMine={handleEditMine}
          onDeleteMine={handleDeleteMine}
        />
      )}
      {mode === 'edit' && editing && (
        <TriggerEditor initial={editing} onSave={handleSave} onCancel={handleCancel} />
      )}
    </div>
  );
}
