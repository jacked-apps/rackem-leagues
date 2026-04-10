/**
 * @fileoverview Wizard 2.0 Framework — Public API
 *
 * Barrel exports for the wizard framework. Import from here, not from
 * individual files, to keep call sites stable as the framework evolves.
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
