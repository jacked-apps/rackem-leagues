/**
 * @fileoverview Threshold Chart Page Layout Component
 *
 * Shared layout wrapper for all threshold chart editor pages. Handles:
 * - Loading state with spinner
 * - Error state with error message
 * - Page structure with header and content area
 *
 * This component reduces duplication across Points, Percentage, and Race
 * chart editor pages by extracting the common page shell.
 *
 * @example
 * ```tsx
 * <ThresholdChartPageLayout
 *   title="Threshold Chart Editor (Team/Points)"
 *   subtitle={season?.season_name}
 *   maxWidth="3xl"
 *   backTo="/league/123/season/456/match-list"
 *   backLabel="Back to Match List"
 *   isLoading={false}
 *   error={null}
 * >
 *   {children}
 * </ThresholdChartPageLayout>
 * ```
 */

import type { ReactNode } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * Props for ThresholdChartPageLayout
 */
export interface ThresholdChartPageLayoutProps {
  /** Page title displayed in the header */
  title: string;

  /** Subtitle displayed below the title (usually season name or description) */
  subtitle: string;

  /** Maximum width of the content area: '3xl' for team charts, '4xl' for race charts */
  maxWidth?: '3xl' | '4xl';

  /** Navigation path for the back button */
  backTo: string;

  /** Label for the back button */
  backLabel: string;

  /** Whether data is currently loading */
  isLoading: boolean;

  /** Error object if data fetch failed (null if no error) */
  error: Error | null;

  /** Page content to render when not loading and no error */
  children: ReactNode;
}

/**
 * Threshold Chart Page Layout
 *
 * Provides consistent page structure for all chart editor pages:
 *
 * 1. **Loading State**: Full-page spinner with "Loading chart from database..."
 * 2. **Error State**: Red error card with the error message
 * 3. **Normal State**: Header + content area with children
 *
 * The layout handles the PageHeader component internally, so pages only
 * need to provide the content (status card, chart type selector, editor).
 */
export function ThresholdChartPageLayout({
  title,
  subtitle,
  maxWidth = '3xl',
  backTo,
  backLabel,
  isLoading,
  error,
  children,
}: ThresholdChartPageLayoutProps) {
  // Determine max-width class based on prop
  const maxWidthClass = maxWidth === '4xl' ? 'max-w-4xl' : 'max-w-3xl';

  // Loading state - show spinner with loading message
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          backTo={backTo}
          backLabel={backLabel}
          title={title}
          subtitle="Loading chart data..."
        />
        <div className={`${maxWidthClass} mx-auto px-4 py-6`}>
          <Card>
            <CardContent className="py-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-3 text-gray-600">Loading chart from database...</span>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state - show error card with message
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          backTo={backTo}
          backLabel={backLabel}
          title={title}
          subtitle="Error loading chart"
        />
        <div className={`${maxWidthClass} mx-auto px-4 py-6`}>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span>Failed to load chart: {error.message}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Normal state - render header and children
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo={backTo}
        backLabel={backLabel}
        title={title}
        subtitle={subtitle}
      />
      <div className={`${maxWidthClass} mx-auto px-4 py-6 space-y-4`}>
        {children}
      </div>
    </div>
  );
}
