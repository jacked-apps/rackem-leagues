/**
 * @fileoverview Percentage Threshold Chart Editor Page
 *
 * Full-page editor for percentage-based threshold charts.
 * Accessed from the Match Data Page or League Settings.
 *
 * Route: /league/:leagueId/threshold-chart/percentage
 *
 * This page allows league operators to:
 * - View the current percentage threshold chart
 * - Add/edit/remove range rows
 * - Reset to default BCA chart
 * - Save custom chart configuration
 *
 * Key differences from Points chart:
 * - Uses handicap difference RANGES (0-14, 15-40, etc.)
 * - Higher/Lower team values instead of Win/Tie/Lose
 * - No ties (25 games = odd number)
 *
 * The SetupOptions component at the top shows the current configuration
 * and allows adjustments that affect the chart (lineup size, handicap type, etc.)
 */

import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import {
  PercentageThresholdChartEditor,
  getDefaultPercentageChartRows,
  type PercentageChartRow,
  type ChartType,
} from '@/components/operator/threshold-editor';
import {
  SetupOptions,
  getDefaultSetupOptions,
  type SetupOptionsConfig,
} from '@/components/operator/match-editor';

/**
 * Percentage Threshold Chart Editor Page
 *
 * Dedicated page for editing the percentage-based threshold chart.
 * Supports navigation back to the originating page.
 */
export default function PercentageThresholdChartPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get params from query string (for navigation back and lineup size)
  const returnTo = searchParams.get('returnTo');
  const lineupSizeParam = searchParams.get('lineupSize');
  const lineupSize = lineupSizeParam ? parseInt(lineupSizeParam, 10) : 5;

  // Setup options state - starts with defaults for percentage (5v5 single round robin)
  const [setupConfig, setSetupConfig] = useState<SetupOptionsConfig>(() => ({
    ...getDefaultSetupOptions('percentage'),
    lineupSize: lineupSize,
  }));

  // State for save operation
  const [isSaving, setIsSaving] = useState(false);

  // TODO: Load saved chart data from database
  // For now, use default or localStorage for testing
  const [savedChartData] = useState<PercentageChartRow[] | null>(() => {
    // Try to load from localStorage for testing
    const saved = localStorage.getItem(`threshold-chart-percentage-${leagueId}`);
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
  const handleSave = async (data: PercentageChartRow[]) => {
    setIsSaving(true);
    try {
      // TODO: Save to database via mutation
      // For now, save to localStorage for testing
      await new Promise((resolve) => setTimeout(resolve, 500));
      localStorage.setItem(
        `threshold-chart-percentage-${leagueId}`,
        JSON.stringify(data)
      );

      if (import.meta.env.DEV) {
        console.log('Saved percentage threshold chart:', data);
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

  /**
   * Handle chart type change - navigate to different chart editor
   * Preserves returnTo and lineupSize params
   */
  const handleChartTypeChange = (type: ChartType) => {
    if (!leagueId) return;
    const params = new URLSearchParams();
    if (returnTo) params.set('returnTo', returnTo);
    if (lineupSize) params.set('lineupSize', lineupSize.toString());
    const queryString = params.toString();
    navigate(`/league/${leagueId}/threshold-chart/${type}${queryString ? `?${queryString}` : ''}`);
  };

  // Determine back navigation
  const backTo = returnTo || (leagueId ? `/league/${leagueId}` : '/');
  const backLabel = returnTo?.includes('match') ? 'Back to Match' : 'Back to League';

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo={backTo}
        backLabel={backLabel}
        title="Percentage Threshold Chart"
        subtitle="Configure games-to-win thresholds based on handicap difference ranges"
      />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Setup Options - context for chart editing */}
        <SetupOptions
          config={setupConfig}
          onChange={setSetupConfig}
          hasSavedOptions={true}
          readOnly={false}
          defaultExpanded={false}
        />

        <PercentageThresholdChartEditor
          initialData={savedChartData ?? getDefaultPercentageChartRows()}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={isSaving}
          onChartTypeChange={handleChartTypeChange}
          initialLineupSize={setupConfig.lineupSize}
        />
      </div>
    </div>
  );
}
