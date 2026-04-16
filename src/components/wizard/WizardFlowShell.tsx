/**
 * @fileoverview WizardFlowShell — Layer 2 of the Wizard 2.0 framework
 *
 * Composes multiple wizards into a single journey with unified progress.
 */

import { toast } from 'sonner';
import type { WizardFlowConfig, FlowContext } from './flowTypes';
import { useWizardFlowState } from './useWizardFlowState';
import { WizardFlowStageRenderer } from './WizardFlowStageRenderer';

/** Per-stage handlers that run when a stage completes (e.g., DB writes). */
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
  /** Skip to this stage index (from DB detection). Marks earlier stages as complete. */
  startAtStage?: number;
  /** Called when all stages are complete */
  onComplete?: (context: FlowContext) => void;
  /** Called when the user cancels the flow */
  onCancel?: () => void;
}

export function WizardFlowShell({
  flow,
  stageHandlers,
  initialContext,
  startAtStage,
  onComplete,
  onCancel,
}: WizardFlowShellProps) {
  const state = useWizardFlowState({
    persistKey: `wizard-v2:flow:${flow.id}:state`,
    stages: flow.stages,
    initialContext,
    startAtStage,
  });

  const handleStageComplete = async (formData?: unknown) => {
    if (!state.currentStage) return;

    // Run stage handler (DB write). On failure: toast + stay on this stage.
    let contextUpdates: Partial<FlowContext> = {};
    const handler = stageHandlers?.[state.currentStage.id];
    if (handler && formData) {
      try {
        contextUpdates = await handler(formData);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong';
        toast.error(message);
        return; // Don't advance — user stays on this stage
      }
    }

    state.completeStage(state.currentStage.id, contextUpdates);

    // If that was the last stage, clear persistence and notify parent
    if (state.isLastStage && onComplete) {
      state.clearFlow();
      onComplete({ ...state.context, ...contextUpdates });
    }
  };

  // Don't clear flow state on cancel — user can resume later
  const handleCancel = () => onCancel?.();

  if (!state.currentStage) {
    return <div className="p-4 text-sm text-red-600">No stages configured.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stage context + league name if available */}
      <div className="text-center">
        {state.context.leagueName && (
          <p className="text-sm font-semibold text-gray-700">{state.context.leagueName}</p>
        )}
        <p className="text-xs text-gray-400">
          Stage {state.currentStageIndex + 1} of {state.totalStages}: {state.currentStage.title}
        </p>
      </div>

      <WizardFlowStageRenderer
        stage={state.currentStage}
        context={state.context}
        onStageComplete={handleStageComplete}
        onCancel={handleCancel}
      />
    </div>
  );
}
