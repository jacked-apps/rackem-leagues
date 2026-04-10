/**
 * @fileoverview WizardFlowShell — Layer 2 of the Wizard 2.0 framework
 *
 * Outer container that composes multiple wizards into a multi-stage user
 * journey. Renders the unified progress bar, tracks which stage is active,
 * handles transitions, and persists flow-level state.
 *
 * This is a STUB. The full implementation comes in Phase 8 of wizard 2.0.
 *
 * See memory-bank/plans/PLAN-wizard2.md → Phase 8: WizardFlow Shell
 */

import type { WizardFlowConfig } from './flowTypes';

interface WizardFlowShellProps {
  /** The flow configuration to render */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  flow: WizardFlowConfig;

  /** Optional initial context (e.g., resuming an in-progress flow) */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  initialContext?: { leagueId?: string; seasonId?: string };

  /** Called when all stages complete */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onComplete?: () => void;
}

/**
 * Stub implementation. Renders a placeholder until Phase 8 fills it in.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function WizardFlowShell(_props: WizardFlowShellProps) {
  return (
    <div className="p-4 border border-dashed border-gray-300 rounded">
      <p className="text-sm text-gray-500">
        WizardFlowShell stub — full implementation in Phase 8
      </p>
    </div>
  );
}
