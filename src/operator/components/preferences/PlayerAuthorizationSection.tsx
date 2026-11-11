/**
 * @fileoverview Player Authorization Section Component
 *
 * Reusable section for managing player authorization preferences.
 * Used within PreferencesCard for both organization and league levels.
 */
import { Button } from '@/components/ui/button';
import { InfoButton } from '@/components/InfoButton';

interface PlayerAuthorizationSectionProps {
  /** Whether this is league level (affects labels) */
  isLeague: boolean;
  /** Whether currently editing */
  isEditing: boolean;
  /** Whether save is in progress */
  saving: boolean;
  /** Current allow unauthorized setting */
  allowUnauthorizedPlayers: boolean;
  /** Whether using organization default (for league level) */
  isUsingOrgDefault?: boolean;
  /** Display value for authorization */
  authorizationDisplay: string;
  /** Handler for authorization change */
  onAuthorizationChange: (value: boolean) => void;
  /** Handler to use organization default (league level only) */
  onUseOrgDefault?: () => void;
  /** Handler to start editing */
  onStartEditing: () => void;
  /** Handler to save */
  onSave: () => void;
  /** Handler to cancel */
  onCancel: () => void;
}

/**
 * Player Authorization Section
 * Manages whether new players need authorization before playing
 */
export const PlayerAuthorizationSection: React.FC<PlayerAuthorizationSectionProps> = ({
  isLeague,
  isEditing,
  saving,
  allowUnauthorizedPlayers,
  isUsingOrgDefault,
  authorizationDisplay,
  onAuthorizationChange,
  onUseOrgDefault,
  onStartEditing,
  onSave,
  onCancel,
}) => {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Player Authorization</h3>
          <InfoButton title="Player Authorization">
            <div className="space-y-3">
              <p>Controls whether new players need authorization before playing in matches.</p>
              <p><strong>Your Options:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>New players can be used without authorization:</strong> Any player can be added to lineups immediately</li>
                <li><strong>Players must be authorized:</strong> Operators must set starting handicaps before a player can compete</li>
              </ul>
              <p className="mt-2">
                Players become &quot;established&quot; after 15+ games and are auto-authorized based on their game history.
              </p>
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
        <div className="space-y-2">
          {isLeague && onUseOrgDefault && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="authorization"
                checked={isUsingOrgDefault}
                onChange={onUseOrgDefault}
                className="w-4 h-4"
              />
              <span className="text-sm">Use organization default</span>
            </label>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="authorization"
              checked={allowUnauthorizedPlayers && !isUsingOrgDefault}
              onChange={() => onAuthorizationChange(true)}
              className="w-4 h-4"
            />
            <span className="text-sm">New players can be used without authorization</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="authorization"
              checked={!allowUnauthorizedPlayers && !isUsingOrgDefault}
              onChange={() => onAuthorizationChange(false)}
              className="w-4 h-4"
            />
            <span className="text-sm">Players must be authorized to be used in lineups</span>
          </label>
        </div>
      ) : (
        <p className="text-sm text-foreground">{authorizationDisplay}</p>
      )}
    </div>
  );
};
