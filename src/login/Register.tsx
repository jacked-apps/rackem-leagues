/**
 * @fileoverview Registration Page
 *
 * Standard registration page that also handles "claim" flows for placeholder players.
 * When a user visits /register?claim={memberId}, they are registering to claim
 * an existing placeholder player profile that was created by a captain/operator.
 *
 * Normal flow: User registers, creates new auth account
 * Claim flow: User registers, creates auth account, AND links to existing placeholder member
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CardAction, CardFooter } from '@/components/ui/card';
import { LoginCard } from './LoginCard';
import { Mail, AlertTriangle, UserCheck, Users } from 'lucide-react';
import { logger } from '@/utils/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Data about the placeholder being claimed */
interface ClaimData {
  memberId: string;
  playerName: string;
  isValid: boolean;
  errorMessage?: string;
}

export const Register: React.FC = () => {
  const [searchParams] = useSearchParams();
  const claimId = searchParams.get('claim');

  // Claim-related state
  const [claimData, setClaimData] = useState<ClaimData | null>(null);
  const [claimLoading, setClaimLoading] = useState(!!claimId);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  // Tracks which OAuth provider's button was clicked so only that button shows
  // "Connecting..." while both stay disabled during the redirect handoff.
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'facebook'>(null);

  /**
   * Fetch placeholder data when claim param is present
   * Validates that the member exists and is still a placeholder (user_id is null)
   */
  useEffect(() => {
    if (!claimId) {
      setClaimLoading(false);
      return;
    }

    const fetchPlaceholder = async () => {
      try {
        const { data, error } = await supabase
          .from('members')
          .select('id, first_name, last_name, user_id')
          .eq('id', claimId)
          .single();

        if (error || !data) {
          logger.warn('Invalid claim ID', { claimId, error: error?.message });
          setClaimData({
            memberId: claimId,
            playerName: '',
            isValid: false,
            errorMessage: 'This registration link is invalid or has expired.',
          });
        } else if (data.user_id !== null) {
          // Already claimed by someone
          logger.warn('Placeholder already claimed', { claimId, existingUserId: data.user_id });
          setClaimData({
            memberId: claimId,
            playerName: `${data.first_name} ${data.last_name}`,
            isValid: false,
            errorMessage: 'This player profile has already been claimed.',
          });
        } else {
          // Valid placeholder ready to claim
          logger.info('Valid placeholder found for claim', { claimId, name: `${data.first_name} ${data.last_name}` });
          setClaimData({
            memberId: claimId,
            playerName: `${data.first_name} ${data.last_name}`,
            isValid: true,
          });
        }
      } catch (err) {
        logger.error('Error fetching placeholder for claim', { error: err });
        setClaimData({
          memberId: claimId,
          playerName: '',
          isValid: false,
          errorMessage: 'An error occurred. Please try again.',
        });
      } finally {
        setClaimLoading(false);
      }
    };

    fetchPlaceholder();
  }, [claimId]);

  const handleGoogleSignup = async () => {
    setOauthLoading('google');
    setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      setMessage(`Error: ${error.message}`);
      setOauthLoading(null);
    }
    // Note: On success, user is redirected to Google, so no need to handle success here
  };

  const handleFacebookSignup = async () => {
    setOauthLoading('facebook');
    setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      setMessage(`Error: ${error.message}`);
      setOauthLoading(null);
    }
    // Note: On success, user is redirected to Facebook, so no need to handle success here
  };

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsSuccess(false);

    // Basic validation
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      setIsSuccess(false);
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters');
      setIsSuccess(false);
      setLoading(false);
      return;
    }

    // Register with Supabase
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
      setIsSuccess(false);
      setLoading(false);
      return;
    }

    // If this is a claim flow, link the new user to the placeholder member
    if (claimData?.isValid && authData.user) {
      const newUserId = authData.user.id;
      logger.info('Linking new user to placeholder member', {
        userId: newUserId,
        memberId: claimData.memberId,
      });

      const { error: updateError } = await supabase
        .from('members')
        .update({
          user_id: newUserId,
          email: email.trim(),
        })
        .eq('id', claimData.memberId)
        .is('user_id', null); // Only update if still a placeholder

      if (updateError) {
        logger.error('Failed to link user to placeholder', { error: updateError.message });
        // Account was created but linking failed
        // Still show success but warn them
        setMessage('Account created but profile linking failed. Contact support.');
      } else {
        logger.info('Successfully linked user to placeholder member', {
          userId: newUserId,
          memberId: claimData.memberId,
        });
      }
    }

    setIsSuccess(true);
    setLoading(false);
  };

  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [showAlreadyOnTeamModal, setShowAlreadyOnTeamModal] = useState(false);

  const handleResendEmail = async () => {
    setResendLoading(true);
    setResendMessage('');

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });

    if (error) {
      setResendMessage(`Error: ${error.message}`);
    } else {
      setResendMessage('Verification email sent!');
    }
    setResendLoading(false);
  };

  // Show loading state while fetching claim data
  if (claimLoading) {
    return (
      <LoginCard
        title="Loading..."
        description="Verifying your registration link"
      >
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
        </div>
      </LoginCard>
    );
  }

  // Show error if claim is invalid
  if (claimData && !claimData.isValid) {
    return (
      <LoginCard
        title="Invalid Link"
        description="There was a problem with your registration link"
      >
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <AlertTriangle className="h-16 w-16 text-warning" />
          </div>
          <p className="text-foreground">{claimData.errorMessage}</p>
          <p className="text-muted-foreground text-sm">
            Please contact your league operator for a new registration link, or register a new account below.
          </p>
        </div>
        <CardFooter className="mt-4 text-sm flex justify-around w-full">
          <Link to="/register">Register New Account</Link>
          <Link to="/login">Back to Login</Link>
        </CardFooter>
      </LoginCard>
    );
  }

  // Show success card after registration
  if (isSuccess) {
    return (
      <LoginCard
        title={claimData?.isValid ? 'Profile Claimed!' : 'Registration Success!'}
        description="Check your email to complete registration"
      >
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            {claimData?.isValid ? (
              <UserCheck className="h-16 w-16 text-success" />
            ) : (
              <Mail className="h-16 w-16 text-success" />
            )}
          </div>
          {claimData?.isValid && (
            <p className="text-foreground">
              You've claimed the profile for <strong>{claimData.playerName}</strong>
            </p>
          )}
          <p className="text-foreground">
            We sent a verification email to <strong>{email}</strong>
          </p>
          <p className="text-muted-foreground text-sm">
            Click the link in your email to verify your account and log in automatically.
          </p>
          <div className="pt-4 space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open('https://gmail.com', '_blank')}
            >
              Open Gmail
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open('https://outlook.com', '_blank')}
            >
              Open Outlook
            </Button>
          </div>
          <div className="pt-2 border-t">
            <p className="text-muted-foreground text-sm mb-2">Didn't receive the email?</p>
            <Button
              variant="ghost"
              className="w-full"
              onClick={handleResendEmail}
              disabled={resendLoading}
            >
              {resendLoading ? 'Sending...' : 'Resend Verification Email'}
            </Button>
            {resendMessage && (
              <p className={`text-sm mt-2 ${resendMessage.includes('Error') ? 'text-destructive' : 'text-success'}`}>
                {resendMessage}
              </p>
            )}
          </div>
        </div>
        <CardFooter className="mt-4 text-sm flex justify-around w-full">
          <Link to="/login">Back to Login</Link>
        </CardFooter>
      </LoginCard>
    );
  }

  return (
    <LoginCard
      title={claimData?.isValid ? 'Claim Your Profile' : 'Register'}
      description={claimData?.isValid
        ? `Complete registration to claim your player profile`
        : 'Create a new account to get started'
      }
    >
      {/* Show claim banner when claiming a profile */}
      {claimData?.isValid && (
        <div className="mb-4 p-3 bg-info/10 border border-info/40 rounded-lg">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-info shrink-0" />
            <div>
              <p className="text-sm font-medium text-info">
                Claiming profile for: {claimData.playerName}
              </p>
              <p className="text-xs text-foreground">
                Your league stats and history will be linked to your account.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Prominent "Already on a team" button - only show when not claiming */}
      {!claimData?.isValid && (
        <button
          type="button"
          onClick={() => setShowAlreadyOnTeamModal(true)}
          className="block w-full mb-6 text-left"
        >
          <div className="p-4 border-2 border-primary/50 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <p className="font-semibold text-primary">I'm already on a team</p>
            </div>
          </div>
        </button>
      )}

      {/* Already on a team info modal */}
      <Dialog open={showAlreadyOnTeamModal} onOpenChange={setShowAlreadyOnTeamModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim Your Player Profile</DialogTitle>
            <DialogDescription>
              Your league operator or team captain can help you connect your account using our invite system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">Before you register, you have 4 options:</p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>They send you a link</li>
              <li>They send you an email</li>
              <li>In person: hand off - use their device for initial registration</li>
              <li>In person: use the QR code</li>
            </ol>
            <p className="text-sm text-muted-foreground pt-2">
              You may choose to register now and connect later by asking your league operator or captain to email you the invite. (Other methods will no longer work after registration.)
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="default"
              loadingText="none"
              onClick={() => setShowAlreadyOnTeamModal(false)}
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <form onSubmit={handleRegister}>
        <div className="mb-4">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="mb-4">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="mb-4">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <PasswordInput
            id="confirmPassword"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <CardAction>
          <Button
            type="submit"
            loadingText="Creating Account..."
            isLoading={loading}
            disabled={loading}
          >
            Register
          </Button>
          {message && (
            <p className="text-sm mt-2 text-destructive">
              {message}
            </p>
          )}
        </CardAction>
      </form>

      {/* Hide OAuth option when claiming a profile - it wouldn't link the user_id */}
      {!claimData?.isValid && (
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignup}
            disabled={!!oauthLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {oauthLoading === 'google' ? 'Connecting...' : 'Sign up with Google'}
          </Button>

          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={handleFacebookSignup}
            disabled={!!oauthLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z"
                fill="#1877F2"
              />
            </svg>
            {oauthLoading === 'facebook' ? 'Connecting...' : 'Sign up with Facebook'}
          </Button>

          <CardFooter className="mt-4 text-sm flex justify-around w-full">
            <Link to="/login">Already have an account? Login</Link>
          </CardFooter>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            By registering you agree to our <Link to="/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </>
      )}
    </LoginCard>
  );
};
