/**
 * @fileoverview TableSizeLabel Component
 *
 * Clickable label for table sizes (7-Foot, 8-Foot, 9-Foot) that shows
 * additional information in a popover when clicked. Similar pattern to
 * PlayerNameLink but simpler - just displays info, no actions.
 *
 * Usage:
 * <TableSizeLabel sizeKey="bar_box_tables" />
 * <TableSizeLabel sizeKey="regulation_tables" className="text-blue-600" />
 */

import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TABLE_SIZES } from '@/constants/tables';
import type { TableSizeKey } from '@/types/venue';

interface TableSizeLabelProps {
  /** The table size key to display */
  sizeKey: TableSizeKey;
  /** Optional custom class name for styling */
  className?: string;
}

/**
 * TableSizeLabel Component
 *
 * Renders a clickable table size label (e.g., "7-Foot") that opens a
 * popover with more detailed information about that table size.
 */
export function TableSizeLabel({ sizeKey, className }: TableSizeLabelProps) {
  const [open, setOpen] = useState(false);

  // Find the config for this size
  const config = TABLE_SIZES.find(size => size.key === sizeKey);

  if (!config) {
    // Fallback if key not found (shouldn't happen with proper typing)
    return <span className={className}>{sizeKey}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors',
            className
          )}
        >
          {config.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="px-4 py-3 border-b bg-muted">
          <div className="font-semibold text-foreground">{config.infoTitle}</div>
        </div>
        <div className="px-4 py-3 text-sm text-muted-foreground">
          {config.infoContent}
        </div>
      </PopoverContent>
    </Popover>
  );
}
