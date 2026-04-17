/**
 * @fileoverview Wizard 2.0 Framework Type Definitions
 *
 * Core type contracts for the wizard framework. The framework has two layers:
 *
 * 1. Wizard Layer — a single multi-step form (League Wizard, Season Wizard, etc.)
 * 2. WizardFlow Layer — a sequence of wizards composed into a multi-stage user
 *    journey with unified progress tracking
 *
 * See memory-bank/plans/PLAN-wizard2.md for the complete design.
 */

import type { ComponentType } from 'react';

/**
 * Props passed to every wizard step component.
 *
 * Steps are plain React components that receive their value, an onChange
 * handler, and any validation errors. They have read-only access to the
 * full form data for steps that need to react to earlier choices.
 *
 * @template TValue - The type of this step's slice of form data
 * @template TFormData - The type of the wizard's full form data object
 */
export interface WizardStepProps<TValue = unknown, TFormData = unknown> {
  /** Current value for this step's slice of form data */
  value: TValue;

  /** Update this step's value (writes back to wizard form state) */
  onChange: (value: TValue) => void;

  /** Validation errors for this step (from zod or custom validators) */
  errors: string[];

  /** Read-only access to the full form data for steps that depend on earlier choices */
  formData: TFormData;

  /** Programmatically advance to the next step (rarely used by step itself) */
  onNext: () => void;

  /** Programmatically go back to the previous step (rarely used by step itself) */
  onBack: () => void;
}

/**
 * Configuration for a single step in a wizard.
 *
 * Each step has a stable string ID (not an array index) so adding/removing
 * steps doesn't break in-progress wizards persisted in localStorage.
 *
 * @template TFormData - The type of the wizard's full form data object
 */
export interface WizardStepConfig<TFormData = unknown> {
  /** Stable string identifier for this step (used in localStorage and routing) */
  id: string;

  /** Display title shown at the top of the step */
  title: string;

  /** Optional subtitle/description shown under the title */
  subtitle?: string;

  /** The React component that renders this step's UI */
  component: ComponentType<WizardStepProps<unknown, TFormData>>;

  /** Optional zod schema for validating this step's value on Next click */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema?: any;

  /** Optional custom validator — return error strings or undefined if valid */
  validate?: (value: unknown, formData: TFormData) => string[] | undefined;

  /** If true, the user can skip this step without filling it in */
  optional?: boolean;

  /** Conditional rendering — return false to skip this step */
  showIf?: (formData: TFormData) => boolean;

  /**
   * If true, hide the default Back button on this step. Useful when going
   * back would desynchronize state with earlier steps (e.g., positions don't
   * match already-generated matches), so the step needs to handle "back"
   * via its own explicit, state-resetting action.
   */
  hideBack?: boolean;

  /**
   * If true, hide the wizard-level Cancel ("Finish Later") button on this
   * step. Useful when the step has already committed enough state to the DB
   * that "Cancel" would be misleading or encourage user mistakes.
   */
  hideCancel?: boolean;

  /**
   * If set, clicking Next pops a confirmation dialog with this content.
   * Next only advances if the user confirms. Lets a step warn the user
   * about actions that are hard to reverse later (e.g., "adding more teams
   * after this step means regenerating the schedule").
   */
  confirmOnNext?: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'default' | 'destructive';
  };
}
