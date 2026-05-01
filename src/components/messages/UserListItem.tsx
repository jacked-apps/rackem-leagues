/**
 * @fileoverview User List Item Component
 *
 * Single responsibility: Display a single user in a selectable list.
 * Reusable component for user selection interfaces with optional selection state.
 */

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface UserListItemProps {
  firstName: string;
  lastName: string;
  playerNumber: number;
  onClick: () => void;
  isSelected?: boolean;
}

export function UserListItem({
  firstName,
  lastName,
  playerNumber,
  onClick,
  isSelected = false,
}: UserListItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-2 rounded-lg border transition-colors text-left flex items-center justify-between',
        isSelected
          ? 'bg-blue-100 border-blue-500 hover:bg-blue-150'
          : 'hover:bg-blue-50 hover:border-blue-300'
      )}
    >
      <div className="flex items-center justify-between flex-1">
        <p className="font-medium text-foreground">
          {firstName} {lastName}
        </p>
        <p className="text-xs text-muted-foreground">P-{playerNumber.toString().padStart(5, '0')}</p>
      </div>
      {isSelected && (
        <div className="ml-2 flex-shrink-0">
          <Check className="h-5 w-5 text-blue-600" />
        </div>
      )}
    </button>
  );
}
