/**
 * @fileoverview SetupSummaryCard — the at-a-glance "Setup Summary" card on the
 * Manage Teams editing surface (league type, venue/table counts, teams used vs
 * max). Presentational: all values are passed in. Extracted from
 * `src/operator/TeamManagement.tsx` as part of the content/chrome decomposition.
 */

import { InfoButton } from '@/components/InfoButton';

interface SetupSummaryCardProps {
  /** Multiple venues assigned → traveling league. */
  isTraveling: boolean;
  /** Exactly one venue assigned → in-house league. */
  isInHouse: boolean;
  /** Number of venues assigned to the league. */
  venueCount: number;
  /** Total tables available across all assigned venues. */
  tablesAvailable: number;
  /** Current number of teams. */
  teamCount: number;
  /** Maximum teams the venue capacity allows. */
  maxTeams: number;
  /** True when the team count has reached the max (shown in warning color). */
  isAtMaxTeams: boolean;
}

export function SetupSummaryCard({
  isTraveling,
  isInHouse,
  venueCount,
  tablesAvailable,
  teamCount,
  maxTeams,
  isAtMaxTeams,
}: SetupSummaryCardProps) {
  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">Setup Summary</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Type:</span>
          <span className="font-medium text-foreground">
            {isTraveling ? 'Traveling' : isInHouse ? 'In-House' : 'Not Set'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Venues:</span>
          <span className="font-medium text-foreground">{venueCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tables Available:</span>
          <span className="font-medium text-foreground">{tablesAvailable}</span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Teams:</span>
            <InfoButton title="Max Teams Explained" size="sm">
              {isInHouse ? (
                <p>In-house leagues can have 2 teams per table since both teams play at the same venue.</p>
              ) : (
                <p>Traveling leagues are limited to 1 home team per table across all venues.</p>
              )}
            </InfoButton>
          </div>
          <span className={`font-medium ${isAtMaxTeams ? 'text-warning' : 'text-foreground'}`}>
            {teamCount}/{maxTeams}
          </span>
        </div>
      </div>
    </div>
  );
}
