/**
 * @fileoverview Week Card Component
 *
 * Displays a single week with all its matches.
 * Handles different week types (regular, playoffs, blackouts, breaks).
 */

import React from 'react';
import { Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MatchCard } from './MatchCard';
import { parseLocalDate } from '@/utils/formatters';
import { getWeekTypeStyle, getEmptyWeekMessage } from '@/utils/scheduleDisplayUtils';
import type { WeekSchedule } from '@/types/schedule';

interface WeekCardProps {
  weekSchedule: WeekSchedule;
  tableNumbers: Map<string, number>;
}

/**
 * WeekCard Component
 *
 * Displays week header, date, and all matches for that week.
 * Applies styling based on week type (playoffs, blackouts, etc).
 *
 * @param weekSchedule - Week data with matches
 * @param tableNumbers - Map of match IDs to venue-specific table numbers
 */
export const WeekCard: React.FC<WeekCardProps> = ({ weekSchedule, tableNumbers }) => {
  const { week, matches } = weekSchedule;
  const weekStyle = getWeekTypeStyle(week.week_type);

  return (
    <Card>
      <CardHeader className={weekStyle.bgColor}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{week.week_name}</CardTitle>
            {weekStyle.badge && (
              <span className={`text-xs font-semibold px-2 py-1 rounded ${weekStyle.badgeColor}`}>
                {weekStyle.badge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {parseLocalDate(week.scheduled_date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {matches.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            {getEmptyWeekMessage(week.week_type)}
          </p>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                tableNumber={tableNumbers.get(match.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
