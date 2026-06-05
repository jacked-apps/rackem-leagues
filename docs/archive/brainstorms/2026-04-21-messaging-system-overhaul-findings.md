# Document Review Findings — Messaging System Overhaul

**Review date:** 2026-04-21
**Reviewers:** coherence, feasibility, product-lens, design-lens, security-lens, scope-guardian, adversarial

## Coverage

| Reviewer | Findings | Auto | Present |
|---|---|---|---|
| coherence | 11 | 6 | 5 |
| feasibility | 10 | 5 | 5 |
| product-lens | 11 | 0 | 11 |
| design-lens | 17 | 3 | 14 |
| security-lens | 10 | 0 | 10 |
| scope-guardian | 9 | 0 | 9 |
| adversarial | 15 | 4 | 11 |

One design-lens finding had malformed `finding_type` field; treated as `error` (announcement reactions contradiction). After cross-persona dedup and merge: **15 auto-fixes applied, ~25 distinct findings require judgment.**

---

## Auto-fixes applied to the requirements doc

1. **Corrected `preferences.profanity_filter_enabled` → `members.profanity_filter_enabled`** (feasibility). The existing column lives on `members`; `preferences` is org/league-scoped. Also noted dormant `organizations.profanity_filter_enabled` + `league_operators.profanity_filter_enabled`.
2. **Clarified `conversation_type` is a CHECK constraint, not a Postgres ENUM** (feasibility, coherence). Migration is drop+recreate CHECK constraint with downstream function verification. Added to Phase 4 prereqs.
3. **Tri-state notifications schema mechanics spelled out** (coherence, feasibility). New `notification_mode` column with CHECK constraint, data-migrated from `is_muted`/`notifications_enabled`.
4. **Added Phase 1 schema task: `conversations.archived_at` column** (feasibility). Column doesn't exist; required for all archival rules.
5. **League/venue/org timezone columns missing** (feasibility, adversarial). Added as Phase 4 prereq migration, with canonical source = `venues.timezone`.
6. **User-reports duplicate schema flagged** (coherence). Two conflicting files in `database/messaging/` and `database/reporting/` must be reconciled before Phase 5.
7. **Announcements read-only/reactions/mentions contradiction resolved** (coherence, design). Reactions are explicit carve-out; staff-authored mentions only; reactions go through report flow.
8. **Profanity filter surfaces enumerated** (coherence, security, adversarial). Lists MessageBubble, conversation list preview, push body (with server-side caveat), search results, system messages. Acknowledged as display convenience, not content guarantee.
9. **Captain match-chat lock phrasing strengthened** (coherence). §5.4 now matches D11's force-member rule explicitly.
10. **@mentions UX + storage model specified** (design, security). Autocomplete scoped to chat members only (no enumeration); mention metadata stored in separate table, not embedded markers.
11. **Typing indicator multi-user behavior defined** (design). Up to 2 names, then "Several people are typing…"
12. **Failed-send error states defined** (design). Failed indicator + retry + preserved composer.
13. **Reschedule edge cases spelled out** (adversarial). Same-day, past-day, already-archived all specified in §7(10).
14. **Match never-completed archive rule added** (adversarial). End-of-match-day + 24h fallback for stuck-in-dispute matches.
15. **scope_type immutability noted** (coherence).

---

## Findings requiring judgment

Grouped by theme. P0/P1 first, then P2. P3 moved to appendix.

### Theme 1 — Premise & scope (HIGH CONSENSUS across product-lens, scope-guardian, adversarial)

**P1 — Premise framing is asserted, not evidenced** (product-lens, 0.82; adversarial, 0.6)
The "social layer of the league" frame drives the entire 5-phase plan, but it's based on inference ("captains default to SMS") rather than captain interviews, usage data, or support-ticket evidence. A different framing — "lightweight coordination surface that cooperates with SMS rather than replacing it" — would yield a dramatically smaller build. Suggested: 2-week captain discovery before Phase 3+ commits.

**P1 — Success metric is unmeasurable** (product-lens, 0.88; adversarial, 0.85)
"50% of match coordination happens in Rackem" cannot be measured — the app has no visibility into SMS/Facebook. Without a baseline, "success" = "we shipped." Suggested replacement metrics: (a) % of active captains with ≥3 team-chat messages in the week before a match, (b) % of matches with ≥1 chat message on match day, (c) post-season survey question.

**P1 — Phasing buries the riskiest bet** (product-lens, 0.8; adversarial, 0.85; scope-guardian, 0.88)
Four-persona consensus: the core hypothesis ("captains will use Rackem chat over SMS") is only testable at Phase 4 (match-night chats). Shipping Phases 1–3 before testing that hypothesis is inverted risk. Also: 5-phase scope is ambitious for a solo dev + mobile partner. Multiple reviewers recommend shipping Phase 1 + minimal Phase 4 slice (match-night chat + push) before Phase 3 polish. If the coordination needle moves, invest in polish; if not, polish was built for nothing.

**P1 — SMS inversion risk / adoption strategy** (product-lens, 0.82)
Even if all 5 phases ship perfectly, captains may still default to SMS because (a) teammates have non-Rackem friends they also text, (b) SMS groups predate the season and persist, (c) inertia. The doc has zero mitigation for this. Suggested: add an adoption section with season-start onboarding prompt, visible social proof (activity badges), and a "share match to SMS" fallback that keeps Rackem as source-of-truth.

**P2 — Opportunity cost not addressed** (product-lens, 0.7)
Recent commit history shows active work on handicap/scoring, roster sizing, preferences. 5 phases of messaging = months that don't go into Fargo tiebreakers, mid-match clinch, or team-handicap preference work noted in memory. Doc doesn't justify the opportunity cost.

**P2 — UX identity drift** (product-lens, 0.72)
Doc mixes iMessage + Discord + Slack aesthetics. Three distinct product identities with different expectations. Suggested: pick one primary ("iMessage for players, Slack-lite for staff") and rule out Discord-style presence density unless user research supports it for bar-league audience.

### Theme 2 — Staff oversight & Operator View (HIGHEST CONSENSUS — 5 personas)

**P0 — Operator View data model is blocking Phase 4** (security-lens, 0.92; coherence, 0.75; scope-guardian, 0.74; adversarial, 0.75; product-lens, 0.6)
Five personas flagged this. The deferred "observer role in participants vs. org-scoped queries" decision cascades into:
- **RLS security** (biggest concern): until decided, implementations likely fall back to no row restriction, leaking team chats to anyone who knows a conversation ID.
- **@staff notification routing** semantics change.
- **Unread counts** and "staff left" representation change.
- **Phase 4 scope** is un-estimable until decided.
- **Product stance** (product-lens): observer role = staff presence is auditable/transparent; query-only = oversight is invisible. This is a trust choice, not just a technical one. Bar-league culture leans toward transparent.

Suggested: resolve BEFORE Phase 4 planning starts, not during.

**P1 — Operator View IS a new UI surface — is it required?** (scope-guardian, 0.78)
The minimum viable "staff oversight without inbox clutter" goal is just query filtering (hide auto-chats from staff inboxes). The Operator View browsing surface (sidebar/tab/route organized by league → team → chat) is a separate layered application. Scope question: ship just the inbox filter in Phase 4, defer the browsing UI?

**P1 — Operator View attention signals undefined** (design-lens, 0.88)
If staff can browse but don't get notifications, how do they know which chats have recent activity? Needs definition: unread counts in Operator View? Last-message timestamps? Activity badges? Separate unread count for `@staff` pings?

### Theme 3 — Match-night chat infrastructure

**P1 — Scheduler mechanism unresolved** (feasibility, 0.78; adversarial, 0.85; design, 0.78)
"Cron job or per-request check at midnight" is two very different architectures. Per-request means chat doesn't exist until someone opens the app — which means captains may arrive at the bar to an empty chat. No scheduler infrastructure exists in the codebase today (no pg_cron, no scheduled edge functions). Needs explicit choice + failure/retry + idempotency + manual-override-for-staff.

**P1 — Push permission denial has no fallback** (adversarial, 0.9)
Phase 2's whole value prop depends on push working. But every platform has meaningful denial paths: browser "Block," dismissed native prompt, iOS Safari requires PWA install, revoked-in-OS-settings. Doc treats push as binary. Needs a permission-states matrix and UX for detect/re-prompt/explain. May force reconsidering email fallback for the denied case (currently non-goal).

**P1 — Push infrastructure is greenfield** (feasibility, 0.82; security, 0.83)
Nothing in codebase speaks Web Push or FCM/APNs today — no service worker handler, no VAPID keys, no `push_subscriptions` table, no dispatch worker. Phase 2's "Push notifications" line item understates this — it's an entire subsystem: subscription capture/storage, per-device revocation, dispatch worker with retry/dedup, quiet-hours gating, VAPID secrets management, mobile partner coordination on APNs certs.

### Theme 4 — Past-member & captain lifecycle (HIGH CONSENSUS)

**P1 — Past-member semantics undefined across 3 layers** (coherence, 0.95; design-lens, 0.9; security-lens, 0.82)
Three personas flagged. "Past member" concept doesn't exist in `conversation_participants.role` enum (`admin | participant` only). Needs:
- **Schema:** `past_member` role, or `is_past_member` boolean, or use existing `left_at` timestamp.
- **RLS:** past member can SELECT messages where `inserted_at <= left_at`, not after.
- **UI:** what does the past-member see in their conversation list? "Past member" label? Composer disabled/hidden? Moves to archive section?

**P1 — Captain lifecycle edge cases undefined** (adversarial, 0.9)
D6 and D11 assume captaincy is the only mutable input. What about: (a) captain deleted as user, (b) captain suspended/blocked, (c) team folded mid-season, (d) captain toggled D14 opt-out before promotion? If a deleted captain still holds the cannot-leave lock, the chat has a ghost participant.

**P1 — Multi-team players have undefined behavior** (adversarial, 0.8)
Pool leagues allow subs and multi-team rosters. If player X is on teams A and B in the same league/season, they're in two team chats. If removed from A, do they stay current-member ecosystem-wide? What if X captains both teams? What if both teams play the same night (dual match-night chats)?

### Theme 5 — Notifications & onboarding UX

**P1 — Onboarding trigger is self-defeating** (product-lens, 0.68; adversarial, 0.85; design-lens, 0.92)
Three-persona consensus. Three sub-issues:
- **Wrong trigger:** asking permission on first Messages-tab open means casual players who never open Messages never grant push, never get mentions → hub strategy fails for exactly the users who need nudging.
- **Wrong moment:** feature-friction prompts have lower grant rates than context-driven ones ("enable push" asked after sending first message).
- **Dismissal loop:** no "No thanks, don't ask again" — re-prompt every session is a dark pattern.

Suggested: prompt on app first-load post-auth, OR on first team-chat auto-add with a toast. Add permanent-decline option.

**P1 — Empty states for conversation list unspecified** (design-lens, 0.91)
New user not yet on a team, or user in a not-yet-activated season, or user opted out of match chats with no DMs — what do they see? Not defined; implementers will invent copy.

**P1 — Captain opt-out warning UX** (design-lens, 0.85)
D14 says "flagged in settings UI" — not defined what the flag says, when it appears, whether there's confirmation before a captain opts out. What if a non-captain enables the opt-out and then gets promoted?

### Theme 6 — Moderation

**P1 — Accessibility requirements entirely absent** (design-lens, 0.83)
No mention of keyboard nav, screen reader labeling, aria-live for typing indicators, emoji picker a11y, image alt text. Standard omission for brainstorms but worth flagging.

**P1 — Report flow + operator review feedback states undefined** (design-lens, 0.89 + 0.88)
Report flow: no reason categories spec'd, no confirmation screen, no reporter feedback. Operator review actions (dismiss/delete/block/warn) have no confirmation dialogs, no success feedback, no undo paths, no "block user org-wide" consequence description.

**P2 — Moderation actor authorization not defined** (security-lens, 0.78)
D2 says all staff treated identically, but "LO/admin-only" for the review page is inconsistent. Is `league_rep` allowed to block users org-wide (affecting leagues they don't manage)? Needs permission matrix: league_rep scoped to their league's reports; admin/owner for org-wide block.

### Theme 7 — Contradictions (reviewer disagreement — present both sides)

**R. P2 — Quiet hours: user-adjustable vs. hardcoded?** (design says define the UI; scope-guardian says drop user-tunability)
- Design-lens (0.8): controls aren't placed anywhere; specify start/end time pickers in settings modal.
- Scope-guardian (0.72): user-adjustable adds settings surface unjustified by stated goals. Ship hardcoded 10pm–7am, only make configurable if users request it.

**S. P1 — `@staff` tag: add controls vs. remove entirely?** (security vs. scope)
- Security-lens (0.85): if kept, rate-limit per user per chat (e.g., 2/hr), consider restricting to captains only, log for audit. Any chat member can flood staff today.
- Scope-guardian (0.82): the tag is a parallel mention-routing abstraction not required by stated goals. The Phase 3 `@mentions` system + observer role already solves staff reachability. Cut the `@staff` abstraction entirely.

**T. P1 — Image attachments: secure them vs. cut them?** (security vs. scope)
- Security-lens (0.87): if shipped, require authenticated bucket (not public URLs), server-side MIME enforcement, scoped storage paths keyed to conversation_id, retention policy.
- Scope-guardian (0.81): no stated goal mentions images. Cost is storage infra + report flow + compression + viewer UI. Cut from Phase 5 entirely; revisit post-launch.

### Theme 8 — P2 additional items (consolidated, not expanded)

- **Captain retention risk from force-membership** (product, 0.7): captains who hit notification fatigue nuclear-option with global opt-out. Reconsider: allow captains to mute but not leave.
- **Rate-limit window is arbitrary** (adversarial, 0.8): 15-min is unresearched; pool match-night bursts happen exactly in 15-min windows. Consider match-night chats exempt from rate limit during active window.
- **Rate-limit state tracking** (feasibility, 0.62): server-side per-user per-chat timestamp, definition of "activity" (push delivered vs presence), batch-vs-drop behavior at quiet-hours end.
- **Captain-mute enforcement surface** (feasibility, 0.7): D6/D11 rules need a layer — RLS trigger, DB check, or app-only? Implementer picking UI-only = bypassable.
- **Match reschedule detection mechanism** (coherence, 0.7): webhook, cron polling, or manual operator action? (Partially addressed in auto-fixes.)
- **Match-chat shadow paths** (feasibility, 0.72): nil venue, empty rosters after opt-outs, reschedule-same-day, failed-job recovery.
- **2-hour archive window arbitrary** (adversarial, 0.7): why 2 not 24? Partial fix applied; core question remains.
- **Thread replies scope** (scope-guardian, 0.83): the Phase-3-with-trim-escape-hatch pattern means it's not load-bearing. Move to post-Phase-5 backlog.
- **Match rich cards scope** (scope-guardian, 0.77): text link to match page meets the goal at zero schema cost. Cut entirely.
- **Pinned message display** (design, 0.82): banner? message list? dismiss UX?
- **Archived chat hierarchy** (design, 0.76): partial fix applied; UI grouping and filter chips confirmed.
- **Match-chat creation authorization gate** (security, 0.75): must be server-side (service role), never client-callable RPC. Partial — flag for planning.
- **Mention injection/enumeration risk** (security, 0.72): partial fix applied (separate table); autocomplete scope to chat members only.
- **Maintenance compounding rules** (product, 0.85): 5-phase scope = 5-phase support cost forever. Sunset rules for underused features.

### P3 appendix (low-priority, noted for completeness)

- Rate-limit cross-device semantics (feasibility, 0.62)
- Midnight DST inconsistency (product, 0.65)
- "Do nothing" analysis (adversarial, 0.6)
- Operator View product-stance deferral (product, 0.6)

---

## Residual risks (not findings; noted for planning)

- `@2toad/profanity` library supply-chain risk (security).
- Supabase realtime presence scale for typing indicators at high chat counts (adversarial).
- Archived chat retention/deletion policy for account deletion (security).
- Blocked-user interaction inside forced-membership auto-chats (adversarial).
- Mobile partner timeline coordination blocks Phase 2 (feasibility, scope, adversarial all noted).

## Deferred questions (for planning)

- Is the `@staff` tag case-insensitive singular keyword, or do we need individual staff handles?
- Retention/privacy policy for archived chats.
- Does mobile dev implement match-chat creation independently, or does web-app scheduler serve both?
- Instrumentation for any replacement success metric — baseline must exist pre-launch.
- Scorekeepers in match chat — not currently identifiable in data; include only rostered players?
- Audit trail for moderation actions — tamper-evident separate table?
