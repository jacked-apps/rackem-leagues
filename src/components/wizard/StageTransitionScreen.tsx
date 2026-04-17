/**
 * @fileoverview StageTransitionScreen — shown after a wizard stage completes
 *
 * Brief confirmation that the previous stage was saved, and a button to
 * continue to the next stage. Prevents the wizard from jumping directly
 * from one stage's review to the next stage's first question.
 *
 * Appears between stages in the flow. User can also exit via "Finish Later".
 */

import { Button } from '@/components/ui/button';

interface StageTransitionScreenProps {
  completedStageTitle: string;
  nextStageTitle: string;
  /** Optional message about what was just completed */
  completedMessage?: string;
  /** Optional message about what's coming next */
  nextMessage?: string;
  onContinue: () => void;
  onFinishLater?: () => void;
}

export function StageTransitionScreen({
  completedStageTitle,
  nextStageTitle,
  completedMessage,
  nextMessage,
  onContinue,
  onFinishLater,
}: StageTransitionScreenProps) {
  return (
    <div className="text-center py-12 space-y-5 max-w-lg mx-auto">
      <div className="text-5xl">✅</div>
      <h3 className="text-2xl font-bold text-gray-900">
        {completedStageTitle} Complete
      </h3>
      {completedMessage && (
        <p className="text-gray-700">{completedMessage}</p>
      )}
      {nextMessage && (
        <p className="text-gray-600">{nextMessage}</p>
      )}
      <p className="text-sm text-gray-400">Your progress is saved.</p>
      <div className="flex justify-center gap-3 pt-2">
        {onFinishLater && (
          <Button variant="outline" onClick={onFinishLater}>
            Finish Later
          </Button>
        )}
        <Button loadingText="none" onClick={onContinue}>
          Continue to {nextStageTitle}
        </Button>
      </div>
    </div>
  );
}
