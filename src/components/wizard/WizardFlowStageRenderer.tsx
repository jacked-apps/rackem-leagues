/**
 * @fileoverview WizardFlowStageRenderer — renders a single stage in a flow
 *
 * Two kinds of stages:
 *   'wizard' — renders a full WizardShell inline
 *   'placeholder' — renders a "Continue to [thing]" button that links
 *                    to an existing legacy page
 *
 * Placeholders link to existing pages until each wizard gets rebuilt.
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { FlowStage, FlowContext } from './flowTypes';
import { WizardShell } from './WizardShell';

interface WizardFlowStageRendererProps {
  stage: FlowStage;
  context: FlowContext;
  onStageComplete: (formData?: unknown) => void;
  onCancel?: () => void;
}

export function WizardFlowStageRenderer({
  stage,
  context,
  onStageComplete,
  onCancel,
}: WizardFlowStageRendererProps) {
  if (stage.kind === 'wizard') {
    return (
      <WizardShell
        wizard={stage.wizard}
        persistKey={`wizard-v2:flow:${stage.id}:formData`}
        onComplete={(formData) => onStageComplete(formData)}
        onCancel={onCancel}
      />
    );
  }

  // Placeholder stage — link to legacy page
  return (
    <PlaceholderStage
      stage={stage}
      context={context}
      onStageComplete={onStageComplete}
      onCancel={onCancel}
    />
  );
}

/** Placeholder stage — shows a button to continue to the legacy page */
function PlaceholderStage({
  stage,
  context,
  onStageComplete,
  onCancel,
}: {
  stage: Extract<FlowStage, { kind: 'placeholder' }>;
  context: FlowContext;
  onStageComplete: (updates?: Partial<FlowContext>) => void;
  onCancel?: () => void;
}) {
  const navigate = useNavigate();

  // Build the legacy route, replacing :leagueId and :seasonId if present
  const route = stage.legacyRoute
    .replace(':leagueId', context.leagueId ?? '')
    .replace(':seasonId', context.seasonId ?? '');

  return (
    <div className="text-center py-12 space-y-4">
      <h3 className="text-xl font-semibold">{stage.title}</h3>
      {stage.description && (
        <p className="text-gray-600 max-w-md mx-auto">{stage.description}</p>
      )}
      <p className="text-sm text-gray-400">Your progress is saved.</p>
      <div className="flex justify-center gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Finish Later
          </Button>
        )}
        <Button loadingText="none" onClick={() => navigate(route)}>
          Continue to {stage.title}
        </Button>
      </div>
      {/* Temporary: skip button for testing placeholder flow */}
      {import.meta.env.DEV && (
        <div className="pt-4">
          <Button
            variant="ghost"
            onClick={() => onStageComplete()}
            className="text-xs text-gray-400"
          >
            Skip (dev only)
          </Button>
        </div>
      )}
    </div>
  );
}
