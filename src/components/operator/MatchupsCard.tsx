/**
 * @fileoverview MatchupsCard — the "Matchups" part of a league.
 *
 * The "who plays who each week" league part. This card is a header-only entry
 * that shows whether matchups are set and opens the right page:
 *   - matchups set    → the season schedule page (view/edit who-plays-who)
 *   - not set yet      → schedule setup (generate the matchups)
 *
 * (Previously this dumped the operator back into the whole create-league wizard
 * just to touch matchups; now it goes straight to the matchups page.)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { SectionCard } from './SectionCard';
import type { League } from '@/types/league';
import { logger } from '@/utils/logger';

interface MatchupsCardProps {
  /** League data (needs organization_id to launch the wizard). */
  league: League;
}

export const MatchupsCard: React.FC<MatchupsCardProps> = ({ league }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasSeason, setHasSeason] = useState(false);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [hasMatchups, setHasMatchups] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const check = async () => {
      setLoading(true);
      try {
        const { data: season } = await supabase
          .from('seasons')
          .select('id')
          .eq('league_id', league.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setHasSeason(!!season);
        setSeasonId(season?.id ?? null);
        if (season) {
          const { count } = await supabase
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', season.id);
          setHasMatchups((count ?? 0) > 0);
        }
      } catch (err) {
        logger.error('Error checking matchups', { error: err instanceof Error ? err.message : String(err) });
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [league.id]);

  const subtitle = loading
    ? undefined
    : !hasSeason
      ? 'Create a season first'
      : hasMatchups
        ? 'Set'
        : 'Not set yet';

  const action = (
    <Button
      size="sm"
      variant={hasMatchups ? 'outline' : undefined}
      loadingText="none"
      disabled={isNavigating || !hasSeason || !seasonId}
      onClick={() => {
        if (!seasonId) return;
        setIsNavigating(true);
        // Matchups exist → view/edit who-plays-who (the Matchups page).
        // Not set yet → generate them (ScheduleSetupPage).
        navigate(
          hasMatchups
            ? `/league/${league.id}/season/${seasonId}/matchups`
            : `/league/${league.id}/season/${seasonId}/schedule-setup`,
        );
      }}
    >
      {isNavigating ? 'Loading...' : hasMatchups ? 'Edit Matchups' : 'Set Matchups'}
    </Button>
  );

  return <SectionCard title="Matchups" subtitle={subtitle} actions={action} />;
};
