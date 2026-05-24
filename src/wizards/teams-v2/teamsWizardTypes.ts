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
  /** Step: VenuesModeStep (next-season only — gate page). On 'keep',
   *  snapshots the previous season's venue IDs so useSaveTeamsV2 has
   *  values without forcing the editor step to render. */
  'venues-mode'?: { mode: 'keep' | 'change'; venueIds?: string[] };

  /** Step: VenueSelectionStep — venue IDs selected for this league */
  'venues'?: string[];

  /** Step: CaptainsModeStep (next-season only — gate page). On 'keep',
   *  snapshots the previous season's captain list from reupResponses. */
  'captains-mode'?: { mode: 'keep' | 'change'; captains?: TeamCaptainEntry[] };

  /** Step: CaptainsTeamsStep — list of captains + their team names */
  'captains'?: TeamCaptainEntry[];
}
