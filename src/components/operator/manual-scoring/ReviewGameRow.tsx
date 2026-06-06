/**
 * @fileoverview One game row on the LO review/correct surface.
 *
 * Two visual states:
 *  - **Scored** — matchup, recorded winner, achievement chips (only when
 *    present), the confirmer line, and a **Vacate** action.
 *  - **Vacated-pending-rescore** — a distinct "vacated" notice with **Undo**
 *    (restore the pre-vacate result) and **Score** (re-score) actions.
 *
 * Pure presentation: all data + actions come in as props.
 *
 * @see docs/plans/2026-06-04-001-feat-lo-match-review-correction-plan.md — Unit 7
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmerLine } from './ConfirmerLine';
import type { ConfirmerAudit } from '@/utils/match/confirmerAudit';

export interface ReviewGameRowProps {
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
    <Card data-testid={vacated ? 'vacated-row' : 'scored-row'}>
      <CardHeader className="py-2">
        <CardTitle className="flex items-center gap-2 text-sm font-normal">
          <Badge variant="secondary">Game {gameNumber}</Badge>
          <span>
            {homeName} vs {awayName}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2 pb-3">
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
                {winnerName ? `🏆 ${winnerName}` : 'No result recorded'}
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
      </CardContent>
    </Card>
  );
}
