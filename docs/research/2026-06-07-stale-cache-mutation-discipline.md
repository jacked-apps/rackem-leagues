# Stale-Cache / Mutation Discipline — Findings + First-Slice Sizing

**Created:** 2026-06-07
**Status:** findings + sized first slice (members)
**Relates to:** LIST_FOR_ED #2 (consolidate queries) — this is the *cache-freshness* half of that effort; the #183 members consolidation was the *query-shape* half.

## Symptom

After a write (mutation), the UI keeps showing **stale data** — e.g. "mutate my name, but the old name sticks around in rosters/lists until a reload." Felt app-wide; the team reaches for `window.location.reload` to force freshness.

## Root cause — it is NOT missing invalidation

Quantitative read of the surface:
- **32** mutation files, **87** `useMutation` sites, **193** `invalidateQueries` calls, **14** `setQueryData` (optimistic) — so mutations *do* invalidate. Adding more is not the fix.
- **~8** real `window.location.reload`/`href` "sledgehammer" refreshes (symptoms).

The real disease is **denormalization**: the same data is cached in *many* places at once. A member's name lives in the `members` cache **and is embedded inside** non-member queries — **17 embeds across 7 query files**: `teams.ts` (`captain:members!captain_id(...)` + `team_players → members(*)`), `operators.ts`, `messages.ts`, `teamStats.ts`, `organizationStaff.ts`, `memberSearch.ts`, `leagueReupStatus.ts`.

So when you change a member, the member mutation hooks invalidate **only `members.*`** (verified — `useMemberMutations.ts` touches `members.all` / `members.byUser` and nothing else). The **embedded copies** of that member inside the teams/operators/messages caches are never refreshed → they stay stale. That's the bug class.

## Two fix strategies

- **(a) Normalize — durable fix.** Stop embedding mutable entity data in other queries; reference by **id** and read the one canonical source. This is the **`PlayerNameLink` pattern** (it reads the member by id via `useMemberById` instead of trusting an embedded name) and the same direction as the query consolidation. One source → invalidating it refreshes everywhere. Bigger refactor; kills the bug class.
- **(b) Broaden invalidation — band-aid.** Make the member mutation also invalidate `teams`, `operators`, `messages`, etc. Works, but blunt (over-refetches) and fragile (a new embedder added later silently breaks).
- **Recommended: hybrid.** High-churn *display* (player names) is already largely normalized via `PlayerNameLink` (read-by-id) — lean on that. For the remaining embedded reads / non-name fields, broaden the invalidation. Adopt a forward rule: *don't embed mutable entity data in another query — reference by id; every mutation invalidates the canonical key.*

## Approach — per-entity slices, highest-embed first

This is cross-cutting but sliceable. Do it one entity at a time; **members** and **teams** carry most of the *visible* staleness (names show everywhere). Each slice = (i) one canonical cached source, (ii) repoint embedded reads to read-by-id where freshness matters, (iii) confirm that entity's mutations invalidate the canonical key (or the embedders), (iv) delete that entity's sledgehammer reloads, (v) verify.

---

## SIZED FIRST SLICE — Members

**Already done (#183):** the member query/mutation *shape* is consolidated — one canonical `getMemberProfile` / `getMemberById` / `useMemberById`, redundant fetches removed, single patch mutation. So the canonical source exists; this slice is purely about **freshness**.

**Work:**
1. **Audit the stale surfaces** *(the real brain-work).* Which components render member data from an **embed** (not via `PlayerNameLink`/`useMemberById`)? Candidates from the 7 embedder queries: team rosters & captain cells (`teams.ts`), operator/staff lists (`operators.ts`, `organizationStaff.ts`), message participant names (`messages.ts`), `teamStats`, `memberSearch`, `leagueReupStatus`.
2. **Resolve each surface** (hybrid): names already through `PlayerNameLink` → already fresh, just verify; raw embedded names → swap to `PlayerNameLink`/read-by-id where cheap, else **broaden** the member mutations to invalidate that embedder's key.
3. **Broaden member-mutation invalidation** for the embedders we don't normalize — update the member mutation hooks in `useMemberMutations.ts` (currently `members.*` only) to also hit the relevant `teams`/`operators`/`messages` keys.
4. **Remove the 3 member-related sledgehammers**, replacing with proper invalidation + in-app navigation:
   - `src/completeProfile/useShortProfileSubmission.ts:138` (the onboarding hard-reload — ties to the join-flow smoothing).
   - `src/profile/PrivacySettingsSection.tsx:36` (`window.location.reload()`).
   - `src/newPlayer/usePlayerFormSubmission.ts:99` (`window.location.href = '/my-teams'` — comment admits it's there to "refresh the entire app state").
5. **Verify:** change a member's name → it updates in their profile, team roster, operator list, and message names **without a reload**; the three reloads are gone.

**Effort: MEDIUM — ~1–2 focused PRs.** The mechanical change is small (broaden a handful of invalidations, delete 3 reloads, swap a few reads). The *audit* (knowing every place member data is embedded + rendered) is the bulk of the effort; the recon above is most of it.

**One decision to make per surface:** normalize (read-by-id) vs broaden-invalidate. Default to the hybrid; only normalize where a surface is high-churn or a new embedder we don't want to keep chasing.

**Natural split:** PR1 = broaden member-mutation invalidations + verify freshness; PR2 = remove the 3 sledgehammers (PR2's `useShortProfileSubmission` doubles as the onboarding join-flow hard-reload fix).
