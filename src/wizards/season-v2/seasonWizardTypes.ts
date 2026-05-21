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

  /** Step: SeasonSettingsModeStep — combined "length + playoff" gate
   *  (next-season only). On 'keep', snapshots the resolved defaults so
   *  useCreateSeasonV2 has values without forcing length + playoff to
   *  render. On 'change', length + playoff render as their own pages. */
  'season-settings-mode'?: {
    mode: 'keep' | 'change';
    length?: number;
    playoff?: { format: string; wildcard: boolean };
  };

  /** Step: SeasonLengthStep */
  'season-length'?: number;

  /** Step: PlayoffFormatStep */
  'playoff-format'?: string;

  /** Wildcard checkbox within PlayoffFormatStep */
  'playoff-wildcard'?: boolean;

  /** Step: ChampionshipModeStep (next-season only — gate page).
   *  Same shape as `season-settings-mode`. Snapshots current tracking
   *  when mode='keep' so useCreateSeasonV2 has values without forcing
   *  the editor step to render. */
  'championships-mode'?: {
    mode: 'keep' | 'change';
    trackBca?: boolean;
    trackApa?: boolean;
  };

  /** Step: ChampionshipEditStep (next-season only, only when gate=change).
   *  The explicit checkbox-edited tracking values. */
  'championships-edit'?: { trackBca: boolean; trackApa: boolean };

  /** Step: ChampionshipStep (first-season only — lives in the schedule
   *  wizard's slice). Carried here for the first-season schedule wizard. */
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
