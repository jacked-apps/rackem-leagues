/**
 * @fileoverview One game on the LO review/correct surface, as a compact
 * accordion item.
 *
 * Collapsed (the trigger row): game number, the matchup, and the winner with a
 * trophy — so an operator can scan a list and jump straight to the game in
 * question. Expanded (the content): the recorded winner, achievement chips (only
 * when present), the two-column home/away confirmer panel, and the **Vacate**
 * action. When a game is vacated it shows the **Undo** + re-score picks instead.
 *
 * Pure presentation: all data + actions come in as props. The parent owns the
 * `<Accordion>` wrapper; this renders a single `<AccordionItem value={...}>`.
 *
 * @see docs/plans/2026-06-04-001-feat-lo-match-review-correction-plan.md — Unit 7
 */

import { Trophy } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmerLine } from './ConfirmerLine';
import type { ConfirmerAudit } from '@/utils/match/confirmerAudit';

export interface ReviewGameRowProps {
  /** Stable accordion value (the game id). */
  value: string;
  gameNumber: number;
  homeName: string;
  awayName: string;
  winnerName: string | null;
  chips: string[];
  audit: ConfirmerAudit;
  homeTeamName: string;
  awayTeamName: string;
  vacated: boolean;
  onVacate: () => void;
  onUndo: () => void;
  onPickHome: () => void;
  onPickAway: () => void;
}

export function ReviewGameRow(props: ReviewGameRowProps) {
  const {
    value,
    gameNumber,
    homeName,
    awayName,
    winnerName,
    chips,
    audit,
    homeTeamName,
    awayTeamName,
    vacated,
    onVacate,
    onUndo,
    onPickHome,
    onPickAway,
  } = props;

  return (
    <AccordionItem
      value={value}
      className="rounded-md border px-3"
      data-testid={vacated ? 'vacated-row' : 'scored-row'}
    >
      {/* Collapsed row: G# · matchup · winner/trophy (chevron auto-appended). */}
      <AccordionTrigger className="py-2.5 hover:no-underline" data-testid="game-trigger">
        <div className="flex w-full items-center gap-2 text-sm">
          <Badge variant="secondary" className="shrink-0">
            G{gameNumber}
          </Badge>
          <span className="truncate text-muted-foreground">
            {homeName} <span className="text-foreground/60">vs</span> {awayName}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1 font-medium">
            {vacated ? (
              <span className="text-xs text-destructive">vacated</span>
            ) : winnerName ? (
              <>
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                <span className="truncate max-w-[7rem]">{winnerName}</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">no result</span>
            )}
          </span>
        </div>
      </AccordionTrigger>

      <AccordionContent className="space-y-3 pb-3">
        {vacated ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-destructive">Vacated — re-score</span>
              <Button variant="outline" size="sm" onClick={onUndo} data-testid="undo-vacate">
                Undo
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onPickHome} data-testid="rescore-home">
                {homeName} wins
              </Button>
              <Button variant="outline" className="flex-1" onClick={onPickAway} data-testid="rescore-away">
                {awayName} wins
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {winnerName ? `🏆 ${winnerName} wins` : 'No result recorded'}
              </span>
              {winnerName && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={onVacate}
                  data-testid="vacate"
                >
                  Vacate
                </Button>
              )}
            </div>

            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1" data-testid="achievements">
                {chips.map((c) => (
                  <Badge key={c} variant="outline">
                    {c}
                  </Badge>
                ))}
              </div>
            )}

            <ConfirmerLine audit={audit} homeTeamName={homeTeamName} awayTeamName={awayTeamName} />
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
