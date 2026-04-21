/**
 * @fileoverview Roster Settings Section Component
 *
 * Lets LOs edit `max_roster_size` (how many total players a team can have
 * on its roster) at both the organization and league levels. At the league
 * level, `lineup_size` is also displayed as a read-only value — it's tier 1
 * immutable (see supabase/migrations/20260418000002_lock_tier1_preferences.sql)
 * because changing how many players play per match fundamentally changes
 * the league's structure.
 *
 * Replaces the older FormatSettingsSection which only exposed a two-value
 * dropdown (5-man / 8-man) — insufficient for leagues that want other
 * roster sizes.
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { InfoButton } from '@/components/InfoButton';

interface RosterSettingsSectionProps {
  /** Whether this is league level (affects labels + shows lineup size). */
  isLeague: boolean;
  /** Whether currently editing. */
  isEditing: boolean;
  /** Whether save is in progress. */
  saving: boolean;
  /** Current max_roster_size input value (empty string when using default). */
  maxRosterSize: string;
  /** Whether the league is using the org-default for max_roster_size. Only
   *  meaningful at league level; always false at org level. */
  useOrgDefaultMaxRoster: boolean;
  /** Display value to render in read mode — resolved from preferences cascade. */
  maxRosterSizeDisplay: string;
  /** Read-only display of the league's locked lineup_size (league only). */
  lineupSizeDisplay?: string;
  /** Handler for max_roster_size input change. */
  onMaxRosterSizeChange: (value: string) => void;
  /** Handler for the org-default checkbox (league level only). */
  onUseOrgDefaultChange: (checked: boolean) => void;
  /** Handler to start editing. */
  onStartEditing: () => void;
  /** Handler to save. */
  onSave: () => void;
  /** Handler to cancel. */
  onCancel: () => void;
}

export function RosterSettingsSection({
  isLeague,
  isEditing,
  saving,
  maxRosterSize,
  useOrgDefaultMaxRoster,
  maxRosterSizeDisplay,
  lineupSizeDisplay,
  onMaxRosterSizeChange,
  onUseOrgDefaultChange,
  onStartEditing,
  onSave,
  onCancel,
}: RosterSettingsSectionProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Roster Settings</h3>
          <InfoButton title="Roster Settings">
            {isLeague
              ? 'Maximum players a team can have on its roster for this league. Lineup size (how many play per match) is fixed at league creation and shown below for reference.'
              : 'Default maximum roster size for new leagues in this organization. Individual leagues can override this value.'}
          </InfoButton>
        </div>
        {!isEditing ? (
          <Button onClick={onStartEditing} size="sm" variant="outline" loadingText="none">
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={onSave}
              size="sm"
              disabled={saving}
              isLoading={saving}
              loadingText="Saving..."
            >
              Save
            </Button>
            <Button onClick={onCancel} size="sm" variant="outline" loadingText="none">
              Cancel
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          {isLeague && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="use-org-default-roster"
                checked={useOrgDefaultMaxRoster}
                onCheckedChange={(c) => onUseOrgDefaultChange(c === true)}
              />
              <Label
                htmlFor="use-org-default-roster"
                className="text-sm text-gray-700 cursor-pointer"
              >
                Use organization default
              </Label>
            </div>
          )}
          <div>
            <Label htmlFor="max-roster-size">Max Roster Size (players per team)</Label>
            <Input
              id="max-roster-size"
              type="number"
              min={1}
              max={20}
              step={1}
              value={maxRosterSize}
              disabled={isLeague && useOrgDefaultMaxRoster}
              onChange={(e) => onMaxRosterSizeChange(e.target.value)}
              placeholder="e.g. 8"
            />
            <p className="text-xs text-gray-500 mt-1">Must be between 1 and 20.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Max Roster Size:</span>
            <span className="font-medium text-gray-900">{maxRosterSizeDisplay}</span>
          </div>
          {isLeague && lineupSizeDisplay && (
            <div className="flex justify-between pt-1 border-t mt-2">
              <span className="text-gray-600">
                Lineup Size{' '}
                <span className="text-xs text-gray-400">(locked at league creation)</span>:
              </span>
              <span className="font-medium text-gray-900">{lineupSizeDisplay}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
