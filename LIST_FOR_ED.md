# List for Ed

Tasks and refactoring items for Ed to work on.

---

## 1. Refactor PlayerNameLink Component

**Branch needed:** `refactor-player-name-link`

**Problem:** The component has a messy prop interface - passing separate pieces (`playerId`, `playerName`) while also fetching data internally. This is the worst of both worlds.

**Current props:**
- `playerId` - required
- `playerName` - required (but also fetched internally)
- `className` - optional styling
- `onSendMessage` - never used
- `onReportUser` - never used
- `onBlockUser` - never used
- `customActions` - extension point

**Solution:** Pass the whole player record instead of pieces.

**New interface:**
```tsx
interface PlayerNameLinkProps {
  player: {
    id: string;
    first_name: string;
    last_name: string;
    user_id: string | null;  // null = placeholder
    email?: string | null;
    membership_paid_date?: string | null;
    starting_handicap_3v3?: number | null;
    starting_handicap_5v5?: number | null;
  };
  className?: string;
  customActions?: CustomAction[];
}
```

**Changes needed:**
1. Update `PlayerNameLink` to accept `player` prop instead of `playerId`/`playerName`
2. Remove unused callback props (`onSendMessage`, `onReportUser`, `onBlockUser`)
3. Remove internal fetch for `playerBasicData` (already have it from prop)
4. Remove internal fetch for `playerOperatorData` (already have it from prop)
5. Keep `isBlocked` fetch (that's user-specific, not player data)
6. Update all call sites to pass `player={player}` instead of `playerId={player.id} playerName={...}`

**Note on existing hooks:**
- `useMemberById(playerId)` already exists in `src/api/hooks/useCurrentMember.ts:166`
- It uses `queryKeys.members.detail(memberId)` and fetches the full member record
- Currently the component has TWO custom inline fetches (lines 93-108 and 118-131) that should just use the existing hook
- But if we pass the whole player record, we don't need ANY fetch - the parent already has the data

**Files to update:**
- `src/components/PlayerNameLink.tsx` - main component
- All files that use `<PlayerNameLink>` (search for usages)

---

## 2. Consolidate ALL Queries - Return Full Records

**Branch needed:** `consolidate-queries`

**Problem:** We have multiple query functions for the same entities that each fetch different subsets of fields. This leads to:
- Code duplication across queries
- Inconsistent data shapes in different parts of the app
- Need to add fields to multiple places when requirements change (like we just did with `user_id` for members)
- Components making multiple fetches to get different pieces of the same record
- Query cache fragmentation (same entity cached multiple times with different shapes)

**This applies to ALL our entities, not just members:**
- Members/Players
- Teams
- Leagues
- Seasons
- Matches
- Venues
- Organizations
- etc.

**Current anti-pattern (example with members):**
- `fetchPlayerDetails()` in `players.ts` - fetches specific fields for operator page
- `useMemberById()` in `useCurrentMember.ts` - fetches different fields
- Various inline fetches in components
- Each query has its own field list that drifts out of sync

**Solution:** For each entity type, create ONE canonical query that returns the full record every time.

**Proposed approach:**
1. For each entity, create a single `use[Entity](id)` hook that returns the complete record
2. Define canonical types with ALL fields for each entity
3. All components use these hooks - they just use the fields they need
4. Queries are cached by entity ID, so multiple components share the cache

**Benefits:**
- DRY - one query function per entity, one type per entity
- Consistent data shape everywhere
- Adding a new field = one place to update
- Better cache utilization (one cached record vs multiple partial records)
- Components never need to refetch because "this query doesn't have that field"
- Easier to reason about data flow

**Pattern to follow:**
```tsx
// One type per entity with ALL fields
interface Member { /* all fields */ }
interface Team { /* all fields */ }
interface League { /* all fields */ }
interface Season { /* all fields */ }
// etc.

// One hook per entity
const { data: member } = useMember(memberId);
const { data: team } = useTeam(teamId);
const { data: league } = useLeague(leagueId);
// etc.

// Components just use what they need
<div>{member.first_name}</div>
<div>{team.team_name}</div>
```

**Files to audit and consolidate:**
- `src/api/queries/*.ts` - all query files
- `src/api/hooks/*.ts` - all hook files
- Inline fetches scattered in components

**Priority order:**
1. Members (most fragmented currently)
2. Teams
3. Leagues/Seasons
4. Everything else

**Mutation strategy - always stay up to date:**

Every mutation should either:
1. **Optimistic updates** - Update the cache immediately, rollback on error
2. **Invalidate & refetch** - Invalidate the relevant query keys so data is refetched

Never leave stale data in the UI after a mutation. Pick the approach based on UX needs:
- Use optimistic for instant feedback (toggling, simple updates)
- Use invalidate for complex updates where server response matters

```tsx
// Option 1: Optimistic update
const mutation = useMutation({
  mutationFn: updateMember,
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['member', id] });
    const previous = queryClient.getQueryData(['member', id]);
    queryClient.setQueryData(['member', id], newData);
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['member', id], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['member', id] });
  },
});

// Option 2: Invalidate & refetch (simpler, always correct)
const mutation = useMutation({
  mutationFn: updateMember,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['member', id] });
    // Also invalidate any lists that include this entity
    queryClient.invalidateQueries({ queryKey: ['members'] });
  },
});
```

**Current problem areas:**
- Some mutations don't invalidate queries at all
- Some invalidate partial query keys but miss related queries
- No consistent pattern across the codebase

---

## 3. Fix Add Placeholder Player Modal in Team Editor

**Branch needed:** `fix-placeholder-modal`

**Problem:** The "Add Placeholder Player" modal in the Team Editor has usability issues:
1. The modal content is not scrollable - top and bottom are cut off
2. No explanation of what a placeholder player is or when to use one
3. Users can't access the full form on smaller screens

**Location:** Team Management page → Add Player → Add Placeholder Player modal

**Changes needed:**
1. Make modal content scrollable (add `overflow-y-auto` and `max-h-[80vh]` or similar)
2. Add InfoButton component with explanation at the top of the modal:
   - What is a placeholder player?
   - When should you use one vs inviting a real player?
   - What happens when a real player claims the placeholder?
3. Ensure modal has proper padding/margins so content isn't cut off

**Files to check:**
- Look for the Add Placeholder modal component in Team Management
- May be in `src/operator/TeamManagement.tsx` or a separate modal component
- Use existing `InfoButton` component from `@/components/InfoButton`

---

## Future Items

(Add more items here as needed)
