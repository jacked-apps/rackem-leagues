/**
 * @fileoverview Code-entry step of the passwordless one-door sign-in.
 *
 * Shown after a sign-in code has been emailed. The user types the 6-digit code
 * — read from their email, or in local dev from Mailpit (http://localhost:54324)
 * — and we verify it in place; they never leave the page. Owns the code input,
 * verify, resend (with cooldown), a "wrong email? go back" affordance, and
 * wrong-vs-expired error messaging.
 */
import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { requestEmailCode, verifyEmailCode } from './passwordlessAuth';
import type { Session, User } from '@supabase/supabase-js';

/** Seconds the resend control stays disabled (matches Supabase's ~60s OTP cooldown). */
const RESEND_COOLDOWN_SECONDS = 60;

interface EmailCodeStepProps {
  /** Address the code was sent to (shown to the user, used to verify). */
  email: string;
  /** Return to the email/choose step (e.g. the user typed the wrong email). */
  onBack: () => void;
  /** Called with the authenticated user/session once the code verifies. */
  onAuthenticated: (result: { user: User | null; session: Session | null }) => void;
}

export const EmailCodeStep: React.FC<EmailCodeStepProps> = ({
  email,
  onBack,
  onAuthenticated,
}) => {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setVerifying(true);
    setMessage('');
    try {
      const result = await verifyEmailCode(email, code);
      onAuthenticated(result);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Something went wrong.';
      // Action-oriented messaging for the two common cases.
      if (/expired/i.test(text)) {
        setMessage('That code expired — tap Resend for a new one.');
      } else if (/invalid|incorrect|token/i.test(text)) {
        setMessage("That code didn't match — check it and try again.");
      } else {
        setMessage(text);
      }
      setMessageIsError(true);
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setMessage('');
    try {
      await requestEmailCode(email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage('New code sent — check your email.');
      setMessageIsError(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not resend the code.');
      setMessageIsError(true);
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={handleVerify}>
      <p className="mb-4 text-sm text-muted-foreground">
        We emailed a 6-digit code to{' '}
        <span className="font-medium text-foreground">{email}</span>.
      </p>
      <div className="mb-4">
        <Label htmlFor="code">Enter the code</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
          autoFocus
          required
        />
      </div>
      <Button
        type="submit"
        loadingText="Verifying..."
        isLoading={verifying}
        disabled={verifying}
      >
        Verify &amp; sign in
      </Button>
      <div className="mt-4 flex items-center justify-between text-sm">
        <Button type="button" variant="link" onClick={onBack}>
          Wrong email? Go back
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending…' : 'Resend code'}
        </Button>
      </div>
      {message && (
        <p
          className={`mt-3 text-sm text-center ${
            messageIsError ? 'text-destructive' : 'text-success'
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
};
