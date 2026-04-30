/**
 * @fileoverview Playoff Match Rules Card Component
 *
 * Displays the standard rules that apply to all playoff matches:
 * - No Team Handicap Bonus
 * - Points Don't Count (only win/loss matters)
 * - Early Termination (match ends at win threshold)
 *
 * These rules are informational and not configurable - they apply
 * to all playoff matches across all organizations and leagues.
 *
 * The card is collapsible to save space - starts collapsed by default
 * and can be expanded by clicking the header.
 *
 * Used on:
 * - Organization Playoff Settings page
 * - League Playoff Settings page (future)
 * - Season Playoff page (future)
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Props for PlayoffMatchRulesCard component
 */
export interface PlayoffMatchRulesCardProps {
  /** Whether the card starts expanded (default: false) */
  defaultExpanded?: boolean;
}

/**
 * PlayoffMatchRulesCard Component
 *
 * Displays the three standard playoff match rules in a collapsible card format.
 * Each rule is shown with a purple bullet point, bold title, and description.
 *
 * @example
 * <PlayoffMatchRulesCard />
 *
 * @example
 * // Start expanded
 * <PlayoffMatchRulesCard defaultExpanded />
 */
export const PlayoffMatchRulesCard: React.FC<PlayoffMatchRulesCardProps> = ({
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Playoff Match Rules</CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-2 h-2 rounded-full bg-purple-600" />
            <div className="text-sm">
              <span className="font-medium">No Team Handicap Bonus</span>
              <span className="text-muted-foreground ml-2">— Team standing modifiers do not apply</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-2 h-2 rounded-full bg-purple-600" />
            <div className="text-sm">
              <span className="font-medium">Points Don&apos;t Count</span>
              <span className="text-muted-foreground ml-2">— Only win/loss matters for advancement</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-2 h-2 rounded-full bg-purple-600" />
            <div className="text-sm">
              <span className="font-medium">Early Termination</span>
              <span className="text-muted-foreground ml-2">— Match ends when win threshold is reached</span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default PlayoffMatchRulesCard;
