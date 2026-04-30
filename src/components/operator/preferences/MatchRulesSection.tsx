/**
 * @fileoverview Match Rules Section Component
 *
 * Reusable section for managing match rule preferences (golden break).
 * Used within PreferencesCard for both organization and league levels.
 */
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { InfoButton } from '@/components/InfoButton';

interface MatchRulesSectionProps {
  /** Whether this is league level (affects labels) */
  isLeague: boolean;
  /** Whether currently editing */
  isEditing: boolean;
  /** Whether save is in progress */
  saving: boolean;
  /** Current golden break setting */
  goldenBreakSetting: 'bca_standard' | 'always' | 'never';
  /** Display value for golden break */
  goldenBreakDisplay: string;
  /** Handler for golden break change */
  onGoldenBreakChange: (value: 'bca_standard' | 'always' | 'never') => void;
  /** Handler to start editing */
  onStartEditing: () => void;
  /** Handler to save */
  onSave: () => void;
  /** Handler to cancel */
  onCancel: () => void;
}

/**
 * Match Rules Section
 * Manages golden break counting rules
 */
export const MatchRulesSection: React.FC<MatchRulesSectionProps> = ({
  isLeague,
  isEditing,
  saving,
  goldenBreakSetting,
  goldenBreakDisplay,
  onGoldenBreakChange,
  onStartEditing,
  onSave,
  onCancel,
}) => {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Match Rules</h3>
          <InfoButton title="Golden Break Rules">
            <div className="space-y-3">
              <p><strong>Official BCA Rules:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>9-Ball:</strong> Golden break DOES count as a win</li>
                <li><strong>10-Ball:</strong> Golden break DOES count as a win</li>
                <li><strong>8-Ball:</strong> Golden break does NOT count as a win</li>
              </ul>
              <p><strong>Your Options:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>BCA Standard:</strong> Follows official BCA rules based on game type</li>
                <li><strong>Always Count:</strong> Golden breaks ALWAYS count as wins for ALL game types</li>
                <li><strong>Never Count:</strong> Golden breaks NEVER count as wins for ANY game type</li>
              </ul>
            </div>
          </InfoButton>
        </div>
        {!isEditing ? (
          <Button onClick={onStartEditing} size="sm" variant="outline" loadingText="none">
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={onSave} size="sm" disabled={saving} isLoading={saving} loadingText="Saving...">
              Save
            </Button>
            <Button onClick={onCancel} size="sm" variant="outline" loadingText="none">
              Cancel
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div>
          <Label>Golden Break Rule</Label>
          <Select value={goldenBreakSetting} onValueChange={(v) => onGoldenBreakChange(v as 'bca_standard' | 'always' | 'never')}>
            <SelectTrigger>
              <SelectValue placeholder="Select golden break rule" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bca_standard">{isLeague ? 'Use organization default' : 'BCA Standard'}</SelectItem>
              <SelectItem value="always">Always Count</SelectItem>
              <SelectItem value="never">Never Count</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            BCA Standard: 9-ball and 10-ball count, 8-ball does not
          </p>
        </div>
      ) : (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Golden Break Rule:</span>
          <span className="font-medium text-foreground">{goldenBreakDisplay}</span>
        </div>
      )}
    </div>
  );
};
