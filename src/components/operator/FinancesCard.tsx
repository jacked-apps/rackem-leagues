/**
 * @fileoverview Finances Card — league-detail entry to the two finance tools.
 *
 * Splits the former single "Open Finances" button into two labelled entries
 * (mirroring the Scoring card's two-button layout): Dues (annual membership
 * dues roster) and Payout Calculator (end-of-season expenses + payouts). They
 * are distinct jobs an operator reaches for at different times, so each gets
 * its own button rather than hiding both behind one generic link.
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SectionCard } from './SectionCard';
import { Users, Calculator } from 'lucide-react';

interface FinancesCardProps {
  readonly leagueId: string;
}

/** Two-button Finances card: Dues roster + Payout Calculator. */
export function FinancesCard({ leagueId }: FinancesCardProps) {
  const navigate = useNavigate();

  return (
    <SectionCard title="Finances">
      <div className="flex flex-wrap gap-2">
        {/* Dues — annual membership dues roster (paid / unpaid by player) */}
        <Button
          variant="outline"
          className="h-auto justify-start gap-3 px-3 py-2"
          onClick={() => navigate(`/league/${leagueId}/dues`)}
        >
          <Users className="h-5 w-5 shrink-0 text-success" />
          <div className="text-left">
            <div className="text-sm font-semibold text-foreground">Dues</div>
            <div className="text-xs text-muted-foreground">Who's paid annual dues</div>
          </div>
        </Button>

        {/* Payout Calculator — expenses, projections, end-of-season payouts */}
        <Button
          variant="outline"
          className="h-auto justify-start gap-3 px-3 py-2"
          onClick={() => navigate(`/league/${leagueId}/finances`)}
        >
          <Calculator className="h-5 w-5 shrink-0 text-blue-600" />
          <div className="text-left">
            <div className="text-sm font-semibold text-foreground">Payout Calculator</div>
            <div className="text-xs text-muted-foreground">Expenses + season payouts</div>
          </div>
        </Button>
      </div>
    </SectionCard>
  );
}
