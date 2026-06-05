# Central Database Layer Implementation Plan

> **Created**: 2025-11-01
> **Status**: Phase 1 Complete - Foundation Set Up
> **Branch**: `app-restructure`

---

## 🎯 Goal

Create a centralized, efficient database access layer using TanStack Query to eliminate duplicate fetches, provide automatic caching, and standardize data fetching patterns across the application.

---

## ✅ Phase 1: Foundation (COMPLETE)

### Completed Tasks
- ✅ Installed `@tanstack/react-query` v5.90.6
- ✅ Installed `@tanstack/react-query-devtools` v5.90.2
- ✅ Created `/src/api` directory structure
- ✅ Created `api/client.ts` with QueryClient configuration
- ✅ Created `api/queryKeys.ts` with comprehensive query key factory
- ✅ Wrapped app with `QueryClientProvider` in `main.tsx`
- ✅ Added React Query DevTools for development

### Directory Structure Created
```
/src/api/
  ├── client.ts           # QueryClient config with optimized defaults
  ├── queryKeys.ts        # Type-safe query key factory
  ├── /queries/           # Read operations (useQuery)
  ├── /mutations/         # Write operations (useMutation)
  └── /hooks/             # Custom hooks combining queries
```

### Configuration Highlights
- **Default stale time**: 5 minutes (data stays fresh)
- **Cache time**: 10 minutes (unused data persists)
- **Specialized stale times** for different data types:
  - User/auth: 30 min (very stable)
  - Members: 15 min
  - Teams/Leagues: 10-15 min
  - Messages: 30 sec (fresh)
  - Live matches: 0 (always refetch)

---

## 📋 Phase 2: Migration Strategy (NEXT)

### High-Value Targets (Start Here)

#### 2.1 Member/User Data (Highest Impact)
**Current State:**
- `useCurrentMember` hook fetches member data on every mount
- `UserProvider` manages auth state
- `useUserProfile` fetches profile separately
- Result: 3+ fetches for same user data across page navigations

**Migration Plan:**
1. Create `api/queries/members.ts`:
   - `getCurrentMember()` - fetches current user's member data
   - `getMemberProfile()` - fetches member profile
   - `getMemberById()` - fetches any member by ID

2. Create `api/hooks/useCurrentMember.ts`:
   - Replace existing hook with TanStack Query version
   - Use `queryKeys.members.current()`
   - Cache member data for 30 minutes
   - Automatic deduplication across app

3. Update `UserProvider`:
   - Keep auth state management
   - Remove redundant member fetches
   - Let queries handle member data

**Benefits:**
- Fetch user data once per session
- Instant navigation (cached data)
- Automatic background refresh

#### 2.2 Team Data
**Current State:**
- `utils/teamQueries.ts` has helper functions
- `useTeamManagement` hook fetches teams
- Multiple components fetch same team data
- No caching between navigations

**Migration Plan:**
1. Create `api/queries/teams.ts`:
   - Move functions from `utils/teamQueries.ts`
   - Return plain data (not Supabase response objects)
   - Add error handling

2. Create hooks in `api/hooks/`:
   - `useTeams(leagueId)` - all teams in league
   - `useTeamDetail(teamId)` - single team with roster
   - `usePlayerTeams(memberId)` - teams for a player

3. Update components:
   - Replace direct `teamQueries` usage
   - Use new hooks instead
   - Remove manual loading states

**Benefits:**
- Teams cached by league/member
- Automatic invalidation on updates
- Deduplicated requests

#### 2.3 Messaging System
**Current State:**
- `utils/messageQueries.ts` with fetch functions
- `useMessages` hook manages state
- `useConversations` hook
- Real-time via `useRealtime` hook

**Migration Plan:**
1. Create `api/queries/messages.ts`:
   - Migrate query functions
   - Add pagination support (infinite query)

2. Create hooks:
   - `useConversations(userId)` - list of conversations
   - `useConversationMessages(conversationId)` - infinite query for history
   - `useUnreadCount(userId)` - real-time count

3. Integrate real-time:
   - Keep `useRealtime` hook
   - Use `queryClient.setQueryData()` for optimistic updates
   - Invalidate queries on real-time events

**Benefits:**
- Infinite scroll for message history
- Optimistic message sending
- Cached conversations list

---

## 📊 Phase 3: Enhanced Features

### 3.1 Optimistic Updates
Add instant UI feedback for mutations:
- Creating/updating teams
- Sending messages
- Updating scores
- Editing rosters

### 3.2 Prefetching Strategies
Load data before user needs it:
- Prefetch team detail when hovering team link
- Prefetch schedule when loading season page
- Prefetch next message page

### 3.3 Dependent Queries
Chain queries efficiently:
- Fetch league → then seasons → then teams
- Fetch user → then member → then teams

### 3.4 Query Devtools Integration
Already added! Access with:
- Click floating React Query icon (bottom-left in dev mode)
- See all active queries
- View cache contents
- Manually refetch/invalidate
- Monitor background updates

---

## 🗂️ Phase 4: Cleanup & Documentation

### 4.1 Remove Old Patterns
- Deprecate direct `supabase.from()` calls in components
- Remove or migrate `utils/*Queries.ts` files
- Update hooks to use TanStack Query

### 4.2 Update Documentation
- Update TABLE_OF_CONTENTS.md with new API structure
- Document query patterns in memory-bank
- Create migration guide for future features

### 4.3 Establish Patterns
- When to create a new query vs. hook
- How to invalidate related queries
- Optimistic update patterns

---

## 📈 Migration Order (Recommended)

### Week 1: Auth & Members
1. ✅ Set up TanStack Query
2. Migrate `useCurrentMember`
3. Migrate `useUserProfile`
4. Migrate `useOperatorId`

### Week 2: Teams & Leagues
5. Migrate `teamQueries.ts`
6. Migrate `useTeamManagement`
7. Migrate `leagueService.ts`
8. Migrate `useSeasonSchedule`

### Week 3: Messaging
9. Migrate `messageQueries.ts`
10. Migrate `useMessages`
11. Migrate `useConversations`
12. Integrate with real-time

### Week 4: Matches & Scoring
13. Migrate `useMatchLineup`
14. Migrate `useMatchScoring`
15. Add optimistic updates

### Week 5: Cleanup
16. Remove deprecated code
17. Update documentation
18. Performance audit

---

## 🔍 Key Patterns & Examples

### Basic Query
```typescript
// api/queries/members.ts
export async function getCurrentMember(userId: string) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

// api/hooks/useCurrentMember.ts
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { getCurrentMember } from '../queries/members';
import { useUser } from '@/context/useUser';

export function useCurrentMember() {
  const { user } = useUser();

  return useQuery({
    queryKey: queryKeys.members.current(),
    queryFn: () => getCurrentMember(user!.id),
    enabled: !!user?.id, // Only run if user exists
    staleTime: STALE_TIME.USER, // 30 minutes
  });
}
```

### Mutation with Invalidation
```typescript
// api/mutations/teams.ts
export async function updateTeamName(teamId: string, newName: string) {
  const { data, error } = await supabase
    .from('teams')
    .update({ team_name: newName })
    .eq('id', teamId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// In component
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { updateTeamName } from '@/api/mutations/teams';

function TeamEditor() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ teamId, name }: { teamId: string; name: string }) =>
      updateTeamName(teamId, name),
    onSuccess: (data) => {
      // Invalidate team queries to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.byLeague(data.league_id) });
    },
  });

  return <button onClick={() => mutation.mutate({ teamId: '123', name: 'New Name' })}>
    {mutation.isPending ? 'Saving...' : 'Save'}
  </button>
}
```

### Optimistic Update
```typescript
const mutation = useMutation({
  mutationFn: updateTeamName,
  onMutate: async ({ teamId, name }) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: queryKeys.teams.detail(teamId) });

    // Snapshot previous value
    const previous = queryClient.getQueryData(queryKeys.teams.detail(teamId));

    // Optimistically update cache
    queryClient.setQueryData(queryKeys.teams.detail(teamId), (old: any) => ({
      ...old,
      team_name: name,
    }));

    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    if (context?.previous) {
      queryClient.setQueryData(
        queryKeys.teams.detail(variables.teamId),
        context.previous
      );
    }
  },
  onSettled: (data) => {
    // Refetch to ensure data is correct
    queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(data.id) });
  },
});
```

---

## 🎨 Design Decisions

### Why TanStack Query?
- **Industry standard** - Most popular React data-fetching library
- **Automatic caching** - Eliminates duplicate fetches
- **Background updates** - Keeps data fresh automatically
- **DevTools** - Excellent debugging experience
- **TypeScript** - Full type safety
- **Small bundle** - ~13kb gzipped

### Why Not Just Context?
- Context doesn't cache or deduplicate
- No automatic refetching/invalidation
- Manual loading states everywhere
- Difficult to manage dependencies

### Why Separate queries/ and hooks/?
- **queries/**: Pure data fetching functions (testable, reusable)
- **hooks/**: React-specific wrappers with useQuery (composition)
- Allows query functions to be used outside React (tests, scripts)

---

## 📝 Notes

- TanStack Query DevTools available by clicking icon in bottom-left (dev mode only)
- Old patterns (`utils/*Queries.ts`) can coexist during migration
- Invalidation is cheap - prefer invalidating more rather than less
- Real-time updates work great with TanStack Query via `setQueryData`

---

## 🚀 Next Steps

1. **Start with `useCurrentMember` migration** (highest impact)
2. Test that member data caches across navigations
3. Verify DevTools shows cached queries
4. Move to team data migration
5. Document learnings in memory-bank

---

*This is a living document. Update as implementation progresses.*
