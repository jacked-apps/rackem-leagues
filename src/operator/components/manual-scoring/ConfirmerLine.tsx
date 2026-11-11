/**
 * @fileoverview Per-game confirmer panel for the LO review surface.
 *
 * Two columns — Home and Away — each headed by the side + team name, listing the
 * FULL names of everyone who confirmed that side's result (the official confirmer
 * from the `match_games` columns plus any extra witnesses from the many-eyes log).
 * Built for dispute adjudication, so it shows every name rather than a "+N" peek.
 *
 * Pure presentation — it takes a pre-built `ConfirmerAudit` (full names already
 * resolved via `fullNameTeamMap`) and the two team names.
 *
 * @see docs/plans/2026-06-04-001-feat-lo-match-review-correction-plan.md — Unit 6
 */

import { PlayerNameLink } from '@/components/PlayerNameLink';
import type { ConfirmerAudit, ConfirmerName, SideAudit } from '@/utils/match/confirmerAudit';

export interface ConfirmerLineProps {
  audit: ConfirmerAudit;
  homeTeamName: string;
  awayTeamName: string;
}

/** Official confirmer first, then the extra witnesses — deduped, all names. */
function confirmerList(side: SideAudit): ConfirmerName[] {
  const list: ConfirmerName[] = [];
  if (side.official) list.push(side.official);
  for (const o of side.others) {
    if (!list.some((c) => c.id === o.id)) list.push(o);
  }
  return list;
}

/** One side's column: "Home: Team" header + the full confirmer-name list. */
function SideColumn({ label, teamName, side }: { label: string; teamName: string; side: SideAudit }) {
  const names = confirmerList(side);
  return (
    <div className="text-xs">
      <p className="font-semibold text-muted-foreground">
        {label}: <span className="text-foreground">{teamName}</span>
      </p>
      {names.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {names.map((c) => (
            <li key={c.id}>
              {/* Clickable for dispute adjudication: tap a confirmer to view their
                  profile, message them, etc. (PlayerNameLink popover). */}
              <PlayerNameLink playerId={c.id} playerName={c.name} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 italic text-muted-foreground">Unconfirmed</p>
      )}
    </div>
  );
}

/** Confirmer panel: a "Confirmed by" label + the home/away two-column lists. */
export function ConfirmerLine({ audit, homeTeamName, awayTeamName }: ConfirmerLineProps) {
  return (
    <div data-testid="confirmer-line">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Confirmed by
      </p>
      <div className="grid grid-cols-2 gap-4">
        <SideColumn label="Home" teamName={homeTeamName} side={audit.home} />
        <SideColumn label="Away" teamName={awayTeamName} side={audit.away} />
      </div>
    </div>
  );
}
