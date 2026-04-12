/**
 * @fileoverview useWizardFlowState — state management for WizardFlowShell
 *
 * Tracks which stage is active, which stages are complete, and provides
 * navigation between stages. Stage completion is determined by checking
 * the database (does the data for this stage exist?).
 *
 * The flow advances when a wizard stage calls onComplete or when a
 * placeholder stage's isComplete check returns true.
 */

import { useState, useCallback } from 'react';
import type { FlowStage, FlowContext } from './flowTypes';

interface UseWizardFlowStateArgs {
  stages: FlowStage[];
  initialContext?: FlowContext;
}

export function useWizardFlowState({
  stages,
  initialContext = {},
}: UseWizardFlowStateArgs) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [context, setContext] = useState<FlowContext>(initialContext);
  const [completedStageIds, setCompletedStageIds] = useState<Set<string>>(new Set());

  const currentStage = stages[currentStageIndex] ?? null;
  const totalStages = stages.length;

  /** Mark a stage as complete and advance to the next one */
  const completeStage = useCallback((stageId: string, updates?: Partial<FlowContext>) => {
    setCompletedStageIds((prev) => new Set(prev).add(stageId));
    if (updates) {
      setContext((prev) => ({ ...prev, ...updates }));
    }
    // Advance to next stage if not at the end
    setCurrentStageIndex((prev) => Math.min(prev + 1, stages.length - 1));
  }, [stages.length]);

  /** Go back to the previous stage */
  const goBackStage = useCallback(() => {
    setCurrentStageIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  /** Check if a specific stage is complete */
  const isStageComplete = useCallback(
    (stageId: string) => completedStageIds.has(stageId),
    [completedStageIds],
  );

  const isFirstStage = currentStageIndex === 0;
  const isLastStage = currentStageIndex === stages.length - 1;

  return {
    currentStage,
    currentStageIndex,
    totalStages,
    context,
    completeStage,
    goBackStage,
    isStageComplete,
    isFirstStage,
    isLastStage,
  };
}
