/**
 * @fileoverview Operator-office card that previews + configures the
 * scoring modal for a league or organization.
 *
 * The card itself is a small surface: a heading + a "Preview Scoring
 * Modal" button. Tapping the button opens the existing ScoringDialog in
 * `mode='preview'` so the LO sees exactly what scorers will see when
 * they tap a winner. An Edit button inside the modal flips it to edit
 * mode for configuring which events render. Save commits to preferences
 * and returns to preview.
 *
 * Why mount the actual modal (vs build a parallel config UI): one
 * rendering, one place to fix bugs. The same component scorers tap on
 * is the same one LOs configure against. Drift impossible by
 * construction.
 *
 * @see docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md (Unit 9)
 */

import { useState } from 'react';
import { Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScoringDialog } from '@/components/scoring/ScoringDialog';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { useUpsertPreference } from '@/api/hooks/usePreferenceMutations';
import { useIsLeagueOperatorOf, useIsOrganizationOperatorOf } from '@/hooks/useIsLeagueOperatorOf';
import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';
import type { GameType } from '@/types/league';

type Scope =
  | { scope: 'league'; leagueId: string }
  | { scope: 'organization'; orgId: string };

interface ScoringPreviewCardProps {
  /**
   * Which preference scope this card edits. League cards live on the
   * LeagueSettings page; organization cards live on OrganizationSettings.
   * The mutation upserts a row at the matching (entity_type, entity_id).
   */
  target: Scope;
}

export function ScoringPreviewCard(props: ScoringPreviewCardProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'score' | 'edit' | 'preview'>('preview');

  // Resolve the league prefs for the preview render. For league scope,
  // this is the league's own resolved prefs. For org scope, there's no
  // "league" — we pick the first league owned by the org, or fall back
  // to safe defaults. (Org scope ships in Phase 2 as a stub; deeper org-
  // preview UX is its own follow-up — see plan §design-lens findings.)
  const leagueId = props.target.scope === 'league' ? props.target.leagueId : null;
  const { data: leaguePrefs } = useResolvedLeaguePrefs(leagueId);

  // Authorization for both scopes (the modal's Edit button is gated by
  // canEditEvents — defense-in-depth even though the office page is
  // already operator-only).
  const isLeagueOp = useIsLeagueOperatorOf(
    props.target.scope === 'league' ? props.target.leagueId : null,
  );
  const isOrgOp = useIsOrganizationOperatorOf(
    props.target.scope === 'organization' ? props.target.orgId : null,
  );
  const canEditEvents = props.target.scope === 'league' ? isLeagueOp : isOrgOp;

  const upsertMutation = useUpsertPreference();
  const handleSaveEnabledEvents = async (next: Record<string, boolean>) => {
    await upsertMutation.mutateAsync(
      props.target.scope === 'league'
        ? {
            entity_type: 'league',
            entity_id: props.target.leagueId,
            enabled_events: next,
          }
        : {
            entity_type: 'organization',
            entity_id: props.target.orgId,
            enabled_events: next,
          },
    );

    // League-scope only: keep leagues.golden_break_counts_as_win in sync
    // with enabled_events.golden_break. The two encode the same decision
    // (tracking the event requires it to count as a win); diverging them
    // creates the confusing "switch says on but modal hides it" state Ed
    // surfaced during smoke testing. Org-scope edits don't touch any
    // specific leagues row.
    if (props.target.scope === 'league' && 'golden_break' in next) {
      const { error } = await supabase
        .from('leagues')
        .update({ golden_break_counts_as_win: next.golden_break })
        .eq('id', props.target.leagueId);
      if (error) {
        logger.warn('Failed to sync leagues.golden_break_counts_as_win', {
          leagueId: props.target.leagueId,
          error: error.message,
        });
      }
    }
  };

  // Synthetic game context for the preview render. The modal expects a
  // game object with a winner — we feed it a placeholder so the
  // applicable-events section renders. None of these values are
  // persisted; the preview is read-only.
  const previewGame = {
    gameNumber: 1,
    winnerPlayerName: 'Example Player',
    winnerWasScheduledBreaker: true,
  };

  const handleClose = () => {
    setOpen(false);
    setMode('preview'); // reset for next open
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" aria-hidden="true" />
          Scoring Modal Preview
        </CardTitle>
        <CardDescription>
          See and configure which events scorers can record. Changes apply
          when scorers open their next game modal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          variant="outline"
          onClick={() => {
            setMode('preview');
            setOpen(true);
          }}
          className="w-full"
        >
          <Eye className="h-4 w-4 mr-2" aria-hidden="true" />
          Preview Scoring Modal
        </Button>
        {canEditEvents && (
          <Button
            variant="outline"
            onClick={() => {
              setMode('edit');
              setOpen(true);
            }}
            className="w-full"
          >
            <Pencil className="h-4 w-4 mr-2" aria-hidden="true" />
            Configure Events
          </Button>
        )}
      </CardContent>

      <ScoringDialog
        open={open}
        game={open ? previewGame : null}
        breakAndRun={false}
        goldenBreak={false}
        // golden_break_counts_as_win lives in the resolved view but the
        // resolver hook doesn't currently select it; default to true for
        // the preview so the GB row renders. Inconsequential — preview is
        // read-only, no scoring happens.
        goldenBreakCountsAsWin={true}
        // game_type is on the `leagues` row, not on `preferences`. The
        // resolver hook doesn't fetch it. For Phase 2 the office card
        // defaults to 'eight_ball' (every current league type is 8-ball);
        // when 9-ball / 10-ball leagues activate, a follow-up will plumb
        // the actual game_type through to the preview.
        gameType="eight_ball"
        handicapType={leaguePrefs?.handicap_type}
        pointsCalculator={leaguePrefs?.points_calculator ?? null}
        pointsCalculatorParams={leaguePrefs?.points_calculator_params ?? null}
        breakFouled={false}
        winByForfeit={false}
        runout={false}
        loserValue={null}
        winnerValue={null}
        loserPlayerName={null}
        onBreakAndRunChange={() => {}}
        onGoldenBreakChange={() => {}}
        onBreakFouledChange={() => {}}
        onWinByForfeitChange={() => {}}
        onRunoutChange={() => {}}
        onLoserValueChange={() => {}}
        onWinnerValueChange={() => {}}
        onCancel={handleClose}
        onConfirm={handleClose}
        mode={mode}
        onModeChange={(next) => {
          // Save inside edit mode resolves to 'preview' (editReturnMode),
          // and Close inside preview mode closes the dialog entirely.
          if (next === mode) return;
          setMode(next);
        }}
        canEditEvents={canEditEvents}
        enabledEventsOverride={leaguePrefs?.enabled_events ?? {}}
        onSaveEnabledEvents={handleSaveEnabledEvents}
        editReturnMode="preview"
      />
    </Card>
  );
}
