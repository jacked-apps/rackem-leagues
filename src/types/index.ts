/**
 * @fileoverview Centralized Type Exports
 * Re-exports all types from their individual modules for convenient importing
 *
 * Usage:
 * import { Member, League, Venue } from '@/types';
 */

// Member and User types
export type { Member, PartialMember, MemberForMessaging, UserRole } from './member';

// League types
export type {
  LeagueFormData,
  TeamFormat,
  HandicapSystem,
  GameType,
  Season,
  League,
  HandicapVariant
} from './league';

// Preferences types (organization and league settings)
export type {
  Preferences,
  PreferenceEntityType,
  PreferencesInsertData,
  PreferencesUpdateData,
  OrganizationPreferences,
  LeaguePreferences,
  ResolvedLeaguePreferences
} from './preferences';
export { SYSTEM_DEFAULTS } from './preferences';

// System overrides (per-league dial JSONB shape — used by leagues.system_overrides)
export type { SystemOverrides } from './systemOverrides';

// Season types
export type { SeasonWeek } from './season';

// Venue types
export type { Venue, VenueFormData } from './venue';

// Tournament types
export type {
  Tournament,
  TournamentDateOption,
  TournamentSearchParams,
  TournamentOrganization,
  TournamentType
} from './tournament';

// Match and Scoring types
export type {
  MatchType,
  MatchBasic,
  MatchWithLeagueSettings,
  Lineup,
  Player,
  HandicapThresholds,
  MatchGame,
  ScoringOptions,
  ConfirmationQueueItem,
  TeamStats,
  PlayerStats
} from './match';

// Match and Scoring utility functions
export { getTeamStats, getPlayerStats, getCompletedGamesCount, calculatePoints, calculateBCAPoints, TIEBREAKER_THRESHOLDS } from './match';

// Team types
export type { Team, TeamWithQueryDetails, UseTeamManagementReturn } from './team';

// Schedule types
export type {
  MatchStatus,
  Match,
  MatchWithDetails,
  MatchInsertData,
  TeamSchedulePosition,
  TeamSchedulePositionInsertData
} from './schedule';

// Playoff types
export type {
  SeededTeam,
  PlayoffMatchup,
  ExcludedTeam,
  PlayoffBracket,
  GeneratePlayoffResult,
  CreatePlayoffMatchesResult
} from './playoff';

// Common React event handler types for convenience
// Usage: onChange={(e: InputChange) => handleChange(e)}
export type InputChange = React.ChangeEvent<HTMLInputElement>;
export type TextAreaChange = React.ChangeEvent<HTMLTextAreaElement>;
export type SelectChange = React.ChangeEvent<HTMLSelectElement>;
export type FormSubmit = React.FormEvent<HTMLFormElement>;
export type ButtonClick = React.MouseEvent<HTMLButtonElement>;
export type KeyDown = React.KeyboardEvent<HTMLInputElement>;
