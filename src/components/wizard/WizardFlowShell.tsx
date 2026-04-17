/**
 * @fileoverview WizardFlowShell — Layer 2 of the Wizard 2.0 framework
 * Shows a transition screen between stages for confirmation.
 */

import type { WizardFlowConfig, FlowContext } from './flowTypes';
import { useWizardFlowState } from './useWizardFlowState';
import { WizardFlowStageRenderer } from './WizardFlowStageRenderer';
import { StageTransitionScreen } from './StageTransitionScreen';
import { FlowStageHeader } from './FlowStageHeader';
import { useFlowCompletion } from './useFlowCompletion';

/** Per-stage handlers that run when a stage completes (e.g., DB writes). */
export type StageHandlers = Record<
  string,
  (formData: unknown) => Promise<Partial<FlowContext>>
>;

interface WizardFlowShellProps {
  flow: WizardFlowConfig;
  stageHandlers?: StageHandlers;
  initialContext?: FlowContext;
  startAtStage?: number;
  onComplete?: (context: FlowContext) => void;
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

  const { pendingUpdates, handleStageComplete, handleTransitionContinue } =
    useFlowCompletion({ state, stageHandlers, onComplete });

  if (!state.currentStage) {
    return <div className="p-4 text-sm text-red-600">No stages configured.</div>;
  }
  const nextStage = flow.stages[state.currentStageIndex + 1] ?? null;

  return (
    <div className="space-y-6">
      <FlowStageHeader
        leagueName={state.context.leagueName}
        index={state.currentStageIndex}
        total={state.totalStages}
        title={state.currentStage.title}
      />

      {pendingUpdates && nextStage ? (
        <StageTransitionScreen
          completedStageTitle={state.currentStage.title}
          nextStageTitle={nextStage.title}
          completedMessage={`Your ${state.currentStage.title.toLowerCase()} has been saved.`}
          nextMessage={`Next up: set up ${nextStage.title.toLowerCase()}.`}
          onContinue={handleTransitionContinue}
          onFinishLater={onCancel}
        />
      ) : (
        <WizardFlowStageRenderer
          stage={state.currentStage}
          context={state.context}
          onStageComplete={handleStageComplete}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}
