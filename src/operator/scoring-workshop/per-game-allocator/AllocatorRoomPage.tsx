/**
 * @fileoverview Per-Game Allocator Workshop — page container.
 *
 * First module workshop in the workshops building. Mounts at
 * `/operator/scoring-workshop/per-game-allocator` (URL keeps the legacy
 * path pending the eventual rename). Shows the user's variations +
 * read-only templates; opens the editor for clone / edit; persists via
 * `useAllocatorRoom`.
 */

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useUserProfile } from '@/api/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { AllocatorList } from './AllocatorList';
import { AllocatorEditor } from './AllocatorEditor';
import {
  useAllocatorRoom,
  type AllocatorRow,
} from './useAllocatorRoom';

type Mode = 'list' | 'edit';

export default function AllocatorRoomPage() {
  const { member } = useUserProfile();
  const memberId = member?.id ?? null;
  const room = useAllocatorRoom(memberId);
  const [mode, setMode] = useState<Mode>('list');
  const [editing, setEditing] = useState<AllocatorRow | null>(null);

  const handleCloneOfficial = async (sourceId: string) => {
    const source = room.officials.find((r) => r.id === sourceId);
    if (!source) return;
    const newName = `Copy of ${source.name}`;
    const newId = await room.cloneOfficial(sourceId, newName);
    if (!newId) return;
    // Find the just-cloned row in the refreshed list and open it for edit.
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

  const handleSave = async (row: AllocatorRow): Promise<boolean> => {
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
        title="Per-Game Allocator Workshop"
        subtitle="Build per-game point variations and apply them to your leagues."
        backTo={mode === 'list' ? '/operator/scoring-workshop' : undefined}
        backLabel={mode === 'list' ? 'Workshops' : 'Back to list'}
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
        <AllocatorList
          officials={room.officials}
          mine={room.mine}
          onCloneOfficial={handleCloneOfficial}
          onEditMine={handleEditMine}
          onDeleteMine={handleDeleteMine}
        />
      )}
      {mode === 'edit' && editing && (
        <AllocatorEditor
          initial={editing}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
