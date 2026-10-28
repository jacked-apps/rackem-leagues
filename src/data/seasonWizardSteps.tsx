/**
 * @fileoverview Season Creation Wizard Step Definitions
 *
 * Steps for creating a new season:
 * 1. Start Date (auto-set for first season, manual for subsequent)
 * 2. Season Length (weeks)
 * 3. BCA Championship Dates
 * 4. APA Championship Dates
 */
import { getDayOfWeekName } from '@/utils/formatters';
import { seasonLengthInfo } from '@/constants/infoContent/seasonWizardInfoContent';
import { fetchBCAChampionshipURL, fetchAPAChampionshipURL, type ChampionshipDateOption } from '@/utils/tournamentUtils';

/**
 * Season form data interface
 */
export interface SeasonFormData {
  startDate: string;           // ISO date string
  seasonLength: string;        // Number as string for form handling
  isCustomLength: boolean;     // Whether custom length option was selected
  bcaChoice: string;           // Choice ID: 'ignore', 'custom', or database option ID
  bcaStartDate: string;        // ISO date string
  bcaEndDate: string;          // ISO date string
  bcaIgnored: boolean;         // Whether to ignore BCA dates
  apaChoice: string;           // Choice ID: 'ignore', 'custom', or database option ID
  apaStartDate: string;        // ISO date string
  apaEndDate: string;          // ISO date string
  apaIgnored: boolean;         // Whether to ignore APA dates
}

/**
 * Wizard step definition interface
 */
export interface SeasonWizardStep {
  id: string; // Allow any string for step IDs
  title: string;
  subtitle?: string | React.ReactElement;
  type: 'date' | 'choice' | 'dual-date' | 'input' | 'review' | 'schedule-review';
  placeholder?: string;
  inputType?: string;
  min?: number;
  max?: number;
  choices?: Array<{
    value: string;
    label: string;
    subtitle?: string;
  }>;
  validator?: (value: string) => { isValid: boolean; error?: string };
  getValue: () => string;
  setValue: (value: string) => void;
  infoTitle?: string;
  infoContent?: string | React.ReactElement | null;
  infoLabel?: string;
}

/**
 * Championship preference from database
 */
export interface ChampionshipPreference {
  organization: 'BCA' | 'APA';
  startDate: string;
  endDate: string;
  ignored: boolean;
}

/**
 * Get season wizard steps with localStorage integration
 */
export function getSeasonWizardSteps(
  leagueId: string,
  hasExistingSeasons: boolean,
  defaultStartDate?: string,
  _leagueDayOfWeek?: string,
  onDayOfWeekChange?: (newDay: string, newDate: string) => void,
  bcaDateOptions?: ChampionshipDateOption[],
  apaDateOptions?: ChampionshipDateOption[],
  _savedChampionshipPreferences?: ChampionshipPreference[]
): SeasonWizardStep[] {
  const STORAGE_KEY = `season-creation-${leagueId}`;

  // Initialize form data from localStorage or defaults
  const getStoredData = (): SeasonFormData => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsedData = JSON.parse(stored);

      // IMPORTANT: If we have a defaultStartDate but localStorage has blank startDate,
      // update it with the default. This handles the case where the component rendered
      // before league data loaded, so localStorage was initialized with empty string.
      if (defaultStartDate && !parsedData.startDate && !hasExistingSeasons) {
        parsedData.startDate = defaultStartDate;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedData));
      }

      return parsedData;
    }

    // Create default data
    const defaultData = {
      startDate: defaultStartDate || '',
      seasonLength: '16',
      isCustomLength: false,
      bcaChoice: '',
      bcaStartDate: '',
      bcaEndDate: '',
      bcaIgnored: false,
      apaChoice: '',
      apaStartDate: '',
      apaEndDate: '',
      apaIgnored: false,
    };

    // Save defaults to localStorage immediately so they're available for auto-advance logic
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));

    return defaultData;
  };

  const formData = getStoredData();

  // The championship steps build keys from the org name (e.g. `bcaChoice`), so
  // TypeScript sees a computed string key; callers cast back to the real shape.
  const saveData = (updates: Partial<SeasonFormData>) => {
    const newData = { ...formData, ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    Object.assign(formData, newData);
  };

  /**
   * Helper function to generate championship date selection steps
   * Creates two steps: choice selection and custom date entry
   */
  const createChampionshipSteps = (
    organization: 'BCA' | 'APA',
    dateOptions: ChampionshipDateOption[] | undefined,
    websiteURL: string
  ): SeasonWizardStep[] => {
    const orgLower = organization.toLowerCase();
    const choiceField = `${orgLower}Choice` as keyof SeasonFormData;
    const startField = `${orgLower}StartDate` as keyof SeasonFormData;
    const endField = `${orgLower}EndDate` as keyof SeasonFormData;
    const ignoredField = `${orgLower}Ignored` as keyof SeasonFormData;

    return [
      // Choice step
      {
        id: choiceField,
        title: `${organization} National Tournament Scheduling`,
        subtitle: (dateOptions && dateOptions.length > 0) ? (
          <>
            To avoid conflicts with major tournaments your players may want to attend, please select how to handle {organization} Nationals dates.
            <br />
            Please verify championship dates at the{' '}
            <a
              href={websiteURL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {organization} Website
            </a>
            .
          </>
        ) : (
          <>
            <strong>Help us build the community database!</strong>
            <br />
            No championship dates have been submitted yet. Please verify the dates at the{' '}
            <a
              href={websiteURL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {organization} Website
            </a>
            {' '}and enter them below. Your submission helps other operators avoid scheduling conflicts.
          </>
        ),
        type: 'choice' as const,
        choices: [
          // Dynamic choices from database (only if they exist)
          ...(dateOptions || []).map(option => ({
            value: option.id,
            label: `${option.start_date} to ${option.end_date}`,
            subtitle: option.dev_verified
              ? '✓ Verified dates'
              : `${option.vote_count} operator${option.vote_count > 1 ? 's' : ''} confirmed`,
          })),
          // Always include ignore and custom options
          {
            value: 'ignore',
            label: 'Skip - I don\'t need to avoid this tournament',
            subtitle: 'I don\'t expect my players to attend this tournament',
          },
          {
            value: 'custom',
            label: dateOptions && dateOptions.length > 0
              ? 'Enter my own tournament dates'
              : 'Enter verified championship dates',
            subtitle: dateOptions && dateOptions.length > 0
              ? `I have different/updated ${organization} tournament dates`
              : 'Help us by verifying and submitting the official dates',
          },
        ],
        getValue: () => (formData[choiceField] as string) || '',
        setValue: (value: string) => {
          saveData({ [choiceField]: value } as Partial<SeasonFormData>);

          // Handle different choice types
          if (value === 'ignore') {
            saveData({
              [ignoredField]: true,
              [startField]: '',
              [endField]: ''
            } as Partial<SeasonFormData>);
          } else if (value === 'custom') {
            // User will enter dates in next step
            saveData({ [ignoredField]: false } as Partial<SeasonFormData>);
          } else {
            // User selected a found date option
            const selectedOption = dateOptions?.find(opt => opt.id === value);
            if (selectedOption) {
              saveData({
                [ignoredField]: false,
                [startField]: selectedOption.start_date,
                [endField]: selectedOption.end_date
              } as Partial<SeasonFormData>);
            }
          }
        },
        infoTitle: 'Why Schedule Around Major Tournaments?',
        infoContent: (
          <div className="space-y-4">
            <p><strong>Many players want to compete in BCA and APA Championships.</strong> These tournaments represent the highest level of pool competition.</p>

            <div>
              <p><strong>Scheduling during tournaments causes problems:</strong></p>
              <ul className="list-disc ml-4 mt-2">
                <li>Teams lose key players who travel to compete</li>
                <li>Unnecessary forfeits when rosters are short</li>
                <li>Complicated makeup matches later in the season</li>
              </ul>
            </div>

            <p><strong>If any of your players might attend these championships, schedule around them.</strong> This supports player growth and keeps your league running smoothly.</p>
          </div>
        ),
        infoLabel: 'Why is this important',
      },

      // Custom date entry step
      {
        id: `${orgLower}CustomDates`,
        title: `${organization} National Championship Dates`,
        subtitle: (
          <>
            Enter the start and end dates for {organization} National Championships.
            <br />
            Verify championship dates at the{' '}
            <a
              href={websiteURL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {organization} Website
            </a>
            .
          </>
        ),
        type: 'dual-date' as const,
        getValue: () => `${(formData[startField] as string) || ''}|${(formData[endField] as string) || ''}`,
        setValue: (value: string) => {
          const [startDate, endDate] = value.split('|');
          saveData({
            [startField]: startDate || '',
            [endField]: endDate || ''
          } as Partial<SeasonFormData>);
        },
        infoTitle: 'Why Schedule Around Major Tournaments?',
        infoContent: (
          <div className="space-y-4">
            <p><strong>Many players want to compete in BCA and APA Championships.</strong> These tournaments represent the highest level of pool competition.</p>

            <div>
              <p><strong>Scheduling during tournaments causes problems:</strong></p>
              <ul className="list-disc ml-4 mt-2">
                <li>Teams lose key players who travel to compete</li>
                <li>Unnecessary forfeits when rosters are short</li>
                <li>Complicated makeup matches later in the season</li>
              </ul>
            </div>

            <p><strong>If any of your players might attend these championships, schedule around them.</strong> This supports player growth and keeps your league running smoothly.</p>
          </div>
        ),
        infoLabel: 'Why is this important',
      },
    ];
  };

  const allSteps: SeasonWizardStep[] = [
    // Step 1: Start Date
    {
      id: 'startDate',
      title: hasExistingSeasons
        ? 'When does the new season start?'
        : 'Confirm season start date',
      subtitle: hasExistingSeasons
        ? 'Select the first league night of the new season'
        : 'This is what you chose as the first night of league play',
      type: 'date',
      getValue: () => formData.startDate,
      setValue: (value: string) => {
        // If first season and date changes, check if we need to warn
        if (!hasExistingSeasons && defaultStartDate && onDayOfWeekChange && value !== defaultStartDate) {
          // Use timezone-safe day calculation
          const newDayOfWeek = getDayOfWeekName(value);

          // Only trigger callback if date is different from default
          onDayOfWeekChange(newDayOfWeek, value);
          // Don't save yet - wait for user confirmation
          return;
        }
        saveData({ startDate: value });
      },
      infoTitle: 'Season Start Date',
      infoContent:
        'This is the date of your first league night. The schedule will be generated starting from this date based on the season length you choose.',
    },

    // Step 2: Season Length (common choices)
    {
      id: 'seasonLength',
      title: 'How many weeks will this season run?',
      subtitle: 'Choose a common length or select custom for 10-52 weeks',
      type: 'choice',
      choices: [
        { value: '10', label: '10 weeks', subtitle: 'Short season' },
        { value: '12', label: '12 weeks', subtitle: 'Compact season' },
        { value: '14', label: '14 weeks', subtitle: 'Popular choice' },
        { value: '16', label: '16 weeks', subtitle: 'Most common ⭐' },
        { value: '18', label: '18 weeks', subtitle: 'Extended season' },
        { value: '20', label: '20 weeks', subtitle: 'Long season' },
        { value: 'custom', label: 'Custom length', subtitle: '10-52 weeks' },
      ],
      getValue: () => {
        // If custom was selected, show 'custom' as selected
        if (formData.isCustomLength) {
          return 'custom';
        }
        // Otherwise return the actual length value or default to '16'
        return formData.seasonLength || '16';
      },
      setValue: (value: string) => {
        if (value === 'custom') {
          // Save that custom was selected, keep previous seasonLength as default
          saveData({ isCustomLength: true });
        } else {
          // Save the standard length and clear custom flag
          saveData({ seasonLength: value, isCustomLength: false });
        }
      },
      infoTitle: seasonLengthInfo.title,
      infoLabel: seasonLengthInfo.label,
      infoContent: seasonLengthInfo.content,
    },

    // Step 2b: Custom Season Length (only shown when custom is selected)
    {
      id: 'customSeasonLength',
      title: 'Enter custom season length',
      subtitle: 'Choose between 10-52 weeks for your season',
      type: 'input',
      inputType: 'number',
      min: 10,
      max: 52,
      getValue: () => formData.seasonLength || '',
      setValue: (value: string) => saveData({ seasonLength: value }),
      validator: (value: string) => {
        if (!value || value.trim() === '') return { isValid: false, error: 'Season length is required' };
        const weeks = parseInt(value);
        if (isNaN(weeks)) return { isValid: false, error: 'Please enter a valid number' };
        if (weeks < 10) return { isValid: false, error: 'Minimum season length is 10 weeks' };
        if (weeks > 52) return { isValid: false, error: 'Maximum season length is 52 weeks' };
        return { isValid: true };
      },
      infoTitle: seasonLengthInfo.title,
      infoLabel: seasonLengthInfo.label,
      infoContent: seasonLengthInfo.content,
    },

    // Step 3 & 3b: BCA Championship Date Selection (choice + custom dates)
    ...createChampionshipSteps('BCA', bcaDateOptions, fetchBCAChampionshipURL()),

    // Step 4 & 4b: APA Championship Date Selection (choice + custom dates)
    ...createChampionshipSteps('APA', apaDateOptions, fetchAPAChampionshipURL()),

    // Step 5: Schedule Review
    {
      id: 'scheduleReview',
      title: 'Review Schedule',
      subtitle: 'Review your season schedule for conflicts',
      type: 'schedule-review',
      getValue: () => '',
      setValue: () => {},
    },
  ];

  // Show custom season length step only when custom flag is set
  const shouldShowCustomSeasonLength = formData.isCustomLength === true;

  // Show BCA/APA custom dates steps only when 'custom' is selected
  const shouldShowBCACustomDates = formData.bcaChoice === 'custom';
  const shouldShowAPACustomDates = formData.apaChoice === 'custom';

  return allSteps.filter(step => {
    if (step.id === 'customSeasonLength') {
      return shouldShowCustomSeasonLength;
    }
    if (step.id === 'bcaCustomDates') {
      return shouldShowBCACustomDates;
    }
    if (step.id === 'apaCustomDates') {
      return shouldShowAPACustomDates;
    }
    return true;
  }) as SeasonWizardStep[];
}

/**
 * Clear ALL season creation data from localStorage
 * Removes all wizard data, schedule data, and blackout weeks
 */
export function clearSeasonCreationData(leagueId: string): void {
  const STORAGE_KEY = `season-creation-${leagueId}`;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(`season-wizard-step-${leagueId}`);
  localStorage.removeItem('season-schedule-review');
  localStorage.removeItem('season-blackout-weeks');
}
