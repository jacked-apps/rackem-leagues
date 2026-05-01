/**
 * @fileoverview Schedule Loading State Component
 *
 * Reusable loading state for schedule pages.
 * Follows DRY principle - single loading component used across schedule views.
 */

import React from 'react';

/**
 * ScheduleLoadingState Component
 *
 * Displays loading indicator with consistent styling.
 * Reusable across all schedule-related pages.
 */
export const ScheduleLoadingState: React.FC = () => {
  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center text-muted-foreground">Loading schedule...</div>
      </div>
    </div>
  );
};
