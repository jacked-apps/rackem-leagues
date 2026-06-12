/**
 * @fileoverview HolidayFilterToggle — checkbox to show/hide minor holidays
 *
 * Defaults to OFF (public holidays only). When toggled ON, shows all
 * holidays including observances (Easter, Halloween, Mother's Day, etc.).
 *
 * Reusable — use anywhere holidays are displayed (wizard, schedule manager).
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { InfoButton } from '@/components/InfoButton';

interface HolidayFilterToggleProps {
  showAll: boolean;
  onChange: (showAll: boolean) => void;
}

export function HolidayFilterToggle({ showAll, onChange }: HolidayFilterToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox
        id="show-all-holidays"
        checked={showAll}
        onCheckedChange={(checked) => onChange(checked === true)}
        className="size-5 border-2 border-input"
      />
      <div className="flex items-center gap-1">
        <Label htmlFor="show-all-holidays" className="text-sm">
          Show all holidays
        </Label>
        <InfoButton title="Holiday Filter" size="sm">
          <p>
            By default, only major federal holidays are shown (Christmas,
            Thanksgiving, etc.). Turn this on to also see observances
            like Easter, Halloween, Mother&rsquo;s Day, and Father&rsquo;s Day.
          </p>
        </InfoButton>
      </div>
    </div>
  );
}
