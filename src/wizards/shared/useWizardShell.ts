/**
 * @fileoverview useWizardShell — orchestration hook for WizardShell
 *
 * The "brain" of the wizard. Composes three lower-level concerns:
 *   1. useWizardState — form data + step navigation
 *   2. useWizardPersistence — debounced localStorage saves
 *   3. validateStep — zod + custom validation on Next click
 *
 * Returns everything WizardShell needs to render (state + handlers).
 * WizardShell itself is just a thin layout component.
 *
 * Flow on user click Next:
 *   validate current step → if errors, show them and block
 *   → if last step, clear localStorage + call onComplete
 *   → otherwise advance to next visible step
 */

import { useCallback, useMemo, useState } from 'react';
import type { WizardConfig } from './flowTypes';
import { useWizardState } from './useWizardState';
import { readPersistedWizardState, useWizardPersistence } from './useWizardPersistence';
import { validateStep } from './validateStep';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface UseWizardShellArgs<TFormData> {
  wizard: WizardConfig<TFormData>;
  persistKey?: string;
  onComplete?: (formData: TFormData) => void;
  onCancel?: () => void;
}

export function useWizardShell<TFormData>({
  wizard,
  persistKey,
  onComplete,
  onCancel,
}: UseWizardShellArgs<TFormData>) {
  const schemaVersion = wizard.schemaVersion ?? 1;

  const persisted = useMemo(
    () => (persistKey ? readPersistedWizardState<TFormData>(persistKey, schemaVersion) : null),
    [persistKey, schemaVersion],
  );

  const state = useWizardState<TFormData>({
    steps: wizard.steps,
    initialFormData: persisted?.formData ?? wizard.initialFormData,
    initialStepId: persisted?.currentStepId,
  });

  const { clear: clearPersisted } = useWizardPersistence<TFormData>({
    enabled: Boolean(persistKey),
    storageKey: persistKey ?? '',
    version: schemaVersion,
    formData: state.formData,
    currentStepId: state.currentStepId,
    debounceMs: 300,
  });

  const [errors, setErrors] = useState<string[]>([]);
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  // IMPORTANT: depend on the stable pieces of `state` (updateFormData is a
  // useCallback with []; currentStep?.id is a string) rather than `state`
  // itself. The full `state` object is rebuilt every render, which made
  // this callback's identity change on every render — any child effect
  // that had onChange in its deps (e.g., ScheduleReview's schedule-sync
  // effect) would then re-fire on every render, causing infinite loops
  // when the child also writes back through onChange.
  const handleStepChange = useCallback(
    (value: unknown) => {
      if (errors.length > 0) setErrors([]);
      state.updateFormData((prev) => ({ ...prev, [state.currentStep?.id ?? '']: value }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.updateFormData, state.currentStep?.id, errors.length],
  );

  const handleNext = useCallback(async () => {
    if (state.currentStep) {
      const stepValue = (state.formData as Record<string, unknown>)[state.currentStep.id];
      const stepErrors = validateStep(state.currentStep, stepValue, state.formData);
      if (stepErrors.length > 0) {
        setErrors(stepErrors);
        return;
      }
    }
    setErrors([]);

    // Framework-level confirmation before advancing. Lets a step warn the
    // user about actions that are hard to reverse (e.g., adding more teams
    // after the Teams step means regenerating the matchup schedule).
    if (state.currentStep?.confirmOnNext) {
      const cfg = state.currentStep.confirmOnNext;
      const ok = await confirm({
        title: cfg.title,
        message: cfg.message,
        confirmText: cfg.confirmText ?? 'Continue',
        cancelText: cfg.cancelText ?? 'Cancel',
        confirmVariant: cfg.confirmVariant ?? 'default',
      });
      if (!ok) return;
    }

    // Re-evaluate "is there a next step?" against the LATEST formData
    // via peekNextStepId — NOT `state.isLastStep`. The boolean is a
    // snapshot from React state at render time; if this Next click was
    // triggered by a gate that just wrote to formData (e.g.,
    // captains-mode setting `{ mode: 'change' }`), the snapshot still
    // reflects the pre-click state where the editor step was invisible,
    // making this look like the last step when it isn't.
    if (state.peekNextStepId() === null) {
      clearPersisted();
      // Await — onComplete may be async (stage handler doing a DB write).
      // Without awaiting, the caller's pending state resets before the
      // handler finishes, letting a second click fire a duplicate write.
      //
      // Pass `getLatestFormData()` (the ref-backed value) instead of
      // `state.formData` (React state, stale within this event tick)
      // so the stage handler sees a gate-step value written by the
      // same click that just triggered Next. Without this, Keep
      // workflows that complete the stage in one click — e.g., teams
      // Keep advancing straight to the stage handler — see an empty
      // captains-mode slice and the save fails the empty-captains
      // guard on first click.
      await onComplete?.(state.getLatestFormData());
    } else {
      state.goNext();
    }
  }, [state, clearPersisted, onComplete, confirm]);

  const handleCancel = useCallback(() => {
    clearPersisted();
    onCancel?.();
  }, [clearPersisted, onCancel]);

  return { ...state, errors, handleStepChange, handleNext, handleCancel, ConfirmDialogComponent };
}
