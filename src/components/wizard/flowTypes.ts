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
  /** ID of the organization the league belongs to. Set from the URL
   *  in the first-time flow (`/create-league/:orgId`); set from the
   *  league row in the next-season flow (which only has `leagueId` in
   *  its URL). Step components should read this from context instead
   *  of `useParams()` so the same step works on either route. */
  organizationId?: string;

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

  /** ISO date of this season's first regular-season week (separate from
   *  the LEAGUE's start_date — a league has many seasons over time, each
   *  with its own start). Surfaced for the summary panel. */
  seasonStartDate?: string;

  /** Number of regular season weeks (from Season wizard) */
  seasonLength?: number;

  /** Number of playoff weeks (from Season wizard playoff preset) */
  playoffWeeks?: number;

  /** True once the schedule stage has saved weeks to the DB */
  scheduleComplete?: boolean;

  /** Org-level championship tracking preferences carried into the
   *  next-season flow. Drives the Season wizard's championship gate
   *  and the summary panel's "Championship Tracking" row. */
  championshipTracking?: {
    trackBca: boolean;
    trackApa: boolean;
    bcaDates?: string;
    apaDates?: string;
  };

  /** Number of teams created for the current season (set after Stage 4) */
  teamCount?: number;

  /** Number of distinct venues in use by those teams */
  venueCount?: number;

  /**
   * Captain re-up responses for the league's previous season — used by
   * the next-season wizard's Teams stage to pre-populate team selection
   * and captain dropdowns. The first-time flow never has any of these
   * (no previous season exists) and the field stays undefined; the
   * Teams step falls back to its normal behavior.
   *
   * Each entry corresponds to ONE team from the previous season:
   *   - returningNextSeason=false → row pre-unchecked
   *   - returningNextSeason=true, nextCaptainId set → captain dropdown
   *     pre-set to that member
   *   - returningNextSeason=true, nextCaptainId NULL → captain stays
   *     the same
   *   - No entry for a team → no response yet → pre-unchecked with
   *     warning ("captain hasn't confirmed")
   */
  reupResponses?: ReupResponseContextEntry[];
}

/**
 * A single team's re-up response, projected into the shape the
 * wizard's Teams stage needs to apply pre-fill. Owned here (not in
 * the re-up feature's types) so the flow framework stays decoupled
 * from the re-up feature's internals.
 */
export interface ReupResponseContextEntry {
  /** Source team ID (from the previous season) */
  sourceTeamId: string;
  /** Previous season's team name — used for display when warning the
   *  operator that a no-response team is being dropped by default */
  teamName: string;
  /** Display name of the current captain (resolved from members table).
   *  Empty string if the team had no captain assigned. */
  captainName: string;
  /** Member ID of the previous season's captain. Used to pre-fill the
   *  Teams editor when the captain hasn't yet submitted a re-up answer
   *  (so the operator sees the team and can decide). */
  currentCaptainId: string | null;
  /** NULL = no submitted answer (treat as "not returning + warn") */
  returningNextSeason: boolean | null;
  /** NULL = same captain; non-null = captain change */
  nextCaptainId: string | null;
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
