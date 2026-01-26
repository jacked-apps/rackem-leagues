/**
 * @fileoverview Match Editor Components
 *
 * Components for the League Operator match data editing page.
 * These components allow operators to view and modify all match data
 * without requiring player participation.
 *
 * Components:
 * - MatchNavigationBar: Week match pills for quick navigation
 * - LineupsSection: Team lineups with handicaps (includes LineupOptionsCard)
 * - ThresholdsSection: Games-to-win thresholds
 * - GamesSection: Individual game results
 * - MatchResultSection: Final match result and points
 *
 * Each section is a self-contained, reusable component with its own
 * view/edit modes and save functionality.
 *
 * Hooks:
 * - useMatchEditorState: State management for the match editor
 */

export { MatchNavigationBar } from './MatchNavigationBar';
export { LineupsSection } from './LineupsSection';
export { ThresholdsSection } from './ThresholdsSection';
export { GamesSection } from './GamesSection';
export { MatchResultSection } from './MatchResultSection';
export {
  SetupOptions,
  calculateTotalGames,
  getDefaultSetupOptions,
  getChartEditorType,
  type SetupOptionsConfig,
  type HandicapType as SetupHandicapType,
  type ThresholdMode,
  type GameFormat,
  type ChartEditorType,
} from './SetupOptions';

// State management
export {
  useMatchEditorState,
  createInitialState,
  type MatchEditorState,
  type MatchEditorAction,
  type FormatConfig,
  type TeamLineup,
  type LineupPlayer,
  type Thresholds,
  type Game,
  type MatchResultState,
  type HandicapType,
  type GameGeneration,
  type PointsSystem,
  type MatchResult,
} from './useMatchEditorState';
