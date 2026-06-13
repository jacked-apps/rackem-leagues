/**
 * @fileoverview InviteSuccessView Component
 *
 * Success state displayed after successful device handoff registration.
 * Shows confirmation message and instructions to hand device back.
 *
 * @example
 * <InviteSuccessView
 *   playerName={playerName}
 *   email={handoffEmail}
 *   onClose={() => handleClose(false)}
 * />
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

interface InviteSuccessViewProps {
  /** The player's display name */
  playerName: string;
  /** The email address used for registration */
  email: string;
  /** Callback to close the modal */
  onClose: () => void;
}

/**
 * InviteSuccessView Component
 *
 * Shows success message after device handoff registration.
 */
export const InviteSuccessView: React.FC<InviteSuccessViewProps> = ({
  playerName,
  email,
  onClose,
}) => {
  const firstName = playerName.split(' ')[0];

  return (
    <div className="space-y-4">
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
          {firstName} should check their email and click the confirmation link to complete setup.
          They can then log in on their own device.
        </p>
      </div>

      {/* Important note */}
      <div className="p-3 bg-warning/10 border border-warning/40 rounded-lg">
        <p className="text-xs text-foreground">
          <span className="font-medium">Important:</span> Please hand the device back to the league operator now.
          Your session is safe and you are not logged in as {firstName}.
        </p>
      </div>

      {/* Done button */}
      <div className="flex justify-end">
        <Button variant="default" loadingText="none" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
};
