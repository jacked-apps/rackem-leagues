/**
 * @fileoverview Empty Schedule State Component
 *
 * Reusable empty state for when no schedule exists yet.
 * Follows DRY principle - single empty state component.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyScheduleStateProps {
  onGenerateSchedule: () => void;
}

/**
 * EmptyScheduleState Component
 *
 * Displays empty state with prompt to generate schedule.
 * Reusable component with friendly messaging.
 *
 * @param onGenerateSchedule - Callback to navigate to schedule generation
 */
export const EmptyScheduleState: React.FC<EmptyScheduleStateProps> = ({ onGenerateSchedule }) => {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <div className="text-6xl mb-4">📅</div>
        <h3 className="text-lg font-medium text-foreground mb-2">No Schedule Yet</h3>
        <p className="text-muted-foreground mb-6">Generate your season schedule to see all matchups</p>
        <Button onClick={onGenerateSchedule} loadingText="none">Generate Schedule</Button>
      </CardContent>
    </Card>
  );
};
