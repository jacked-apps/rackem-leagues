/**
 * @fileoverview SignInFirstLink — a link to a signed-in-only page that
 * explains itself to a visitor instead of bouncing them to the login screen.
 *
 * Signed in: a plain link to `to`.
 * Signed out: tapping the child opens a small "Sign in first" dialog that
 * says why, with Sign in / Create account / Not now. Sign in carries
 * `?redirect=<to>`, so after signing in the visitor lands on the page they
 * were headed to (Login reads it through `getSafeRedirectPath`).
 *
 * Why: a public page (e.g. Become a League Operator) can have a button that
 * leads somewhere members-only. Dropping a visitor on the login screen with
 * no explanation feels like an error (Ed, 2026-11-19).
 *
 * @example
 * <SignInFirstLink
 *   to="/league-operator-application"
 *   reason="You need an account to apply. After you sign in, we'll take you straight to the application."
 * >
 *   <Button>Start Application</Button>
 * </SignInFirstLink>
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@/context/useUser';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SignInFirstLinkProps {
  /** The signed-in-only path the child leads to. */
  to: string;
  /** One or two plain sentences: why an account is needed, what happens next. */
  reason: string;
  /** The tappable thing (usually a Button). */
  children: React.ReactNode;
}

export function SignInFirstLink({ to, reason, children }: SignInFirstLinkProps) {
  const { isLoggedIn } = useUser();
  const [open, setOpen] = useState(false);

  if (isLoggedIn) return <Link to={to}>{children}</Link>;

  return (
    <>
      {/* `contents` keeps the child's own layout; the tap bubbles up to here. */}
      <span className="contents" onClick={() => setOpen(true)}>
        {children}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in first</DialogTitle>
            <DialogDescription>{reason}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button variant="ghost" loadingText="none">Not now</Button>
            </DialogClose>
            <Link to="/register">
              <Button variant="outline" loadingText="none" className="w-full">Create account</Button>
            </Link>
            <Link to={`/login?redirect=${encodeURIComponent(to)}`}>
              <Button loadingText="none" className="w-full">Sign in</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
