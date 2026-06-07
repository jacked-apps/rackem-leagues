/**
 * @fileoverview MatchupsCard — the "Matchups" part of a league.
 *
 * The fourth league part (Season / Teams / Schedule / Matchups). Unlike the
 * others, matchups has no standalone page — setting/editing matchups (team
 * positions + round-robin) lives as the final stage of the create-league
 * wizard. So this card is a header-only entry: it shows whether matchups are
 * set and launches the wizard to set or edit them.
 *
 * Follow-up (see LIST_FOR_ED): split matchups editing out of the full wizard
 * so an operator can edit unfinished matches directly once matchups are set,
 * without re-running creation.
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
      disabled={isNavigating || !hasSeason}
      onClick={() => {
        setIsNavigating(true);
        navigate(`/create-league/${league.organization_id}?leagueId=${league.id}`);
      }}
    >
      {isNavigating ? 'Loading...' : hasMatchups ? 'Edit Matchups' : 'Set Matchups'}
    </Button>
  );

  return <SectionCard title="Matchups" subtitle={subtitle} actions={action} />;
};
