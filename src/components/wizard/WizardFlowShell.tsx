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

/** Per-stage handlers that run when a stage completes (e.g., DB writes).
 *  Receives the wizard's live `context` as the second arg so handlers
 *  always read fresh values (e.g., seasonId set by the previous stage)
 *  instead of stale props-closure values. */
export type StageHandlers = Record<
  string,
  (formData: unknown, context: FlowContext) => Promise<Partial<FlowContext>>
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

  // Exiting to the dashboard (or any cancel path) should wipe the flow's
  // localStorage so the DB stays the source of truth. Without this, a
  // user who starts a league, deletes it, and comes back sees a summary
  // that still carries the old league's data.
  const handleCancel = onCancel
    ? () => {
        state.clearFlow();
        onCancel();
      }
    : undefined;

  if (!state.currentStage) {
    return <div className="p-4 text-sm text-red-600">No stages configured.</div>;
  }
  const nextStage = flow.stages[state.currentStageIndex + 1] ?? null;

  // Cumulative summary items from all completed stages. Rendered above the
  // current wizard's own summary so the user sees everything we've gathered
  // so far, not just the in-progress stage.
  const contextSummaryItems = flow.getContextSummaryItems?.(state.context) ?? [];

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
          onFinishLater={handleCancel}
        />
      ) : (
        <WizardFlowStageRenderer
          stage={state.currentStage}
          context={state.context}
          contextSummaryItems={contextSummaryItems}
          onStageComplete={handleStageComplete}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
