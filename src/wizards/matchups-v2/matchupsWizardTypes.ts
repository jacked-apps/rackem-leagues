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
  /** Step: MatchupsModeStep (gate). On 'fast' the gate also stashes a
   *  pre-randomized `positions` array here so PositionsStep can be
   *  skipped entirely; ReviewStep reads from this slot when the
   *  positions step didn't render. */
  'matchups-mode'?: {
    mode: 'fast' | 'manual';
    positions?: MatchupTeamPosition[];
  };
  /** Step: PositionsStep — ordered team positions (incl. BYE if odd count) */
  'positions'?: MatchupTeamPosition[];
  /** Step: ReviewStep — no form value (incremental DB writes via WeekEditorView) */
  'review'?: unknown;
}
