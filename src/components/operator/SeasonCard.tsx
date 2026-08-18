/**
 * @fileoverview SeasonCard — the "Season" part of a league on the league page.
 *
 * Shows, per the operator league-page design:
 *   - a count of COMPLETED seasons (header),
 *   - the CURRENT season — the one being worked on: the `active` season if there
 *     is one (shown with x/N weeks *played* progress), else the queued/upcoming
 *     season being set up (shown with its 3-step *setup* progress),
 *   - the NEXT season — only when a season is active: the queued one's setup
 *     progress, or a prompt to create it.
 *
 * "Editing the season" (its dates/blackouts) lives on the Schedule card, not
 * here — this card carries status + the guarded Delete (see {@link useRemoveSeason}).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionCard, SectionCardLoading, SectionCardEmpty } from './SectionCard';
import { useRemoveSeason } from '@/api/hooks/useSeasonMutations';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { League } from '@/types/league';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

interface SeasonCardProps {
  /** League data to display. */
  league: League;
}

/** A season row, plus the derived setup/play signals the card renders. */
interface SeasonBlock {
  id: string;
  season_name: string;
  start_date: string;
  end_date: string;
  season_length: number;
  status: string;
  /** Setup steps (Ed's terms): dates = schedule made, teams attached, matchups made. */
  hasSchedule: boolean;
  hasTeams: boolean;
  hasMatchups: boolean;
  /** Regular weeks marked completed — the x in "x / N weeks played". */
  completedWeeks: number;
  /** Matches with a played result — the guard between delete and archive. */
  playedMatches: number;
}

/** Load the setup/play signals for one season (parallel count queries). */
async function loadSeasonBlock(row: {
  id: string;
  season_name: string;
  start_date: string;
  end_date: string;
  season_length: number;
  status: string;
}): Promise<SeasonBlock> {
  const [{ count: teams }, { count: weeks }, { count: matches }, { count: doneWeeks }, { count: played }] =
    await Promise.all([
      supabase.from('teams').select('*', { count: 'exact', head: true }).eq('season_id', row.id).eq('status', 'active'),
      supabase.from('season_weeks').select('*', { count: 'exact', head: true }).eq('season_id', row.id),
      supabase.from('matches').select('*', { count: 'exact', head: true }).eq('season_id', row.id),
      supabase.from('season_weeks').select('*', { count: 'exact', head: true }).eq('season_id', row.id).eq('week_type', 'regular').eq('week_completed', true),
      supabase.from('matches').select('*', { count: 'exact', head: true }).eq('season_id', row.id).in('status', ['completed', 'verified']),
    ]);
  return {
    ...row,
    hasSchedule: (weeks ?? 0) > 0,
    hasTeams: (teams ?? 0) > 0,
    hasMatchups: (matches ?? 0) > 0,
    completedWeeks: doneWeeks ?? 0,
    playedMatches: played ?? 0,
  };
}

/** A slim progress bar (value/max). Not a form control, so a styled div is fine. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const SeasonCard: React.FC<SeasonCardProps> = ({ league }) => {
  const navigate = useNavigate();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const removeSeason = useRemoveSeason();

  const [loading, setLoading] = useState(true);
  const [completedCount, setCompletedCount] = useState(0);
  const [current, setCurrent] = useState<SeasonBlock | null>(null);
  const [next, setNext] = useState<SeasonBlock | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: seasons, error } = await supabase
        .from('seasons')
        .select('id, season_name, start_date, end_date, season_length, status')
        .eq('league_id', league.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = seasons ?? [];
      setCompletedCount(rows.filter((s) => s.status === 'completed').length);

      const active = rows.find((s) => s.status === 'active');
      const queued = rows.find((s) => s.status === 'upcoming' || s.status === 'scheduled');

      // "Current" = the season you're working on: the active one, else the one
      // being set up. "Next" only appears when a season is actively running.
      const currentRow = active ?? queued ?? null;
      const nextRow = active ? queued : null;

      setCurrent(currentRow ? await loadSeasonBlock(currentRow) : null);
      setNext(nextRow ? await loadSeasonBlock(nextRow) : null);
    } catch (err) {
      logger.error('SeasonCard: failed to load seasons', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }, [league.id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Delete (nothing played) or archive (played matches exist), with a clear confirm. */
  const handleRemove = async (block: SeasonBlock) => {
    const willArchive = block.playedMatches > 0;
    const ok = await confirm({
      title: willArchive ? 'Archive this season?' : 'Delete this season?',
      message: willArchive
        ? `"${block.season_name}" has ${block.playedMatches} played match(es), so it can't be deleted — it'll be archived instead (hidden from your active seasons, data kept).`
        : `Permanently delete "${block.season_name}" and everything in it (teams, matchups, schedule)? This can't be undone.`,
      confirmText: willArchive ? 'Archive' : 'Delete',
    });
    if (!ok) return;
    try {
      const result = await removeSeason.mutateAsync({ seasonId: block.id });
      toast.success(result.action === 'archived' ? 'Season archived.' : 'Season deleted.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove the season.');
    }
  };

  const subtitle = completedCount > 0
    ? `${completedCount} completed season${completedCount === 1 ? '' : 's'}`
    : undefined;

  /** Render one season block — play progress if active, setup progress otherwise. */
  const renderBlock = (block: SeasonBlock, label: 'CURRENT' | 'NEXT') => {
    const isActive = block.status === 'active';
    const setupDone = [block.hasSchedule, block.hasTeams, block.hasMatchups].filter(Boolean).length;
    const setupComplete = setupDone === 3;
    const statusText = isActive
      ? 'Active'
      : setupComplete
        ? 'Ready'
        : 'Setting up';

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="truncate font-semibold text-foreground">{block.season_name}</div>
          </div>
          <Badge variant={isActive ? 'default' : setupComplete ? 'default' : 'secondary'}>{statusText}</Badge>
        </div>

        <div className="text-sm text-muted-foreground">
          {fmtDate(block.start_date)} – {fmtDate(block.end_date)}
        </div>

        {isActive ? (
          <>
            <Bar value={block.completedWeeks} max={block.season_length} />
            <div className="text-xs text-muted-foreground">
              {block.completedWeeks} / {block.season_length} weeks played
            </div>
          </>
        ) : (
          <>
            <Bar value={setupDone} max={3} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span className={block.hasSchedule ? 'text-success' : 'text-muted-foreground'}>
                {block.hasSchedule ? '✓' : '○'} Dates
              </span>
              <span className={block.hasTeams ? 'text-success' : 'text-muted-foreground'}>
                {block.hasTeams ? '✓' : '○'} Teams
              </span>
              <span className={block.hasMatchups ? 'text-success' : 'text-muted-foreground'}>
                {block.hasMatchups ? '✓' : '○'} Matchups
              </span>
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => handleRemove(block)}
            isLoading={removeSeason.isPending}
            loadingText="Removing..."
          >
            {block.playedMatches > 0 ? 'Archive season' : 'Delete season'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <SectionCard title="Season" subtitle={subtitle} collapsible defaultOpen>
      {loading ? (
        <SectionCardLoading message="Loading season..." />
      ) : !current ? (
        <SectionCardEmpty icon="📅" message="No season yet — create one to get started." />
      ) : (
        <div className="space-y-4">
          {renderBlock(current, 'CURRENT')}

          <div className="border-t border-border pt-4">
            {next ? (
              renderBlock(next, 'NEXT')
            ) : current.status === 'active' ? (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">NEXT</div>
                <p className="text-sm text-muted-foreground">
                  Not created yet. Season ends {fmtDate(current.end_date)}.
                </p>
                <Button
                  size="sm"
                  variant="default"
                  loadingText="none"
                  onClick={() => navigate(`/operator/start-next-season/${league.id}`)}
                >
                  Create next season
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
      {ConfirmDialogComponent}
    </SectionCard>
  );
};
