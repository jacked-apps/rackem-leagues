/**
 * @fileoverview Playoff format preset options for PlayoffFormatStep
 *
 * Covers ~90% of leagues with 4 standard formats + a "coming soon"
 * custom option. Detailed playoff configuration (matchup styles,
 * bracket layout) happens on the Playoff Setup page after the wizard.
 */

import type { SelectableCardOption } from '@/components/wizard';

export const PLAYOFF_OPTIONS: SelectableCardOption<string>[] = [
  {
    value: 'none',
    title: 'No Playoffs',
    description: 'Regular season only — no playoff weeks',
  },
  {
    value: '1week_all',
    title: '1 Week — All Teams',
    description: 'Single playoff night, every team competes',
    infoButton: {
      title: '1 Week — All Teams',
      content: 'All teams play in a single playoff night. Seeded: 1st vs last, 2nd vs second-to-last, etc.',
    },
  },
  {
    value: '1week_top4',
    title: '1 Week — Top 4 Teams',
    description: 'Single playoff night, top 4 teams qualify',
    infoButton: {
      title: '1 Week — Top 4',
      content: 'Top 4 qualify. Seeded: 1st vs 4th, 2nd vs 3rd. Winners play for the championship.',
    },
  },
  {
    value: '2week_top4',
    title: '2 Weeks — Top 4 (Semi/Finals)',
    description: 'Week 1: semifinals. Week 2: winners play for gold/silver, losers play for bronze',
    infoButton: {
      title: '2 Weeks — Top 4',
      content: 'Top 4 qualify. Week 1: 1st vs 4th, 2nd vs 3rd. Week 2: all four teams play — winners compete for gold/silver, losers compete for bronze.',
    },
  },
  {
    value: '2week_percentage',
    title: '2 Weeks — Top 50% (Semi/Finals)',
    description: 'Week 1: seeded semifinals. Week 2: winners play for gold/silver, losers play for bronze',
    infoButton: {
      title: '2 Weeks — Top 50%',
      content: 'Top half qualify. Week 1: seeded semis. Week 2: all remaining teams play — winners compete for gold/silver, losers compete for bronze.',
    },
  },
  {
    value: 'custom',
    title: 'Custom Playoff Format',
    disabled: true,
    disabledMessage: 'Coming soon — customize in the Playoff Setup page after the wizard',
    description: 'Build your own playoff structure',
  },
];
