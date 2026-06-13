/**
 * @fileoverview Confirm Dialog Hook
 *
 * A reusable hook that provides a promise-based confirmation dialog.
 * Works like window.confirm() but with a styled modal dialog.
 * Uses shadcn AlertDialog component for consistent UI and accessibility.
 *
 * Usage:
 * const { confirm, ConfirmDialogComponent } = useConfirmDialog();
 *
 * // In your handler:
 * const confirmed = await confirm({
 *   title: 'Delete Team?',
 *   message: 'This action cannot be undone.',
 * });
 * if (confirmed) {
 *   // do the thing
 * }
 *
 * // In your JSX (at the end of your component):
 * {ConfirmDialogComponent}
 */
import { useState, useCallback } from 'react';
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
import { cn } from '@/lib/utils';

export interface ConfirmOptions {
  /** Dialog title */
  title: string;
  /** Confirmation message */
  message: string;
  /** Text for the confirm button (default: 'Confirm') */
  confirmText?: string;
  /** Text for the cancel button (default: 'Cancel') */
  cancelText?: string;
  /** Button variant for confirm button (default: 'destructive') */
  confirmVariant?: 'default' | 'destructive';
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

/**
 * useConfirmDialog Hook
 *
 * Provides a promise-based confirmation dialog that can be awaited.
 * Returns the confirm function and the dialog component to render.
 * Uses shadcn AlertDialog for proper accessibility (keyboard navigation,
 * focus trapping, screen reader support).
 *
 * @example
 * function MyComponent() {
 *   const { confirm, ConfirmDialogComponent } = useConfirmDialog();
 *
 *   const handleDelete = async () => {
 *     const confirmed = await confirm({
 *       title: 'Delete Item?',
 *       message: 'This cannot be undone.',
 *       confirmText: 'Delete',
 *     });
 *     if (confirmed) {
 *       await deleteItem();
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleDelete}>Delete</button>
 *       {ConfirmDialogComponent}
 *     </>
 *   );
 * }
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmVariant: 'destructive',
    resolve: null,
  });

  /**
   * Show the confirmation dialog and return a promise that resolves
   * to true (confirmed) or false (cancelled)
   */
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        confirmVariant: options.confirmVariant || 'destructive',
        resolve,
      });
    });
  }, []);

  /**
   * Handle user clicking confirm
   */
  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  /**
   * Handle user clicking cancel or clicking outside
   */
  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  /**
   * The dialog component to render in your JSX
   * Uses shadcn AlertDialog for consistent styling and accessibility
   */
  const ConfirmDialogComponent = (
    <AlertDialog open={state.isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {state.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {state.cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={cn(
              state.confirmVariant === 'destructive' &&
                buttonVariants({ variant: 'destructive' })
            )}
          >
            {state.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    confirm,
    ConfirmDialogComponent,
  };
}

export default useConfirmDialog;
