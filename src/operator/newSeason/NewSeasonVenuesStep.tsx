/**
 * @fileoverview Step 3 of the "Start Next Season" wizard — venues.
 *
 * Same carry-forward pattern as teams (Step 2): all venues from the
 * previous season's `league_venues` are checked by default. Operator
 * unchecks any that aren't being used next season. At least one
 * venue must remain checked.
 *
 * Adding new venues to the league is handled separately via the
 * org's Venue Management page — this step only handles which of
 * the EXISTING league venues carry into the new season.
 *
 * Closes Unit 5 of docs/plans/2026-05-17-001-feat-new-season-from-previous-plan.md.
 */

import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { MapPin, AlertTriangle } from 'lucide-react';
import type { NewSeasonPrefill } from '@/api/queries/newSeasonPrefill';

export interface VenueDecision {
  venueId: string;
  included: boolean;
}

interface NewSeasonVenuesStepProps {
  prefill: NewSeasonPrefill;
  venues: VenueDecision[];
  onChange: (venues: VenueDecision[]) => void;
}

export function NewSeasonVenuesStep({
  prefill,
  venues,
  onChange,
}: NewSeasonVenuesStepProps) {
  const rows = useMemo(() => {
    return venues.map((decision) => {
      const source = prefill.leagueVenues.find(
        (v) => v.venue_id === decision.venueId,
      );
      return { decision, source };
    });
  }, [venues, prefill.leagueVenues]);

  const updateDecision = (venueId: string, included: boolean) => {
    onChange(
      venues.map((v) => (v.venueId === venueId ? { ...v, included } : v)),
    );
  };

  const checkedCount = venues.filter((v) => v.included).length;
  const noneSelected = checkedCount === 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        All venues from {prefill.previousSeason.season_name} are checked
        by default. Uncheck any that aren't being used next season. To
        add a brand-new venue to the league, head to{' '}
        <span className="font-medium">Venue Management</span> first;
        then come back and start the next season.
      </p>

      <div className="space-y-2">
        {rows.map(({ decision, source }) => {
          if (!source) return null;
          const tableCount = source.available_table_numbers?.length ?? 0;
          return (
            <div
              key={decision.venueId}
              className={[
                'border rounded-lg p-4 transition-colors',
                !decision.included && 'opacity-50 bg-muted/30',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`venue-${decision.venueId}`}
                  checked={decision.included}
                  onCheckedChange={(checked) =>
                    updateDecision(decision.venueId, !!checked)
                  }
                  className="mt-1"
                />
                <Label
                  htmlFor={`venue-${decision.venueId}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {source.venue_name}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tableCount} table{tableCount === 1 ? '' : 's'} available
                  </p>
                </Label>
              </div>
            </div>
          );
        })}
      </div>

      {noneSelected && (
        <div className="border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-700 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-yellow-800 dark:text-yellow-300">
            At least one venue must be checked to continue. Teams need
            somewhere to play.
          </p>
        </div>
      )}

      <div className="text-sm text-muted-foreground border-t pt-3">
        {checkedCount} venue{checkedCount === 1 ? '' : 's'} carrying
        forward of {venues.length} from previous season.
      </div>
    </div>
  );
}
