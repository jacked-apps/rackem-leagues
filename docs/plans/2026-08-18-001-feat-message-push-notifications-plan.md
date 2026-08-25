---
title: "feat: Message Push Notifications (v1 loud-first Web Push)"
type: feat
status: active
date: 2026-08-18
origin: docs/brainstorms/2026-08-18-message-push-notifications-requirements.md
deepened: 2026-08-18
---

# feat: Message Push Notifications (v1 loud-first Web Push)

## Overview

Deliver Web Push notifications so a new message produces a phone/desktop chime **even when the app is
closed or backgrounded**, and tapping it jumps straight to that conversation. v1 pushes on **personal
DMs and manual group chats only** (the `auto_managed = false` conversations), honoring an explicit
per-chat mute + a global on/off. The auto-created team/captain/announcement channels stay quiet for now.
Critically, **which conversation kinds push is data-driven** (a tiny policy table), so later phases turn
more on by flipping a row — and the eventual per-user notification console writes the `notification_mode`
column that already exists. We build the full two-layer structure now and light it up incrementally.
The delivery pipeline is greenfield — no subscriptions table, VAPID keys, custom service worker,
deep-link route, or dispatcher exist yet — but every piece follows an established repo or industry pattern.

> **This plan was hardened after a 5-persona review** (coherence, feasibility, scope, security,
> adversarial). Schema facts below were re-verified against the real migrations; several "settled"
> details in the first draft were wrong and are corrected here.

## Problem Frame

Messaging Phase 1 shipped (auto team/captain/announcement chats, mute, in-app unread badges). Users are
now using it and have asked for "a chime when someone messages me." Today a new message is only knowable
via an in-app badge while the app is focused (`src/api/hooks/useMessagingRealtime.ts`) — there is no way
to reach a device that isn't actively open, so coordination leaks back to SMS. (see origin:
docs/brainstorms/2026-08-18-message-push-notifications-requirements.md)

## Requirements Trace

Each requirement lists the unit that **implements** it (others may scaffold).

- R1. A subscribed user gets an OS notification for a new message even with the app closed — *impl: Unit 7 (dispatch) + Unit 4 (SW); scaffolded by Units 1, 2, 5.*
- R2. Tapping the notification opens/focuses the app **at that conversation** on every platform — *impl: Unit 3 (deep-link route) + Unit 4 (SW notificationclick); URL built in Unit 7.*
- R3. Recipient selection is "loud" within enabled kinds: all non-sender active participants of a
  push-enabled conversation kind, minus explicit mute, minus a global off — *impl: Unit 7 (predicate) +
  Unit 1 (`push_type_policy` seeded to `direct` only); per-user `notification_mode` = the future console.*
- R4. A global per-user on/off exists, independent of the browser permission — *impl: Unit 1 (`members.push_enabled`) + Unit 6 (UI).*
- R5. iOS not-installed state is handled with an "Add to Home Screen" nudge, never a silent no-op — *impl: Unit 5 (detect) + Unit 6 (UI).*
- R6. Notification preview text respects the **recipient's** profanity-filter preference — *impl: Unit 7 (with a safe fallback if the filter can't run in Deno).*
- R7. Forward-compat for v2 reply-from-notification is banked at ~zero cost: `conversation_id` in payload, `push_subscriptions` maps endpoint→member server-side, one custom SW, deep-link route, server-side send path stays reachable — *impl: Units 1, 3, 4, 7.*

## Scope Boundaries

- **Non-goal:** rate-limiting, quiet hours, notification-pause picker, live-match bypass (origin §1).
- **Non-goal:** `@mention`-based routing (mentions aren't built), email notifications.
- **Non-goal:** notification action buttons / inline reply in v1 (unsupported on iOS; Android build is v2).
- **Non-goal:** presence-aware suppression beyond the cheap SW-side "don't buzz the chat you're staring at"
  guard (Unit 4). Full cross-device presence is out of scope.
- **Accepted by design:** multi-device fan-out — a user subscribed on phone + tablet + laptop gets the
  chime on all three. Intentional, not a bug.

### Deferred to Separate Tasks

- **v2 notification preferences panel** (per-chat + frequency controls): future PR. The
  `conversation_participants.notification_mode` tri-state already backs it.
- **v2 Android/desktop reply-from-notification**: future PR. This plan only banks the cheap forward-compat (R7).

## Context & Research

### Relevant Code and Patterns (re-verified)

- **Edge Function template:** `supabase/functions/send-invite/index.ts` (Deno v2, `Deno.env.get`,
  service-role admin client, CORS + OPTIONS, `withTimeout()` helper). No `_shared/` folder exists.
- **Edge Function config:** each function needs a `[functions.<name>] verify_jwt = false` block in
  `supabase/config.toml` (server-invoked, no user JWT). A comment there records this "bit us 2026-06-21."
- **Message schema (verified):** `messages` gained `is_system boolean NOT NULL DEFAULT false` and a
  **nullable** `sender_id` in `supabase/migrations/20260509000002_messaging_phase1_messages_members.sql`,
  with CHECK `messages_is_system_shape`: `(is_system=true AND sender_id IS NULL) OR (is_system=false AND
  sender_id IS NOT NULL)`. So a real user message is exactly `is_system = false`.
- **Existing message triggers (verified in baseline `20251130010824_baseline.sql`):**
  `increment_unread_on_message` and `update_conversation_on_new_message` — the precedent the push trigger
  sits beside.
- **`notification_mode` (verified):** `varchar(20) NOT NULL DEFAULT 'all'` CHECK IN (`all`,`mentions`,
  `none`), added in `supabase/migrations/20260509000001_messaging_phase1_conversations_participants.sql`.
  **It is never NULL** — the recipient filter must not rely on a NULL branch. Legacy `is_muted` /
  `notifications_enabled` are dormant and **not** consulted.
- **Targeting identity:** `conversation_participants.user_id` is **`members.id`** (not auth uid);
  `members.id` PK; `members.user_id` → `auth.users.id` (nullable for placeholders).
- **Blocking:** a `blocked_users` relationship exists (see `prevent_blocked_user_dm` in migrations) — the
  recipient filter must exclude blocked pairs.
- **Profanity filter (verified):** `src/utils/profanityFilter.ts` wraps the **npm** package
  `@2toad/profanity` — running it in the Deno edge runtime is **unverified** (see Unit 7 spike + fallback).
- **PWA config:** `vite.config.ts` uses `vite-plugin-pwa` v1.2.0, `generateSW`, `registerType: 'prompt'`,
  env-specific manifests (Rack 'Em / BETA / DEV). Runtime-caching regex is `^https:\/\/.*\.supabase\.co\/.*`
  (production-only; localhost isn't cached today — **preserve this exact regex**).
- **Messaging route (verified):** `src/navigation/NavRoutes.tsx` defines only `{ path: 'messages' }` —
  **not deep-linkable.** Unit 3 adds `messages/:conversationId`.
- **`pg_net` / `supabase_vault`:** **neither is present** in active migrations (only in `migrations_archive/`).
  `pg_net` must be created (Unit 8); Vault is **not** used (per-env config comes from a small private table).

### Institutional Learnings

- **New Edge Function needs a full Supabase restart locally** (`memory/feedback_new_edge_functions_need_supabase_restart.md`):
  a new function folder 404s until `pnpm run db:stop && db:start`. Called out in Unit 7 verification.
- **Prefer data/trigger over realtime for load-bearing delivery** (`memory/project_match_realtime_resilience_gap.md`):
  why dispatch uses a DB trigger + `pg_net`, not a realtime subscription.
- **RLS is intentionally OFF until launch** (`memory/project_rls_disabled_until_launch.md`): no RLS on the
  new table now — but `push_subscriptions` is a **priority table for the launch RLS pass** (its rows are
  device push credentials; a spoofed row is an eavesdropping vector — see Risks).
- **Dev data disposable + consolidate migrations** (`memory/feedback_dev_data_disposable.md`,
  `feedback_consolidate_migrations_in_pr.md`): one clean migration per concern, no backfill.
- **In-app-quiet rule is reversed for the push channel** (`memory/project_messaging_low_priority.md`): loud
  push is explicitly wanted.

### External References

- **Deno Web Push:** `jsr:@negrel/webpush` — Deno-native, RFC 8291 + 8292.
  [guide](https://www.negrel.dev/blog/deno-web-push-notifications/) · [JSR](https://jsr.io/@negrel/webpush).
  `npm:web-push` is the fallback if JSR doesn't resolve on **deploy** (not just locally).
- **`vite-plugin-pwa` injectManifest:** [guide](https://vite-pwa-org.netlify.app/guide/inject-manifest.html) —
  each old `runtimeCaching` object becomes a `registerRoute(...)` call.
- **Declarative Web Push (iOS/iPadOS 18.4+, 2026):** payload with top-level `"web_push": 8030` + a
  `notification` object (`title` + `navigate` required); Safari renders without running the SW.
  [WebKit](https://webkit.org/blog/16535/meet-declarative-web-push/). **Coexistence caveat:** a stable
  notification `tag` per conversation is used so declarative + SW paths can't double-render (Unit 4/7).
- **iOS baseline:** push only for a home-screen-installed PWA (iOS 16.4+); permission from a user gesture;
  no notification actions/inline reply on iOS.
- **Lifecycle:** one row per device (unique on `endpoint`), fan-out per user, prune on `404/410`.
  [RFC 8030 §5 (4096-byte limit)](https://www.rfc-editor.org/rfc/rfc8030).

## Key Technical Decisions

- **Dispatch = DB trigger + `pg_net` → Edge Function** (not realtime, not a client call). Reliable,
  server-authoritative, matches the team's anti-realtime-for-delivery precedent. `pg_net` is itself an
  async HTTP queue, so no separate queue table for v1. *(Resolves origin §9 "dispatch mechanism".)*
- **Dispatch auth = a dedicated shared secret, NOT the service-role key.** The function runs
  `verify_jwt = false`, so it must authenticate its caller itself: the trigger sends
  `X-Dispatch-Secret: <random value>` and the function 401s on mismatch. This closes the open-endpoint
  push-spam hole **and** avoids writing the service-role key into `pg_net`'s queryable request tables. The
  function reads the DB using its **own** `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env` — that key never
  travels over the wire. *(Added from security review.)*
- **Per-env dispatch config lives in a small private table `push_dispatch_config(env_key, function_url,
  shared_secret)`**, seeded per environment — NOT Vault (absent) and NOT hardcoded in the migration. The
  trigger reads the row for the current environment. *(Resolves the deferred credentials question.)*
- **Notification eligibility is DATA-DRIVEN in two layers — build all of it, light up per phase (Ed directive).**
  - **Layer 1 — per-conversation-kind policy (the phase switch):** a tiny table `push_type_policy
    (conversation_kind text PK, push_enabled boolean)` with a row per kind (`direct`, `team_chat`,
    `captains_chat`, `announcements`, `match_chat`). **v1 seeds only `direct = true`; all others false.**
    A conversation's kind = `COALESCE(conversation_type, 'direct')` (personal DMs + manual group chats have
    `conversation_type = NULL / auto_managed = false`, so they normalize to `direct`). Turning on team
    chats later = `UPDATE push_type_policy SET push_enabled = true WHERE conversation_kind = 'team_chat'`
    — no code change.
  - **Layer 2 — per-user per-conversation preference (the future user console):** the existing
    `conversation_participants.notification_mode` (`all`/`mentions`/`none`). v1 pushes only when it's
    `'all'`; the v2 console just exposes this column as UI. `'mentions'`/`'none'` get no v1 push (mentions
    unbuilt → mentions-only correctly means "nothing yet").
  - **Layer 3 — frequency / "how often" (documented seam, NOT built):** rate-limit / quiet-hours belong to
    the same console but are a different mechanism; left as an explicit extension point, no dormant columns.
- **Recipient predicate (corrected + policy-driven):** notify a participant iff the conversation's kind is
  `push_enabled` in `push_type_policy` AND `left_at IS NULL` AND `user_id != sender` AND
  `notification_mode = 'all'` AND `members.push_enabled IS NOT FALSE` AND not blocked vs. sender AND they
  have ≥1 `push_subscriptions` row. Legacy `is_muted`/`notifications_enabled` are not consulted.
  *(Corrected from the dead NULL-branch SQL; announcements are now off via policy data, not a hardcode.)*
- **Custom SW via `injectManifest`**, ported runtime caching (same supabase.co regex) into `registerRoute`,
  plus `push` + `notificationclick` handlers, a **suppress-if-viewing** guard, and a stable per-conversation
  notification `tag`. `pushsubscriptionchange` re-subscribe is **cut** (SW can't call the React mutation);
  staleness is healed on next app mount instead (Unit 5). *(Simplified per scope review.)*
- **Payload = Declarative `web_push: 8030` envelope + `data.conversation_id` + short capped preview.** One
  payload serves iOS (declarative) and Chrome/Android (SW). `tag = conversation_id` prevents double-render.
- **Global on/off = `members.push_enabled`** (NULL = never prompted; TRUE = on; FALSE = off). A subscribed
  device = a `push_subscriptions` row.
- **VAPID:** single long-lived keypair. Public → client via `VITE_VAPID_PUBLIC_KEY` (must be set at BUILD
  time in every env's CI). Private + subject → Supabase secrets. Rotation invalidates all subs.

## Open Questions

### Resolved During Planning

- Dispatch mechanism → DB trigger + `pg_net` → Edge Function.
- Dispatch auth + credentials → shared secret in `push_dispatch_config` (not Vault, not service key).
- SW strategy → migrate to `injectManifest` with `src/sw.ts`.
- Deep-link → add `messages/:conversationId` (Unit 3).
- iOS install-nudge → onboarding prompt + inline on the settings toggle when iOS + not-installed.
- Payload shape → declarative `web_push: 8030` + `data.conversation_id`, capped preview, per-conversation tag.
- **Which conversations push in v1** → personal DMs + manual group chats only (`direct` kind). Confirmed by
  Ed. Team/captain/announcement channels are seeded OFF in `push_type_policy` and turned on in later phases;
  the full per-kind + per-user structure is built now (Ed: "build the structure for all of it, turn on what
  we want at each phase").

### Deferred to Implementation

- **`@2toad/profanity` in Deno** — Unit 7 opens with a spike; if it doesn't run/censor identically, filtered
  recipients get a generic "New message" preview (safe fallback), unfiltered recipients get the real preview.
- **Exact `registerRoute` translation** of the current `NetworkFirst` supabase.co rule — finalize against
  the real generated Workbox config; preserve the regex byte-for-byte.
- **Whether the onboarding push prompt is a new step or folded into the profanity modal** — decide when
  touching `src/components/onboarding/ProfanityOnboardingModal.tsx`.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation
> specification. Treat it as context, not code to reproduce.*

```mermaid
sequenceDiagram
    participant U as Sender (client)
    participant DB as Postgres (messages)
    participant TG as AFTER INSERT trigger (is_system=false)
    participant PN as pg_net (async HTTP)
    participant EF as Edge Fn: dispatch-push-notifications
    participant PS as Push service (Apple/Google/Mozilla)
    participant SW as Recipient SW / iOS declarative

    U->>DB: insert message (sendMessage)
    DB->>TG: row inserted
    TG->>TG: read push_dispatch_config (url + shared secret)
    TG->>PN: http_post(url, {message_id}, X-Dispatch-Secret) — wrapped so failure can't abort insert
    PN-->>EF: POST {message_id} + secret
    EF->>EF: 401 unless X-Dispatch-Secret matches
    EF->>DB: (service key from Deno.env) load message, conversation, sender
    EF->>DB: select recipients (participants − sender − left_at − not 'all' − push_enabled=false − blocked − no subs); exclude announcements
    EF->>DB: load push_subscriptions per recipient
    EF->>EF: per recipient: profanity preview (or generic fallback), cap length, build web_push:8030 payload, tag=conversation_id
    EF->>PS: encrypted push per subscription (@negrel/webpush)
    PS-->>SW: deliver → declarative render OR SW push handler (suppress if viewing that chat)
    EF->>DB: on 404/410 delete dead subscription; log {dispatched, pruned, failed}
    Note over SW: tap → open /messages/{conversation_id}
```

## Implementation Units

- [x] **Unit 1: schema — `push_subscriptions`, `members.push_enabled`, `push_type_policy`**

**Goal:** Persist per-device subscriptions, a per-user master switch, and the per-kind push policy that
makes phase rollout a data flip.

**Requirements:** R1, R3, R4, R7

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260818000000_push_subscriptions.sql`
- Modify: `src/types/database.types.ts` (`pnpm db:types`)
- Test: `src/__tests__/database/pushSubscriptions.db.test.ts`

**Approach:**
- `push_subscriptions`: `id` uuid PK, `member_id` uuid NOT NULL FK → `members(id)` ON DELETE CASCADE,
  `endpoint` text NOT NULL **UNIQUE**, `p256dh` text NOT NULL, `auth` text NOT NULL, `user_agent` text NULL,
  `created_at` timestamptz default now(), `last_seen_at` timestamptz NULL. Index on `member_id`.
- Add `members.push_enabled BOOLEAN NULL` (NULL = never prompted; TRUE = on; FALSE = globally off).
- `push_type_policy`: `conversation_kind text PRIMARY KEY`, `push_enabled boolean NOT NULL DEFAULT false`.
  **Seed one row per kind** (`direct`, `team_chat`, `captains_chat`, `announcements`, `match_chat`) with
  **only `direct = true`**. This is the phase switch — future phases `UPDATE` a row to light up a kind.
- No RLS policies (RLS off pre-launch; note in comment that `push_subscriptions` is an RLS-pass priority
  and `push_type_policy` should be admin-write-only at launch).
- `member_id` mapping banks R7.

**Patterns to follow:** migration style in `supabase/migrations/`; `db` test conventions in
`src/__tests__/database/` (`// @vitest-environment jsdom` first line if using supabase-js writes).

**Test scenarios:**
- Happy path: insert a subscription; select by `member_id` returns it.
- Edge case: second insert with the same `endpoint` violates UNIQUE (upsert target).
- Edge case: deleting a member cascades and removes their subscription rows.
- Happy path: `members.push_enabled` defaults NULL and accepts TRUE/FALSE.
- Happy path: `push_type_policy` seeds exactly `direct = true` and the other four kinds `false`.

**Verification:** migration applies on a fresh `db:reset`; `pnpm db:types` regenerates; db test passes.

---

- [x] **Unit 2: VAPID keys + dispatch shared secret + secrets docs**

**Goal:** Establish the VAPID keypair and the dispatch shared secret, and wire public/private material.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `.env.example` (add `VITE_VAPID_PUBLIC_KEY`)
- Create: `docs/ops/push-notifications-secrets.md`

**Approach:**
- Generate one VAPID keypair. Public key is safe in the client bundle via `VITE_VAPID_PUBLIC_KEY` (**must be
  set at build time in every env's CI**, not just `.env.example`). Private key + `VAPID_SUBJECT` (`mailto:`)
  → Supabase secrets (`supabase secrets set …` per env) + local `supabase/functions/.env`.
- Generate a random `DISPATCH_SHARED_SECRET`; store it as a Supabase function secret (function side) AND in
  `push_dispatch_config` (DB side, Unit 8) per env.
- Document: key generation, per-env secret setting, the build-time public-key requirement, and a **rotation
  runbook** (rotating VAPID invalidates all subs → truncate `push_subscriptions`, set `members.push_enabled
  = NULL` for all, users re-prompted on next open).

**Patterns to follow:** `supabase/functions/send-invite/index.ts` (`Deno.env.get("RESEND_API_KEY")`).

**Test scenarios:** Test expectation: none — secrets/config + docs only.

**Verification:** public key readable via `import.meta.env.VITE_VAPID_PUBLIC_KEY`; function can read
`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`/`DISPATCH_SHARED_SECRET` locally; secrets doc followed for staging/prod.

---

- [x] **Unit 3: Deep-linkable conversation route**

**Goal:** Make a single conversation openable by URL so tap-to-open (R2) and iOS `navigate` have a target.

**Requirements:** R2, R7

**Dependencies:** None

**Files:**
- Modify: `src/navigation/NavRoutes.tsx` (add `messages/:conversationId`)
- Modify: `src/pages/Messages.tsx` (read the param, open that conversation; invalid/absent → conversation list)
- Test: co-located test or `src/__tests__/integration/messagesDeepLink.test.tsx`

**Approach:**
- Add a nested/param route so `/messages/:conversationId` renders `Messages` focused on that thread; bare
  `/messages` keeps current list behavior. Guard against an unknown/forbidden id (fall back to the list, no crash).
- This is a small, self-contained change — land it as its own reviewable checkpoint (it has value independent of push).

**Patterns to follow:** existing route definitions in `src/navigation/NavRoutes.tsx`; `Messages.tsx` selection state.

**Test scenarios:**
- Happy path: navigating to `/messages/<valid-id>` opens that conversation.
- Edge case: `/messages/<unknown-id>` falls back to the conversation list without error.
- Happy path: bare `/messages` still shows the list.

**Verification:** pasting `/messages/<id>` in the address bar opens the right thread on a cold load.

---

- [ ] **Unit 4: Custom service worker — migrate `generateSW` → `injectManifest`**

**Goal:** Own the SW to handle push + tap-to-open without regressing offline caching; land as its own checkpoint.

**Requirements:** R1, R2, R7

**Dependencies:** Unit 3 (URL to open)

**Files:**
- Modify: `vite.config.ts` (`strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`, keep env
  manifests + the `virtual:pwa-register` flow)
- Create: `src/sw.ts`
- Create: `src/utils/push/notificationPayload.ts` (pure: push data → notification options + target url)
- Modify: `tsconfig` (`"WebWorker"` in `lib`)
- Test: `src/utils/push/notificationPayload.test.ts`

**Approach:**
- `src/sw.ts`: `precacheAndRoute(self.__WB_MANIFEST)` + `cleanupOutdatedCaches()`; port the supabase.co
  `NetworkFirst` rule into a `registerRoute(...)` **with the exact same regex** (don't start caching localhost).
- `push` handler: build the notification via the pure helper; set `tag = conversation_id` (collapses rapid
  messages and prevents iOS declarative + SW double-render); **suppress-if-viewing** — `clients.matchAll()`,
  and if a focused client is already on `/messages/<conversation_id>`, skip `showNotification`
  (best-effort; Android/desktop only — iOS declarative can't be suppressed client-side, accepted).
- `notificationclick`: focus an existing client at the target path or `clients.openWindow('/messages/' +
  conversation_id)`.
- Extract payload→notification mapping into `notificationPayload.ts` (unit-testable; the SW glue isn't).
- Confirm the VAPID **public** key is available where needed (build-time inline) — note the SW does not need
  it since `pushsubscriptionchange` re-subscribe is cut.

**Execution note:** verify in `vite build && vite preview` across all three `VITE_APP_ENV` values — offline
caching parity is a **hard pass/fail gate**, not a soft note (blast radius = whole app, not just messaging).

**Patterns to follow:** current `vite.config.ts` PWA block (keep the three env manifest variants); Workbox
`registerRoute` docs.

**Test scenarios:**
- Happy path: well-formed push data → `{ title, body, data.url, tag }` as expected.
- Edge case: missing preview/body → generic fallback ("New message").
- Edge case: `data.conversation_id` present → target `/messages/<id>`; absent → `/messages`.
- Edge case: suppress-if-viewing — a focused client on the target conversation → helper signals "skip".

**Verification:** `pnpm run build` succeeds with injected manifest across all 3 env builds; app still
installs + caches offline in `vite preview` (DevTools → Application → Cache Storage matches pre-migration);
a manually-sent test push shows a notification and tap opens the right route.

---

- [ ] **Unit 5: Client subscription + permission logic (+ heal-stale-on-mount)**

**Goal:** Subscribe a device, persist it, classify every permission/capability state, and self-heal stale subs.

**Requirements:** R1, R4, R5, R7

**Dependencies:** Unit 1, Unit 2, Unit 4

**Files:**
- Create: `src/utils/push/pushCapability.ts` (pure: supported / denied / needs-ios-install / unsupported)
- Create: `src/api/hooks/usePushSubscription.ts` (subscribe/unsubscribe + on-mount staleness check)
- Create: `src/api/mutations/pushSubscriptions.ts` (upsert on `endpoint`, delete on unsubscribe)
- Test: `src/utils/push/pushCapability.test.ts`, `src/api/hooks/usePushSubscription.test.ts`

**Approach:**
- `pushCapability.ts`: from `'serviceWorker' in navigator`, `'PushManager' in window`,
  `Notification.permission`, and iOS + standalone (`matchMedia('(display-mode: standalone)').matches` /
  `navigator.standalone`). iOS + not-standalone → `needs-ios-install`.
- `usePushSubscription`: on user gesture → `requestPermission()` →
  `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` (base64url public key →
  `Uint8Array`) → extract `p256dh`/`auth` → upsert `push_subscriptions` → set `members.push_enabled = true`.
  Unsubscribe reverses it and sets FALSE.
- **Heal-stale-on-mount** (replaces the cut `pushsubscriptionchange` handler): on app mount, if
  `push_enabled = true` but the browser has no live subscription (or its endpoint differs from the stored
  row), re-subscribe and upsert. Cheap recovery from the rare rotation event.
- Upsert keyed on `endpoint` dedupes re-subscribes.

**Patterns to follow:** hooks in `src/api/hooks/`, mutations in `src/api/mutations/` (TanStack Query invalidation).

**Test scenarios:**
- Happy path: supported + granted → subscribe called, row upserted, `push_enabled` true.
- Error path: `permission === 'denied'` → `denied` state, no subscribe attempt.
- Edge case: iOS Safari tab (not standalone) → `needs-ios-install`, subscribe never called.
- Edge case: unsupported browser (no `PushManager`) → `unsupported`.
- Edge case: `push_enabled = true` but no live browser sub on mount → re-subscribe + upsert.
- Integration: unsubscribe deletes the row and sets `push_enabled` false.

**Verification:** enabling produces exactly one `push_subscriptions` row; disabling removes it;
iOS-not-installed shows the install path instead of erroring.

---

- [ ] **Unit 6: Permission UI — onboarding prompt, settings toggle, iOS nudge**

**Goal:** Give users a clear place to turn push on/off and guide iPhone users to install first.

**Requirements:** R4, R5

**Dependencies:** Unit 5

**Files:**
- Modify: `src/components/onboarding/ProfanityOnboardingModal.tsx` (add a push-enable ask — a `Button` is the
  required user gesture — on first Messages open)
- Modify: the messaging settings modal in `src/components/messages/` (add global push toggle + iOS nudge)
- Test: co-located component test for the toggle states

**Approach:**
- Onboarding: `Button` triggers `usePushSubscription.subscribe()`. Dismiss leaves `push_enabled` NULL.
  **Re-prompt behavior (make explicit):** while NULL, the prompt shows **every** first-Messages-open per
  session — intentional loud-nudge for v1; it stops once the user enables or explicitly declines.
- Settings toggle reflects `push_enabled` + capability. `needs-ios-install` → replace toggle with an "Add to
  Home Screen to get notified" explainer. `denied` → browser-settings hint, toggle disabled.
- shadcn components only (`Button`, `Switch`, `Label`, `Card`).

**Patterns to follow:** `ProfanityOnboardingModal.tsx`; shadcn usage rules in project CLAUDE.md.

**Test scenarios:**
- Happy path: toggle ON → subscribe; OFF → unsubscribe.
- Edge case: `needs-ios-install` renders the install nudge, not the toggle.
- Edge case: `denied` renders the browser-settings hint, toggle disabled.
- Happy path: onboarding dismiss leaves state undecided (re-prompts next session).

**Verification:** desktop Chrome toggle works; first-Messages-open shows the push ask; an iOS Safari tab
shows the install nudge, not a broken toggle.

---

- [ ] **Unit 7: Edge Function — `dispatch-push-notifications`**

**Goal:** Given a `message_id` (from an authenticated trigger), fan out encrypted Web Push to recipients' devices.

**Requirements:** R1, R2, R3, R6, R7

**Dependencies:** Unit 1 (tables), Unit 2 (secrets), Unit 3 (deep-link URL shape)

**Files:**
- Create: `supabase/functions/dispatch-push-notifications/index.ts`
- Modify: `supabase/config.toml` (`[functions.dispatch-push-notifications] verify_jwt = false`)
- Test: `src/__tests__/database/pushDispatchRecipients.db.test.ts` (recipient-selection SQL correctness)

**Approach:**
- **Spike first:** confirm `jsr:@negrel/webpush` **and** `@2toad/profanity` import in the deployed Deno
  runtime (a trivial function that imports both and deploys to staging). Fallbacks: `npm:web-push`; and for
  profanity, if it can't run/censor identically → filtered recipients get a generic "New message" preview.
- **Auth gate:** 401 immediately unless `X-Dispatch-Secret` header matches `Deno.env.get('DISPATCH_SHARED_SECRET')`.
- Service-role admin client from `Deno.env` (never from the request). Follow `send-invite` scaffold (CORS,
  OPTIONS, `withTimeout`).
- Load message + conversation + sender. Compute the conversation **kind** = `COALESCE(conversation_type,
  'direct')` and short-circuit if `push_type_policy.push_enabled` is false for that kind (v1: everything
  except `direct` is off). **Recipient select:** participants where `conversation_id` matches,
  `user_id != sender`, `left_at IS NULL`, `notification_mode = 'all'`, `members.push_enabled IS NOT FALSE`,
  not blocked vs. sender (`blocked_users`), joined to `push_subscriptions` (recipients with zero subs are
  simply skipped — the normal case).
- Per recipient: build the preview — apply their profanity filter (or generic fallback), then **hard-cap the
  body at ~120 chars** (lock-screen privacy). Build one payload: top-level `web_push: 8030`, `notification`
  (`title`, capped body, `navigate: /messages/<conversation_id>`), `data.conversation_id`, `tag =
  conversation_id`. Keep JSON well under 4096 bytes.
- Send via the web-push lib to each subscription; on `404`/`410` delete that `push_subscriptions` row.
- Return `{ success, dispatched, pruned, failed }` and **log the structured counts** (so silent failure is
  diagnosable — see Risks/observability).

**Execution note:** after creating the new function folder, run `pnpm run db:stop && db:start` — a new
function 404s until a full restart (`memory/feedback_new_edge_functions_need_supabase_restart.md`).

**Patterns to follow:** `supabase/functions/send-invite/index.ts`; profanity util `src/utils/profanityFilter.ts`.

**Test scenarios (recipient logic, DB-level):**
- Happy path: 3-person **group DM** (`direct` kind, policy on), sender posts → the 2 non-senders with subs are selected.
- Edge case: `notification_mode = 'none'` or `'mentions'` → excluded.
- Edge case: `left_at` set → excluded.
- Edge case: `members.push_enabled = FALSE` → excluded even if `'all'`.
- Edge case: sender never selected for their own message.
- Edge case: recipient blocked by sender → excluded.
- Edge case: message in a `team_chat` (policy `push_enabled = false` in v1) → nobody selected; then flip the
  policy row to true and the same insert selects recipients (proves the phase switch is data-driven).
- Edge case: recipient participant with **zero** `push_subscriptions` rows → skipped, no error (normal case).
- Edge case: profanity-filtered recipient vs. unfiltered recipient in the same chat → different preview
  (or generic-fallback vs. raw, if the Deno spike failed).
- Error path (function-level, note): a `410` from the push service prunes the dead subscription row.

**Verification:** invoking with a real `message_id` + correct secret delivers to a subscribed test device,
prunes a stale endpoint, and logs counts; a POST **without** the secret returns 401; recipient db test passes.

---

- [ ] **Unit 8: DB trigger + `pg_net` wiring + `push_dispatch_config`**

**Goal:** Automatically and safely invoke the dispatcher on every real message insert.

**Requirements:** R1, R3

**Dependencies:** Unit 7 (function must exist to be called)

**Files:**
- Create: `supabase/migrations/20260818000001_message_push_dispatch_trigger.sql`
- Test: `src/__tests__/database/messagePushTrigger.db.test.ts`

**Approach:**
- `CREATE EXTENSION IF NOT EXISTS pg_net;` (idempotent). Verify the `pg_net` background worker runs locally
  (add a smoke check that a test `net.http_post` enqueues into `net.http_request_queue`).
- Create `push_dispatch_config(env_key text primary key, function_url text not null, shared_secret text not
  null)`; seed per environment (the migration seeds local; staging/prod seeded via the secrets doc).
- `AFTER INSERT ON messages` trigger firing only for real user messages (`is_system = false`). In the trigger
  function: read the config row for the current env, `net.http_post(function_url, body := json_build_object(
  'message_id', NEW.id), headers := jsonb_build_object('X-Dispatch-Secret', shared_secret, 'Content-Type',
  'application/json'))`. **Wrap the `net.http_post` call in `BEGIN ... EXCEPTION WHEN OTHERS THEN` (log,
  swallow)** so a dispatch-enqueue failure can never abort the message insert.
- Sits beside `increment_unread_on_message`; must not block the insert (pg_net is async post-commit).

**Patterns to follow:** existing message triggers in `supabase/migrations/20251130010824_baseline.sql`.

**Test scenarios:**
- Happy path: inserting a normal message enqueues exactly one `net.http_request_queue` row with the right
  `message_id` and the `X-Dispatch-Secret` header.
- Edge case: a system message (`is_system = true`) inserts without enqueuing.
- Error path: if `net.http_post` raises (e.g. missing config), the message insert **still commits** (exception swallowed).
- Integration: message insert still succeeds and `increment_unread_on_message` still fires.

**Verification:** end-to-end **two-phone test** — post from phone A, phone B (subscribed) gets the chime and
tap opens the conversation; message send latency is unaffected; edge-function logs show dispatch counts.

## System-Wide Impact

- **Interaction graph:** new `AFTER INSERT` trigger on `messages` runs beside `increment_unread_on_message`
  + `update_conversation_on_new_message`. Non-blocking and failure-isolated (exception-swallowed pg_net).
- **Error propagation:** dispatcher failures are logged + pruned, never surfaced to the sender; the message
  write is authoritative and independent of push success.
- **Observability (new):** because pg_net is fire-and-forget, a broken pipeline fails **silently** — the
  same "no buzz" as a quiet night. Mitigation: the dispatcher logs `{dispatched, pruned, failed}` per call;
  during the two-phone test, tail the edge-function logs to confirm pushes are actually going out.
- **State lifecycle risks:** stale/duplicate subs — unique `endpoint` + 404/410 pruning + heal-on-mount.
  Multi-device fan-out is intentional.
- **API surface parity:** none — push is additive; in-app realtime badges unchanged.
- **Integration coverage:** the full path (insert → trigger → pg_net → function → push → SW/iOS → tap) is
  only proven by the live two-phone test; unit/db tests cover the pieces (recipient SQL, payload mapping,
  trigger enqueue, deep-link route).
- **Unchanged invariants:** `sendMessage()`, the unread-count trigger, and in-app realtime hooks are not
  modified; `notification_mode` semantics are honored, not redefined.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Open dispatch endpoint → push spam | `X-Dispatch-Secret` gate; 401 on mismatch (Unit 7) |
| Service-role key leaking via `pg_net` request tables | Trigger sends only the shared secret, never the service key; function reads DB with its own env key (Unit 7/8) |
| `pg_net` absent / worker not running | `CREATE EXTENSION IF NOT EXISTS pg_net` + a local enqueue smoke check (Unit 8) |
| New Edge Function 404s locally after creation | `db:stop && db:start` step in Unit 7 execution note |
| `injectManifest` regresses offline caching / 3 env manifests | Port regex byte-for-byte; hard pass/fail `vite preview` gate across all envs; land as its own PR (Unit 4) |
| `@2toad/profanity` won't run in Deno → uncensored lock-screen preview | Deploy spike; fallback to generic "New message" preview for filtered recipients (Unit 7) |
| tap-to-open lands nowhere | Deep-link route `messages/:conversationId` (Unit 3) |
| iOS declarative + SW double-notification | Stable per-conversation `tag`; two-phone iOS single-vs-double check (Unit 4/8) |
| Announcement/channel blast → night-one mass opt-out | Only `direct` kind seeded on in `push_type_policy`; auto-managed channels off until a deliberate phase flip |
| Silent pipeline failure looks like a quiet night | Dispatcher logs counts; tail logs during the test (observability note) |
| VAPID rotation invalidates all subs | Long-lived keypair; rotation runbook in the ops doc (Unit 2) |
| `push_subscriptions` spoofing (RLS off) → eavesdrop | Accepted pre-launch; flagged as a **priority table** for the launch RLS pass (own + member-scoped write policies) |

## Documentation / Operational Notes

- `docs/ops/push-notifications-secrets.md` (Unit 2): key generation, `supabase secrets set` per env, the
  build-time `VITE_VAPID_PUBLIC_KEY` requirement, the `DISPATCH_SHARED_SECRET` + `push_dispatch_config`
  seeding, and the VAPID rotation runbook.
- Deployment: Edge Function ships via the existing tagged-release CI (`.github/workflows/deploy-production.yml`
  runs `supabase functions deploy` after migrations). Set VAPID + dispatch secrets and seed
  `push_dispatch_config` in staging + prod **before** the release that includes the trigger.
- Sequencing/gating: land Unit 3 (deep-link) and Unit 4 (SW migration) as their own reviewable checkpoints
  ahead of the push-specific units, so a caching regression is bisectable. Consider the standard staging
  gate for the loud rollout; if gated, add to `LIST_FOR_ED.md` with the flag + every entry point.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-08-18-message-push-notifications-requirements.md](docs/brainstorms/2026-08-18-message-push-notifications-requirements.md)
- Edge Function template: `supabase/functions/send-invite/index.ts`
- Message schema/triggers: `supabase/migrations/20251130010824_baseline.sql`,
  `supabase/migrations/20260509000002_messaging_phase1_messages_members.sql`,
  `supabase/migrations/20260509000001_messaging_phase1_conversations_participants.sql`
- Route: `src/navigation/NavRoutes.tsx`; in-app realtime (do not couple): `src/api/hooks/useMessagingRealtime.ts`
- PWA config: `vite.config.ts`; profanity: `src/utils/profanityFilter.ts`
- Web Push (Deno): https://jsr.io/@negrel/webpush · injectManifest: https://vite-pwa-org.netlify.app/guide/inject-manifest.html
- Declarative Web Push (iOS 2026): https://webkit.org/blog/16535/meet-declarative-web-push/
- Institutional: `memory/feedback_new_edge_functions_need_supabase_restart.md`, `memory/project_match_realtime_resilience_gap.md`, `memory/project_rls_disabled_until_launch.md`
