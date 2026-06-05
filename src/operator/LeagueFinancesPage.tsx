/**
 * @fileoverview Dedicated finances page for a single league.
 *
 * Mounts the existing `LeagueFinancesSection` on its own route so the
 * league detail page can stay focused on the season-running bits
 * (status, teams, schedule, standings). Operators who care about
 * finances click through; operators who don't never see the cards.
 *
 * Route: `/league/:leagueId/finances`
 *
 * Why this page exists rather than the section being inlined on
 * LeagueDetail.tsx: per Ed's product call, finances/accounting is
 * a separate area of the LO's brain — payouts, BCA dues, season
 * payments. The right home is its own gateway, not a card buried
 * between the overview and teams. This page is the first step; a
 * full Finances/Accounting hub with sub-pages (Season Payments,
 * BCA Dues, etc.) is a follow-up plan tracked separately.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { PageHeader } from '@/components/PageHeader';
import { LeagueFinancesSection } from '@/components/operator/finances/LeagueFinancesSection';
import { LoadingState } from '@/components/shared';

interface SeasonHandle {
  id: string;
  season_length: number;
  status: string;
}

export default function LeagueFinancesPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [season, setSeason] = useState<SeasonHandle | null>(null);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the active or most-recent season + its team count. The
  // finances section uses these for the running projection card.
  useEffect(() => {
    const load = async () => {
      if (!leagueId) {
        setError('No league ID');
        setLoading(false);
        return;
      }
      try {
        const { data: activeSeason } = await supabase
          .from('seasons')
          .select('id, season_length, status')
          .eq('league_id', leagueId)
          .eq('status', 'active')
          .maybeSingle();
        const target = activeSeason ?? null;
        setSeason(target);
        if (target?.id) {
          const { count } = await supabase
            .from('teams')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', target.id)
            .eq('status', 'active');
          setTeamCount(count ?? 0);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load finances');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [leagueId]);

  if (!leagueId) {
    return <p className="p-6 text-red-600">Missing league ID.</p>;
  }
  if (loading) {
    return (
      <div className="container mx-auto px-4 max-w-4xl py-8">
        <LoadingState message="Loading finances..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="container mx-auto px-4 max-w-4xl py-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        backTo={`/league/${leagueId}`}
        backLabel="Back to League"
        title="Finances"
      />
      <div className="container mx-auto px-4 max-w-4xl py-8">
        <LeagueFinancesSection
          leagueId={leagueId}
          seasonId={season?.id ?? null}
          teamCount={teamCount}
          totalWeeks={season?.season_length ?? 0}
        />
        {/* Tiny back-link at the bottom for long pages. */}
        <div className="mt-8 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => navigate(`/league/${leagueId}`)}
            className="underline hover:text-foreground"
          >
            ← Back to league
          </button>
        </div>
      </div>
    </>
  );
}
