/**
 * @fileoverview Playoff Settings Card Component
 *
 * Wrapper card that contains the core playoff configuration settings:
 * - Example Team Count (for previewing brackets)
 * - Playoff Weeks (number of playoff rounds)
 * - Participation Settings (who qualifies)
 * - Wildcard Settings (random selection spots)
 *
 * Used on:
 * - Organization Playoff Settings page
 * - League Playoff Settings page
 *
 * This component provides consistent layout and styling for the settings
 * section across both organization and league configuration pages.
 */

import React from 'react';
import { Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExampleTeamCountCard } from '@/operator/components/playoff/ExampleTeamCountCard';
import { PlayoffWeeksCard } from '@/operator/components/playoff/PlayoffWeeksCard';
import { ParticipationSettingsCard } from '@/operator/components/playoff/ParticipationSettingsCard';
import { WildcardSettingsCard } from '@/operator/components/playoff/WildcardSettingsCard';
import type { PlayoffSettingsState, PlayoffSettingsAction } from '@/hooks/playoff/usePlayoffSettingsReducer';

/**
 * Props for PlayoffSettingsCard component
 */
export interface PlayoffSettingsCardProps {
  /** Current playoff settings state from usePlayoffSettingsReducer */
  settings: PlayoffSettingsState;
  /** Dispatch function from usePlayoffSettingsReducer */
  dispatch: React.Dispatch<PlayoffSettingsAction>;
}

/**
 * PlayoffSettingsCard Component
 *
 * Renders a card containing all the core playoff configuration options.
 * Delegates to individual sub-cards for each setting type.
 *
 * @example
 * const [settings, dispatch] = usePlayoffSettingsReducer();
 *
 * <PlayoffSettingsCard
 *   settings={settings}
 *   dispatch={dispatch}
 * />
 */
export const PlayoffSettingsCard: React.FC<PlayoffSettingsCardProps> = ({
  settings,
  dispatch,
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5 text-highlight" />
          Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Example Team Count Card Component */}
        <ExampleTeamCountCard
          settings={settings}
          dispatch={dispatch}
        />

        {/* Playoff Weeks Card Component */}
        <PlayoffWeeksCard
          settings={settings}
          dispatch={dispatch}
        />

        {/* Participation Card Component */}
        <ParticipationSettingsCard
          settings={settings}
          dispatch={dispatch}
        />

        {/* Wildcard Settings Card Component */}
        <WildcardSettingsCard
          settings={settings}
          dispatch={dispatch}
        />
      </CardContent>
    </Card>
  );
};

export default PlayoffSettingsCard;
