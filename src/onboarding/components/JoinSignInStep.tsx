/**
 * @fileoverview Inline sign-in step for the team-join flow.
 *
 * A brand-new joiner taps a shared team link and needs to sign in WITHOUT
 * leaving the join context. Because passwordless sign-in is an in-page email
 * code (not a magic-link bounce-out), we reuse `requestEmailCode` +
 * `EmailCodeStep` right here on /join — the team name stays on screen the whole
 * time and the join intent never leaves React state. On success the user
 * context is updated and the team's join view is invalidated so the page
 * re-reads and advances (profile form → Join).
 *
 * Google / password sign-in stay on the dedicated /login screen, reachable via
 * the "More options" link (which carries the join path so it returns here).
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 3).
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requestEmailCode } from '@/login/passwordlessAuth';
import { EmailCodeStep } from '@/login/EmailCodeStep';
import { useUser } from '@/context/useUser';
import { queryKeys } from '@/api/queryKeys';
import type { Session, User } from '@supabase/supabase-js';

interface JoinSignInStepProps {
  /** The team join token (for the "more options" return path + cache key). */
  token: string;
  /** Team name, shown so the joiner knows what they're signing in to join. */
  teamName: string;
  /** League name, shown as a subtitle. */
  leagueName: string | null;
}

/** Email-code sign-in rendered inline on the join page. */
export const JoinSignInStep: React.FC<JoinSignInStepProps> = ({
  token,
  teamName,
  leagueName,
}) => {
  const { setUser, setIsLoggedIn } = useUser();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await requestEmailCode(email);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a code.');
    } finally {
      setSending(false);
    }
  };

  const onAuthenticated = (result: { user: User | null; session: Session | null }) => {
    if (result.user) {
      setUser(result.user);
      setIsLoggedIn(true);
    }
    // Re-read the join view with the now-authenticated session so the page can
    // advance (its viewer_request_status / member checks update).
    queryClient.invalidateQueries({ queryKey: queryKeys.teamJoin.view(token) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {teamName}</CardTitle>
        {leagueName && (
          <p className="text-sm text-muted-foreground">{leagueName}</p>
        )}
      </CardHeader>
      <CardContent>
        {step === 'code' ? (
          <EmailCodeStep
            email={email}
            onBack={() => setStep('email')}
            onAuthenticated={onAuthenticated}
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Enter your email and we'll send you a code — no password needed.
            </p>
            <form onSubmit={sendCode}>
              <div className="mb-4">
                <Label htmlFor="join-email">Email</Label>
                <Input
                  id="join-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <Button
                type="submit"
                loadingText="Sending code..."
                isLoading={sending}
                disabled={sending}
              >
                Email me a code
              </Button>
            </form>
            {error && (
              <p className="mt-3 text-sm text-center text-destructive">{error}</p>
            )}
            <div className="mt-4 text-center">
              <Button asChild variant="link">
                <Link to={`/login?redirect=${encodeURIComponent(`/join/${token}`)}`}>
                  More sign-in options
                </Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
