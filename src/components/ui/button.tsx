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
type ButtonBaseProps = Omit<React.ComponentProps<'button'>, 'onClick'> & {
  asChild?: boolean;
  message?: string;
  /**
   * Force the loading state.
   *
   * Usually unnecessary: if `onClick` returns a promise the button tracks it
   * automatically. Pass this only when the pending state lives somewhere else —
   * a TanStack `isPending`, or a parent coordinating several controls.
   *
   * When provided it WINS, so existing call sites behave exactly as before.
   */
  isLoading?: boolean;
  /**
   * Click handler. May be async — if it returns a promise, the button shows
   * `loadingText`, disables itself, and ignores further clicks until it
   * settles.
   *
   * Returns `unknown` rather than `void | Promise<unknown>` deliberately. Plenty
   * of existing handlers are expressions like `() => cond && doThing()`, which
   * return `false | void`; a narrower type rejects them for no benefit, since
   * what actually matters is the runtime check for a thenable.
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => unknown;
};

/** Props for action variants (default, destructive) - loadingText is REQUIRED */
type ActionButtonProps = ButtonBaseProps & {
  variant?: 'default' | 'destructive';
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
 * Loading behavior is REQUIRED for action buttons (default, destructive variants).
 * Other variants (outline, secondary, ghost, link) auto-default to no loading.
 *
 * @param loadingText - Text to show while loading, or "none" if no loading needed.
 *                      REQUIRED for default/destructive variants.
 *                      Optional for other variants (defaults to "none").
 * @param isLoading - Boolean to toggle loading state.
 * @param message - Optional error/info message to display below the button.
 * @param asChild - If true, renders as a Slot for composition.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, message, loadingText, isLoading, disabled, children, onClick, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';

  // Tracks an async onClick that hasn't settled yet.
  //
  // This exists because `loadingText` alone did nothing — the button only
  // spun and disabled when a caller ALSO passed `isLoading`, and across 200+
  // call sites plenty didn't. Those buttons stayed live for the whole request,
  // so a double-tap fired the action twice. That produced two duplicate team
  // chats and a PWA update button that looked dead, both found by a user rather
  // than a test (2026-09-05).
  //
  // Making the button track its own promise fixes every call site at once and
  // means a new one can't reintroduce it by forgetting a prop.
  const [isPending, setIsPending] = React.useState(false);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Action variants (default, destructive) require explicit loadingText
  // Other variants (outline, secondary, ghost, link) default to "none"
  const isActionVariant = variant === 'default' || variant === 'destructive' || variant === undefined;
  const effectiveLoadingText = loadingText ?? (isActionVariant ? undefined : 'none');

  // TypeScript will catch missing loadingText for action variants at compile time
  // This runtime check is a safety net
  if (isActionVariant && effectiveLoadingText === undefined) {
    console.warn('Button: loadingText is required for default/destructive variants');
  }

  // Determine if loading behavior is enabled. `loadingText="none"` is a COMPLETE
  // opt-out: no spinner, no disabling, and no promise tracking either — a Cancel
  // or Close button shouldn't change behaviour just because its handler happens
  // to be async.
  const hasLoadingBehavior = effectiveLoadingText !== 'none' && effectiveLoadingText !== undefined;

  // An explicit isLoading wins, so existing call sites are untouched.
  const busy = isLoading ?? isPending;
  const showLoading = hasLoadingBehavior && busy;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Re-entry guard. `disabled` already blocks the pointer, but a keyboard
    // Enter-repeat or a programmatic click can still arrive.
    if (showLoading) return;
    const result = onClick?.(event);
    if (!hasLoadingBehavior) return;
    if (typeof (result as Promise<unknown>)?.then !== 'function') return;

    setIsPending(true);
    // The handler may navigate or unmount this button; don't set state on a
    // component that's gone.
    const settle = () => {
      if (mounted.current) setIsPending(false);
    };
    // Both branches handled explicitly rather than `.finally()`, which returns a
    // promise that re-rejects — that produced an unhandled rejection for every
    // failing handler, i.e. this wrapper added console noise that the call site
    // never asked for.
    //
    // Reaching the rejection branch means the CALLER didn't catch it, so log
    // rather than swallow: a silently-failed action that just re-enables its
    // button is indistinguishable from one that did nothing.
    (result as Promise<unknown>).then(settle, (error: unknown) => {
      settle();
      console.error('Button: onClick handler rejected', error);
    });
  };

  // Disable button when loading
  const isDisabled = disabled || showLoading;

  return (
    <div className="flex flex-col items-center gap-2">
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        onClick={handleClick}
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
