/**
 * @fileoverview useFlowCompletion — handles stage completion logic for WizardFlowShell
 *
 * Runs the stage handler on submit. On success, shows a transition screen
 * (or finishes the flow if it was the last stage). On error, shows a toast
 * and keeps the user on the current stage.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import type { FlowContext } from './flowTypes';
import type { useWizardFlowState } from './useWizardFlowState';
import type { StageHandlers } from './WizardFlowShell';

type FlowState = ReturnType<typeof useWizardFlowState>;

interface UseFlowCompletionArgs {
  state: FlowState;
  stageHandlers?: StageHandlers;
  onComplete?: (context: FlowContext) => void;
}

export function useFlowCompletion({ state, stageHandlers, onComplete }: UseFlowCompletionArgs) {
  const [pendingUpdates, setPendingUpdates] = useState<Partial<FlowContext> | null>(null);

  const handleStageComplete = async (formData?: unknown) => {
    if (!state.currentStage) return;

    let contextUpdates: Partial<FlowContext> = {};
    const handler = stageHandlers?.[state.currentStage.id];
    if (handler && formData) {
      try {
        contextUpdates = await handler(formData);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong');
        return;
      }
    }

    if (state.isLastStage) {
      state.completeStage(state.currentStage.id, contextUpdates);
      state.clearFlow();
      onComplete?.({ ...state.context, ...contextUpdates });
      return;
    }
    setPendingUpdates(contextUpdates);
  };

  const handleTransitionContinue = () => {
    if (!state.currentStage || !pendingUpdates) return;
    state.completeStage(state.currentStage.id, pendingUpdates);
    setPendingUpdates(null);
  };

  return { pendingUpdates, handleStageComplete, handleTransitionContinue };
}
