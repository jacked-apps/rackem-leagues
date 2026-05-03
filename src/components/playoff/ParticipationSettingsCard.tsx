/**
 * @fileoverview Participation Settings Card Component
 *
 * A reusable card component that displays and allows editing of playoff
 * participation/qualification settings. Shows the configured settings
 * (not calculated results) since this is for organization-level defaults.
 *
 * Supports three qualification types:
 * - All teams: All teams qualify (odd numbers drop last place)
 * - Fixed: A set number of top teams qualify
 * - Percentage: A percentage of teams qualify with min/max constraints
 *
 * This component uses the playoff settings reducer for state management,
 * receiving dispatch from the parent component.
 */

import React, { useState } from 'react';
import { Pencil, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  PlayoffSettingsState,
  PlayoffSettingsAction,
  QualificationType,
} from '@/hooks/playoff/usePlayoffSettingsReducer';

/**
 * Props for the ParticipationSettingsCard component
 */
export interface ParticipationSettingsCardProps {
  /** Current playoff settings state */
  settings: Pick<
    PlayoffSettingsState,
    | 'qualificationType'
    | 'fixedTeamCount'
    | 'qualifyingPercentage'
    | 'percentageMin'
    | 'percentageMax'
  >;
  /** Dispatch function for updating settings */
  dispatch: React.Dispatch<PlayoffSettingsAction>;
}

/**
 * ParticipationSettingsCard Component
 *
 * Displays the current playoff participation settings (the configured values,
 * not calculated results) and provides collapsible editing controls.
 */
export const ParticipationSettingsCard: React.FC<ParticipationSettingsCardProps> = ({
  settings,
  dispatch,
}) => {
  // Local state for collapsible edit section
  const [showQualificationEdit, setShowQualificationEdit] = useState(false);

  const {
    qualificationType,
    fixedTeamCount,
    qualifyingPercentage,
    percentageMin,
    percentageMax,
  } = settings;

  // Determine what to show in the circle based on qualification type
  const circleDisplay = qualificationType === 'all'
    ? 'ALL'
    : qualificationType === 'fixed'
      ? fixedTeamCount.toString()
      : `${qualifyingPercentage}%`;

  // Build the title text
  const titleText = qualificationType === 'all'
    ? 'All Teams Participate'
    : qualificationType === 'fixed'
      ? `Top ${fixedTeamCount} Teams`
      : `Top ${qualifyingPercentage}% of Teams`;

  // Build the description text showing the full settings
  const getDescriptionText = () => {
    if (qualificationType === 'all') {
      return 'All teams qualify for playoffs (odd numbers drop last place)';
    }
    if (qualificationType === 'fixed') {
      return `Top ${fixedTeamCount} teams qualify for playoffs`;
    }
    // Percentage type - show min/max constraints
    const parts = [`${qualifyingPercentage}% of teams qualify`];
    if (percentageMin > 0) {
      parts.push(`minimum ${percentageMin}`);
    }
    if (percentageMax !== null) {
      parts.push(`maximum ${percentageMax}`);
    }
    return parts.join(', ');
  };

  return (
    <div className="p-4 bg-green-50 rounded-lg space-y-3">
      {/* Summary Row */}
      <div className="flex items-center gap-3">
        {/* Circle indicator */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-600 text-white font-bold text-sm">
          {circleDisplay}
        </div>

        {/* Description */}
        <div className="flex-1">
          <div className="font-medium text-green-900">
            {titleText}
          </div>
          <div className="text-sm text-green-700 mt-1">
            {getDescriptionText()}
          </div>
        </div>

        {/* Edit Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowQualificationEdit(!showQualificationEdit)}
          className="text-green-700 hover:text-green-900 hover:bg-green-100"
        >
          {showQualificationEdit ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <Pencil className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Collapsible Qualification Settings */}
      {showQualificationEdit && (
        <div className="pt-3 border-t border-green-200 space-y-3">
          {/* Qualification Type Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-green-800">Teams qualifying</span>
            <Select
              value={qualificationType}
              onValueChange={(value) =>
                dispatch({ type: 'SET_QUALIFICATION_TYPE', payload: value as QualificationType })
              }
            >
              <SelectTrigger className="w-[160px] bg-card">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                <SelectItem value="fixed">Top # teams</SelectItem>
                <SelectItem value="percentage">Top %</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fixed team count input */}
          {qualificationType === 'fixed' && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-sm text-green-700">Top</span>
              <Input
                type="number"
                min={2}
                max={40}
                value={fixedTeamCount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  dispatch({ type: 'SET_FIXED_TEAM_COUNT', payload: parseInt(e.target.value) || 2 })
                }
                className="w-20 bg-card"
              />
              <span className="text-sm text-green-700">teams</span>
            </div>
          )}

          {/* Percentage with min/max inputs */}
          {qualificationType === 'percentage' && (
            <div className="space-y-2 ml-4">
              {/* Percentage selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-700">Top</span>
                <Select
                  value={qualifyingPercentage.toString()}
                  onValueChange={(value) =>
                    dispatch({ type: 'SET_QUALIFYING_PERCENTAGE', payload: parseInt(value, 10) })
                  }
                >
                  <SelectTrigger className="w-[100px] bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25%</SelectItem>
                    <SelectItem value="33">33%</SelectItem>
                    <SelectItem value="50">50%</SelectItem>
                    <SelectItem value="67">67%</SelectItem>
                    <SelectItem value="75">75%</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-green-700">of teams</span>
              </div>

              {/* Minimum input */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-700">Minimum</span>
                <Input
                  type="number"
                  min={2}
                  max={40}
                  value={percentageMin}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    dispatch({ type: 'SET_PERCENTAGE_MIN', payload: parseInt(e.target.value) || 2 })
                  }
                  className="w-20 bg-card"
                />
                <span className="text-sm text-green-700">teams</span>
              </div>

              {/* Maximum input */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-700">Maximum</span>
                <Input
                  type="number"
                  min={2}
                  max={40}
                  value={percentageMax ?? ''}
                  placeholder="No limit"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const val = parseInt(e.target.value);
                    dispatch({ type: 'SET_PERCENTAGE_MAX', payload: isNaN(val) ? null : val });
                  }}
                  className="w-20 bg-card"
                />
                <span className="text-sm text-green-700">teams (leave empty for no max)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ParticipationSettingsCard;
