/**
 * @fileoverview Handicap Settings Section Component
 *
 * Reusable section for managing handicap preferences.
 * Used within PreferencesCard for both organization and league levels.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { InfoButton } from '@/components/InfoButton';
import type { HandicapVariant } from '@/types/league';

interface HandicapSettingsSectionProps {
  /** Whether this is league level (affects labels) */
  isLeague: boolean;
  /** Whether currently editing */
  isEditing: boolean;
  /** Whether save is in progress */
  saving: boolean;
  /** Current handicap variant value */
  handicapVariant: HandicapVariant | 'default';
  /** Current team handicap variant value */
  teamHandicapVariant: HandicapVariant | 'default';
  /** Current game history limit */
  gameHistoryLimit: number;
  /** Display value for player handicap */
  playerHandicapDisplay: string;
  /** Display value for team handicap */
  teamHandicapDisplay: string;
  /** Display value for game history limit */
  gameHistoryDisplay: string;
  /** Handler for handicap variant change */
  onHandicapVariantChange: (value: HandicapVariant | 'default') => void;
  /** Handler for team handicap variant change */
  onTeamHandicapVariantChange: (value: HandicapVariant | 'default') => void;
  /** Handler for game history limit change */
  onGameHistoryLimitChange: (value: number) => void;
  /** Handler to start editing */
  onStartEditing: () => void;
  /** Handler to save */
  onSave: () => void;
  /** Handler to cancel */
  onCancel: () => void;
}

/**
 * Handicap Settings Section
 * Manages player/team handicap variants and game history limit
 */
export const HandicapSettingsSection: React.FC<HandicapSettingsSectionProps> = ({
  isLeague,
  isEditing,
  saving,
  handicapVariant,
  teamHandicapVariant,
  gameHistoryLimit,
  playerHandicapDisplay,
  teamHandicapDisplay,
  gameHistoryDisplay,
  onHandicapVariantChange,
  onTeamHandicapVariantChange,
  onGameHistoryLimitChange,
  onStartEditing,
  onSave,
  onCancel,
}) => {
  const defaultLabel = isLeague ? 'Use organization default' : 'None chosen';

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Handicap Settings</h3>
          <InfoButton title="Handicap Settings">
            Controls how player and team handicaps are calculated.
            {isLeague ? ' Set to use organization default or override for this league.' : ' These can be overridden per league.'}
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
        <div className="space-y-4">
          <div>
            <Label>Player Handicap Variant</Label>
            <Select value={handicapVariant} onValueChange={(v) => onHandicapVariantChange(v as HandicapVariant | 'default')}>
              <SelectTrigger>
                <SelectValue placeholder={defaultLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">{defaultLabel}</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="reduced">Reduced</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Team Handicap Variant</Label>
            <Select value={teamHandicapVariant} onValueChange={(v) => onTeamHandicapVariantChange(v as HandicapVariant | 'default')}>
              <SelectTrigger>
                <SelectValue placeholder={defaultLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">{defaultLabel}</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="reduced">Reduced</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Game History Limit (for handicap calculation)</Label>
            <Input
              type="number"
              value={gameHistoryLimit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onGameHistoryLimitChange(parseInt(e.target.value) || 200)}
              min={50}
              max={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Number of recent games to include (50-500)
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Player Handicap:</span>
            <span className="font-medium text-foreground">{playerHandicapDisplay}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Team Handicap:</span>
            <span className="font-medium text-foreground">{teamHandicapDisplay}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Game History Limit:</span>
            <span className="font-medium text-foreground">{gameHistoryDisplay}</span>
          </div>
        </div>
      )}
    </div>
  );
};
