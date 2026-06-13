/**
 * @fileoverview Selected Target Chips Component
 *
 * Displays selected announcement targets as removable chips.
 * Shows target name and season (if applicable).
 */

import { X } from 'lucide-react';

interface AnnouncementTarget {
  id: string;
  name: string;
  type: 'league' | 'organization';
  season_id?: string;
  season_name?: string;
}

interface SelectedTargetChipsProps {
  selectedTargets: AnnouncementTarget[];
  onRemove: (targetId: string) => void;
}

export function SelectedTargetChips({ selectedTargets, onRemove }: SelectedTargetChipsProps) {
  if (selectedTargets.length === 0) return null;

  return (
    <div className="px-6 pt-4 border-b bg-info/10">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-info">
          Selected ({selectedTargets.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-2 pb-4">
        {selectedTargets.map((target) => (
          <div
            key={target.id}
            className="bg-card border border-info/40 rounded-full px-3 py-1 text-sm flex items-center gap-2"
          >
            <span>
              {target.name}
              {target.season_name && ` (${target.season_name})`}
            </span>
            <button
              onClick={() => onRemove(target.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
