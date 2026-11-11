/**
 * @fileoverview TableBadgePopover Component
 *
 * Clickable table badge that shows a popover menu with actions.
 * Used in VenueLimitModal to allow operators to move tables between
 * available and unavailable states.
 *
 * Similar pattern to PlayerNameLink but simpler - just displays
 * table info and provides move action.
 */

import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X as XIcon, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableBadgePopoverProps {
  /** The table number to display */
  tableNumber: number;
  /** The table size label (e.g., "7-Foot") */
  sizeLabel: string;
  /** Whether this table is currently available */
  isAvailable: boolean;
  /** Whether this table's size category is disabled */
  isSizeDisabled?: boolean;
  /** Called when user wants to toggle availability */
  onToggle: () => void;
  /** Called when user confirms re-enabling the size category (adds all tables of that size) */
  onEnableSize?: () => void;
  /** Called when user wants to add just this single table (keeps size disabled but removes from blocked) */
  onAddSingleTable?: () => void;
  /** Whether custom ordering is active (shows move options when true) */
  isCustomOrder?: boolean;
  /** Whether this is the first table in the list (disables move up) */
  isFirst?: boolean;
  /** Whether this is the last table in the list (disables move down) */
  isLast?: boolean;
  /** Called when user wants to move this table up in order */
  onMoveUp?: () => void;
  /** Called when user wants to move this table down in order */
  onMoveDown?: () => void;
}

/**
 * TableBadgePopover Component
 *
 * Renders a clickable table badge that opens a popover with
 * table info and a move action.
 */
export function TableBadgePopover({
  tableNumber,
  sizeLabel,
  isAvailable,
  isSizeDisabled = false,
  onToggle,
  onEnableSize,
  onAddSingleTable,
  isCustomOrder = false,
  isFirst = false,
  isLast = false,
  onMoveUp,
  onMoveDown,
}: TableBadgePopoverProps) {
  const [open, setOpen] = useState(false);
  const [showEnableSizeConfirm, setShowEnableSizeConfirm] = useState(false);

  const handleToggle = () => {
    // If trying to make available but the size category is disabled, show confirmation
    if (!isAvailable && isSizeDisabled) {
      setOpen(false);
      setShowEnableSizeConfirm(true);
      return;
    }

    onToggle();
    setOpen(false);
  };

  const handleAddSingleTable = () => {
    // Just add this single table without enabling the whole size category
    if (onAddSingleTable) {
      onAddSingleTable();
    }
    setShowEnableSizeConfirm(false);
  };

  const handleEnableSizeConfirm = () => {
    // Re-enable the size category, which will make all tables of this size available
    if (onEnableSize) {
      onEnableSize();
    }
    setShowEnableSizeConfirm(false);
  };

  const handleMoveUp = () => {
    if (onMoveUp) {
      onMoveUp();
    }
    // Keep popover open so user can move multiple times
  };

  const handleMoveDown = () => {
    if (onMoveDown) {
      onMoveDown();
    }
    // Keep popover open so user can move multiple times
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex flex-col items-center group cursor-pointer"
          >
            <span
              className={cn(
                'inline-flex items-center justify-center w-8 h-8 text-sm font-medium bg-card rounded border transition-colors',
                isAvailable
                  ? 'text-info border-info/40 group-hover:border-info/60'
                  : 'text-destructive border-destructive/40 group-hover:border-destructive/60'
              )}
            >
              {tableNumber}
            </span>
            <span
              className={cn(
                'text-[10px] mt-0.5',
                isAvailable ? 'text-info' : 'text-destructive'
              )}
            >
              {sizeLabel}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0" align="center">
          <div className="flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-muted flex items-start justify-between">
              <div>
                <div className="font-semibold text-foreground">Table {tableNumber}</div>
                <div className="text-xs text-muted-foreground">{sizeLabel}</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-muted-foreground -mr-1 -mt-1"
                aria-label="Close"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Move Up/Down actions (only for available tables in custom order mode) */}
            {isAvailable && isCustomOrder && (
              <>
                <button
                  onClick={handleMoveUp}
                  disabled={isFirst}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left',
                    isFirst
                      ? 'text-muted-foreground cursor-not-allowed'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <ChevronUp className="h-4 w-4" />
                  <span>Move Up</span>
                </button>
                <button
                  onClick={handleMoveDown}
                  disabled={isLast}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left',
                    isLast
                      ? 'text-muted-foreground cursor-not-allowed'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <ChevronDown className="h-4 w-4" />
                  <span>Move Down</span>
                </button>
                <div className="border-t border-border" />
              </>
            )}

            {/* Toggle availability action */}
            <button
              onClick={handleToggle}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left',
                isAvailable ? 'text-destructive' : 'text-success'
              )}
            >
              {isAvailable ? (
                <>
                  <XIcon className="h-4 w-4" />
                  <span>Move to Unavailable</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Move to Available</span>
                </>
              )}
            </button>

            {/* Warning if size is disabled */}
            {!isAvailable && isSizeDisabled && (
              <div className="px-4 py-2 bg-warning/10 border-t border-warning/40">
                <div className="flex items-center gap-2 text-xs text-warning">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  <span>{sizeLabel} tables are disabled</span>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Dialog for choosing how to add table when size is disabled */}
      <Dialog open={showEnableSizeConfirm} onOpenChange={setShowEnableSizeConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Table {tableNumber}?</DialogTitle>
            <DialogDescription>
              {sizeLabel} tables are currently disabled. How would you like to add this table?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {/* Option 1: Add just this table */}
            <button
              onClick={handleAddSingleTable}
              className="w-full text-left p-3 border rounded-lg hover:bg-muted transition-colors"
            >
              <div className="font-medium text-foreground">Add only Table {tableNumber}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Keep {sizeLabel} tables disabled, but add this single table to available.
              </div>
            </button>

            {/* Option 2: Enable all tables of this size */}
            <button
              onClick={handleEnableSizeConfirm}
              className="w-full text-left p-3 border rounded-lg hover:bg-muted transition-colors"
            >
              <div className="font-medium text-foreground">Enable all {sizeLabel} tables</div>
              <div className="text-sm text-muted-foreground mt-1">
                Re-enable the {sizeLabel} checkbox and add all tables of this size. You can then remove individual tables.
              </div>
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnableSizeConfirm(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
