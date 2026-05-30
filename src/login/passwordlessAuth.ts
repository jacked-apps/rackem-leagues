/**
 * @fileoverview Passwordless sign-in helpers (email one-time code).
 *
 * Thin wrappers around Supabase Auth's OTP API for the one-door sign-in flow:
 * the user enters an email, we send a 6-digit code (NOT a magic link — the
 * code-vs-link choice is made by the email template, configured in the Supabase
 * project, not here), and they type it on the same screen.
 *
 * `signInWithOtp` create-or-finds the account (its `shouldCreateUser` option
 * defaults to `true`), so callers never branch on new-vs-returning — that's the
 * "one door" behaviour.
 *
 * These live in their own module (rather than inline in the screen) so the
 * send/verify behaviour is unit-testable and reusable, following the
 * `src/api/mutations` convention of throwing on failure.
 */
import { supabase } from '../supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Request a one-time sign-in code be emailed to `email`.
 *
 * Relies on the default `shouldCreateUser: true`, so a brand-new email creates
 * an account and an existing email logs in — the same call either way.
 *
 * @param email - The address to send the code to.
 * @throws Error if the email is blank or Supabase rejects the request.
 */
export async function requestEmailCode(email: string): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed) {
    throw new Error('Please enter your email address.');
  }

  const { error } = await supabase.auth.signInWithOtp({ email: trimmed });
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Verify a typed one-time code and establish a session.
 *
 * Uses `type: 'email'` — the current type for email OTP login, NOT the legacy
 * `'signup'` type used by the email-confirmation *link* flow
 * (`EmailConfirmation.tsx`). On success Supabase's `onAuthStateChange` updates
 * the app's UserProvider automatically; the returned user/session is provided
 * for callers that also want to update context synchronously before navigating.
 *
 * @param email - The address the code was sent to.
 * @param token - The 6-digit code the user typed.
 * @returns The authenticated user and session.
 * @throws Error if email/token are blank, or the code is wrong/expired.
 */
export async function verifyEmailCode(
  email: string,
  token: string,
): Promise<{ user: User | null; session: Session | null }> {
  const trimmedEmail = email.trim();
  const trimmedToken = token.trim();
  if (!trimmedEmail || !trimmedToken) {
    throw new Error('Enter the code we emailed you.');
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedToken,
    type: 'email',
  });
  if (error) {
    throw new Error(error.message);
  }

  return { user: data.user, session: data.session };
}
