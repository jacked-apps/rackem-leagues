/**
 * @fileoverview League format preset options for the LeagueFormatStep
 *
 * Defines the 4 cards shown in the format selector:
 * 1. 5v5 Fargo (top — BCA pitch priority)
 * 2. 3v3 Standard
 * 3. 5v5 Standard
 * 4. Custom
 *
 * Each preset locks in lineup size, handicap system, match format, etc.
 * The actual field values for each preset are mapped in the dual-write
 * mutation (Phase 9). For now this just captures the selection string.
 */

import type { SelectableCardOption } from '@/components/wizard';

export const LEAGUE_FORMAT_OPTIONS: SelectableCardOption<string>[] = [
  {
    value: 'fargo_5v5',
    title: '5v5 Fargo Rated',
    description: '5-player lineup, Fargo handicap system, single round robin',
    infoButton: {
      title: '5v5 Fargo Rated',
      content:
        'Uses Fargo ratings to calculate handicaps. Players enter their Fargo rating and the system determines start points. Fargo API integration coming soon — ratings are entered manually for now.',
    },
  },
  {
    value: 'standard_3v3',
    title: '3v3 Standard',
    description: '3-player lineup, points handicap, double round robin',
    infoButton: {
      title: '3v3 Standard',
      content:
        '3 players per team with a 5-player roster. Uses the -1/+2 points-based handicap system. Each player plays each opponent twice (18 games per match).',
    },
  },
  {
    value: 'standard_5v5',
    title: '5v5 Standard',
    description: '5-player lineup, percentage handicap, single round robin',
    infoButton: {
      title: '5v5 Standard',
      content:
        '5 players per team with an 8-player roster. Uses the percentage-based BCA handicap system. Each player plays each opponent once (25 games per match).',
    },
  },
  {
    value: 'custom',
    title: 'Custom',
    description: 'Configure lineup size, handicap system, and match format yourself',
    infoButton: {
      title: 'Custom Format',
      content:
        'Build your own format by choosing each setting individually. This takes longer to set up but gives you full control over how your league operates.',
    },
  },
];
