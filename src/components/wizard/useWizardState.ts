/**
 * @fileoverview useWizardState — internal state hook for WizardShell
 *
 * Holds form data, current step ID, and provides navigation helpers
 * (next/back). Persistence lives in useWizardPersistence. Validation
 * lives in validateStep. This hook is pure state management.
 *
 * KEY DESIGN: Step IDs are strings (not array indices). This means you
 * can add, remove, or reorder steps without breaking in-progress wizards
 * that are saved to localStorage. The showIf system also means steps can
 * appear/disappear based on earlier answers (e.g., custom path steps only
 * show when user picks "Custom" format).
 */

import { useState, useCallback } from 'react';
import type { WizardStepConfig } from './types';

interface UseWizardStateOptions<TFormData> {
  steps: WizardStepConfig<TFormData>[];
  initialFormData: TFormData;
  /** Optional starting step ID — used when restoring from persisted state */
  initialStepId?: string;
}

/**
 * Find the next visible step index, skipping any that are filtered out by showIf.
 * Returns -1 if no further visible step exists.
 */
function findNextVisibleIndex<TFormData>(
  steps: WizardStepConfig<TFormData>[],
  formData: TFormData,
  fromIndex: number,
  direction: 1 | -1
): number {
  let i = fromIndex + direction;
  while (i >= 0 && i < steps.length) {
    const step = steps[i];
    if (!step.showIf || step.showIf(formData)) return i;
    i += direction;
  }
  return -1;
}

export function useWizardState<TFormData>({
  steps,
  initialFormData,
  initialStepId,
}: UseWizardStateOptions<TFormData>) {
  const [formData, setFormData] = useState<TFormData>(initialFormData);
  const [currentStepId, setCurrentStepId] = useState<string>(() => {
    // Prefer the persisted step if it's STILL a valid AND VISIBLE step
    // in the current config. A persisted step that's now hidden via
    // showIf (e.g., schema changed since the wizard was paused) falls
    // through to "first visible" so the wizard never lands on a hidden
    // step.
    if (initialStepId) {
      const persistedStep = steps.find((s) => s.id === initialStepId);
      if (persistedStep && (!persistedStep.showIf || persistedStep.showIf(initialFormData))) {
        return initialStepId;
      }
    }
    // First visible step — skip any that are hidden by their showIf check.
    const firstVisible = steps.find((s) => !s.showIf || s.showIf(initialFormData));
    return firstVisible?.id ?? steps[0]?.id ?? '';
  });

  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;

  const updateFormData = useCallback((updater: (prev: TFormData) => TFormData) => {
    setFormData(updater);
  }, []);

  const goNext = useCallback(() => {
    const nextIndex = findNextVisibleIndex(steps, formData, currentIndex, 1);
    if (nextIndex >= 0) setCurrentStepId(steps[nextIndex].id);
  }, [steps, formData, currentIndex]);

  const goBack = useCallback(() => {
    const prevIndex = findNextVisibleIndex(steps, formData, currentIndex, -1);
    if (prevIndex >= 0) setCurrentStepId(steps[prevIndex].id);
  }, [steps, formData, currentIndex]);

  const isFirstStep = findNextVisibleIndex(steps, formData, currentIndex, -1) === -1;
  const isLastStep = findNextVisibleIndex(steps, formData, currentIndex, 1) === -1;

  // Only count steps that are currently visible (pass their showIf check)
  const visibleStepCount = steps.filter(
    (s) => !s.showIf || s.showIf(formData),
  ).length;

  // Current position among visible steps (for accurate progress bar)
  const visibleStepIndex = steps
    .filter((s) => !s.showIf || s.showIf(formData))
    .findIndex((s) => s.id === currentStepId);

  return {
    formData,
    updateFormData,
    currentStep,
    currentStepId,
    currentIndex,
    totalSteps: visibleStepCount,
    visibleStepIndex,
    goNext,
    goBack,
    isFirstStep,
    isLastStep,
  };
}
