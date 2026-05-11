/**
 * @fileoverview ContactInfoExposure Component
 * Reusable component for setting contact information visibility preferences
 */
import React from 'react';
import { type ContactVisibilityLevel } from '../../schemas/leagueOperatorSchema';
import { VisibilityChoiceCard } from './VisibilityChoiceCard';

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
interface ContactVisibilityOption {
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
const VISIBILITY_OPTIONS: ContactVisibilityOption[] = [
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
 * Get color scheme for a visibility level
 */
const getVisibilityColors = (level: ContactVisibilityLevel) => {
  switch (level) {
    case 'in_app_only':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        accent: 'text-green-600'
      };
    case 'my_team_captains':
    case 'my_teams':
    case 'my_organization':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        accent: 'text-yellow-600'
      };
    case 'anyone':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        accent: 'text-red-600'
      };
    default:
      return {
        bg: 'bg-muted',
        border: 'border-border',
        text: 'text-foreground',
        accent: 'text-muted-foreground'
      };
  }
};

/**
 * Props for ContactInfoExposure component
 */
interface ContactInfoExposureProps {
  /** Type of contact information being configured */
  contactType: 'email' | 'phone' | 'other';

  /** User role - determines which visibility options are available */
  userRole: UserRole;

  /** Current visibility level selection */
  selectedLevel?: ContactVisibilityLevel;

  /** Callback when visibility level changes */
  onLevelChange: (level: ContactVisibilityLevel) => void;

  /** Optional title override */
  title?: string;

  /** Whether this is required to be set */
  required?: boolean;

  /** Additional help text */
  helpText?: string;

  /** Error message to display */
  error?: string;
}

/**
 * ContactInfoExposure Component
 *
 * Provides a clear, single-choice interface for setting contact information
 * visibility preferences. Each option clearly explains what it means and
 * who will have access to the contact information.
 *
 * @param contactType - The type of contact info being configured
 * @param userRole - User role (determines available visibility options)
 * @param selectedLevel - Currently selected visibility level
 * @param onLevelChange - Callback for when selection changes
 * @param title - Optional custom title
 * @param required - Whether selection is required
 * @param helpText - Additional help text
 * @param error - Error message to display
 */
export const ContactInfoExposure: React.FC<ContactInfoExposureProps> = ({
  contactType,
  userRole,
  selectedLevel,
  onLevelChange,
  title,
  required = true,
  helpText,
  error
}) => {
  const defaultTitle = `Who can see your ${contactType}?`;
  const displayTitle = title || defaultTitle;

  // Filter visibility options based on user role
  const availableOptions = VISIBILITY_OPTIONS.filter(option =>
    option.availableForRoles.includes(userRole)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {displayTitle}
          {required && <span className="text-red-500 ml-1">*</span>}
        </h3>
        {helpText && (
          <p className="text-sm text-muted-foreground">{helpText}</p>
        )}
      </div>

      {/* Visibility Options - Using Reusable Choice Cards */}
      <div className="space-y-1">
        {availableOptions.map((option) => (
          <VisibilityChoiceCard
            key={option.value}
            option={option}
            isSelected={selectedLevel === option.value}
            colors={getVisibilityColors(option.value)}
            onSelect={onLevelChange}
            showExplanation={true}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      {/* Additional Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <span className="text-amber-600 text-sm">ℹ️</span>
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">Privacy Note:</p>
            <p>
              You can change this setting anytime. More restrictive settings protect
              your privacy but may make it harder for players to reach you directly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

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