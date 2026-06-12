/**
 * @fileoverview Register Player Modal
 *
 * Modal for registering an unregistered/placeholder player.
 * Provides options to:
 * - Copy a registration link to share with the player
 * - Initiate a device handoff for in-person registration
 * - Show a QR code for the player to scan
 *
 * Device Handoff Flow:
 * 1. Captain clicks "Start Device Handoff"
 * 2. Modal shows minimal registration form (email + password)
 * 3. Friend fills out the form on captain's device
 * 4. signUp() creates auth account, returns user_id
 * 5. We immediately link user_id to the placeholder member record
 * 6. Friend goes home, confirms email, logs in on their device
 * 7. Captain's session is never interrupted (signUp doesn't log anyone in)
 *
 * This modal is accessed from the PlayerNameLink popover menu
 * when viewing an unregistered player's profile.
 */
import { useState, useMemo } from 'react';
import { Copy, Check, Smartphone, AlertTriangle, QrCode, ChevronDown, ChevronUp, ArrowLeft, Mail } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

/** Modes for the modal */
type ModalMode = 'options' | 'handoff' | 'success';

/**
 * Determine current environment based on hostname
 * Returns: 'local' | 'staging' | 'production'
 */
function getEnvironment(): 'local' | 'staging' | 'production' {
  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
    return 'local';
  }

  // TODO: Update these with your actual domains
  if (hostname.includes('staging') || hostname.includes('dev') || hostname.includes('test')) {
    return 'staging';
  }

  return 'production';
}

interface RegisterPlayerModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** The player's member ID */
  playerId: string;
  /** The player's display name */
  playerName: string;
}

/**
 * RegisterPlayerModal Component
 *
 * Provides two registration options:
 * 1. Copy Link - Generate and copy a registration link to share
 * 2. Device Handoff - Start in-person registration flow
 */
export function RegisterPlayerModal({
  open,
  onOpenChange,
  playerId,
  playerName,
}: RegisterPlayerModalProps) {
  // Modal mode state
  const [mode, setMode] = useState<ModalMode>('options');

  // Options mode state
  const [copied, setCopied] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  // Handoff form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect current environment
  const environment = useMemo(() => getEnvironment(), []);
  const isLocal = environment === 'local';
  const isStaging = environment === 'staging';

  // Generate the registration link
  // For local dev, show a warning that links won't work
  // For staging/production, use the actual origin
  const registrationLink = `${window.location.origin}/register?claim=${playerId}`;

  /**
   * Reset all form state when modal closes or mode changes
   */
  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setIsSubmitting(false);
  };

  /**
   * Handle modal close - reset to options mode
   */
  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset everything when closing
      setMode('options');
      resetForm();
      setShowQrCode(false);
      setCopied(false);
    }
    onOpenChange(newOpen);
  };

  /**
   * Copy registration link to clipboard
   */
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(registrationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = registrationLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /**
   * Start device handoff flow - switch to handoff mode
   */
  const handleDeviceHandoff = () => {
    resetForm();
    setMode('handoff');
  };

  /**
   * Go back to options from handoff mode
   */
  const handleBackToOptions = () => {
    resetForm();
    setMode('options');
  };

  /**
   * Handle handoff form submission
   * Creates auth account and links to placeholder member
   */
  const handleHandoffSubmit = async (e: React.FormEvent) => {
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
        // Account was created but linking failed - this is a problem
        // The user can still confirm email and log in, but they won't be linked
        setError('Account created but failed to link to profile. Contact support.');
        setIsSubmitting(false);
        return;
      }

      logger.info('Successfully linked user to placeholder member', {
        userId: newUserId,
        memberId: playerId
      });

      // Success! Show success state
      setMode('success');
      setIsSubmitting(false);

    } catch (err) {
      logger.error('Unexpected error during handoff', { error: err });
      setError('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {/* ============ OPTIONS MODE ============ */}
        {mode === 'options' && (
          <>
            <DialogHeader>
              <DialogTitle>Register Player</DialogTitle>
              <DialogDescription>
                Help <span className="font-medium text-foreground">{playerName}</span> create their account
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Option 1: Device Handoff (moved to top) */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">In-Person Registration</Label>
                <p className="text-xs text-muted-foreground">
                  Hand your device to the player so they can register right now.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={handleDeviceHandoff}
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Start Device Handoff</span>
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {/* Option 2: Copy Registration Link */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Share Registration Link</Label>
                <p className="text-xs text-muted-foreground">
                  Send this link to the player so they can create their account and claim their profile.
                </p>

                {/* Environment Warning */}
                {isLocal && (
                  <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/40 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <div className="text-xs text-warning">
                      <p className="font-medium">Local Development</p>
                      <p>Registration links won't work in local environment. Test on staging or production.</p>
                    </div>
                  </div>
                )}

                {isStaging && (
                  <div className="flex items-start gap-2 p-3 bg-info/10 border border-info/40 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-info mt-0.5 shrink-0" />
                    <div className="text-xs text-info">
                      <p className="font-medium">Staging Environment</p>
                      <p>This link points to the staging site, not production.</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={registrationLink}
                    className="flex-1 text-sm bg-muted"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    className="shrink-0"
                    disabled={isLocal}
                    title={isLocal ? 'Links do not work in local development' : 'Copy link'}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {copied && (
                  <p className="text-xs text-success">Link copied to clipboard!</p>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {/* Option 3: QR Code */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowQrCode(!showQrCode)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium cursor-pointer">Show QR Code</Label>
                  </div>
                  {showQrCode ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {showQrCode && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Have the player scan this code with their phone to register.
                    </p>
                    <div className="flex justify-center p-4 bg-card rounded-lg border">
                      <QRCodeSVG
                        value={registrationLink}
                        size={180}
                        level="M"
                        includeMargin={true}
                      />
                    </div>
                    {isLocal && (
                      <p className="text-xs text-warning text-center">
                        QR code points to localhost and won't work on other devices.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => handleClose(false)}>
                Close
              </Button>
            </div>
          </>
        )}

        {/* ============ HANDOFF MODE ============ */}
        {mode === 'handoff' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBackToOptions}
                  className="p-1 hover:bg-muted rounded-md transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <DialogTitle>Device Handoff</DialogTitle>
              </div>
              <DialogDescription>
                Hand your device to <span className="font-medium text-foreground">{playerName}</span> to complete registration
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleHandoffSubmit} className="space-y-4 py-4">
              {/* Instructions for the person registering */}
              <div className="p-3 bg-info/10 border border-info/40 rounded-lg">
                <p className="text-sm text-info">
                  <span className="font-medium">Hi {playerName.split(' ')[0]}!</span> Enter your email and create a password to claim your player profile.
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
                  onClick={handleBackToOptions}
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
          </>
        )}

        {/* ============ SUCCESS MODE ============ */}
        {mode === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle>Account Created!</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Success icon */}
              <div className="flex justify-center">
                <div className="p-4 bg-success/10 rounded-full">
                  <Mail className="h-8 w-8 text-success" />
                </div>
              </div>

              {/* Success message */}
              <div className="text-center space-y-2">
                <p className="text-sm text-foreground">
                  A confirmation email has been sent to <span className="font-medium">{email}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {playerName.split(' ')[0]} should check their email and click the confirmation link to complete setup.
                  They can then log in on their own device.
                </p>
              </div>

              {/* Important note */}
              <div className="p-3 bg-warning/10 border border-warning/40 rounded-lg">
                <p className="text-xs text-warning">
                  <span className="font-medium">Important:</span> Please hand the device back to the league operator now.
                  Your session is safe and you are not logged in as {playerName.split(' ')[0]}.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end">
              <Button variant="default" loadingText="none" onClick={() => handleClose(false)}>
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
