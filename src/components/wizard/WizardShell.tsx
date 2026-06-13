/**
 * @fileoverview WizardShell — Layer 1 of the Wizard 2.0 framework
 *
 * Thin layout component that orchestrates the wizard's visual structure:
 * progress bar, step header, step content, error display, and navigation.
 *
 * All logic (state, persistence, validation, handlers) lives in
 * useWizardShell. All navigation buttons live in WizardNavigation.
 */

import { WizardProgress } from '@/components/forms/WizardProgress';
import type { WizardConfig } from './flowTypes';
import type { WizardStepProps } from './types';
import { useWizardShell } from './useWizardShell';
import { WizardNavigation } from './WizardNavigation';
import { WizardSummary, type WizardSummaryItem } from './WizardSummary';

interface WizardShellProps<TFormData = unknown> {
  wizard: WizardConfig<TFormData>;
  persistKey?: string;
  onComplete?: (formData: TFormData) => void;
  onCancel?: () => void;
  /**
   * Summary items for facts committed in earlier flow stages. Rendered
   * above the wizard's own summary items so the user sees a cumulative
   * running summary when this wizard is embedded in a flow.
   */
  contextSummaryItems?: WizardSummaryItem[];
}

export function WizardShell<TFormData>(props: WizardShellProps<TFormData>) {
  const {
    formData,
    currentStep,
    totalSteps,
    visibleStepIndex,
    isFirstStep,
    isLastStep,
    goBack,
    errors,
    handleStepChange,
    handleNext,
    handleCancel,
    ConfirmDialogComponent,
  } = useWizardShell(props);

  if (!currentStep) {
    return <div className="p-4 text-sm text-destructive">No steps configured.</div>;
  }

  const StepComponent = currentStep.component;
  const stepValue = (formData as Record<string, unknown>)[currentStep.id];

  const stepProps: WizardStepProps<unknown, TFormData> = {
    value: stepValue,
    onChange: handleStepChange,
    errors,
    formData,
    onNext: handleNext,
    onBack: goBack,
  };

  return (
    <div className="space-y-6">
      <WizardProgress currentStep={visibleStepIndex} totalSteps={totalSteps} />

      <div>
        <h2 className="text-2xl font-semibold mb-1">{currentStep.title}</h2>
        {currentStep.subtitle && (
          <p className="text-sm text-muted-foreground mb-4">{currentStep.subtitle}</p>
        )}

        <StepComponent {...stepProps} />

        {errors.length > 0 && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/40 rounded text-sm text-destructive">
            {errors.map((err, i) => (
              <p key={i}>{err}</p>
            ))}
          </div>
        )}
      </div>

      {(props.contextSummaryItems?.length || props.wizard.getSummaryItems) && (
        <WizardSummary
          title="Summary"
          items={[
            ...(props.contextSummaryItems ?? []),
            ...(props.wizard.getSummaryItems?.(formData) ?? []),
          ]}
        />
      )}

      <WizardNavigation
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        showSkip={currentStep.optional === true && !stepValue}
        hideBack={currentStep.hideBack === true}
        hideCancel={currentStep.hideCancel === true}
        hideNext={currentStep.hideNext === true}
        onBack={goBack}
        onNext={handleNext}
        onCancel={props.onCancel ? handleCancel : undefined}
      />
      {ConfirmDialogComponent}
    </div>
  );
}
