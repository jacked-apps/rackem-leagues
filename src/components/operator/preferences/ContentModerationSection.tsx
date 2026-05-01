/**
 * @fileoverview Content Moderation Section Component
 *
 * Reusable section for managing profanity filter preferences.
 * Used within PreferencesCard for both organization and league levels.
 * Controls whether team names and content are validated for profanity.
 */
import { Button } from '@/components/ui/button';
import { InfoButton } from '@/components/InfoButton';

interface ContentModerationSectionProps {
  /** Whether this is league level (affects labels) */
  isLeague: boolean;
  /** Whether currently editing */
  isEditing: boolean;
  /** Whether save is in progress */
  saving: boolean;
  /** Current profanity filter setting */
  profanityFilterEnabled: boolean;
  /** Whether using organization default (for league level) */
  isUsingOrgDefault?: boolean;
  /** Display value for profanity filter */
  profanityFilterDisplay: string;
  /** Handler for profanity filter change */
  onProfanityFilterChange: (value: boolean) => void;
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
 * Content Moderation Section
 * Manages profanity filter settings for team names and content
 */
export const ContentModerationSection: React.FC<ContentModerationSectionProps> = ({
  isLeague,
  isEditing,
  saving,
  profanityFilterEnabled,
  isUsingOrgDefault,
  profanityFilterDisplay,
  onProfanityFilterChange,
  onUseOrgDefault,
  onStartEditing,
  onSave,
  onCancel,
}) => {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Content Moderation</h3>
          <InfoButton title="Content Moderation">
            <div className="space-y-3">
              <p>Controls profanity validation for team names and other content.</p>
              <p><strong>Your Options:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Team names may contain profanity:</strong> No content filtering applied</li>
                <li><strong>Team names may not contain profanity:</strong> Team names with inappropriate language will be rejected</li>
              </ul>
              <p className="mt-2">
                <strong>Note:</strong> This setting applies to team names and organization-wide content only.
                Individual messages are filtered based on each user&apos;s personal preferences.
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
                name="profanityFilter"
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
              name="profanityFilter"
              checked={!profanityFilterEnabled && !isUsingOrgDefault}
              onChange={() => onProfanityFilterChange(false)}
              className="w-4 h-4"
            />
            <span className="text-sm">Team names may contain profanity</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="profanityFilter"
              checked={profanityFilterEnabled && !isUsingOrgDefault}
              onChange={() => onProfanityFilterChange(true)}
              className="w-4 h-4"
            />
            <span className="text-sm">Team names may not contain profanity</span>
          </label>
        </div>
      ) : (
        <p className="text-sm text-foreground">{profanityFilterDisplay}</p>
      )}
    </div>
  );
};
