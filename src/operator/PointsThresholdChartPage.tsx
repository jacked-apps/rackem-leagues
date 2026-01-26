/**
 * @fileoverview Points Threshold Chart Editor Page
 *
 * Full-page editor for points-based threshold charts.
 * Accessed from the Match Data Page or League Settings.
 *
 * Route: /league/:leagueId/threshold-chart/points
 *
 * This page allows league operators to:
 * - View the current points threshold chart
 * - Add/edit/remove rows
 * - Reset to default BCA chart
 * - Save custom chart configuration
 *
 * The SetupOptions component at the top shows the current configuration
 * and allows adjustments that affect the chart (lineup size, handicap type, etc.)
 */

import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import {
  PointsThresholdChartEditor,
  getDefaultPointsChartRows,
  type PointsChartRow,
} from '@/components/operator/threshold-editor';
import {
  SetupOptions,
  getDefaultSetupOptions,
  type SetupOptionsConfig,
} from '@/components/operator/match-editor';

/**
 * Points Threshold Chart Editor Page
 *
 * Dedicated page for editing the points-based threshold chart.
 * Supports navigation back to the originating page.
 */
export default function PointsThresholdChartPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get params from query string (for navigation back and lineup size)
  const returnTo = searchParams.get('returnTo');
  const lineupSizeParam = searchParams.get('lineupSize');
  const lineupSize = lineupSizeParam ? parseInt(lineupSizeParam, 10) : 3;

  // Setup options state - starts with defaults for points (3v3 double round robin)
  const [setupConfig, setSetupConfig] = useState<SetupOptionsConfig>(() => ({
    ...getDefaultSetupOptions('points'),
    lineupSize: lineupSize,
  }));

  // State for save operation
  const [isSaving, setIsSaving] = useState(false);

  // TODO: Load saved chart data from database
  // For now, use default or localStorage for testing
  const [savedChartData] = useState<PointsChartRow[] | null>(() => {
    // Try to load from localStorage for testing
    const saved = localStorage.getItem(`threshold-chart-points-${leagueId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  /**
   * Handle save - mock implementation for now
   */
  const handleSave = async (data: PointsChartRow[]) => {
    setIsSaving(true);
    try {
      // TODO: Save to database via mutation
      // For now, save to localStorage for testing
      await new Promise((resolve) => setTimeout(resolve, 500));
      localStorage.setItem(`threshold-chart-points-${leagueId}`, JSON.stringify(data));

      if (import.meta.env.DEV) {
        console.log('Saved points threshold chart:', data);
      }
    } catch (error) {
      console.error('Failed to save threshold chart:', error);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle cancel/back navigation
   */
  const handleCancel = () => {
    if (returnTo) {
      navigate(returnTo);
    } else if (leagueId) {
      // Default to league detail page
      navigate(`/league/${leagueId}`);
    } else {
      navigate(-1);
    }
  };

  // Determine back navigation
  const backTo = returnTo || (leagueId ? `/league/${leagueId}` : '/');
  const backLabel = returnTo?.includes('match') ? 'Back to Match' : 'Back to League';

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo={backTo}
        backLabel={backLabel}
        title="Points Threshold Chart"
        subtitle="Configure games-to-win thresholds based on handicap difference"
      />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Setup Options - read-only context for chart editing */}
        <SetupOptions
          config={setupConfig}
          onChange={setSetupConfig}
          hasSavedOptions={true}
          readOnly={false}
          defaultExpanded={false}
        />

        <PointsThresholdChartEditor
          initialData={savedChartData ?? getDefaultPointsChartRows()}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={isSaving}
          initialLineupSize={setupConfig.lineupSize}
        />
      </div>
    </div>
  );
}
