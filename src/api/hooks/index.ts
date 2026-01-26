/**
 * @fileoverview API Hooks Index
 *
 * Central export point for all TanStack Query hooks.
 * Import hooks from here for cleaner imports.
 *
 * @example
 * import { useCurrentMember, useUserProfile } from '@/api/hooks';
 */

// Member/Auth hooks
export {
  useCurrentMember,
  useMemberId,
  useMemberFirstName,
  useIsCaptain,
  useAllMembers,
  useMemberById,
  useMemberProfanitySettings,
} from './useCurrentMember';

// Member search hooks
export { useMemberSearch } from './useMemberSearch';
export type { MemberSearchFilter } from '../queries/memberSearch';

export {
  useUserProfile,
  useIsOperator,
  useIsDeveloper,
  useMemberRole,
} from './useUserProfile';

export {
  useOperatorId,
  useOperatorIdValue,
  useIsCurrentUserOperator,
} from './useOperatorId';

// Team hooks
export {
  usePlayerTeams,
  useTeamDetails,
  useTeamsByLeague,
  useTeamsBySeason,
  useCaptainTeamEditData,
  useUserTeamInMatch,
  useTeamRoster,
} from './useTeams';

// Team query functions (for backward compatibility with non-hook usage)
// Wraps the new query functions to match old {data, error} pattern
import { getTeamsByLeague } from '../queries/teams';

export async function fetchTeamsWithDetails(leagueId: string) {
  try {
    const data = await getTeamsByLeague(leagueId);
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// Message hooks (queries)
export {
  useConversations,
  useConversationMessages,
  useBlockedUsers,
  useBlockedUsersDetails,
  useUnreadMessageCount,
  useConversationParticipants,
} from './useMessages';

// Message mutations
export {
  useSendMessage,
  useUpdateLastRead,
  useBlockUser,
  useUnblockUser,
} from './useMessageMutations';

// Conversation mutations
export {
  useCreateOrOpenConversation,
  useCreateGroupConversation,
  useLeaveConversation,
} from './useConversationMutations';

// Announcement mutations
export {
  useCreateLeagueAnnouncement,
  useCreateOrganizationAnnouncement,
} from './useAnnouncementMutations';

// Conversation queries
export {
  useConversationType,
  useConversationTitle,
  useConversationParticipants as useConversationParticipantsQuery,
  useIsUserBlocked,
  useOtherParticipantId,
} from './useConversationQueries';

// Messaging real-time subscriptions (Messages page only)
export {
  useConversationsRealtime,
  useConversationMessagesRealtime,
} from './useMessagingRealtime';

// Report mutations
export {
  useCreateUserReport,
  useUpdateReportStatus,
} from './useReportMutations';

// League queries
export {
  useLeaguesByOperator,
  useLeagueCount,
  useLeagueById,
  useLeaguesWithProgress,
} from './useLeagues';

// Operator queries
export {
  useOperatorProfile,
} from './useOperatorProfile';

// Organization queries
export {
  useOrganizations,
  useOrganization,
  useOrganizationPosition,
} from './useOrganizations';

// Organization staff queries
export {
  useOrganizationStaff,
} from './useOrganizationStaff';

// Organization staff mutations
export {
  useAddOrganizationStaff,
  useRemoveOrganizationStaff,
} from './useOrganizationStaffMutations';

// Preferences queries
export {
  useOrganizationPreferences,
  useLeaguePreferences,
} from './usePreferences';

// Operator stats queries
export {
  useOperatorStats,
} from './useOperatorStats';

// Season queries
export {
  useSeasonsByLeague,
  useSeasonById,
  useMostRecentSeason,
  useActiveSeason,
  useSeasonCount,
  usePreviousCompletedSeason,
  useChampionshipPreferences,
} from './useSeasons';

// Match/Schedule queries
export {
  useMatchById,
  useMatchesBySeason,
  useMatchesByTeam,
  useSeasonSchedule,
  useSeasonWeeks,
  useNextMatchForTeam,
  useMatchWithLeagueSettings,
  useMatchLineups,
  useMatchGames,
  useCompleteMatch,
} from './useMatches';

// Venue queries
export {
  useVenuesByOperator,
  useVenuesByOrganization,
  useVenueById,
  useLeagueVenues,
  useLeagueVenuesWithDetails,
} from './useVenues';

// Venue mutations
export {
  useCreateVenue,
  useUpdateVenue,
  useDeleteVenue,
} from './useVenueMutations';

// Team mutations
export {
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
} from './useTeamMutations';

// Season mutations
export {
  useCreateSeason,
  useUpdateSeason,
  useActivateSeason,
  useDeleteSeason,
} from './useSeasonMutations';

// League mutations
export {
  useCreateLeague,
  useUpdateLeague,
  useDeleteLeague,
  useUpdateLeagueDayOfWeek,
} from './useLeagueMutations';

// League Venue mutations
export {
  useAddLeagueVenue,
  useUpdateLeagueVenue,
  useRemoveLeagueVenue,
} from './useLeagueVenueMutations';

// Schedule mutations
export {
  useGenerateSchedule,
  useDeleteSchedule,
} from './useScheduleMutations';

// Match Lineup mutations
export {
  useCreateEmptyLineup,
  useSaveMatchLineup,
  useLockMatchLineup,
  useUnlockMatchLineup,
  useUpdateMatchLineup,
} from './useMatchLineupMutations';

// Match mutations
export {
  useUpdateMatch,
} from './useMatchMutations';

// Member mutations
export {
  useUpdateProfanityFilter,
  useCreateMember,
  useDeleteMember,
} from './useMemberMutations';

// Championship date mutations
export {
  useCreateChampionshipDate,
  useUpdateChampionshipDate,
  useDeleteChampionshipDate,
} from './useChampionshipDateMutations';

// Operator blackout preference mutations
export {
  useCreateOperatorBlackoutPreference,
  useUpdateOperatorBlackoutPreference,
  useDeleteOperatorBlackoutPreference,
} from './useOperatorBlackoutPreferenceMutations';

// Preference mutations (organization and league preferences)
export {
  useCreatePreference,
  useUpdatePreference,
  useDeletePreference,
} from './usePreferenceMutations';

// Invite hooks
export { usePendingInvites } from './usePendingInvites';
export { useInviteStatuses } from './useInviteStatuses';
export type { InviteStatus } from './useInviteStatuses';
export { usePlayerTeamCount } from './usePlayerTeamCount';
export type { PlayerTeam } from './usePlayerTeamCount';

// Threshold Charts hooks
export {
  useGlobalThresholdCharts,
  useLeagueThresholdCharts,
  useThresholdChart,
  useDefaultThresholdChart,
  useThresholdLookup,
  useCreateThresholdChart,
  useCreateThresholdChartRows,
  useUpdateThresholdChart,
  useReplaceThresholdChartRows,
  useDeleteThresholdChart,
  useCopyGlobalChartToLeague,
  thresholdChartKeys,
} from './useThresholdCharts';
export type {
  ThresholdChartType,
  ThresholdEntityType,
  ThresholdLookupMode,
  ThresholdChart,
  ThresholdChartRow,
  ThresholdChartWithRows,
  ThresholdLookupResult,
  CreateThresholdChartInput,
  CreateThresholdChartRowInput,
} from './useThresholdCharts';

// League Format Settings hooks
export {
  useLeagueFormatSettings,
  useLeagueFormatSettingsWithChart,
  useLeagueFormatSettingsOrCreate,
  useCreateLeagueFormatSettings,
  useUpdateLeagueFormatSettings,
  useUpsertLeagueFormatSettings,
  useDeleteLeagueFormatSettings,
  leagueFormatSettingsKeys,
  calculateEstimatedGames,
  getChartTypeForHandicapType,
} from './useLeagueFormatSettings';
export type {
  LeagueFormatSettings,
  LeagueFormatSettingsWithChart,
  CreateLeagueFormatSettingsInput,
  UpdateLeagueFormatSettingsInput,
  HandicapType,
  GameGeneration,
  PointsSystem,
} from './useLeagueFormatSettings';
