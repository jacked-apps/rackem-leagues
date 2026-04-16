/**
 * @fileoverview Matchups Wizard types
 */

/** One team's schedule position (mirrors TeamPosition from ScheduleSetup.tsx) */
export interface MatchupTeamPosition {
  id: string;
  team_name: string;
  home_venue_id: string | null;
  schedule_position: number;
}

export interface MatchupsWizardFormData {
  /** Step: PositionsStep — ordered team positions (incl. BYE if odd count) */
  'positions'?: MatchupTeamPosition[];
  /** Step: ReviewStep — no form value (incremental DB writes via WeekEditorView) */
  'review'?: unknown;
}
