/**
 * @fileoverview Wizard 2.0 Framework — Flow Layer Type Definitions
 *
 * Type contracts for the WizardFlow layer (Layer 2). A WizardFlow composes
 * multiple wizards into a single user journey with unified progress tracking.
 *
 * Flow stages can be either:
 * - 'wizard' stages — built on the new framework, rendered inline
 * - 'placeholder' stages — link to existing legacy pages until rebuilt
 *
 * See memory-bank/plans/PLAN-wizard2.md for the complete design.
 */

import type { WizardStepConfig } from './types';
import type { WizardSummaryItem } from './WizardSummary';

/**
 * Configuration for a wizard that lives inside a flow stage.
 *
 * A WizardConfig describes one of the wizards in our system (League Wizard,
 * Season Wizard, etc.) so the flow shell knows how to render it.
 *
 * @template TFormData - The type of the wizard's full form data object
 */
export interface WizardConfig<TFormData = unknown> {
  /** Stable string identifier for this wizard */
  id: string;

  /** Display title for the wizard */
  title: string;

  /** The list of steps that make up this wizard */
  steps: WizardStepConfig<TFormData>[];

  /** Initial form data when the wizard starts fresh */
  initialFormData: TFormData;

  /**
   * Schema version for persistence. Bump this when the form data shape
   * or step structure changes in a way that would make stale persisted
   * data incompatible. Defaults to 1.
   */
  schemaVersion?: number;

  /**
   * Optional function that maps form data to a list of summary items.
   * When provided, WizardShell renders a running summary box showing
   * the user's choices so far.
   */
  getSummaryItems?: (formData: TFormData) => WizardSummaryItem[];
}

/**
 * A single stage in a flow. Stages are either real wizards built on the
 * new framework, or placeholders that link to existing legacy implementations.
 *
 * The placeholder pattern is how we ship the flow architecture in v1
 * without rebuilding all 5 wizards (League, Season, Schedule, Teams, Matchups).
 */
export type FlowStage =
  | {
      kind: 'wizard';
      id: string;
      title: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wizard: WizardConfig<any>;
    }
  | {
      kind: 'placeholder';
      id: string;
      title: string;
      /** Brief description — static string or function that receives flow context */
      description?: string | ((context: FlowContext) => string);
      /** Legacy route to navigate to when the user clicks "Continue" */
      legacyRoute: string;
      /** Optional function to check if this stage is complete (queries DB) */
      isComplete?: (context: FlowContext) => Promise<boolean>;
    };

/**
 * Context passed to flow-level helpers (completion checks, etc.).
 * Holds the IDs of entities created in earlier stages.
 */
export interface FlowContext {
  /** ID of the league this flow is creating/managing (set after Stage 1) */
  leagueId?: string;

  /** The league's start date (set after Stage 1, used by Season wizard) */
  leagueStartDate?: string;

  /** Auto-generated league name — game + day + differentiator only (no season/year) */
  leagueName?: string;

  /** Game type selected (e.g., "eight_ball") */
  gameType?: string;

  /**
   * @deprecated Use lineupSize / rosterSize / handicapType instead.
   * Left for any consumers still reading legacy "format" presets.
   */
  leagueFormat?: string;

  /** How many players field a match at once (e.g., 3 or 5) */
  lineupSize?: number;

  /** Max players on the roster (e.g., 5, 8) */
  rosterSize?: number;

  /** Handicap system the league uses ('points' | 'percentage' | 'fargo' | 'none' | 'custom_formula') */
  handicapType?: string;

  /** How matches are generated ('double_round_robin' | 'single_round_robin' | 'individual_races') */
  matchFormat?: string;

  /** League day of week (e.g., "monday") */
  dayOfWeek?: string;

  /** League division/differentiator */
  division?: string;

  /** ID of the season this flow is creating/managing (set after Stage 2) */
  seasonId?: string;

  /** Generated season name (e.g., "8 Ball Monday Blue Fall 2026") */
  seasonName?: string;

  /** Number of regular season weeks (from Season wizard) */
  seasonLength?: number;

  /** Number of playoff weeks (from Season wizard playoff preset) */
  playoffWeeks?: number;

  /** True once the schedule stage has saved weeks to the DB */
  scheduleComplete?: boolean;
}

/**
 * Configuration for an entire flow (e.g., "Create New League").
 *
 * A flow is a declarative list of stages. The flow shell handles rendering,
 * progress tracking, navigation, and resume-from-database.
 */
export interface WizardFlowConfig {
  /** Stable string identifier for this flow */
  id: string;

  /** Display title for the flow */
  title: string;

  /** Ordered list of stages */
  stages: FlowStage[];

  /**
   * Optional: turn the flow's context (facts collected from completed
   * stages) into summary items. When provided, the shell renders these
   * ABOVE each wizard's own summary items — so every stage shows a
   * cumulative "what we know so far" box that grows as the user
   * progresses. Each wizard's own getSummaryItems only needs to return
   * items for in-progress choices in THAT wizard.
   */
  getContextSummaryItems?: (context: FlowContext) => WizardSummaryItem[];
}
