/**
 * @fileoverview WizardShell — Layer 1 of the Wizard 2.0 framework
 *
 * Generic shell that renders a single wizard with its steps. Handles
 * step transitions, navigation, validation, error display, and per-wizard
 * scratch state in localStorage.
 *
 * This is a STUB. The full implementation comes in Phase 2 of wizard 2.0.
 *
 * See memory-bank/plans/PLAN-wizard2.md → Phase 2: Wizard Shell
 */

import type { WizardConfig } from './flowTypes';

interface WizardShellProps {
  /** The wizard configuration to render */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  wizard: WizardConfig;

  /** Called when the wizard completes successfully */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onComplete?: (formData: unknown) => void;

  /** Called when the user cancels the wizard */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCancel?: () => void;
}

/**
 * Stub implementation. Renders a placeholder until Phase 2 fills it in.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function WizardShell(_props: WizardShellProps) {
  return (
    <div className="p-4 border border-dashed border-gray-300 rounded">
      <p className="text-sm text-gray-500">
        WizardShell stub — full implementation in Phase 2
      </p>
    </div>
  );
}
