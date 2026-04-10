/**
 * @fileoverview useWizardShell — orchestration hook for WizardShell
 *
 * Composes the lower-level hooks (useWizardState, useWizardPersistence)
 * with validation and event handlers. Returns everything WizardShell
 * needs to render.
 *
 * Extracted from WizardShell to keep each file under 100 lines.
 */

import { useCallback, useMemo, useState } from 'react';
import type { WizardConfig } from './flowTypes';
import { useWizardState } from './useWizardState';
import { readPersistedWizardState, useWizardPersistence } from './useWizardPersistence';
import { validateStep } from './validateStep';

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

  const handleStepChange = useCallback(
    (value: unknown) => {
      if (errors.length > 0) setErrors([]);
      state.updateFormData((prev) => ({ ...prev, [state.currentStep?.id ?? '']: value }));
    },
    [state, errors.length],
  );

  const handleNext = useCallback(() => {
    if (state.currentStep) {
      const stepValue = (state.formData as Record<string, unknown>)[state.currentStep.id];
      const stepErrors = validateStep(state.currentStep, stepValue, state.formData);
      if (stepErrors.length > 0) {
        setErrors(stepErrors);
        return;
      }
    }
    setErrors([]);
    if (state.isLastStep) {
      clearPersisted();
      onComplete?.(state.formData);
    } else {
      state.goNext();
    }
  }, [state, clearPersisted, onComplete]);

  const handleCancel = useCallback(() => {
    clearPersisted();
    onCancel?.();
  }, [clearPersisted, onCancel]);

  return { ...state, errors, handleStepChange, handleNext, handleCancel };
}
