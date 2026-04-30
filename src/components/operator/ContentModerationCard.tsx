/**
 * @fileoverview Content Moderation Card Component
 *
 * Displays and manages profanity filter settings for an organization.
 * Allows operators to enable/disable content filtering for team names
 * and other public content.
 */
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { useOperatorProfanityToggle } from '@/hooks/useOperatorProfanityToggle';
import type { Organization } from '@/api/queries/organizations';

interface ContentModerationCardProps {
  /** Organization data */
  organization: Organization;
  /** Callback when settings are updated */
  onUpdate?: () => void;
}

/**
 * Content Moderation Card
 * Manages profanity filter settings for organization content
 */
export const ContentModerationCard: React.FC<ContentModerationCardProps> = ({
  organization,
  onUpdate,
}) => {
  const [profanityFilterEnabled, setProfanityFilterEnabled] = useState(false);

  // Sync state when organization loads
  useEffect(() => {
    if (organization) {
      setProfanityFilterEnabled(organization.profanity_filter_enabled || false);
    }
  }, [organization]);

  // Profanity filter toggle hook
  const { toggleFilter, isSaving, success } = useOperatorProfanityToggle(
    organization?.id || null,
    profanityFilterEnabled,
    setProfanityFilterEnabled
  );

  const handleToggle = async () => {
    await toggleFilter();
    onUpdate?.();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-purple-600" />
          <CardTitle>Content Moderation</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700 font-medium">
              Profanity filter settings updated successfully!
            </p>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Control profanity validation for your organization. When enabled, team names and other public content containing inappropriate language will be rejected.
        </p>

        <div className="p-4 bg-muted rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium text-foreground">Profanity Filter</p>
              <p className="text-sm text-muted-foreground mt-1">
                {profanityFilterEnabled
                  ? 'Team names may not contain profanity'
                  : 'Team names may contain profanity'}
              </p>
              <div className="mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  profanityFilterEnabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-muted text-foreground'
                }`}>
                  {profanityFilterEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
            <Button
              onClick={handleToggle}
              disabled={isSaving}
              variant={profanityFilterEnabled ? 'destructive' : 'default'}
              size="sm"
              className="ml-4"
              loadingText="Saving..."
            >
              {isSaving ? 'Saving...' : profanityFilterEnabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </div>

        {profanityFilterEnabled && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> This setting validates team names and organization-wide content only. Individual messages are filtered based on each user's personal preferences.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
