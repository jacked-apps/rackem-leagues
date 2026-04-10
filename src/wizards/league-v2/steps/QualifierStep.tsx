/**
 * @fileoverview QualifierStep — optional division/descriptor for the league name
 *
 * Asks the operator for an optional identifier used when they run multiple
 * leagues of the same type on the same day (e.g., "East Side", "Beginner",
 * "Division A"). Gets inserted into the auto-generated league name.
 *
 * This step is optional — the user can leave it blank and click Next.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InfoButton } from '@/components/InfoButton';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

export function QualifierStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, LeagueWizardFormData>) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <Label htmlFor="qualifier">Add an optional descriptor (Optional)</Label>
        <InfoButton title="When do I need this?" size="sm">
          <p>
            Use this if you run multiple leagues of the same game on the same
            day. For example, &ldquo;East Side&rdquo;, &ldquo;Beginner&rdquo;,
            or &ldquo;Division A&rdquo;. It gets added to the league name
            to tell them apart. Leave blank if you only have one league.
          </p>
        </InfoButton>
      </div>

      <Input
        id="qualifier"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder='e.g., "East Side", "Beginner", "Division A"'
      />
    </div>
  );
}
