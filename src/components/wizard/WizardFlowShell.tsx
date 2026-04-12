/**
 * @fileoverview WizardFlowShell — Layer 2 of the Wizard 2.0 framework
 *
 * Composes multiple wizards into a single user journey with a unified
 * progress bar. Each stage is either a real wizard (rendered inline via
 * WizardShell) or a placeholder (shows a "Continue" button linking to
 * an existing legacy page).
 *
 * Progress bar reflects ALL stages (e.g., 5 stages = 20% each).
 */

import type { WizardFlowConfig, FlowContext } from './flowTypes';
import { useWizardFlowState } from './useWizardFlowState';
import { WizardFlowStageRenderer } from './WizardFlowStageRenderer';

/**
 * Optional per-stage handlers. When a wizard stage completes, its handler
 * runs (e.g., to save to the database). Returns context updates that get
 * merged into the flow context for later stages.
 */
export type StageHandlers = Record<
  string,
  (formData: unknown) => Promise<Partial<FlowContext>>
>;

interface WizardFlowShellProps {
  /** The flow configuration (list of stages) */
  flow: WizardFlowConfig;
  /** Optional per-stage completion handlers (e.g., DB writes) */
  stageHandlers?: StageHandlers;
  /** Optional initial context (e.g., resuming an in-progress flow) */
  initialContext?: FlowContext;
  /** Called when all stages are complete */
  onComplete?: (context: FlowContext) => void;
  /** Called when the user cancels the flow */
  onCancel?: () => void;
}

export function WizardFlowShell({
  flow,
  stageHandlers,
  initialContext,
  onComplete,
  onCancel,
}: WizardFlowShellProps) {
  const state = useWizardFlowState({
    stages: flow.stages,
    initialContext,
  });

  const handleStageComplete = async (formData?: unknown) => {
    if (!state.currentStage) return;

    // Run the stage handler if one exists (e.g., DB write)
    let contextUpdates: Partial<FlowContext> = {};
    const handler = stageHandlers?.[state.currentStage.id];
    if (handler && formData) {
      contextUpdates = await handler(formData);
    }

    state.completeStage(state.currentStage.id, contextUpdates);

    // If that was the last stage, notify parent
    if (state.isLastStage && onComplete) {
      onComplete({ ...state.context, ...contextUpdates });
    }
  };

  if (!state.currentStage) {
    return <div className="p-4 text-sm text-red-600">No stages configured.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stage context — subtle label, no progress bar (the inner wizard has its own) */}
      <p className="text-xs text-center text-gray-400">
        Stage {state.currentStageIndex + 1} of {state.totalStages}: {state.currentStage.title}
      </p>

      <WizardFlowStageRenderer
        stage={state.currentStage}
        context={state.context}
        onStageComplete={handleStageComplete}
        onCancel={onCancel}
      />
    </div>
  );
}
