/**
 * @fileoverview SeasonIntroStep — explains what's about to happen
 *
 * Shows different messaging for first season vs subsequent seasons.
 * For the first season, displays the inherited start date from the league.
 * Reads context from the wizard's form data (injected by the config).
 */

import { useEffect } from 'react';
import { toast } from 'sonner';
import { getDayOfWeekName } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import type { WizardStepProps } from '@/components/wizard';
import type { SeasonWizardFormData } from '../seasonWizardTypes';

interface IntroValue {
  leagueStartDate: string;
  hasExistingSeasons: boolean;
}

export function SeasonIntroStep({
  value,
  onChange,
  formData,
}: WizardStepProps<IntroValue | undefined, SeasonWizardFormData>) {
  // Flow context is injected into formData._flowContext by WizardFlowStageRenderer
  const flowContext = (formData as Record<string, unknown>)._flowContext as
    { leagueStartDate?: string } | undefined;

  const isFirst = !value?.hasExistingSeasons;
  const startDate = value?.leagueStartDate ?? flowContext?.leagueStartDate;

  // Save the intro context to formData on mount so the summary can read it
  useEffect(() => {
    if (!value && startDate) {
      onChange({ leagueStartDate: startDate, hasExistingSeasons: false });
    }
  }, [startDate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4 max-w-lg">
      {isFirst ? (
        <FirstSeasonIntro startDate={startDate} />
      ) : (
        <NextSeasonIntro />
      )}
    </div>
  );
}

function FirstSeasonIntro({
  startDate,
}: {
  startDate: string | undefined;
}) {
  // TODO: Implement "start over" — needs confirmation dialog + league delete mutation.
  // See TODO-season-preferences-editor.md and the team cascade delete warnings.
  const handleStartOver = () => {
    toast.info('Coming soon — for now, delete the league from the dashboard and start fresh.');
  };

  return (
    <>
      <h3 className="text-xl font-bold text-gray-900">Create Your First Season</h3>
      <p className="text-gray-700">
        Here you&rsquo;ll set up the details for your first season
        — how many weeks of regular play and how playoffs are structured.
      </p>
      <p className="text-gray-700">
        These choices will become your defaults for future seasons.
        They can be changed season to season, so don&rsquo;t worry
        about getting it perfect the first time.
      </p>
      {startDate && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-gray-800">
            Your start date:{' '}
            <strong>{getDayOfWeekName(startDate)}, {formatDate(startDate)}</strong>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            This will be the first day of this season. If this date is
            incorrect, you&rsquo;ll need to start over with a new league.
          </p>
          <Button
            variant="ghost"
            onClick={handleStartOver}
            className="mt-2 text-sm text-red-600 hover:text-red-800 p-0 h-auto"
          >
            Start over with a different date
          </Button>
        </div>
      )}
      <p className="text-sm text-gray-500">
        Click Next to set the season length and playoff format.
      </p>
    </>
  );
}

function NextSeasonIntro() {
  return (
    <>
      <h3 className="text-xl font-bold text-gray-900">Create Your Next Season</h3>
      <p className="text-gray-700">
        Starting a new season. You&rsquo;ll pick a start date and
        confirm the season length and playoff format.
      </p>
      <p className="text-gray-700">
        Your previous season&rsquo;s settings are used as defaults.
        Adjust anything that needs to change, or just confirm and
        move on.
      </p>
      <p className="text-sm text-gray-500">
        Click Next to get started.
      </p>
    </>
  );
}

/** Format ISO date for display: "April 14, 2026" */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
