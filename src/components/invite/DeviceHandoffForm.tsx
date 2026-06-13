/**
 * @fileoverview DeviceHandoffForm Component
 *
 * Form for in-person device handoff registration.
 * Captain hands device to player who creates their account on the spot.
 *
 * Features:
 * - Email, password, confirm password fields
 * - Creates auth account and links to placeholder member
 * - Does NOT log the captain out
 *
 * @example
 * <DeviceHandoffForm
 *   playerId={playerId}
 *   playerName={playerName}
 *   initialEmail={email}
 *   onSuccess={(email) => setMode('success')}
 *   onBack={() => setMode('options')}
 * />
 */

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

interface DeviceHandoffFormProps {
  /** The player's member ID */
  playerId: string;
  /** The player's display name */
  playerName: string;
  /** Pre-filled email (if available) */
  initialEmail?: string;
  /** Callback on successful account creation */
  onSuccess: (email: string) => void;
  /** Callback to go back to options */
  onBack: () => void;
}

/**
 * DeviceHandoffForm Component
 *
 * Allows a player to create their account on the captain's device.
 */
export const DeviceHandoffForm: React.FC<DeviceHandoffFormProps> = ({
  playerId,
  playerName,
  initialEmail = '',
  onSuccess,
  onBack,
}) => {
  const queryClient = useQueryClient();

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle form submission
   * Creates auth account and links to placeholder member
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Create auth account (does NOT log anyone in)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) {
        logger.error('Handoff signUp failed', { error: authError.message });
        setError(authError.message);
        setIsSubmitting(false);
        return;
      }

      if (!authData.user) {
        setError('Failed to create account - no user returned');
        setIsSubmitting(false);
        return;
      }

      const newUserId = authData.user.id;
      logger.info('Auth account created for handoff', { userId: newUserId, email: email.trim() });

      // Step 2: Link the new user_id to the placeholder member record
      const { error: updateError } = await supabase
        .from('members')
        .update({
          user_id: newUserId,
          email: email.trim(),
        })
        .eq('id', playerId)
        .is('user_id', null); // Only update if still a placeholder

      if (updateError) {
        logger.error('Failed to link user to placeholder', { error: updateError.message });
        setError('Account created but failed to link to profile. Contact support.');
        setIsSubmitting(false);
        return;
      }

      logger.info('Successfully linked user to placeholder member', {
        userId: newUserId,
        memberId: playerId
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member', playerId] });

      // Success!
      setIsSubmitting(false);
      onSuccess(email.trim());

    } catch (err) {
      logger.error('Unexpected error during handoff', { error: err });
      setError('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const firstName = playerName.split(' ')[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Instructions for the person registering */}
      <div className="p-3 bg-info/10 border border-info/40 rounded-lg">
        <p className="text-sm text-foreground">
          <span className="font-medium">Hi {firstName}!</span> Enter your email and create a password to claim your player profile.
        </p>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="handoff-email">Email</Label>
        <Input
          id="handoff-email"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          disabled={isSubmitting}
          autoComplete="email"
          autoFocus
        />
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="handoff-password">Password</Label>
        <Input
          id="handoff-password"
          type="password"
          placeholder="Create a password"
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          disabled={isSubmitting}
          autoComplete="new-password"
        />
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <Label htmlFor="handoff-confirm">Confirm Password</Label>
        <Input
          id="handoff-confirm"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
          disabled={isSubmitting}
          autoComplete="new-password"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/40 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Submit button */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          loadingText="Creating account..."
          className="flex-1"
        >
          Create Account
        </Button>
      </div>
    </form>
  );
};
