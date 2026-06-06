/**
 * @fileoverview Per-game confirmer line for the LO review surface.
 *
 * Renders the OFFICIAL confirmer for each side (from the `match_games`
 * `confirmed_by_*` columns) plus a tappable "+N others" peek that lists the extra
 * witnesses (name + team) from the many-eyes log. Pure presentation — it takes a
 * pre-built `ConfirmerAudit` (see `buildConfirmerAudit`) and the two team names.
 *
 * A game with no log rows (a v1 LO-entered or pre-many-eyes game) simply shows
 * the official with no "+N others" chip.
 *
 * @see docs/plans/2026-06-04-001-feat-lo-match-review-correction-plan.md — Unit 6
 */

import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { ConfirmerAudit, SideAudit } from '@/utils/match/confirmerAudit';

export interface ConfirmerLineProps {
  audit: ConfirmerAudit;
  homeTeamName: string;
  awayTeamName: string;
}

/** One side's "Home: Player (Team)  [+N others]" row. */
function SideRow({
  sideLabel,
  teamName,
  side,
}: {
  sideLabel: string;
  teamName: string;
  side: SideAudit;
}) {
  const officialName = side.official?.name ?? 'Unconfirmed';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 shrink-0 text-muted-foreground">{sideLabel}:</span>
      <span className="font-medium">
        {officialName} <span className="font-normal text-muted-foreground">({teamName})</span>
      </span>
      {side.others.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs text-muted-foreground"
              data-testid="others-peek"
            >
              +{side.others.length} other{side.others.length === 1 ? '' : 's'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Also confirmed</p>
            <ul className="space-y-1">
              {side.others.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{o.name}</span>
                  {o.team && <span className="text-muted-foreground">{o.team}</span>}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/** The per-game confirmer audit: a "Confirmed by" label + a home + away row. */
export function ConfirmerLine({ audit, homeTeamName, awayTeamName }: ConfirmerLineProps) {
  return (
    <div className="space-y-0.5" data-testid="confirmer-line">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Confirmed by
      </p>
      <SideRow sideLabel="Home" teamName={homeTeamName} side={audit.home} />
      <SideRow sideLabel="Away" teamName={awayTeamName} side={audit.away} />
    </div>
  );
}
