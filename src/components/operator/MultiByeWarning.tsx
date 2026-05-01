/**
 * @fileoverview MultiByeWarning component
 *
 * Shows a non-blocking notice on the team-management page when a season
 * has 2+ bye teams. Suggests the LO consolidate via the schedule editor
 * so byes play each other and real teams play every week.
 *
 * Triggered by R24 of the team-deletion-cascade fix plan.
 *
 * @see docs/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md (Unit 2.10)
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface MultiByeWarningProps {
  /** Season being managed. Used as the key for the per-session dismissal flag. */
  seasonId: string;
  /** Number of bye-status team rows in this season. */
  byeCount: number;
  /** Optional callback fired when the LO clicks the schedule-editor link. */
  onOpenScheduleEditor?: () => void;
}

/**
 * Renders the warning when byeCount >= 2; nothing otherwise.
 *
 * Dismissable per session via sessionStorage. Reappears on page reload
 * until the LO has consolidated the byes (count drops to ≤1).
 */
export const MultiByeWarning: React.FC<MultiByeWarningProps> = ({
  seasonId,
  byeCount,
  onOpenScheduleEditor,
}) => {
  const dismissalKey = `multibye-warning-dismissed:${seasonId}`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(dismissalKey) === '1');
  }, [dismissalKey]);

  if (byeCount < 2 || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem(dismissalKey, '1');
    setDismissed(true);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900 mb-1">
            This season has {byeCount} BYE teams.
          </p>
          <p className="text-sm text-amber-800">
            You can edit the schedule so the BYE teams play each other for
            the remaining weeks, freeing real teams to play every week.
          </p>
          {onOpenScheduleEditor && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={onOpenScheduleEditor}
              loadingText="none"
            >
              Open Schedule Editor
            </Button>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          className="flex-shrink-0 -mt-1 -mr-1"
          loadingText="none"
          aria-label="Dismiss warning"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
