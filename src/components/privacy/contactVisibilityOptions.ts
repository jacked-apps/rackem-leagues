/**
 * @fileoverview Contact-visibility options (who can see an operator's contact
 * info) and the label/description lookups used by previews.
 *
 * Kept out of `ContactInfoExposure.tsx` so that file exports only its
 * component (keeps React fast-refresh working).
 */

import type { ContactVisibilityLevel } from '../../schemas/leagueOperatorSchema';

/**
 * User roles that can use the ContactInfoExposure component
 * Different roles may have different visibility options available
 *
 * - 'league_operator': Can control visibility to their teams, captains, organization, and public
 * - 'member': Limited to in-app only or public visibility (future implementation)
 * - 'captain': Can control visibility within their team context (future implementation)
 */
export type UserRole = 'league_operator' | 'member' | 'captain';

/**
 * Contact visibility option configuration
 */
export interface ContactVisibilityOption {
  value: ContactVisibilityLevel;
  label: string;
  description: string;
  icon?: string;
  availableForRoles: UserRole[]; // Which roles can use this visibility option
}

/**
 * Predefined visibility options with clear descriptions
 * Ordered from most private (fewest people) to most public (most people)
 */
export const VISIBILITY_OPTIONS: ContactVisibilityOption[] = [
  {
    value: 'in_app_only',
    label: 'In-App Communication Only',
    description: 'Players contact you through the app messaging system only. Your contact info stays completely private.',
    icon: '🔒',
    availableForRoles: ['league_operator', 'member', 'captain']
  },
  {
    value: 'my_team_captains',
    label: 'My Team Captains Only',
    description: 'Visible only to team captains in your leagues for coordination and communication.',
    icon: '👨‍💼',
    availableForRoles: ['league_operator'] // Only league operators have team captains
  },
  {
    value: 'my_teams',
    label: 'My Current Players',
    description: 'Visible to all current players actively participating in your leagues.',
    icon: '👥',
    availableForRoles: ['league_operator'] // Only league operators have "their" players
  },
  {
    value: 'my_organization',
    label: 'My Organization (All Players)',
    description: 'Visible to any player who has ever played in your leagues (active or inactive members).',
    icon: '🏢',
    availableForRoles: ['league_operator'] // Only league operators have "their" organization
  },
  {
    value: 'anyone',
    label: 'Anyone (Public)',
    description: 'Publicly visible to anyone searching for leagues or viewing your organization.',
    icon: '🌐',
    availableForRoles: ['league_operator', 'member', 'captain']
  }
];

/**
 * Helper function to get human-readable label for a visibility level
 */
export const getVisibilityLabel = (level: ContactVisibilityLevel): string => {
  const option = VISIBILITY_OPTIONS.find(opt => opt.value === level);
  return option?.label || 'Unknown';
};

/**
 * Helper function to get description for a visibility level
 */
export const getVisibilityDescription = (level: ContactVisibilityLevel): string => {
  const option = VISIBILITY_OPTIONS.find(opt => opt.value === level);
  return option?.description || 'Unknown visibility level';
};
