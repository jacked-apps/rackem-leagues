/**
 * @fileoverview Tournament Utility Functions
 *
 * Functions for generating dynamic tournament links and handling tournament date logic.
 * Accounts for the fact that tournament websites update their URLs after each year's event.
 */
import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

/**
 * Championship date option from database
 */
export interface ChampionshipDateOption {
  id: string;
  organization: 'BCA' | 'APA';
  year: number;
  start_date: string;
  end_date: string;
  vote_count: number;
  dev_verified: boolean;
}

/**
 * Fetches the current BCA Championship URL based on today's date
 *
 * Logic: After March 15, the NEXT year's championship page becomes active
 * - Before March 15: Current year's championship is still relevant
 * - After March 15: Next year's championship page is published
 *
 * @returns The current relevant BCA championship URL
 */
export const fetchBCAChampionshipURL = (): string => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const month = today.getMonth(); // 0-based (March = 2)
  const day = today.getDate();

  // After March 15, use next year's championship page
  const useNextYear = month > 2 || (month === 2 && day > 15); // month > 2 = April+, month === 2 && day > 15 = after March 15

  const championshipYear = useNextYear ? currentYear + 1 : currentYear;

  return `https://www.playcsipool.com/${championshipYear}-bcapl-world-championships.html`;
};

/**
 * Fetches the current APA Championship URL
 *
 * APA uses a static URL that doesn't change year to year
 *
 * @returns The APA championship URL
 */
export const fetchAPAChampionshipURL = (): string => {
  return 'https://poolplayers.com/world-pool-championships/';
};

/**
 * Gets the championship year that's currently relevant for planning
 *
 * @param organization - 'BCA' or 'APA'
 * @returns The year of the next upcoming championship
 */
export const getRelevantChampionshipYear = (organization: 'BCA' | 'APA'): number => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  if (organization === 'BCA') {
    // BCA championships are in February/March
    const useNextYear = month > 2 || (month === 2 && day > 15);
    return useNextYear ? currentYear + 1 : currentYear;
  } else {
    // APA championships are in August
    const useNextYear = month >= 8;
    return useNextYear ? currentYear + 1 : currentYear;
  }
};

/**
 * Generic tournament URL fetcher
 *
 * @param organization - 'BCA' or 'APA'
 * @returns The current relevant championship URL
 */
export const getChampionshipLink = (organization: 'BCA' | 'APA'): string => {
  return organization === 'BCA' ? fetchBCAChampionshipURL() : fetchAPAChampionshipURL();
};

/**
 * Fetches championship date options from database for the relevant year
 * Returns dev-verified dates first, then sorted by vote count (highest first)
 * Filters out past dates
 *
 * @param organization - 'BCA' or 'APA'
 * @returns Array of championship date options
 */
export const fetchChampionshipDateOptions = async (
  organization: 'BCA' | 'APA'
): Promise<ChampionshipDateOption[]> => {
  const relevantYear = getRelevantChampionshipYear(organization);
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  const { data, error } = await supabase
    .from('championship_date_options')
    .select('*')
    .eq('organization', organization)
    .eq('year', relevantYear)
    .gte('end_date', today) // Only future dates
    .order('dev_verified', { ascending: false }) // Dev verified first
    .order('vote_count', { ascending: false }); // Then highest votes

  if (error) {
    logger.error('Error fetching championship dates', { error: error.message });
    return [];
  }

  // `organization` is plain text in the DB; these rows were filtered by it.
  return (data || []) as ChampionshipDateOption[];
};

/**
 * Submits or updates championship dates in the database
 * If dates already exist, increments vote_count
 * If new dates, creates new entry
 *
 * @param organization - 'BCA' or 'APA'
 * @param startDate - ISO date string (YYYY-MM-DD)
 * @param endDate - ISO date string (YYYY-MM-DD)
 * @returns The updated or created championship date option
 */
export const submitChampionshipDates = async (
  organization: 'BCA' | 'APA',
  startDate: string,
  endDate: string
): Promise<ChampionshipDateOption | null> => {
  const year = getRelevantChampionshipYear(organization);

  // Check if these exact dates already exist
  const { data: existing, error: fetchError } = await supabase
    .from('championship_date_options')
    .select('*')
    .eq('organization', organization)
    .eq('year', year)
    .eq('start_date', startDate)
    .eq('end_date', endDate)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = no rows found, which is fine
    logger.error('Error checking existing championship dates', { error: fetchError.message });
    return null;
  }

  if (existing) {
    // Dates exist - increment vote count
    const { data: updated, error: updateError } = await supabase
      .from('championship_date_options')
      .update({ vote_count: existing.vote_count + 1 })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating championship date vote count', { error: updateError.message });
      return null;
    }

    return updated as ChampionshipDateOption; // organization filtered above
  } else {
    // New dates - create new entry
    const { data: created, error: insertError } = await supabase
      .from('championship_date_options')
      .insert({
        organization,
        year,
        start_date: startDate,
        end_date: endDate,
        vote_count: 1,
        dev_verified: false,
      })
      .select()
      .single();

    if (insertError) {
      logger.error('Error inserting new championship dates', { error: insertError.message });
      return null;
    }

    return created as ChampionshipDateOption; // organization inserted above
  }
};