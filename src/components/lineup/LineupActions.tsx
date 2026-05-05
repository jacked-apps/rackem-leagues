/**
 * @fileoverview Lineup Actions Component
 *
 * Displays Lock/Unlock buttons and opponent status.
 * Handles button states and click events for lineup management.
 *
 * Status System (based on match lineup_id and locked state):
 * - Absent: No lineup ID in match record (opponent hasn't joined yet)
 * - Choosing Lineup: Has lineup ID but not locked (opponent is selecting players)
 * - Ready: Has lineup ID and is locked (opponent is ready to start)
 */

import { Button } from '@/components/ui/button';
import { Lock, CheckCircle, UserX, Users, Loader2 } from 'lucide-react';

type OpponentStatus = 'absent' | 'choosing' | 'ready';

interface LineupActionsProps {
  locked: boolean;
  opponentStatus: OpponentStatus; // New 3-status system
  opponentStatusText?: string; // Optional detailed status text (e.g., "Players chosen: 2")
  canLock: boolean; // All positions filled
  canUnlock: boolean; // Opponent hasn't locked yet
  onLock: () => void;
  onUnlock: () => void;
  /**
   * True while prep_match is in flight (or while we're waiting for it to
   * be in flight on the home device, in the away-team case). Disables
   * Unlock and shows a "Setting up match…" indicator under the buttons.
   * The route guard navigates away as soon as status flips, so this state
   * is typically visible for ~1–3 seconds.
   */
  isPreparing?: boolean;
}

/**
 * Lineup action buttons with status indicators.
 *
 * Shows Lock/Unlock for the user's lineup and reports opponent status.
 * Navigation to the scoring page is NOT handled here — useMatchPreparation
 * auto-navigates once both lineups are locked and (for Fargo) start-points
 * are mutually confirmed.
 */
export function LineupActions({
  locked,
  opponentStatus,
  opponentStatusText,
  canLock,
  canUnlock,
  onLock,
  onUnlock,
  isPreparing = false,
}: LineupActionsProps) {
  return (
    <div className="space-y-4">
      {/* Opponent Status */}
      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
        <span className="text-sm font-medium text-foreground">Opponent Status:</span>
        <div className="flex items-center gap-2">
          {opponentStatus === 'absent' && (
            <>
              <UserX className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Absent</span>
            </>
          )}
          {opponentStatus === 'choosing' && (
            <>
              <Users className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-600">
                {opponentStatusText || 'Choosing Lineup'}
              </span>
            </>
          )}
          {opponentStatus === 'ready' && (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-semibold text-green-600">
                {opponentStatusText || 'Ready'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Your Status */}
      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
        <span className="text-sm font-medium text-foreground">Your Status:</span>
        <div className="flex items-center gap-2">
          {locked ? (
            <>
              <Lock className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-600">Locked</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Not Locked</span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        {!locked ? (
          <Button
            loadingText="Locking..."
            onClick={onLock}
            disabled={!canLock}
            className="w-full"
            size="lg"
          >
            <Lock className="h-4 w-4 mr-2" />
            Lock Lineup
          </Button>
        ) : (
          <Button
            onClick={onUnlock}
            disabled={!canUnlock || isPreparing}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Unlock Lineup
          </Button>
        )}
      </div>

      {/* Prep-in-flight indicator (Defense 7's polling + the route
          guard's status redirect navigate away as soon as match.status
          flips, so this is typically visible for ~1–3 seconds). */}
      {isPreparing && (
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Setting up match…
        </p>
      )}

      {/* Helper Text */}
      {!locked && !canLock && (
        <p className="text-xs text-muted-foreground text-center">
          Select all players before locking your lineup
        </p>
      )}

      {locked && !canUnlock && (
        <p className="text-xs text-muted-foreground text-center">
          Cannot unlock - opponent has already locked their lineup
        </p>
      )}

      {locked && opponentStatus === 'absent' && (
        <p className="text-xs text-muted-foreground text-center">
          Waiting for opponent to join...
        </p>
      )}

      {locked && opponentStatus === 'choosing' && (
        <p className="text-xs text-muted-foreground text-center">
          Waiting for opponent to lock their lineup...
        </p>
      )}
    </div>
  );
}
