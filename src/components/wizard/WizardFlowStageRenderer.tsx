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

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { FlowStage, FlowContext } from './flowTypes';
import type { WizardSummaryItem } from './WizardSummary';
import { WizardShell } from './WizardShell';

interface WizardFlowStageRendererProps {
  stage: FlowStage;
  context: FlowContext;
  contextSummaryItems?: WizardSummaryItem[];
  onStageComplete: (formData?: unknown) => void;
  onCancel?: () => void;
}

export function WizardFlowStageRenderer({
  stage,
  context,
  contextSummaryItems,
  onStageComplete,
  onCancel,
}: WizardFlowStageRendererProps) {
  if (stage.kind === 'wizard') {
    // key={stage.id} forces React to unmount/remount when the stage changes,
    // resetting all wizard state. Without this, React reuses the component
    // and the previous wizard's state (like currentStepId) leaks through.
    return (
      <FlowWizardStage
        key={stage.id}
        stage={stage}
        context={context}
        contextSummaryItems={contextSummaryItems}
        onStageComplete={onStageComplete}
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

/**
 * Wizard stage wrapper — clears stale localStorage on mount so the
 * wizard always starts fresh when entering a new flow stage.
 */
function FlowWizardStage({
  stage,
  context,
  contextSummaryItems,
  onStageComplete,
  onCancel,
}: {
  stage: Extract<FlowStage, { kind: 'wizard' }>;
  context: FlowContext;
  contextSummaryItems?: WizardSummaryItem[];
  onStageComplete: (formData?: unknown) => void;
  onCancel?: () => void;
}) {
  const persistKey = `wizard-v2:flow:${stage.id}:formData`;

  // Clear stale persistence synchronously on first render (before WizardShell reads it).
  // Using useState initializer ensures this runs once, before any useEffect.
  useState(() => {
    try { window.localStorage.removeItem(persistKey); } catch { /* silent */ }
  });

  // Inject flow context into the wizard's initial form data so steps can read it.
  // E.g., season wizard needs leagueId and league start date from the flow.
  const wizardWithContext = {
    ...stage.wizard,
    initialFormData: {
      ...stage.wizard.initialFormData,
      _flowContext: context,
    },
  };

  return (
    <WizardShell
      wizard={wizardWithContext}
      persistKey={persistKey}
      contextSummaryItems={contextSummaryItems}
      onComplete={(formData) => onStageComplete(formData)}
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
        <p className="text-gray-600 max-w-md mx-auto">
          {typeof stage.description === 'function'
            ? stage.description(context)
            : stage.description}
        </p>
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
