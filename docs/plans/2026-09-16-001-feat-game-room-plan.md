---
title: 'feat: Game Room — a generic, perishable, multi-phone room that games plug into'
type: feat
status: active
date: 2026-09-16
origin: docs/brainstorms/2026-09-16-game-room-requirements.md
---

# feat: Game Room — a generic, perishable, multi-phone room that games plug into

## Overview

A `rooms` row plus a `room_phones` row per phone, one realtime channel per
phone over a **table list stored on the room row**, and a small game
registry. Games bring their own tables; the room verifies them at creation,
listens to them by `room_id`, pokes one query key per table, and deletes
everything when the room dies. The first tenant is the two-phone coin flip,
with the face decided by the database so no phone can lean on it.

Ships **gated** (non-production) for staging review. No payment processor;
the shared-room door checks `members.role` until Ed's per-hat designations
table lands.

## Problem Frame

Two friends at a bar want the app to keep score while they play — a race, a
flip for the break, a round robin. Nothing counts toward stats. The league
scoring room is team-shaped and sacred; the coin flip runs on one phone only.
What's missing is the *container* — a place two or more phones can be in
together, where one phone's rows are seen by every other one — built so that
adding a game never touches it. (See origin.)

Decisions carried from the origin doc: games bring their own tables (not an
event log); every game table has `room_id` cascade + publication + full
replica identity; presence is rows with a heartbeat; seats derive from
members present × 4; one stored cell says shared or not; free = same room,
door shut; wipe on new game; the room is the future foundation for tournament
self-scoring (R4 is a fence, not a wall); first tenant = two-phone coin flip.

## Requirements Trace

(IDs from the origin doc.)

- R1 room row: host, game key, table list (cap 3, a dial), settings, shared
- R2 perishable; room-owned activity heartbeat; 24h sweep (a dial)
- R3 another game in the same room → wipe previous rows, rebuild channel
- R4 never feeds stats; fence not wall
- R5 free = not shared = no channel, otherwise identical
- R6 shared requires host gate; interim = `role in (league_operator, developer)`
- R7 free → shared in place
- R8–R10 seats: Game Room members × 4 − phones; derived; door-only
- R11 join by link/QR; guest = name only; member recognised
- R12 phones watching / empty seats; tap → QR + link
- R13 presence = `room_phones` row + heartbeat; stable per-room identity
- R14–R16 one channel per phone; `room_id` filter; invalidate
  `['room', roomId, table]`, all tables on catch-up
- R17 plug-in contract; creation-time table check
- R18 the room promises create/join/leave, who's here, the channel, the
  invalidation, the slots, the heartbeat, cleanup — nothing else
- R19 no room code change per game

Success criteria (origin): two-phone flip works with one server-decided face;
Ed's race then plugs in with zero room changes; free room opens no channel;
room A never hears room B; delete leaves no rows; league engine untouched.

## Scope Boundaries

- No games beyond the coin flip. Not the race, round robin, RPS.
- No charging. No per-member entitlements table (Ed's, separately).
- No history past the room's life. No push/notifications.
- No changes to `matches`, `match_games`, the scoring room, or stats.
- No RLS policies (pre-launch pass is separate); the RPCs are the boundary.
- No "challenge from profile" door.

### Deferred to Separate Tasks

- Ed's race as second tenant — Ed's other machine; plugs in after this lands.
- Per-hat designations table — Ed's other machine; swaps into the R6 gate.
- Enabling anonymous sign-ins on the **hosted** projects (staging, prod) is a
  dashboard setting, not a migration — a deploy-day step in LIST_FOR_ED.

## Context & Research

### Relevant Code and Patterns

- `src/realtime/useMatchRealtime.ts` — one channel, many `postgres_changes`
  bindings each filtered `x=eq.<id>`; `classifySubscribeEvent` →
  `live | reconnecting | error` + `catchUp`; callbacks in refs; deps
  `[matchId]` only; `isBindingMismatch` = terminal (table not published).
- `src/brackets/useBracketRealtime.ts` — bindings that all call
  `invalidateQueries(key)`. The room hook is this, generalised over a table
  list, plus the match hook's status/catch-up.
- `src/api/hooks/useBrackets.ts` `useBracketShare` — function-form
  `refetchInterval` (15 s) as a polling fallback beside realtime.
- Publication block (idempotent) + `REPLICA IDENTITY FULL`:
  `supabase/migrations/20260904160417_tournament_brackets.sql` lines 139–162.
  Header note: `supabase stop && supabase start` locally after publishing.
- Guest join precedent: `supabase/migrations/20260906181438_bracket_walkup_self_add.sql`
  (`add_self_as_walkup` — SECURITY DEFINER, anon-granted, returns
  `{ok, reason}` never raises), `20260905225243_bracket_join.sql`
  (`join_bracket_hopper` resolves `auth.uid()`), `get_bracket_player_view`
  (`{found:false}` for swept token). Page: `src/brackets/paid/JoinHopperPage.tsx`;
  URL: `src/brackets/paid/joinUrl.ts`; QR: `JoinQrPoster.tsx` (`qrcode.react`),
  `qrExport.ts`; guest-name memory: `walkupMemory.ts`.
- `bracket_hopper` (`20260905220235`) — the shape for `room_phones`.
- pg_cron: `supabase/migrations/20260611000000_auto_forfeit_sweep.sql`
  (function returns count; unschedule-then-schedule; keyed on state).
  Sweep test: `src/__tests__/database/brackets.sweep.db.test.ts`.
- Gating: `src/handicapCalculator/NonProdGate.tsx` (`isProduction`), doors in
  `src/components/layout/AppDrawer.tsx` + `AppSidebar.tsx` (`/brackets`).
- Role gate: `useIsOperator()` in `src/api/hooks/useUserProfile.ts` =
  `role === 'league_operator' || 'developer'` — exactly R6's interim check.
- Query keys: `src/api/queryKeys.ts` (`brackets` block as the template).
- Coin flip: `src/components/coinflip/CoinFlip.tsx` (props incl. `viewerId`,
  `callerId`, `flipperId`, `random`), `flipCoin.ts` (`resolveFlip(call, face,
  caller, other)` is pure and takes a supplied face), plan
  `docs/plans/2026-09-08-001-feat-coin-flip-component-plan.md` Unit 4.
- Tests: `src/__tests__/README.md`, `src/test/dbTestUtils.ts` (`executeSql`),
  `src/__tests__/database/bracket.join.db.test.ts` (RPC test shape),
  `brackets.schema.db.test.ts` lines 164–182 (publication + replica assert).

### Institutional Learnings

- Filtered UPDATE/DELETE silently drop without full replica identity + publication (bracket plan). Every table here gets both, in the same migration, and a db test asserts it.
- Anon-role realtime delivery is unproven; brackets ship a 15 s poll fallback. Room: anonymous sign-in makes guests `authenticated` (proven path) **and** keeps the poll fallback.
- Realtime never replays; catch-up refetch on re-SUBSCRIBED; don't tear down on transient CLOSED; all state data-derived.
- One filter per binding; heartbeat UPDATEs are noise — the phones binding must ignore heartbeat-only updates.
- happy-dom breaks supabase-js writes: db tests under `src/__tests__/database/` with the jsdom pragma; prefer `executeSql`.
- Real UTC migration timestamps; this branch runs parallel to Ed's other machine — the exact collision scenario. Run `scripts/check-migration-versions.sh` before every commit.
- Gate route + every door + the public join route together (2026-06-21 lesson).
- `pnpm run build` is the authoritative typecheck; `.select()` strings must be one literal.

## Key Technical Decisions

- **Guests get a Supabase anonymous session.** `enable_anonymous_sign_ins = true`
  in `supabase/config.toml`; the room's identity hook signs in anonymously
  when no session exists. Every phone then has an `auth.uid()`, all RPCs
  resolve identity one way (the `join_bracket_hopper` template), realtime
  runs as `authenticated` (the proven role), and the future RLS pass has
  something to key on. Guest sessions live in localStorage like any session.
  Rejected: raw anon-key writes with anon-granted RPCs — works today only
  because RLS is off, and leaves realtime delivery unproven.
- **The app must know a guest is not a member.** An anonymous session would
  otherwise make `isLoggedIn` true everywhere: the login page bounces, the
  drawer shows member links, member routes dump the guest into profile
  completion, and a real member who scans a QR on a cold phone gets turned
  into a guest before they can sign in. So: `UserProvider` exposes
  `isGuest` (`user.is_anonymous`) and `isLoggedIn` means *signed in and not
  anonymous*. `Login` renders for a guest and a real sign-in replaces the
  anonymous session (supabase-js does this natively). `ProtectedRoute`
  treats a guest as not logged in. The join page asks "Sign in" or "Continue
  as guest" **before** minting anything, and only reads the room (granted to
  `anon`, `{found:false}`-safe) until the guest commits. `useRoomIdentity`
  does nothing while `UserProvider.loading` is true. Leaving a room as a guest
  signs the anonymous session out. Anonymous `auth.users` older than 48 h
  are swept by the same cron (Supabase's own guidance).
- **Room routes are not member routes.** `/rooms/join/:token` and
  `/rooms/:id` are public routes outside `MemberLayout` (the
  `/brackets/join/:joinToken` precedent); the room page renders its own
  minimal chrome. Only `/rooms` (start / rejoin) is `withMember`. The RPCs
  are the boundary.
- **`room_phones` is the identity and the presence.** One row per
  (room, auth user), `UNIQUE(room_id, user_id)`; refresh = same row; a
  second device = a second row (phones, not people). `last_seen_at` is the
  heartbeat; present = seen within the grace window. The room row's
  `last_activity_at` is bumped by the same heartbeat RPC, so activity is
  room-owned (R2) and free rooms are never swept mid-play.
- **The heartbeat must not spam the channel — on either table.**
  `room_phones` UPDATEs where only `last_seen_at` changed, and `rooms`
  UPDATEs where only `last_activity_at` changed, are ignored client-side
  (old/new comparison — possible because replica identity is full; note in
  the hook and in PRE_LAUNCH_CHECKLIST that RLS narrows `old` to the primary
  key, which would silently undo this). `room_heartbeat` bumps
  `rooms.last_activity_at` only when it is older than 5 minutes, so the
  room-row write is rare to begin with. Row events invalidate `rooms.detail`
  **exactly**; prefix invalidation is reserved for subscribe. The phones
  query polls every 30 s to age out absent phones; the server returns
  `is_present` per phone (computed against server `now()`) so the list and
  the seat count never disagree on a phone with a skewed clock.
- **Table validation lives in `create_room` / `set_room_game`.** For each
  listed table: not a reserved room table (`rooms`, `room_phones` →
  `table_reserved`); exists in `public`; has a `room_id` column of type
  `uuid`; that column is a foreign key to `rooms` with `ON DELETE CASCADE`
  (`pg_constraint`: `contype='f'`, `confrelid = rooms`, `confdeltype='c'`);
  is in `supabase_realtime`; `relreplident = 'f'`; list length ≤ cap. Fails
  with `{ok:false, reason:'table_not_ready', table, missing}` naming what is
  wrong. This is also what makes the dynamic-SQL wipe safe: only names that
  passed validation are ever interpolated (schema-qualified, `format('%I')`),
  and the wipe reads the list from the *stored* row, re-validating the new
  list first so a rejected switch leaves the old game intact.
- **Wipe = delete by `room_id` from each listed table, then rebuild the
  channel.** Supabase channels cannot change bindings live; the hook's
  subscribe effect keys on `[roomId, shared, tableList.join()]`, and on
  rebuild it `removeQueries` the old table keys so a switch A→B→A never
  flashes pre-wipe rows from cache. `set_room_game` always wipes (it is a
  new game); `set_room_settings` changes settings **without** wiping, so a
  game can adjust a dial mid-play. Both are in the plug-in contract.
- **Host close = delete the room row.** Cascade removes phones and game
  rows; every other phone receives the DELETE on the published `rooms` row
  (published with full replica identity like everything else) and renders
  "this room has ended." That live DELETE is only the fast path: realtime
  never replays, so a phone that was asleep learns the same thing when
  `getRoom` (`maybeSingle`) comes back null on catch-up. The ended state is
  data-derived; `roomGone` just makes it instant. The sweep handles idle
  rooms only.
- **Game registry is a code-side map** (`gameKey → { name, tables, Setup,
  Play }`). Data-side later, same journey as scoring systems. The room reads
  the registry only to render; the *contract* is the table list on the row.
  **Acceptance boundary, stated precisely:** "the room" is `src/rooms/**`
  *except* `src/rooms/games/**`, plus the room RPCs. Adding a registry entry
  and a folder under `games/` is how a game plugs in; touching anything else
  is a room bug.
- **Query keys:** `rooms.all = ['room']`, `rooms.detail(id) = ['room', id]`,
  `rooms.phones(id) = ['room', id, 'room_phones']`,
  `rooms.table(id, t) = ['room', id, t]`. Prefix invalidation of `detail`
  therefore also refreshes every table key — intended on catch-up.
- **Server-decided flip.** `throw_room_coin(flip_id)` sets `face` from
  `random()` only if `call` is set and `face` is null, and only for the
  flipper phone. Both phones render from the row; `resolveFlip` consumes
  the stored face. `CoinFlip` gains a
  *controlled* path (`call`, `face`, `onCall`, `onThrow`); when those are
  absent it behaves exactly as today (existing 31 tests untouched).
- **Every SUBSCRIBED refetches, including the first.** A channel rebuild is
  a normal in-game transition here (game switch) with concurrent writes; a
  row inserted between the page's fetch and the new channel's SUBSCRIBED
  would be neither fetched nor delivered. One refetch per table per
  subscribe is trivial for tables this small, and it closes the gap.
- **Server-decided flip, and a frozen call.** The call goes through
  `call_room_coin(flip_id, call)`, which refuses once `face` is set or if
  the caller is not `caller_phone_id`; otherwise a caller could rewrite the
  call after seeing the face. Same RPC shape as the throw.
- **Polling fallback stays.** Room queries use a function-form
  `refetchInterval` (15 s while the room is open) as insurance, exactly like
  the public bracket page.

## Open Questions

### Resolved During Planning

- *Anon vs anonymous sign-in:* anonymous sign-in (above).
- *Per-phone identity:* `room_phones.id`, keyed by `auth.uid()`.
- *Activity signal:* heartbeat RPC bumps phone + room; games contribute nothing.
- *Sweep mechanism:* pg_cron hourly calling `sweep_stale_rooms(24)`.
- *Table cap enforcement:* in the RPC (a constant), not a DB CHECK — it's a dial.
- *Stale QR:* `get_room_by_token` returns `{found:false}` → "this room has ended."
- *Host closes mid-game:* rooms row DELETE reaches guests → same ended screen.
- *Settings slot size:* no cap now; it is game-owned and small; note in risks.
- *Which phone calls in the flip:* the phone that did not create the flip
  calls; the creator throws. Default only; the setup lets the creator flip it.
- *Room page chrome:* public route with its own minimal header; not under
  `MemberLayout`, so the tab bar / sidebar question does not arise.
- *Member on a second device:* joins as whatever that device's session is; a
  second anonymous device is a guest phone and does not add seats. Named in
  the seats copy, not special-cased.

### Deferred to Implementation

- Heartbeat interval and grace window (start 30 s / 120 s) — two constants,
  tuned once seen on a real phone that goes to sleep.
- Heartbeat room-row threshold (5 min) — a constant.
- Exact shape of the "waiting for X" copy in the controlled coin flip.
- Whether the join page needs the walk-up name memory (`walkupMemory.ts`
  pattern) — cheap; add if the sandbox shows re-typing is annoying.

## Output Structure

    supabase/migrations/
      <ts>_game_rooms.sql               rooms, room_phones, RPCs, publication
      <ts>_game_rooms_sweep.sql         sweep_stale_rooms + pg_cron
      <ts>_room_coin_flips.sql          first tenant table + throw RPC
    src/api/
      queries/rooms.ts                  getRoom, getRoomByToken, getRoomPhones
      mutations/rooms.ts                createRoom, joinRoom, heartbeat, setGame, setShared, closeRoom
      hooks/useRooms.ts                 TanStack wrappers
      queryKeys.ts                      + rooms block
    src/rooms/
      RoomsIndexPage.tsx                start a room / rejoin mine
      CreateRoomDialog.tsx              game picker, free/shared
      RoomPage.tsx                      the room: header, seats, game slot
      JoinRoomPage.tsx                  public /rooms/join/:token, name entry
      RoomEnded.tsx                     not-found / closed / swept
      SeatCounter.tsx                   "3 watching · 1 empty seat" (tap → invite)
      InviteSheet.tsx                   QR + copyable link
      PhoneList.tsx                     who's here
      useRoomIdentity.ts                ensure a session (anonymous if none)
      useRoomHeartbeat.ts               interval → room_heartbeat RPC
      useRoomRealtime.ts                channel over the table list
      games/types.ts                    GameDefinition contract
      games/registry.ts                 gameKey → definition
      games/coinflip/CoinFlipSetup.tsx  who calls (default), start
      games/coinflip/RoomCoinFlip.tsx   row → controlled <CoinFlip>
    src/components/coinflip/CoinFlip.tsx   + controlled call/face path
    src/__tests__/database/
      rooms.schema.db.test.ts, rooms.rpc.db.test.ts, rooms.sweep.db.test.ts,
      roomCoinFlips.db.test.ts

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for
> review, not implementation specification. The implementing agent should
> treat it as context, not code to reproduce.*

The room owns three things a game never sees: the phones, the channel, and
the wipe. A game owns three things the room never sees: its columns, its
screens, its rules.

```mermaid
sequenceDiagram
  participant H as Host phone
  participant DB as Postgres + Realtime
  participant G as Guest phone
  H->>DB: create_room(game, tables, settings, shared)  -- validates tables
  H->>DB: heartbeat every 30s (bumps phone + room)
  G->>DB: get_room_by_token(token) -> {found, room, seats}  -- no session needed
  G->>DB: "Continue as guest" -> sign in anonymously; join_room(token, name) -- FOR UPDATE + seat check
  DB-->>H: room_phones INSERT (room_id filter) -> invalidate ['room', id, 'room_phones']
  Note over H,G: game rows flow the same way, one key per listed table
  G->>DB: call_room_coin(flip_id, 'heads') -- refused after the throw
  DB-->>H: invalidate ['room', id, 'room_coin_flips']
  H->>DB: throw_room_coin(flip_id) -- server picks face
  DB-->>G: invalidate; both render resolveFlip(call, face)
  H->>DB: DELETE rooms -- cascade
  DB-->>G: rooms DELETE -> "this room has ended"
```

RPC surface (all SECURITY DEFINER, return `{ok, reason?}` rather than raise,
granted to `authenticated` — anonymous users are authenticated — except the
one read that must work before any sign-in):

| RPC | Who | Does |
|---|---|---|
| `create_room(game_key, tables[], settings, shared)` | signed-in member; shared needs host gate | validate tables; insert room + host phone row |
| `get_room_by_token(token)` | anyone, incl. `anon` (column-projected, `{found:false}`-safe) | room + derived seats, before any sign-in |
| `join_room(token, display_name)` | anyone signed in | `not_shared` on a free room; lock the room row (`FOR UPDATE`); seat check; upsert phone row (member flag from gate) |
| `room_heartbeat(room_id)` | a phone in the room | bump `last_seen_at` + `rooms.last_activity_at` |
| `set_room_game(room_id, game_key, tables[], settings)` | host | validate; wipe old tables by room_id; update row |
| `set_room_settings(room_id, settings)` | host | update settings; no wipe |
| `set_room_shared(room_id)` | host, host gate | flip the cell |
| `close_room(room_id)` | host | delete the row (cascade) |
| `sweep_stale_rooms(idle_hours)` | pg_cron | delete idle rooms + anonymous auth users older than 48 h; returns count |
| `call_room_coin(flip_id, call)` | the caller phone | set call once, refused after the throw |
| `throw_room_coin(flip_id)` | the flipper phone | set face from `random()` once |

## Implementation Units

### Phase A — the room's database

- [ ] **Unit 1: Rooms schema, RPCs, and realtime publication**

**Goal:** The room exists as data, with every door and the table-validation
check enforced in the database.

**Requirements:** R1, R3, R4, R6, R7, R8–R11, R13, R17

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/<real-utc-ts>_game_rooms.sql`
- Modify: `supabase/config.toml` (`enable_anonymous_sign_ins = true`)
- Modify: `src/types/database.types.ts` (regenerate)
- Test: `src/__tests__/database/rooms.schema.db.test.ts`
- Test: `src/__tests__/database/rooms.rpc.db.test.ts`

**Approach:**
- `rooms`: id, host_member_id (FK members, cascade), game_key text,
  game_tables text[] (validated, cap constant), settings jsonb default '{}',
  shared boolean default false, join_token uuid default gen_random_uuid()
  unique, last_activity_at, created_at.
- `room_phones`: id, room_id (FK rooms cascade), user_id uuid (auth user,
  anonymous or not), member_id nullable (FK members), display_name,
  is_member boolean (the R6 gate evaluated at join), last_seen_at, joined_at;
  `UNIQUE(room_id, user_id)`.
- Both tables: publication block + `REPLICA IDENTITY FULL`, header note
  about restarting the local realtime container.
- A private validation function used by `create_room` and `set_room_game`:
  each name must be a real public table with a `room_id` column, in
  `supabase_realtime`, with `relreplident = 'f'`; count ≤ cap. Returns the
  offending table name so the error is specific.
- Seat math lives in one SQL function `room_seats(room_id)` → present
  phones, present members, open seats — used by `join_room` and returned by
  `get_room_by_token` so client and server never disagree.
- `join_room` on an existing (room, user) row just refreshes name/last_seen
  (rejoin is not a new phone). It refuses a free room (`not_shared`), locks
  the room row `FOR UPDATE` so two phones cannot both take the last seat,
  and a full room returns `{ok:false, reason:'full', hint:'another member
  joining opens more'}`.
- `room_heartbeat` bumps the phone row every call and the room row only
  when `last_activity_at` is more than 5 minutes old.
- `get_room_by_token` and `room_seats` return `is_present` per phone,
  computed server-side.
- Host gate inside `create_room(shared=true)` and `set_room_shared`: caller's
  `members.role in ('league_operator','developer')`, returned as
  `reason:'not_a_host'`. One place to swap when the designations table lands.
- Revoke EXECUTE from `anon`/PUBLIC on every RPC and grant `authenticated`
  — except `get_room_by_token`, granted to `anon` too (the
  `get_bracket_share` shape), so scanning a dead poster never mints a user.
- Migration header explains anonymous sign-in and the deploy-day dashboard
  step for hosted projects.

**Execution note:** Write the schema test (publication + replica identity +
cascade) before the RPC tests; it is the thing the whole design leans on.

**Patterns to follow:**
- `20260904160417_tournament_brackets.sql` (publication block, `{found:false}`
  read, revoke/grant), `20260905225243_bracket_join.sql` (`auth.uid()` → member),
  `20260905220235_bracket_hopper_roster.sql` (`bracket_hopper` shape).

**Test scenarios:**
- Happy path: both tables are in `pg_publication_tables` and have `relreplident = 'f'`.
- Happy path: `create_room` with a valid table list returns ok and creates the host's phone row with `is_member` true for an LO.
- Happy path: `join_room` with a fresh token + name inserts a phone row; a second call from the same user updates it, does not duplicate.
- Happy path: `get_room_by_token` returns `{found:true}` with derived seats matching `room_seats`.
- Edge case: a player-role host can create a free room but `create_room(shared=true)` → `not_a_host`; `set_room_shared` likewise.
- Edge case: seats — one member present → 4 phones fit, the 5th `join_room` → `full`; a second member joining raises capacity to 8.
- Edge case: a phone whose `last_seen_at` is older than the grace window is not counted as present by `room_seats`.
- Edge case: `create_room` with 4 tables → `too_many_tables`; with a table lacking `room_id`, or `room_id` not uuid, or no cascade FK to rooms, or not published, or not full-replica → `table_not_ready` naming the table and what is missing; with `room_phones` listed → `table_reserved`.
- Edge case: `join_room` on a free room → `not_shared`.
- Edge case: `room_heartbeat` twice within a minute updates the phone row twice and the room row once.
- Edge case: `set_room_settings` changes settings and leaves every game-table row in place.
- Edge case: `get_room_by_token` works with `auth.uid()` null (executeSql runs as postgres) and returns `{found:false}` for a swept token.
- Edge case: `set_room_game` deletes the previous game's rows by `room_id` from each old listed table (fixture: a published test table with `room_id` + cascade FK) and leaves other rooms' rows alone; a switch to an invalid list is refused and the old rows survive.
- Error path: `join_room` with an unknown token → `not_found`; `close_room` by a non-host → `not_host`.
- Integration: deleting a room removes its phone rows and rows in a listed game table (cascade), leaving zero orphans.

**Verification:**
- The db project is green; `pnpm run build` passes with regenerated types.
- `scripts/check-migration-versions.sh` reports no duplicates.

---

- [ ] **Unit 2: Idle sweep via pg_cron**

**Goal:** Rooms nobody has touched for a day disappear on their own.

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**
- Create: `supabase/migrations/<real-utc-ts>_game_rooms_sweep.sql`
- Test: `src/__tests__/database/rooms.sweep.db.test.ts`

**Approach:**
- `sweep_stale_rooms(p_idle_hours integer default 24)` deletes rooms whose
  `last_activity_at` is older than the window, then deletes anonymous
  `auth.users` (`is_anonymous`) older than 48 h that no phone row still
  references; returns the room count. Keyed on state, so a skipped run
  self-heals.
- Hourly `cron.schedule('game-room-sweep', …)` after a guarded unschedule.
- Revoke from anon/PUBLIC.

**Patterns to follow:**
- `20260611000000_auto_forfeit_sweep.sql`, `brackets.sweep.db.test.ts`.

**Test scenarios:**
- Happy path: a room with `last_activity_at` 25 h ago is deleted; count = 1.
- Happy path: a room heartbeated 1 h ago survives.
- Edge case: a swept room's phone rows and game-table rows are gone (cascade); other rooms untouched.
- Edge case: calling the sweep twice is idempotent (second returns 0).
- Happy path: an anonymous auth user created 3 days ago with no phone row is deleted; one created an hour ago survives; one still referenced by a live room survives.

**Verification:**
- `cron.job` contains exactly one `game-room-sweep` entry after re-applying the migration.
- Confirm on hosted staging that the existing auto-forfeit cron actually runs (pg_cron enabled there); the room sweep inherits the same footing. Note the result in LIST_FOR_ED.

### Phase B — the room in the browser

- [ ] **Unit 3: Data layer and identity**

**Goal:** Typed queries, mutations, hooks, and a hook that guarantees every
phone has a session before it touches a room.

**Requirements:** R11, R13, R16

**Dependencies:** Unit 1

**Files:**
- Create: `src/api/queries/rooms.ts`, `src/api/mutations/rooms.ts`,
  `src/api/hooks/useRooms.ts`, `src/rooms/useRoomIdentity.ts`,
  `src/rooms/useRoomHeartbeat.ts`
- Modify: `src/api/queryKeys.ts` (rooms block), `src/api/hooks/index.ts`,
  `src/context/UserProvider.tsx` (`isGuest`; `isLoggedIn` excludes
  anonymous), `src/login/Login.tsx` (no bounce for a guest),
  `src/components/ProtectedRoute.tsx` (guest = not logged in)
- Test: the nearest existing auth/provider test, `src/components/ProtectedRoute.test.tsx`
- Test: `src/api/hooks/useRooms.test.ts` (mocked supabase),
  `src/rooms/useRoomIdentity.test.ts`, `src/rooms/useRoomHeartbeat.test.ts`

**Approach:**
- Queries throw on transport errors and return typed rows (`Tables<'rooms'>`).
  RPC results cast to local `{ ok, reason }` unions, as in
  `src/api/mutations/brackets.ts`.
- `useRoomIdentity({ wanted })`: waits for `UserProvider.loading` to be
  false; if there is no session and the caller has asked for a guest
  session (`wanted` — set only when the user taps "Continue as guest"),
  calls `supabase.auth.signInAnonymously()` once (ref-guarded); exposes
  `{ userId, isGuest, ready, leaveAsGuest }`. Members are untouched;
  `leaveAsGuest` signs an anonymous session out.
- `getRoom` uses `maybeSingle` and returns null for a missing room — that
  null *is* the ended state.
- `useRoomHeartbeat(roomId, enabled)`: interval → `room_heartbeat`; pauses
  when the tab is hidden and fires once on visibility return. Errors swallowed
  (a missed heartbeat is not a failure).
- Room queries carry a function-form `refetchInterval` (15 s while open) as
  the polling fallback; the phones query 30 s.

**Patterns to follow:**
- `src/api/hooks/useBrackets.ts` (`useBracketShare` polling), `src/api/queryKeys.ts` brackets block.

**Test scenarios:**
- Happy path: `useRoomIdentity` with an existing session never calls `signInAnonymously`; with none and `wanted` it calls it exactly once and reports `isGuest`.
- Edge case: with `loading=true` and a session arriving afterwards, `signInAnonymously` is never called.
- Edge case: without `wanted`, no session is ever created (reading a room stays anonymous-role).
- Happy path: `isLoggedIn` is false and `isGuest` true for an anonymous session; `Login` renders its form for a guest; `ProtectedRoute` sends a guest to login on a member route.
- Happy path: `getRoom` for a deleted id resolves to null, not an error.
- Happy path: `useRoomHeartbeat` fires on mount then every interval while enabled; stops on unmount.
- Edge case: heartbeat pauses on `visibilitychange` hidden and fires immediately on visible.
- Error path: a failing heartbeat RPC logs and does not throw or stop the interval.
- Happy path: `useJoinRoom` success invalidates `rooms.detail(id)` (prefix covers tables).

**Verification:**
- Hooks compile against regenerated types; unit project green.

---

- [ ] **Unit 4: The room realtime hook**

**Goal:** One channel per phone over the room's table list, invalidating one
key per table, hardened like the scoring room's hook.

**Requirements:** R5, R14, R15, R16

**Dependencies:** Unit 3

**Files:**
- Create: `src/rooms/useRoomRealtime.ts`
- Test: `src/rooms/useRoomRealtime.test.ts`

**Approach:**
- Signature: `useRoomRealtime({ roomId, shared, tables })` → `{ connectionStatus }`.
- When `shared` is false: no channel, status `'live'` (nothing to hear).
- Bindings: `rooms` (`id=eq.`) → invalidate `rooms.detail` **exactly**,
  unless the event is an UPDATE whose only changed column is
  `last_activity_at`; `room_phones` (`room_id=eq.`) → invalidate
  `rooms.phones` unless the only changed column is `last_seen_at`; each
  listed table (`room_id=eq.`) → invalidate `rooms.table(roomId, table)`.
  The old/new comparison relies on full replica identity with RLS off —
  comment it in the hook.
- A `rooms` DELETE sets a `roomGone` flag the page reads to render the ended
  state without waiting for a refetch to 404.
- Reuse `classifySubscribeEvent` / `RealtimeConnectionStatus` from
  `src/realtime/useMatchRealtime.ts` for status; but invalidate the
  `rooms.detail` prefix (everything) on **every** SUBSCRIBED, first
  included — a rebuild is a normal in-game transition here.
- Effect deps: `[roomId, shared, tables.join(',')]`; callbacks in refs.
  Changing the table list tears down, `removeQueries` the old table keys,
  and rebuilds (R3).

**Execution note:** Test-first against a mocked `supabase.channel` — the
`useMatchRealtime.test.ts` harness is the template.

**Patterns to follow:**
- `src/realtime/useMatchRealtime.ts`, `src/brackets/useBracketRealtime.ts`,
  `src/realtime/useMatchRealtime.test.ts`.

**Test scenarios:**
- Happy path: with tables `['room_coin_flips']`, the channel has exactly three bindings (rooms, room_phones, room_coin_flips), each with the right filter.
- Happy path: an INSERT on a listed table invalidates `['room', id, 'room_coin_flips']` and nothing else.
- Happy path: a `room_phones` INSERT invalidates the phones key; an UPDATE changing only `last_seen_at` invalidates nothing; an UPDATE changing `display_name` invalidates.
- Happy path: a `rooms` UPDATE changing only `last_activity_at` invalidates nothing; one changing `settings` invalidates `rooms.detail` exactly (table keys untouched).
- Happy path: a `rooms` DELETE sets `roomGone`.
- Edge case: `shared=false` opens no channel and reports `live`.
- Edge case: changing `tables` removes the old channel, removes the old table keys from the cache, and subscribes a new one.
- Edge case: every SUBSCRIBED — the first, and one after a CLOSED — invalidates the `rooms.detail` prefix.
- Error path: a binding-mismatch CHANNEL_ERROR reports `error` and does not resubscribe.
- Edge case: unmount removes the channel exactly once.

**Verification:**
- Two browser tabs on the sandbox see each other's joins within a beat; a free room shows no websocket in devtools.

---

- [ ] **Unit 5: Room screens and the game registry**

**Goal:** Create, join, see who's here, invite, and hand the game slot to
whichever game the room row names.

**Requirements:** R1, R3, R5, R7, R11, R12, R18

**Dependencies:** Units 3, 4

**Files:**
- Create: `src/rooms/RoomsIndexPage.tsx`, `CreateRoomDialog.tsx`,
  `RoomPage.tsx`, `JoinRoomPage.tsx`, `RoomEnded.tsx`, `SeatCounter.tsx`,
  `InviteSheet.tsx`, `PhoneList.tsx`, `RoomChrome.tsx` (minimal header for
  the public room page), `games/types.ts`, `games/registry.ts`
- Modify: `src/navigation/NavRoutes.tsx` (routes, gated — see Unit 7)
- Test: `src/rooms/RoomPage.test.tsx`, `JoinRoomPage.test.tsx`,
  `SeatCounter.test.tsx`, `games/registry.test.ts`

**Approach:**
- `GameDefinition = { key, name, tables, Setup, Play }` — `Setup` writes
  settings via `set_room_game`; `Play` receives `{ roomId, myPhone, phones,
  settings }` and owns everything else. The registry is the only place the
  room reads game names.
- `RoomPage`: header (game name, connection status text), `SeatCounter`,
  `PhoneList`, the game slot. Host-only controls: switch game, open the door
  (free → shared), close room. Guests see none of them.
- `JoinRoomPage` (public route): `get_room_by_token` first (works with no
  session) → if signed-in member: name from profile, join; if no session:
  two buttons, "Sign in" (to `/login?redirect=` back here) and "Continue as
  guest" (name entry → `useRoomIdentity({wanted:true})` → `join_room`) →
  navigate into the room. `{found:false}`, `not_shared` and `full` render
  in-page notices, never errors. Ended/closed → `RoomEnded`.
- `RoomPage` (public route, own chrome): renders `RoomEnded` whenever the
  room query resolves to null or `roomGone` fires; a guest's "Leave" calls
  `leaveAsGuest`.
- `SeatCounter` renders "N watching · M empty seats" as text; tapping opens
  `InviteSheet` (QR via `qrcode.react` + copyable link, `joinUrl` pattern).
  Zero seats → the explanatory copy from R12. On a free room it reads "1
  phone · open the door to invite" and the tap offers the door (host) or
  nothing (guest).
- `RoomsIndexPage`: "Start a room" (any member; the shared toggle disabled
  with a note unless `useIsOperator()`), plus "rooms I'm in" (phone rows for
  my user). Doors gated per Unit 7.
- Colour never carries meaning alone: present/absent phones get a text
  label; connection status is text.
- shadcn `Button`, `Card`, `Dialog`, `Sheet`, `Input`, `Label` only. Keep
  each file near ~100 lines; split before it grows.

**Patterns to follow:**
- `src/brackets/paid/JoinHopperPage.tsx` (public join, notices),
  `JoinQrPoster.tsx` (QR), `src/components/InfoButton.tsx` (tooltips).

**Test scenarios:**
- Happy path: `RoomPage` renders the game named by the row via the registry; an unknown key renders a plain "unknown game" notice, not a crash.
- Happy path: `SeatCounter` shows "3 watching · 1 empty seat"; tapping opens the invite sheet with the join URL for the room's token.
- Happy path: `JoinRoomPage` for a guest shows the name field; submitting calls `join_room` and navigates.
- Edge case: a signed-in member skips the name field.
- Edge case: `{found:false}` → "this room has ended" notice; `full` → seat explanation with the members-open-more hint.
- Edge case: host controls render only for the host phone.
- Edge case: `roomGone` from the realtime hook flips the page to `RoomEnded` without a refetch; a room query resolving to null does the same.
- Edge case: `JoinRoomPage` with no session shows "Sign in" and "Continue as guest"; a guest is only signed in anonymously after tapping the latter.
- Edge case: `SeatCounter` on a free room shows the door copy, not the QR.
- Integration: switching games via `CreateRoomDialog` on an existing room calls `set_room_game` with the registry's table list for the new game.

**Verification:**
- Two devices on the sandbox: host creates a shared room, guest scans the QR, name in, both see "2 watching"; host closes, guest sees ended.

### Phase C — the first tenant

- [ ] **Unit 6: Two-phone coin flip**

**Goal:** One phone calls, the other throws, the database picks the face,
both phones watch the same coin land.

**Requirements:** success criterion 1; origin games appendix (server-decided
flip; controlled seam)

**Dependencies:** Units 1, 3, 5

**Files:**
- Create: `supabase/migrations/<real-utc-ts>_room_coin_flips.sql`
- Modify: `src/components/coinflip/CoinFlip.tsx` (controlled path),
  `src/components/coinflip/CoinFlip.test.tsx`
- Create: `src/rooms/games/coinflip/CoinFlipSetup.tsx`,
  `src/rooms/games/coinflip/RoomCoinFlip.tsx`
- Modify: `src/rooms/games/registry.ts` (register `coin_flip`),
  `src/api/mutations/rooms.ts` (`throwRoomCoin`), `src/api/queries/rooms.ts`
- Test: `src/__tests__/database/roomCoinFlips.db.test.ts`,
  `src/rooms/games/coinflip/RoomCoinFlip.test.tsx`

**Approach:**
- `room_coin_flips`: id, room_id (cascade), caller_phone_id, flipper_phone_id
  (FK room_phones cascade), call text null, face text null, thrown_at,
  created_at. Published + full replica identity. Check constraints on the
  two-value columns.
- `call_room_coin(flip_id, call)`: caller must be the caller phone; refused
  once `face` is set (`already_thrown`). `throw_room_coin(flip_id)`: caller
  must be the flipper phone; requires `call` set and `face` null; sets
  `face` from `random()` and `thrown_at`. Both return `{ok, reason}`. The
  two RPCs are the trust boundary; nothing about the flip is a plain update.
- `CoinFlip` controlled path: optional `call`, `face`, `onCall`, `onThrow`.
  When `face` is supplied the coin animates to it and `resolveFlip` uses it;
  the internal `tossCoin` is never consulted. When none are supplied,
  behaviour is unchanged. Phase is derived: no call → calling; call, no face
  → called; face → flipping then result.
- `RoomCoinFlip`: reads the latest flip row for the room; maps my phone to
  `viewerId`; wires `onCall` → update, `onThrow` → RPC. "Flip again" creates
  a new row (history is fine; it dies with the room).
- `CoinFlipSetup`: who calls (default: the phone that is not me), start.

**Patterns to follow:**
- `docs/plans/2026-09-08-001-feat-coin-flip-component-plan.md` Unit 4
  (the cut seam), `flipCoin.ts` `resolveFlip`.

**Test scenarios:**
- Happy path (db): `throw_room_coin` sets a face of heads or tails exactly once; a second call → `already_thrown`.
- Edge case (db): throw before a call → `no_call`; throw by the caller phone → `not_flipper`; a call by the flipper phone → `not_caller`; a call after the face exists → `already_thrown` and the stored call is unchanged.
- Edge case (db): the table is published with full replica identity; deleting the room removes flips.
- Happy path (component): with `call='heads'` and `face='heads'` supplied, the caller is announced winner by name; with `face='tails'`, the other.
- Edge case (component): with a supplied face, the injected `random` is never called.
- Edge case (component): with no controlled props, all existing tests pass untouched.
- Happy path (component): `viewerId` = caller renders heads/tails buttons and, after calling, "waiting for X to throw"; `viewerId` = flipper renders only the throw control once a call exists.
- Integration (component): `RoomCoinFlip` with a row lacking a call shows the caller's choice; after `onCall`, the flipper's throw; after the row gains a face, both render the same winner.
- Edge case: the random-source distribution test in `flipCoin.test.ts` is untouched — the pure module does not change.

**Verification:**
- Two phones on staging: one calls, the other throws, both see the same face and winner; refreshing either phone shows the same result.

### Phase D — gate, doors, docs

- [ ] **Unit 7: Gating, entry points, and documentation**

**Goal:** Reachable on dev + staging, invisible in production, and findable
in the indexes.

**Requirements:** R5–R7 (doors), success criterion "league engine untouched"

**Dependencies:** Units 5, 6

**Files:**
- Modify: `src/navigation/NavRoutes.tsx` (`/rooms` withMember; `/rooms/:id`
  and `/rooms/join/:token` public, outside `MemberLayout`; all under
  `NonProdGate`), `src/components/layout/AppDrawer.tsx`,
  `src/components/layout/AppSidebar.tsx` (Game Room link, same gate; both
  already hide for a guest once `isLoggedIn` excludes anonymous)
- Modify: `LIST_FOR_ED.md` (gated section: route + every door + the
  anonymous-sign-in dashboard step + the 30/hour/IP anonymous rate limit as
  a dial + confirm pg_cron runs on hosted + what to verify),
  `TABLE_OF_CONTENTS.md`,
  `src/components/COMPONENTS_INDEX.md` (CoinFlip controlled props, room
  components), `PRE_LAUNCH_CHECKLIST.md` (new anonymous-user paths)
- Delete: `src/dev/CoinFlipSandbox.tsx` + its route (a real caller now mounts
  CoinFlip — its header says to delete it)
- Test: `src/navigation/roomsGate.test.tsx`

**Approach:**
- One condition (`!isProduction`) on the routes and both nav doors; a test
  asserts they hide together.

**Test scenarios:**
- Happy path: with `isProduction=false`, `/rooms` and `/rooms/join/x` resolve and the nav link renders.
- Edge case: with `isProduction=true`, the routes redirect and neither nav link renders.
- Happy path: an anonymous session reaches `/rooms/:id` without a redirect; a guest on `/rooms` is sent to login.

**Verification:**
- Production build shows no Game Room door; staging shows all of them.
- TOC "Last Updated" and every new file listed; migration version check clean.

## System-Wide Impact

- **Interaction graph:** New routes, two nav links, a config flag, and one
  deliberate change to shared auth plumbing: `UserProvider.isLoggedIn` now
  excludes anonymous sessions and `ProtectedRoute`/`Login` read `isGuest`.
  Nothing existing imports from `src/rooms/`. `CoinFlip` gains optional
  props only.
- **Error propagation:** RPCs return `{ok:false, reason}`; pages phrase
  reasons; realtime errors surface as text status; heartbeat failures are
  swallowed.
- **State lifecycle risks:** cascade on `rooms` is the only cleanup path —
  every game table must FK to it (validated at creation). Channel rebuild on
  game switch; the old game's rows are wiped first so no stale key survives.
- **API surface parity:** no mobile app today; Jack mirrors the RPC surface
  table above.
- **Integration coverage:** cascade-leaves-no-orphans and publication/replica
  assertions are db tests, not mocks; the two-device flow is a staging check.
- **Unchanged invariants:** `matches`, `match_games`, `game_confirmations`,
  `useMatchRealtime`, the scoring room, stats — untouched. `CoinFlip`'s
  uncontrolled path and `flipCoin.ts` — byte-identical. `members.role` —
  read, not written. For a real (non-anonymous) session, `isLoggedIn` and
  every route guard behave exactly as today.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Anonymous sign-in not enabled on hosted staging/prod → guests cannot join | Deploy-day step in LIST_FOR_ED; `useRoomIdentity` surfaces a plain "guest sign-in unavailable" notice instead of a blank page |
| A game table forgets publication/replica → deletes never sync | `create_room` refuses the table by name; db schema test per table |
| Heartbeat writes flood the channel | Both bindings ignore timestamp-only updates; room row bumped at most every 5 min; row events invalidate exactly, prefix only on subscribe |
| An anonymous session makes the app think a guest is a member | `isLoggedIn` excludes anonymous; Login/ProtectedRoute/nav read it; join page offers sign-in before minting a guest; guests sign out on leave; stale anonymous users swept |
| A sleeping phone misses the room DELETE | Ended state is data-derived (`getRoom` null); `roomGone` is only the fast path |
| Two guests take the last seat at once | `join_room` locks the room row `FOR UPDATE` |
| Enabling RLS later narrows `old` payloads and turns heartbeats back into invalidations | Comment in the hook + PRE_LAUNCH_CHECKLIST line |
| Migration version collision with Ed's parallel branch | Real UTC timestamps; `scripts/check-migration-versions.sh` before every commit |
| Two phones toss their own coin | The face exists only in the row, written by the RPC; the component's controlled path never calls `tossCoin` |
| Settings jsonb grows and every phone refetches it on room-row events | Game-owned and small by contract; noted, not capped; revisit if a game abuses it |
| Local realtime container doesn't see new tables | Migration headers say `supabase stop && supabase start`; the terminal binding-mismatch status makes it visible |

## Documentation / Operational Notes

- Ships gated (`!isProduction`) with a LIST_FOR_ED entry listing route, both
  nav doors, the public join route, and the anonymous-sign-in dashboard step.
- `pnpm run db:types` after each migration; `pnpm run build` is the
  authoritative typecheck.
- Ed's race plugs in afterwards as its own migration, a folder under
  `src/rooms/games/`, and a registry entry; if it needs any change outside
  `src/rooms/games/**` or to the room RPCs, that is a room bug.
- Jack's mobile mirror must use anonymous sign-in for guests too — the RPC
  grants make it a requirement, not a preference.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-09-16-game-room-requirements.md`
- Superseded brainstorm: `docs/brainstorms/2026-09-10-game-room-requirements.md`
- Coin flip plan: `docs/plans/2026-09-08-001-feat-coin-flip-component-plan.md`
- Self-scoring primer: `docs/brainstorms/2026-09-08-self-scoring-primer.md`
- Realtime: `src/realtime/useMatchRealtime.ts`, `src/brackets/useBracketRealtime.ts`
- Join/QR: `src/brackets/paid/JoinHopperPage.tsx`, `joinUrl.ts`, `JoinQrPoster.tsx`
- Migrations: `20260904160417_tournament_brackets.sql`, `20260906181438_bracket_walkup_self_add.sql`, `20260611000000_auto_forfeit_sweep.sql`
- Related PRs: #279 (coin flip), #275 (tournament paid foundation)
