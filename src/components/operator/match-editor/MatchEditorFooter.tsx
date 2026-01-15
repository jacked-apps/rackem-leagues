/**
 * @fileoverview Match Editor Footer Component
 *
 * Contains the action buttons for saving changes and completing the match.
 * Shows save button when there are unsaved changes, and complete button
 * when match is ready to be finalized.
 *
 * @example
 * <MatchEditorFooter
 *   isDirty={isDirty}
 *   onSave={handleSave}
 *   onComplete={handleComplete}
 *   matchStatus={match.status}
 * />
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Save, CheckCircle } from 'lucide-react';

interface MatchEditorFooterProps {
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Callback to save all changes */
  onSave: () => Promise<void>;
  /** Callback to mark match as complete */
  onComplete: () => Promise<void>;
  /** Current match status */
  matchStatus: string;
}

/**
 * Match Editor Footer
 *
 * Sticky footer with save and complete actions.
 */
export function MatchEditorFooter({
  isDirty,
  onSave,
  onComplete,
  matchStatus,
}: MatchEditorFooterProps) {
  const isCompleted = matchStatus === 'completed';

  return (
    <Card className="sticky bottom-4 shadow-lg">
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - status indicator */}
          <div className="text-sm text-gray-500">
            {isDirty ? (
              <span className="text-amber-600 font-medium">Unsaved changes</span>
            ) : (
              <span>No unsaved changes</span>
            )}
          </div>

          {/* Right side - action buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onSave}
              disabled={!isDirty}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>

            <Button
              onClick={onComplete}
              disabled={isCompleted}
              className="gap-2"
              loadingText="Completing..."
            >
              <CheckCircle className="h-4 w-4" />
              {isCompleted ? 'Completed' : 'Mark as Complete'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
