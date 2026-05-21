/**
 * @fileoverview SeasonWizardFormData — shared type for the season creation wizard
 *
 * Holds the answers captured across all season wizard steps. Keys match
 * the step IDs in seasonWizardConfig.ts.
 *
 * The wizard runs in two modes:
 *   First season: start date inherited from the league, no date picker
 *   Next season: start date picked via DateStepper (same day of week)
 *
 * The mode is determined by checking if the league already has seasons.
 */

export interface SeasonWizardFormData {
  /** Step: SeasonIntroStep — holds context about whether this is the first season */
  'intro'?: { leagueStartDate: string; hasExistingSeasons: boolean };

  /** Step: SeasonStartDateStep (only for subsequent seasons) */
  'season-start-date'?: string;

  /** Step: SeasonLengthStep */
  'season-length'?: number;

  /** Step: PlayoffFormatStep */
  'playoff-format'?: string;

  /** Wildcard checkbox within PlayoffFormatStep */
  'playoff-wildcard'?: boolean;

  /** Step: ChampionshipStep (next-season only — confirmation of last
   *  season's BCA/APA tracking choices). In first-season flow this step
   *  lives in the schedule wizard instead since it ties to schedule
   *  building. */
  'championships'?: { trackBca: boolean; trackApa: boolean };
}

/**
 * Context passed into the Season wizard from the flow or parent page.
 * Tells the wizard what league it's working with and whether this is
 * the first season.
 */
export interface SeasonWizardContext {
  leagueId: string;
  /** The league's day of week (0-6, for the DateStepper filter) */
  dayOfWeek: number;
  /** The league's start date (ISO string, used as default for first season) */
  leagueStartDate: string;
  /** Whether the league already has seasons */
  hasExistingSeasons: boolean;
}
