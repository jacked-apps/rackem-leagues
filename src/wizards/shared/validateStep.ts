/**
 * @fileoverview validateStep — runs zod schema + custom validator for a step
 *
 * Called by WizardShell when the user clicks Next. Returns an array of
 * error strings (empty = valid). Combines zod schema errors with any
 * custom validator errors.
 *
 * Validation only runs on Next click (not on every keystroke). This was
 * a deliberate UX decision — see Decision 6 in PLAN-wizard2.md.
 */

import type { WizardStepConfig } from './types';

/**
 * Validate a step's value against its schema and custom validator.
 *
 * @param step - The step config (may have schema and/or validate)
 * @param value - The current value for this step
 * @param formData - The full wizard form data (for cross-field custom validators)
 * @returns Array of error message strings. Empty array = valid.
 */
export function validateStep<TFormData>(
  step: WizardStepConfig<TFormData>,
  value: unknown,
  formData: TFormData,
): string[] {
  const errors: string[] = [];

  // Run zod schema validation if present
  if (step.schema) {
    const result = step.schema.safeParse(value);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(issue.message);
      }
    }
  }

  // Run custom validator if present (escape hatch for complex rules)
  if (step.validate) {
    const customErrors = step.validate(value, formData);
    if (customErrors) {
      errors.push(...customErrors);
    }
  }

  return errors;
}
