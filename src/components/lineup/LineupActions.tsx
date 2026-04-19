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
import { Lock, CheckCircle, UserX, Users } from 'lucide-react';

type OpponentStatus = 'absent' | 'choosing' | 'ready';

interface LineupActionsProps {
  locked: boolean;
  opponentStatus: OpponentStatus; // New 3-status system
  opponentStatusText?: string; // Optional detailed status text (e.g., "Players chosen: 2")
  canLock: boolean; // All positions filled
  canUnlock: boolean; // Opponent hasn't locked yet
  onLock: () => void;
  onUnlock: () => void;
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
}: LineupActionsProps) {
  return (
    <div className="space-y-4">
      {/* Opponent Status */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <span className="text-sm font-medium text-gray-700">Opponent Status:</span>
        <div className="flex items-center gap-2">
          {opponentStatus === 'absent' && (
            <>
              <UserX className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-400">Absent</span>
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
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <span className="text-sm font-medium text-gray-700">Your Status:</span>
        <div className="flex items-center gap-2">
          {locked ? (
            <>
              <Lock className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-600">Locked</span>
            </>
          ) : (
            <span className="text-sm text-gray-500">Not Locked</span>
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
            disabled={!canUnlock}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Unlock Lineup
          </Button>
        )}
      </div>

      {/* Helper Text */}
      {!locked && !canLock && (
        <p className="text-xs text-gray-500 text-center">
          Select all players before locking your lineup
        </p>
      )}

      {locked && !canUnlock && (
        <p className="text-xs text-gray-500 text-center">
          Cannot unlock - opponent has already locked their lineup
        </p>
      )}

      {locked && opponentStatus === 'absent' && (
        <p className="text-xs text-gray-500 text-center">
          Waiting for opponent to join...
        </p>
      )}

      {locked && opponentStatus === 'choosing' && (
        <p className="text-xs text-gray-500 text-center">
          Waiting for opponent to lock their lineup...
        </p>
      )}
    </div>
  );
}
