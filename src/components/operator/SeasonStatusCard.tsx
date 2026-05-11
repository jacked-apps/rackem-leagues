/**
 * @fileoverview SeasonStatusCard Component
 *
 * Displays current season configuration status with ability to edit specific steps
 * Shows: start date, season length, BCA dates, APA dates
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { parseLocalDate } from '@/utils/formatters';

interface SeasonStatusCardProps {
  /** Season start date (ISO string) */
  startDate?: string;
  /** Season length in weeks */
  seasonLength?: number;
  /** BCA championship start date (ISO string) */
  bcaStartDate?: string;
  /** BCA championship end date (ISO string) */
  bcaEndDate?: string;
  /** Whether BCA dates are ignored */
  bcaIgnored?: boolean;
  /** APA championship start date (ISO string) */
  apaStartDate?: string;
  /** APA championship end date (ISO string) */
  apaEndDate?: string;
  /** Whether APA dates are ignored */
  apaIgnored?: boolean;
  /** Callback to edit a specific step */
  onEdit?: (step: 'startDate' | 'seasonLength' | 'bca' | 'apa') => void;
}

/**
 * SeasonStatusCard Component
 *
 * Shows the current configuration of the season being created/edited
 * Allows quick editing of individual configuration steps
 */
export const SeasonStatusCard: React.FC<SeasonStatusCardProps> = ({
  startDate,
  seasonLength,
  bcaStartDate,
  bcaEndDate,
  bcaIgnored,
  apaStartDate,
  apaEndDate,
  apaIgnored,
  onEdit,
}) => {
  /**
   * Format date for display
   */
  const formatDate = (isoDate: string | undefined): string => {
    if (!isoDate) return 'Not set';
    try {
      return parseLocalDate(isoDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  /**
   * Format date range for display
   */
  const formatDateRange = (start: string | undefined, end: string | undefined): string => {
    if (!start || !end) return 'Not set';
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  return (
    <div className="bg-card rounded-xl shadow-sm p-6 mb-6 mt-6">
      <h3 className="text-sm font-semibold text-foreground mb-3">Configuration</h3>

      <div className="space-y-2">
        {/* Start Date */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Start Date:</span>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${startDate ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {formatDate(startDate)}
            </span>
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit('startDate')}
                className="h-7 px-2 text-xs"
              >
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Season Length */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Season Length:</span>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${seasonLength ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {seasonLength ? `${seasonLength} weeks` : 'Not set'}
            </span>
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit('seasonLength')}
                className="h-7 px-2 text-xs"
              >
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* BCA Championship */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">BCA Championship:</span>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${bcaIgnored ? 'text-muted-foreground' : bcaStartDate ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {bcaIgnored ? 'Ignored' : formatDateRange(bcaStartDate, bcaEndDate)}
            </span>
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit('bca')}
                className="h-7 px-2 text-xs"
              >
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* APA Championship */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">APA Championship:</span>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${apaIgnored ? 'text-muted-foreground' : apaStartDate ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {apaIgnored ? 'Ignored' : formatDateRange(apaStartDate, apaEndDate)}
            </span>
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit('apa')}
                className="h-7 px-2 text-xs"
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
