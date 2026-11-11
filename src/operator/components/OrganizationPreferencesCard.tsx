/**
 * @fileoverview Organization Preferences Card Component
 *
 * Thin wrapper around PreferencesCard for organization-level preferences.
 * This exists for backward compatibility with existing imports.
 */

import { PreferencesCard } from './PreferencesCard';

interface OrganizationPreferencesCardProps {
  organizationId: string;
  onUpdate?: () => void;
}

/**
 * Organization Preferences Card
 * Allows operators to set default preferences for all their leagues
 */
export const OrganizationPreferencesCard: React.FC<OrganizationPreferencesCardProps> = ({
  organizationId,
  onUpdate,
}) => {
  return (
    <PreferencesCard
      entityType="organization"
      entityId={organizationId}
      onUpdate={onUpdate}
    />
  );
};
