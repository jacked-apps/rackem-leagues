/**
 * @fileoverview Championship Preferences Hook
 *
 * Manages fetching and refetching of BCA and APA championship blackout preferences.
 * Extracts championship preference logic from OrganizationSettings component.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabaseClient';
import type { OperatorBlackoutPreference } from '@/types/operator';
import type { ChampionshipDateOption } from '@/utils/tournamentUtils';
import { logger } from '@/utils/logger';

export interface ChampionshipPreference {
  preference: OperatorBlackoutPreference | null;
  championship: ChampionshipDateOption | null;
}

interface UseChampionshipPreferencesReturn {
  /** BCA championship preference and dates */
  bcaPreference: ChampionshipPreference | null;
  /** APA championship preference and dates */
  apaPreference: ChampionshipPreference | null;
  /** Refetch preferences from database */
  refetchPreferences: () => Promise<void>;
  /** Is initial fetch loading? */
  loading: boolean;
}

/**
 * Hook to manage championship blackout preferences for an operator
 *
 * Fetches both BCA and APA championship preferences with associated date details.
 * Provides refetch function for updating after changes.
 *
 * @param operatorId - Operator's primary key ID
 * @returns Championship preferences and refetch function
 *
 * @example
 * const { bcaPreference, apaPreference, refetchPreferences } = useChampionshipPreferences(operatorId);
 *
 * // After saving changes
 * await refetchPreferences();
 */
export function useChampionshipPreferences(
  operatorId: string | null | undefined
): UseChampionshipPreferencesReturn {
  const [bcaPreference, setBcaPreference] = useState<ChampionshipPreference | null>(null);
  const [apaPreference, setApaPreference] = useState<ChampionshipPreference | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch championship preferences from database
   * Separated into a function so it can be reused for initial fetch and refetch
   */
  const fetchPreferences = useCallback(async () => {
    if (!operatorId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all championship preferences for this operator
      const { data: preferences, error: prefError } = await supabase
        .from('operator_blackout_preferences')
        .select('*')
        .eq('organization_id', operatorId)
        .eq('preference_type', 'championship');

      if (prefError) throw prefError;

      // Clear existing state
      setBcaPreference(null);
      setApaPreference(null);

      // Process each preference and fetch associated championship details
      for (const pref of preferences || []) {
        if (!pref.championship_id) continue;

        const { data: championship } = await supabase
          .from('championship_date_options')
          .select('*')
          .eq('id', pref.championship_id)
          .single();

        if (championship) {
          // The organization check narrows the text column to 'BCA' | 'APA'.
          if (championship.organization === 'BCA') {
            setBcaPreference({ preference: pref, championship: championship as ChampionshipDateOption });
          } else if (championship.organization === 'APA') {
            setApaPreference({ preference: pref, championship: championship as ChampionshipDateOption });
          }
        }
      }
    } catch (err) {
      logger.error('Failed to fetch championship preferences', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  /**
   * Initial fetch on mount or when operatorId changes
   */
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  /**
   * Refetch preferences after saving changes
   * Clears existing state and re-fetches to ensure UI is up to date
   */
  const refetchPreferences = useCallback(async () => {
    await fetchPreferences();
  }, [fetchPreferences]);

  return {
    bcaPreference,
    apaPreference,
    refetchPreferences,
    loading,
  };
}
