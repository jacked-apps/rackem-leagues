/**
 * @fileoverview Member Mutation Hooks (TanStack Query)
 *
 * React hooks for member write operations with automatic cache invalidation.
 * Wraps mutation functions with TanStack Query for optimistic updates.
 *
 * Benefits:
 * - Automatic cache invalidation after successful mutations
 * - Built-in loading/error states
 * - Optimistic updates for better UX
 * - Automatic retries on failure
 *
 * @see api/mutations/members.ts - Pure mutation functions
 */

import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import {
  updateProfanityFilter,
  markProfanityOnboardingComplete,
  updateMemberProfile,
  createMember,
  deleteMember,
  type UpdateMemberRoleParams,
} from '../mutations/members';

/**
 * Invalidate every cache that EMBEDS member data, so a member identity change
 * (name / nickname / role / create / delete) refreshes everywhere it's shown —
 * not just the `members` cache.
 *
 * Member data is denormalized into many other queries: rosters & captains
 * (`teams`), operator/staff lists (`operators`, `organizationStaff`), message
 * participant names (`messages`), stats (`stats`), member search (`memberSearch`),
 * and re-up status (`leagueReupStatus`). Invalidating only `members.*` leaves
 * those embedded copies stale — the "name updates in the profile but not the
 * roster" bug. This refreshes all of them.
 *
 * This is the pragmatic band-aid for the denormalization (it over-invalidates a
 * little); the durable fix is reading member data by id (the PlayerNameLink
 * pattern). See docs/research/2026-06-07-stale-cache-mutation-discipline.md.
 *
 * @param queryClient - the active TanStack Query client.
 * @param refetchAll - when true, also refetch INACTIVE queries (used by the role
 *   change, whose LO-application flow navigates to a page gated on fresh data —
 *   closes LIST_FOR_ED #7). Returns the invalidation promise so callers can await.
 */
function invalidateMemberEmbedders(
  queryClient: QueryClient,
  refetchAll = false,
): Promise<unknown> {
  const keys: QueryKey[] = [
    queryKeys.members.all,
    queryKeys.teams.all,
    queryKeys.operators.all,
    queryKeys.messages.all,
    queryKeys.stats.all,
    ['memberSearch'],
    ['organizationStaff'],
    ['leagueReupStatus'],
  ];
  return Promise.all(
    keys.map((queryKey) =>
      queryClient.invalidateQueries(
        refetchAll ? { queryKey, refetchType: 'all' } : { queryKey },
      ),
    ),
  );
}

/**
 * Hook to update member's profile information
 *
 * General-purpose hook for updating any member profile fields.
 * Automatically invalidates member cache after successful update.
 *
 * @returns TanStack Mutation object with mutate/mutateAsync functions
 *
 * @example
 * const updateProfile = useUpdateMemberProfile();
 *
 * await updateProfile.mutateAsync({
 *   memberId: 'member-123',
 *   updates: {
 *     first_name: 'John',
 *     email: 'john@example.com'
 *   }
 * });
 */
export function useUpdateMemberProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMemberProfile,
    onSuccess: () => {
      // Refresh the member everywhere it's shown — incl. embedded copies in
      // rosters, operator lists, message names, etc. (not just members.*).
      invalidateMemberEmbedders(queryClient);
    },
  });
}

/**
 * Hook to update member's profanity filter preference
 *
 * Only works for users 18+. Automatically invalidates profanity settings cache
 * after successful update so the UI reflects the new state.
 *
 * @returns TanStack Mutation object with mutate/mutateAsync functions
 *
 * @example
 * const updateFilter = useUpdateProfanityFilter();
 *
 * const handleToggle = async () => {
 *   try {
 *     await updateFilter.mutateAsync({
 *       userId: user.id,
 *       enabled: !currentState
 *     });
 *     toast.success('Filter preference updated');
 *   } catch (error) {
 *     toast.error(error.message);
 *   }
 * };
 */
export function useUpdateProfanityFilter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfanityFilter,
    onSuccess: (_, variables) => {
      // Invalidate profanity settings cache for this user
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.members.byUser(variables.userId), 'profanitySettings'],
      });
    },
  });
}

/**
 * Hook for the Unit 9 profanity-onboarding modal.
 *
 * Writes both `profanity_filter_enabled` (the user's chosen preference)
 * AND `profanity_onboarding_completed_at` (now, so the modal stops
 * reappearing) in a single UPDATE. Invalidates both the profanity
 * settings cache AND the current-member cache so the modal-mount
 * gate (`profanity_onboarding_completed_at IS NULL`) flips to false
 * immediately.
 */
export function useMarkProfanityOnboardingComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markProfanityOnboardingComplete,
    onSuccess: (_, variables) => {
      // Profanity settings (current-user filter pref) — gives the rest
      // of the UI the new preference on the next render.
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.members.byUser(variables.userId), 'profanitySettings'],
      });
      // Member row itself — `profanity_onboarding_completed_at` is part
      // of the member record the modal-mount component reads.
      queryClient.invalidateQueries({
        queryKey: queryKeys.members.byUser(variables.userId),
      });
    },
  });
}

/**
 * Hook to create a new member
 *
 * Used for testing RLS INSERT policies.
 * Automatically invalidates member queries on success.
 *
 * @returns TanStack Mutation object with mutate/mutateAsync functions
 *
 * @example
 * const createMemberMutation = useCreateMember();
 *
 * const member = await createMemberMutation.mutateAsync({
 *   first_name: 'John',
 *   last_name: 'Doe',
 *   phone: '555-0100',
 *   email: 'john@example.com',
 *   address: '123 Main St',
 *   city: 'Austin',
 *   state: 'TX',
 *   zip_code: '78701',
 *   date_of_birth: '1990-01-01',
 *   system_player_number: 12345
 * });
 */
export function useCreateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMember,
    onSuccess: () => {
      // New member shows up in member lists, search, pickers, etc.
      invalidateMemberEmbedders(queryClient);
    },
  });
}

/**
 * Hook to delete a member
 *
 * Used for cleaning up test data.
 * Automatically invalidates member queries on success.
 *
 * @returns TanStack Mutation object with mutate/mutateAsync functions
 *
 * @example
 * const deleteMemberMutation = useDeleteMember();
 *
 * await deleteMemberMutation.mutateAsync({ memberId: 'member-123' });
 */
export function useDeleteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMember,
    onSuccess: () => {
      // Removed member must drop out of lists, rosters, search, etc.
      invalidateMemberEmbedders(queryClient);
    },
  });
}

/**
 * Hook to update member's role
 *
 * Changes a member's role (e.g., from 'player' to 'league_operator').
 * Delegates to the canonical `updateMemberProfile` patch mutation (role is a
 * member-row column) while keeping this named hook for its bespoke invalidation
 * and so role changes stay greppable. Automatically invalidates member cache
 * after successful update.
 *
 * @returns TanStack Mutation object with mutate/mutateAsync functions
 *
 * @example
 * const updateRole = useUpdateMemberRole();
 *
 * await updateRole.mutateAsync({
 *   memberId: 'member-123',
 *   role: 'league_operator'
 * });
 */
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, role }: UpdateMemberRoleParams) =>
      updateMemberProfile({ memberId, updates: { role } }),
    onSuccess: async () => {
      // Refresh role everywhere it's embedded (members, operator/staff lists…)
      // AND wait for the refetch — paired with the same treatment in
      // useCreateOrganization (closes LIST_FOR_ED #7). The LO-application flow
      // runs both mutations back-to-back then navigates to /dashboard, which
      // gates the org-list on BOTH the new role AND the new org. If either is
      // stale when the dashboard mounts, the user sees the empty/wrong state.
      //
      // `refetchAll` forces inactive-query refetches; awaiting it holds the
      // mutation open until the cache is fresh.
      await invalidateMemberEmbedders(queryClient, true);
    },
  });
}
