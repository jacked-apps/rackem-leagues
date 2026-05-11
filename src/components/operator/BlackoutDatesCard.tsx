/**
 * @fileoverview Blackout Dates Card Component
 *
 * Displays and manages championship blackout dates for an organization.
 * Allows operators to set BCA and APA championship date ranges that
 * should be avoided when scheduling league matches.
 */
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { InfoButton } from '@/components/InfoButton';
import { CalendarX } from 'lucide-react';
import { parseLocalDate } from '@/utils/formatters';
import { useChampionshipPreferences } from '@/hooks/useChampionshipPreferences';
import { useChampionshipDateEditor } from '@/hooks/useChampionshipDateEditor';
import { useChampionshipIgnoreToggle } from '@/hooks/useChampionshipIgnoreToggle';

interface BlackoutDatesCardProps {
  /** Organization ID */
  organizationId: string;
  /** Callback when settings are updated */
  onUpdate?: () => void;
}

/**
 * Blackout Dates Card
 * Manages BCA and APA championship blackout dates
 */
export const BlackoutDatesCard: React.FC<BlackoutDatesCardProps> = ({
  organizationId,
  onUpdate,
}) => {
  // Championship preferences hook
  const {
    bcaPreference,
    apaPreference,
    refetchPreferences,
  } = useChampionshipPreferences(organizationId);

  // Async success handler for hooks that expect Promise<void>
  const handleSuccess = async () => {
    await refetchPreferences();
    onUpdate?.();
  };

  // Championship date editor hooks
  const bcaEditor = useChampionshipDateEditor('BCA', bcaPreference, organizationId, handleSuccess);
  const apaEditor = useChampionshipDateEditor('APA', apaPreference, organizationId, handleSuccess);

  // Championship ignore toggles
  const bcaIgnoreToggle = useChampionshipIgnoreToggle(
    bcaPreference?.preference?.id,
    bcaPreference?.preference?.preference_action,
    handleSuccess
  );

  const apaIgnoreToggle = useChampionshipIgnoreToggle(
    apaPreference?.preference?.id,
    apaPreference?.preference?.preference_action,
    handleSuccess
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CalendarX className="h-6 w-6 text-red-600" />
          <CardTitle>Blackout Dates</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* BCA Preference */}
        <div className="border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground font-medium">BCA Championship</span>
            {!bcaEditor.isEditing ? (
              <button
                onClick={bcaEditor.startEditing}
                className="text-xs px-2 py-1 border border-border rounded hover:bg-muted"
              >
                {bcaPreference?.championship ? 'Edit' : 'Add'}
              </button>
            ) : (
              <div className="flex gap-2">
                <Button
                  loadingText="Saving..."
                  isLoading={bcaEditor.isSaving}
                  onClick={bcaEditor.saveDates}
                  size="sm"
                  className="text-xs h-7"
                  disabled={bcaEditor.isSaving}
                >
                  Save
                </Button>
                <Button
                  onClick={bcaEditor.cancelEditing}
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
          {bcaEditor.isEditing ? (
            <div className="space-y-2 mb-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Start Date</label>
                  <Calendar
                    value={bcaEditor.startDate}
                    onChange={bcaEditor.setStartDate}
                    placeholder="Select start date"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">End Date</label>
                  <Calendar
                    value={bcaEditor.endDate}
                    onChange={bcaEditor.setEndDate}
                    placeholder="Select end date"
                  />
                </div>
              </div>
            </div>
          ) : bcaPreference && bcaPreference.championship ? (
            <>
              <div className="text-sm text-foreground mb-2">
                {parseLocalDate(bcaPreference.championship.start_date).toLocaleDateString()} - {parseLocalDate(bcaPreference.championship.end_date).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={bcaPreference.preference?.preference_action === 'ignore'}
                    onChange={bcaIgnoreToggle.toggleIgnore}
                    disabled={bcaIgnoreToggle.isToggling}
                    className="rounded"
                  />
                  Ignore these dates
                </label>
                <InfoButton title="Championship Dates">
                  National tournament dates are normally flagged as potential schedule conflicts since many players travel to play or attend. If you don't expect enough of your players to be affected to justify rescheduling, these dates can safely be ignored.
                </InfoButton>
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground italic">Not set</span>
          )}
        </div>

        {/* APA Preference */}
        <div className="border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground font-medium">APA Championship</span>
            {!apaEditor.isEditing ? (
              <button
                onClick={apaEditor.startEditing}
                className="text-xs px-2 py-1 border border-border rounded hover:bg-muted"
              >
                {apaPreference?.championship ? 'Edit' : 'Add'}
              </button>
            ) : (
              <div className="flex gap-2">
                <Button
                  loadingText="Saving..."
                  isLoading={apaEditor.isSaving}
                  onClick={apaEditor.saveDates}
                  size="sm"
                  className="text-xs h-7"
                  disabled={apaEditor.isSaving}
                >
                  Save
                </Button>
                <Button
                  onClick={apaEditor.cancelEditing}
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
          {apaEditor.isEditing ? (
            <div className="space-y-2 mb-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Start Date</label>
                  <Calendar
                    value={apaEditor.startDate}
                    onChange={apaEditor.setStartDate}
                    placeholder="Select start date"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">End Date</label>
                  <Calendar
                    value={apaEditor.endDate}
                    onChange={apaEditor.setEndDate}
                    placeholder="Select end date"
                  />
                </div>
              </div>
            </div>
          ) : apaPreference && apaPreference.championship ? (
            <>
              <div className="text-sm text-foreground mb-2">
                {parseLocalDate(apaPreference.championship.start_date).toLocaleDateString()} - {parseLocalDate(apaPreference.championship.end_date).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={apaPreference.preference?.preference_action === 'ignore'}
                    onChange={apaIgnoreToggle.toggleIgnore}
                    disabled={apaIgnoreToggle.isToggling}
                    className="rounded"
                  />
                  Ignore these dates
                </label>
                <InfoButton title="Championship Dates">
                  National tournament dates are normally flagged as potential schedule conflicts since many players travel to play or attend. If you don't expect enough of your players to be affected to justify rescheduling, these dates can safely be ignored.
                </InfoButton>
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground italic">Not set</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
