/**
 * @fileoverview Button Component with Built-in Loading State
 *
 * Enhanced shadcn/ui Button with required loading state handling.
 * Every button must explicitly declare its loading behavior to ensure
 * developers consider async operations and user feedback.
 *
 * @example
 * // Button with loading state
 * <Button loadingText="Saving..." isLoading={isSaving} onClick={handleSave}>
 *   Save
 * </Button>
 *
 * @example
 * // Button that doesn't need loading (e.g., Cancel, Close)
 * <Button loadingText="none" onClick={handleCancel}>
 *   Cancel
 * </Button>
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary border border-border text-secondary-foreground hover:bg-secondary/80',
        // For an action that is allowed but carries a consequence — "start
        // without them", "skip this". Distinct from `destructive`, which is for
        // deleting something; this is caution, not danger.
        warning:
          'bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:ring-warning/20 dark:focus-visible:ring-warning/40',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/** Base props shared by all button variants */
type ButtonBaseProps = React.ComponentProps<'button'> & {
  asChild?: boolean;
  message?: string;
  /** Whether the button is currently in loading state */
  isLoading?: boolean;
};

/** Props for action variants (default, destructive, warning) - loadingText is REQUIRED */
type ActionButtonProps = ButtonBaseProps & {
  variant?: 'default' | 'destructive' | 'warning';
  /** Text to display while loading, or "none" if no loading behavior needed. REQUIRED. */
  loadingText: string;
} & Omit<VariantProps<typeof buttonVariants>, 'variant'>;

/** Props for non-action variants (outline, secondary, ghost, link) - loadingText is optional */
type NonActionButtonProps = ButtonBaseProps & {
  variant: 'outline' | 'secondary' | 'ghost' | 'link';
  /** Text to display while loading. Optional - defaults to "none" for non-action variants. */
  loadingText?: string;
} & Omit<VariantProps<typeof buttonVariants>, 'variant'>;

type ButtonProps = ActionButtonProps | NonActionButtonProps;

/**
 * Button component with built-in loading state support.
 *
 * Loading behavior is REQUIRED for action buttons (default, destructive,
 * warning variants). Other variants (outline, secondary, ghost, link)
 * auto-default to no loading.
 *
 * @param loadingText - Text to show while loading, or "none" if no loading needed.
 *                      REQUIRED for default/destructive/warning variants.
 *                      Optional for other variants (defaults to "none").
 * @param isLoading - Boolean to toggle loading state.
 * @param message - Optional error/info message to display below the button.
 * @param asChild - If true, renders as a Slot for composition.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, message, loadingText, isLoading = false, disabled, children, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';

  // Action variants (default, destructive, warning) require explicit loadingText
  // Other variants (outline, secondary, ghost, link) default to "none"
  const isActionVariant =
    variant === 'default' ||
    variant === 'destructive' ||
    variant === 'warning' ||
    variant === undefined;
  const effectiveLoadingText = loadingText ?? (isActionVariant ? undefined : 'none');

  // TypeScript will catch missing loadingText for action variants at compile time
  // This runtime check is a safety net
  if (isActionVariant && effectiveLoadingText === undefined) {
    console.warn(
      'Button: loadingText is required for default/destructive/warning variants'
    );
  }

  // Determine if loading behavior is enabled
  const hasLoadingBehavior = effectiveLoadingText !== 'none' && effectiveLoadingText !== undefined;

  // Show loading state only if loading behavior is enabled AND isLoading is true
  const showLoading = hasLoadingBehavior && isLoading;

  // Disable button when loading
  const isDisabled = disabled || showLoading;

  return (
    <div className="flex flex-col items-center gap-2">
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {showLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {effectiveLoadingText}
          </>
        ) : (
          children
        )}
      </Comp>
      {message && <p className="text-sm text-destructive">{message}</p>}
    </div>
  );
});

Button.displayName = 'Button';

export { Button, buttonVariants };
