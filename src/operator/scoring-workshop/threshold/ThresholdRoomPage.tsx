/**
 * @fileoverview Threshold Workshop — page container.
 *
 * Third standalone module workshop in the workshops building. Mounts at
 * `/operator/scoring-workshop/threshold`. Mirrors `TriggerRoomPage` 1:1 in
 * shape — independent room, shares only the `ExpressionBuilder` widget and the
 * (Phase B) chart editor.
 */

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useUserProfile } from '@/api/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { ThresholdList } from './ThresholdList';
import { ThresholdEditor } from './ThresholdEditor';
import { useThresholdRoom, type ThresholdRoomRow } from './useThresholdRoom';

type Mode = 'list' | 'edit';

export default function ThresholdRoomPage() {
  const { member } = useUserProfile();
  const memberId = member?.id ?? null;
  const room = useThresholdRoom(memberId);
  const [mode, setMode] = useState<Mode>('list');
  const [editing, setEditing] = useState<ThresholdRoomRow | null>(null);

  const handleCloneOfficial = async (sourceId: string) => {
    const source = room.officials.find((r) => r.id === sourceId);
    if (!source) return;
    const newId = await room.cloneOfficial(sourceId, `Copy of ${source.label}`);
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

  const handleSave = async (row: ThresholdRoomRow): Promise<boolean> => {
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
        title="Threshold Workshop"
        subtitle="Build threshold variations — finish lines, head starts, milestones. A threshold figures out one number from the handicaps."
        backTo={mode === 'list' ? '/operator/scoring-workshop' : undefined}
        backLabel={mode === 'list' ? 'Workshops' : 'Back to list'}
        onBackClick={mode === 'edit' ? handleCancel : undefined}
      />
      {room.loading && <p>Loading…</p>}
      {room.error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">{room.error}</CardContent>
        </Card>
      )}
      {!room.loading && !room.error && mode === 'list' && (
        <ThresholdList
          officials={room.officials}
          mine={room.mine}
          onCloneOfficial={handleCloneOfficial}
          onEditMine={handleEditMine}
          onDeleteMine={handleDeleteMine}
        />
      )}
      {mode === 'edit' && editing && (
        <ThresholdEditor initial={editing} onSave={handleSave} onCancel={handleCancel} />
      )}
    </div>
  );
}
