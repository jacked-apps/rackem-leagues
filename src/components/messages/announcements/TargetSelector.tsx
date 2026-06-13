/**
 * @fileoverview Target Selector Component
 *
 * Displays selectable list of announcement targets (leagues and organizations).
 * Highlights selected targets and shows target metadata.
 */

import { Label } from '@/components/ui/label';
import { Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState, EmptyState } from '@/components/shared';

interface AnnouncementTarget {
  id: string;
  name: string;
  type: 'league' | 'organization';
  season_id?: string;
  season_name?: string;
}

interface TargetSelectorProps {
  targets: AnnouncementTarget[];
  selectedTargetIds: string[];
  loading: boolean;
  onToggle: (targetId: string) => void;
}

export function TargetSelector({
  targets,
  selectedTargetIds,
  loading,
  onToggle,
}: TargetSelectorProps) {
  if (loading) {
    return <LoadingState message="Loading targets..." />;
  }

  if (targets.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No announcement targets available"
        description="You must be a captain or operator to send announcements"
      />
    );
  }

  return (
    <>
      <Label className="text-base font-semibold mb-3 block">
        Select Target(s) for Announcement
      </Label>

      <div className="space-y-2">
        {targets.map((target) => (
          <button
            key={target.id}
            onClick={() => onToggle(target.id)}
            className={cn(
              'w-full p-4 rounded-lg border-2 transition-all text-left',
              selectedTargetIds.includes(target.id)
                ? 'border-info bg-info/10'
                : 'border-border hover:border-border hover:bg-muted'
            )}
          >
            <div className="font-medium text-foreground">{target.name}</div>
            {target.season_name && (
              <div className="text-sm text-muted-foreground mt-1">Season: {target.season_name}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {target.type === 'league' ? 'League' : 'Organization-wide'}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
