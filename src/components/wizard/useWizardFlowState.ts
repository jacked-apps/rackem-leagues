/**
 * @fileoverview useWizardFlowState — state management for WizardFlowShell
 *
 * Tracks which stage is active and the flow context (leagueId, etc.).
 * Persists to localStorage so canceling or refreshing resumes at the
 * right stage — the user never has to redo a completed stage.
 *
 * When a stage completes (e.g., league created in DB), the context is
 * saved. On next mount, the flow reads the saved context and skips
 * past completed stages.
 */

import { useState, useCallback, useEffect } from 'react';
import type { FlowStage, FlowContext } from './flowTypes';

interface PersistedFlowState {
  currentStageIndex: number;
  completedStageIds: string[];
  context: FlowContext;
}

interface UseWizardFlowStateArgs {
  /** Unique key for localStorage (e.g., 'flow:create-new-league') */
  persistKey: string;
  stages: FlowStage[];
  initialContext?: FlowContext;
  /** Start at this stage index (from DB detection). Takes priority over localStorage. */
  startAtStage?: number;
}

function readPersistedFlow(key: string): PersistedFlowState | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePersistedFlow(key: string, state: PersistedFlowState) {
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch { /* silent */ }
}

export function useWizardFlowState({
  persistKey,
  stages,
  initialContext = {},
  startAtStage,
}: UseWizardFlowStateArgs) {
  // DB detection takes priority → localStorage fallback → start at 0
  const persisted = readPersistedFlow(persistKey);
  const resolvedStartIndex = startAtStage ?? persisted?.currentStageIndex ?? 0;

  const [currentStageIndex, setCurrentStageIndex] = useState(resolvedStartIndex);
  const [context, setContext] = useState<FlowContext>({
    ...(persisted?.context ?? {}),
    ...initialContext, // DB-detected context overrides localStorage
  });
  const [completedStageIds, setCompletedStageIds] = useState<Set<string>>(() => {
    const ids = new Set(persisted?.completedStageIds ?? []);
    // Mark all stages before startAtStage as complete
    if (startAtStage) {
      for (let i = 0; i < startAtStage; i++) {
        ids.add(stages[i].id);
      }
    }
    return ids;
  });

  // Persist flow state whenever it changes
  useEffect(() => {
    savePersistedFlow(persistKey, {
      currentStageIndex,
      completedStageIds: Array.from(completedStageIds),
      context,
    });
  }, [persistKey, currentStageIndex, completedStageIds, context]);

  const currentStage = stages[currentStageIndex] ?? null;
  const totalStages = stages.length;

  const completeStage = useCallback((stageId: string, updates?: Partial<FlowContext>) => {
    setCompletedStageIds((prev) => new Set(prev).add(stageId));
    if (updates) setContext((prev) => ({ ...prev, ...updates }));
    setCurrentStageIndex((prev) => Math.min(prev + 1, stages.length - 1));
  }, [stages.length]);

  const goBackStage = useCallback(() => {
    setCurrentStageIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const isStageComplete = useCallback(
    (stageId: string) => completedStageIds.has(stageId),
    [completedStageIds],
  );

  /** Clear all persisted flow state (call on flow completion or explicit cancel) */
  const clearFlow = useCallback(() => {
    try { window.localStorage.removeItem(persistKey); } catch { /* silent */ }
  }, [persistKey]);

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
    clearFlow,
    isFirstStage,
    isLastStage,
  };
}
