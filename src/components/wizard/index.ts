/**
 * @fileoverview Wizard 2.0 Framework — Public API
 *
 * Barrel exports for the wizard framework. Import from '@/components/wizard'
 * instead of individual files — this keeps call sites stable as the
 * framework evolves internally.
 *
 * ARCHITECTURE OVERVIEW (for Jack):
 *
 * The wizard framework has two layers:
 *
 * Layer 1 — Wizard (single multi-step form):
 *   WizardShell renders steps one at a time with Back/Next/Cancel.
 *   useWizardState manages form data + current step.
 *   useWizardPersistence saves scratch state to localStorage.
 *   validateStep runs zod schemas on Next click.
 *
 * Layer 2 — WizardFlow (multi-wizard journey):
 *   WizardFlowShell composes multiple wizards into a single flow with
 *   unified progress tracking (e.g., Create League → Season → Schedule).
 *   NOT YET BUILT — see PLAN-wizard2.md Phase 6.
 *
 * Building blocks (reusable in any step):
 *   CardSelector — card-based radio selector (mobile-friendly)
 *   NumberStepper — minus/value/plus numeric input
 *   WizardSummary — live preview of the user's choices
 *   ReviewStep — generic final confirmation step
 *
 * To add a new wizard: see memory-bank/plans/PLAN-wizard2.md
 * To add a new step: create a component matching WizardStepProps,
 *   then register it in the wizard's config steps array.
 */

// Type contracts
export type {
  WizardStepProps,
  WizardStepConfig,
} from './types';

export type {
  WizardConfig,
  FlowStage,
  FlowContext,
  WizardFlowConfig,
} from './flowTypes';

// Shells
export { WizardShell } from './WizardShell';
export { WizardFlowShell } from './WizardFlowShell';

// Reusable step building blocks
export { CardSelector } from './CardSelector';
export { SelectableCard, type SelectableCardOption } from './SelectableCard';
export { NumberStepper } from './NumberStepper';
export { WizardSummary, type WizardSummaryItem } from './WizardSummary';
export { ReviewStep } from './ReviewStep';

// Persistence (advanced — most callers just pass persistKey to WizardShell)
export {
  useWizardPersistence,
  readPersistedWizardState,
} from './useWizardPersistence';
