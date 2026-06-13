/**
 * @fileoverview ConflictBadge Component
 *
 * Small visual indicator for schedule conflicts (holidays or championships)
 * Color-coded by severity: Red (critical), Orange (high), Yellow (medium), Blue (low)
 */
import React from 'react';
import type { ConflictBadgeProps } from '@/types/scheduleReview';

/**
 * ConflictBadge Component
 *
 * Displays a single conflict as a colored badge based on severity
 * - Critical (red): Same day or travel week
 * - High (orange): 1 day away
 * - Medium (yellow): 2-3 days away
 * - Low (blue): 4-7 days away
 */
export const ConflictBadge: React.FC<ConflictBadgeProps> = ({ conflict }) => {
  // Determine colors based on severity
  const severityStyles = {
    critical: 'bg-destructive/10 text-destructive border-destructive/40',
    high: 'bg-warning/10 text-warning border-warning/40',
    medium: 'bg-warning/10 text-warning border-warning/40',
    low: 'bg-info/10 text-info border-info/40',
  };

  const severityEmoji = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
  };

  const colorClass = severityStyles[conflict.severity];
  const emoji = conflict.type === 'championship' ? '🏆' : severityEmoji[conflict.severity];

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${colorClass}`}
      title={conflict.reason}
    >
      <span className="hidden lg:block">{emoji}</span>
      <span>{conflict.name}</span>
    </div>
  );
};
