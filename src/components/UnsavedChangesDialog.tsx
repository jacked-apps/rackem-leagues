/**
 * @fileoverview Unsaved Changes Dialog Component
 *
 * A reusable dialog that warns users when they're about to navigate away
 * from a page with unsaved changes. Works with react-router's useBlocker hook.
 *
 * Usage:
 * 1. Use useBlocker to detect navigation attempts when there are unsaved changes
 * 2. Pass the blocker to this component
 * 3. The dialog will show when navigation is blocked
 *
 * @example
 * const blocker = useBlocker(({ currentLocation, nextLocation }) =>
 *   isModified && currentLocation.pathname !== nextLocation.pathname
 * );
 *
 * <UnsavedChangesDialog blocker={blocker} />
 */

import React from 'react';
import type { Blocker } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

/**
 * Props for UnsavedChangesDialog component
 */
export interface UnsavedChangesDialogProps {
  /** The blocker from react-router's useBlocker hook */
  blocker: Blocker;
  /** Custom title for the dialog */
  title?: string;
  /** Custom description for the dialog */
  description?: string;
  /** Custom label for the cancel button */
  cancelLabel?: string;
  /** Custom label for the confirm button */
  confirmLabel?: string;
}

/**
 * UnsavedChangesDialog Component
 *
 * Shows an alert dialog when the user tries to navigate away from a page
 * with unsaved changes. Provides options to stay on the page or discard
 * changes and navigate away.
 *
 * @example
 * const blocker = useBlocker(({ currentLocation, nextLocation }) =>
 *   hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
 * );
 *
 * return (
 *   <>
 *     <UnsavedChangesDialog blocker={blocker} />
 *     {// rest of your page //}
 *   </>
 * );
 */
export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  blocker,
  title = 'Unsaved Changes',
  description = 'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
  cancelLabel = 'Stay on Page',
  confirmLabel = 'Leave Without Saving',
}) => {
  // Only render when blocker is active (state === 'blocked')
  if (blocker.state !== 'blocked') {
    return null;
  }

  return (
    <AlertDialog open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => blocker.proceed?.()}
            className={buttonVariants({ variant: 'destructive' })}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default UnsavedChangesDialog;
