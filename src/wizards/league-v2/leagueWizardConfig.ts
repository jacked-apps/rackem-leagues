/**
 * @fileoverview League Wizard v2 Configuration
 *
 * THE CENTRAL CONFIG for the League Creation Wizard. This is where all
 * the steps are registered, ordered, and wired up.
 *
 * Two paths through the wizard:
 *   PRESET (fast): GameType → StartDate → Qualifier → Pick a preset → Review
 *   CUSTOM (longer): GameType → StartDate → Qualifier → Custom → LineupSize
 *                    → RosterSize → MatchFormat → HandicapSystem → Review
 *
 * Custom path steps use showIf: they only appear when formData['league-format']
 * === 'custom'. The shell handles this automatically — no routing needed.
 *
 * schemaVersion: bump this number if you change the form data shape or step
 * IDs in a way that would break saved localStorage data. It forces a fresh
 * start for users mid-wizard.
 *
 * getSummaryItems: maps form data to the live preview box that shows the
 * league name building in real time as the user answers questions.
 */

import type { WizardConfig } from '@/components/wizard';
import { ReviewStep } from './steps/ReviewStep';
import { evaluateCombo } from './comboCoherence';
import { LeagueIntroStep } from './steps/LeagueIntroStep';
import { GameTypeStep } from './steps/GameTypeStep';
import { StartDateStep } from './steps/StartDateStep';
import { QualifierStep } from './steps/QualifierStep';
import { LeagueFormatStep } from './steps/LeagueFormatStep';
import { LineupSizeStep } from './steps/LineupSizeStep';
import { RosterSizeStep } from './steps/RosterSizeStep';
import { MatchFormatStep } from './steps/MatchFormatStep';
import { HandicapSystemStep } from './steps/HandicapSystemStep';
import { PairingFormatStep } from './steps/PairingFormatStep';
import { PointsCalculatorStep } from './steps/PointsCalculatorStep';
import { ThresholdSourceStep } from './steps/ThresholdSourceStep';
import { WinConditionStep } from './steps/WinConditionStep';
import { MechanismStep } from './steps/MechanismStep';
import { StandingsSortStep } from './steps/StandingsSortStep';
import { TiebreakerStep } from './steps/TiebreakerStep';
import type { LeagueWizardFormData } from './leagueWizardTypes';
import { getLeagueSummaryItems } from './leagueWizardHelpers';
import { getMatchTotalGames } from '@/utils/lineup/getMatchTotalGames';

/** Simple validator — blocks Next if nothing is selected */
const requireSelection = (value: unknown) =>
  value ? undefined : ['Please make a selection'];

export const leagueWizardConfig: WizardConfig<LeagueWizardFormData> = {
  id: 'league-creation-v2',
  title: 'Create New League',
  schemaVersion: 1,
  initialFormData: {},
  getSummaryItems: getLeagueSummaryItems,
  steps: [
    {
      id: 'intro',
      title: 'Create Your League',
      component: LeagueIntroStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'game-type',
      title: 'Game Type',
      validate: requireSelection,
      component: GameTypeStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'start-date',
      title: 'Start Date',
      validate: requireSelection,
      component: StartDateStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'qualifier',
      title: 'Division Descriptor',
      optional: true,
      component: QualifierStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'league-format',
      title: 'League Format',
      validate: requireSelection,
      component: LeagueFormatStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    // Custom path — only shown when user picks "Custom" format
    {
      id: 'lineup-size',
      title: 'Lineup Size',
      showIf: (fd) => fd['league-format'] === 'custom',
      component: LineupSizeStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'roster-size',
      title: 'Roster Size',
      showIf: (fd) => fd['league-format'] === 'custom',
      component: RosterSizeStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'match-format',
      title: 'Match Format',
      showIf: (fd) => fd['league-format'] === 'custom',
      validate: requireSelection,
      component: MatchFormatStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'handicap-system',
      title: 'Handicap System',
      showIf: (fd) => fd['league-format'] === 'custom',
      validate: requireSelection,
      component: HandicapSystemStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    // Phase 4 Unit 4.1 — additional modular axes (custom path only).
    // Steps appear in dependency order: pairing format and scoring method
    // come first because their values constrain the remaining choices.
    {
      id: 'pairing-format',
      title: 'Pairing Format',
      showIf: (fd) => fd['league-format'] === 'custom',
      validate: requireSelection,
      component: PairingFormatStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'points-calculator',
      title: 'Points Calculator',
      showIf: (fd) => fd['league-format'] === 'custom',
      // No requireSelection here — `null` ("don't track points") is a
      // valid answer per Phase 4 Unit 4.1, and the CardSelector returns
      // `null` for that card. requireSelection would falsely block it.
      component: PointsCalculatorStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'win-condition',
      title: 'Win Condition',
      showIf: (fd) => fd['league-format'] === 'custom',
      validate: requireSelection,
      component: WinConditionStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'mechanism',
      title: 'Handicap Mechanism',
      showIf: (fd) => fd['league-format'] === 'custom',
      validate: requireSelection,
      component: MechanismStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    // Phase 4 Unit 4.3: tells the LO which threshold source their combo
    // will use (Tested Preset / Fargo formula / manual entry) and lets
    // them opt into mechanism='none' for off-preset combos.
    {
      id: 'threshold-source',
      title: 'Threshold Source',
      showIf: (fd) => fd['league-format'] === 'custom',
      // No requireSelection — the step is informational; the
      // 'unhandicapped' checkbox is optional.
      component: ThresholdSourceStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'standings-sort',
      title: 'Standings Sort',
      showIf: (fd) => fd['league-format'] === 'custom',
      validate: requireSelection,
      component: StandingsSortStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    // Tiebreaker only matters when the configured (lineup × match-format)
    // produces an even total game count. Even lineup sizes always do; odd
    // lineup with double-round-robin also does. Odd × single-RR = odd
    // games, no ties possible — skip the question.
    {
      id: 'tiebreaker',
      title: 'Tiebreaker',
      showIf: (fd) => {
        if (fd['league-format'] !== 'custom') return false;
        const totalGames = getMatchTotalGames({
          lineupSize: fd['lineup-size'] ?? 3,
          gameGeneration: fd['match-format'] ?? 'double_round_robin',
        });
        return totalGames % 2 === 0;
      },
      validate: requireSelection,
      component: TiebreakerStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'review',
      title: 'Review',
      // Phase 4 Unit 4.2: combo-coherence ERRORS block Save/Finish.
      // Warnings are rendered inside the step but don't gate
      // submission — the LO can save anyway.
      validate: (_value, formData) => {
        const { errors } = evaluateCombo(formData);
        if (errors.length === 0) return undefined;
        return errors.map((e) => e.message);
      },
      component: ReviewStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
  ],
};
