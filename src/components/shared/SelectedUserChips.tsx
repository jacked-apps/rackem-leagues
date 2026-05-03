/**
 * @fileoverview Selected User Chips Component
 *
 * Reusable component for displaying selected users/items as removable chips.
 * Used in messaging and announcement features.
 */

import { X, Users } from 'lucide-react';

interface SelectedItem {
  id: string;
  name: string;
  subtitle?: string;
}

interface SelectedUserChipsProps {
  items: SelectedItem[];
  onRemove: (id: string) => void;
  title?: string;
}

export function SelectedUserChips({ items, onRemove, title = 'Selected' }: SelectedUserChipsProps) {
  if (items.length === 0) return null;

  return (
    <div className="px-6 pt-4 border-b bg-blue-50">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-900">
          {title} ({items.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-2 pb-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-card border border-blue-300 rounded-full px-3 py-1 text-sm flex items-center gap-2"
          >
            <span>
              {item.name}
              {item.subtitle && ` ${item.subtitle}`}
            </span>
            <button
              onClick={() => onRemove(item.id)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${item.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
