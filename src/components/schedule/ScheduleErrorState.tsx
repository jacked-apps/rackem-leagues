/**
 * @fileoverview Schedule Error State Component
 *
 * Reusable error state for schedule pages.
 * Follows DRY principle - single error component used across schedule views.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ScheduleErrorStateProps {
  error: string;
  onBack: () => void;
}

/**
 * ScheduleErrorState Component
 *
 * Displays error message with consistent styling and back button.
 * Reusable across all schedule-related pages.
 *
 * @param error - Error message to display
 * @param onBack - Callback function for back button
 */
export const ScheduleErrorState: React.FC<ScheduleErrorStateProps> = ({ error, onBack }) => {
  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>
            <p className="text-foreground mb-4">{error}</p>
            <Button onClick={onBack} loadingText="none">Back to League</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
