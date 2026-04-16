/**
 * @fileoverview Teams Wizard types
 */

export interface TeamCaptainEntry {
  /** Member ID of the captain (existing registered player) */
  captainId: string;
  /** Display name of the captain */
  captainName: string;
  /** Team name (editable by LO — defaults to "Team 1", "Team 2", etc.) */
  teamName: string;
}

export interface TeamsWizardFormData {
  /** Step: VenueSelectionStep — venue IDs selected for this league */
  'venues'?: string[];

  /** Step: CaptainsTeamsStep — list of captains + their team names */
  'captains'?: TeamCaptainEntry[];
}
