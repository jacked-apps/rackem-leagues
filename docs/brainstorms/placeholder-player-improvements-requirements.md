---
date: 2026-04-22
topic: placeholder-player-improvements
---

# Placeholder Player Improvements

## Problem Frame

Live league testing surfaced that the placeholder-player system is the single biggest friction point in getting real people onto real rosters. Placeholders are roster members without a registered auth account — created by captains and league operators so matches can be played before everyone signs up. The current flow fails in five distinct ways:

1. **Creation is a maze.** A modal-on-modal pattern (open dropdown → click "Add Placeholder" → 7-field form opens on top) with required fields like city and state that captains don't know and don't need.
2. **Wizard cache bug.** Creating a placeholder during the team-creation wizard does not insert it into the target roster slot and does not appear in the player dropdown until the page is refreshed.
3. **No visual tag.** Placeholders look identical to registered players in every UI, including live scoring. Scorekeepers cannot tell who still needs to be resolved to a real account.
4. **No distinction between disposable and stats-carrying placeholders.** A placeholder that has never played is a throwaway. A placeholder that has played represents real stats attached to a real human — those must never be casually deleted; they must be merged with a registered user.
5. **No LO-facing merge UI.** The only current path to link a placeholder to a registered user is an email invite the player must accept themselves. There is no operator-driven merge, no undo, and no way to reconcile the two-stat-sources case.

This work targets every step of that lifecycle — from the moment a captain types a name in the dropdown to the moment an LO merges a placeholder away and the record is retired.

## Placeholder Lifecycle (at a glance)

| State | Visual tag | Who can delete | Who can merge | Next action |
|---|---|---|---|---|
| No stats yet | "Placeholder" (gray) | Captain or LO | LO | May play → becomes "Needs Merge", or may be deleted if roster changes |
| Has stats | "Needs Merge" (amber) | Nobody (delete blocked) | LO | Merge with registered user; record is deleted post-merge |
| Merged | (does not appear — record deleted; stats now on registered user) | — | — | Undoable for a retention window via LO action |

## Requirements

**Creation UX**

- R1. The player dropdown (`MemberCombobox`) returns an explicit "No player found matching '<query>'" state when a search produces no matches. This state is visually distinct from the "still typing" and "here are your matches" states.
- R2. Only from that "no player found" state may a user initiate placeholder creation via an "Add as placeholder" button. Rationale: prevents a captain from fast-adding a typo'd version of a registered player as a new placeholder.
- R3. Clicking "Add as placeholder" opens an inline panel (not a modal stacked on the dropdown's modal) that collects: first name, last name, email (optional). Name fields are pre-populated from the search text when the parse is obvious (e.g., "John Smith" → first "John", last "Smith").
- R4. City, state, and nickname are no longer required for placeholder creation. Nickname remains optional. State/city are removed entirely from the create form.
- R5. Submitting creates the placeholder AND inserts it into the target roster slot in a single action.
- R6. The inline panel offers a "Save and add another" control that, on submit, creates the placeholder, inserts it in the current slot, advances the cursor to the next empty slot (where applicable), and re-opens the add panel. Explicit close exits add-mode.
- R7. Targeted clarity pass on `MemberCombobox`: (a) remove the four non-functional filter chips (All / My Org / State / Operators) currently rendered in `src/components/MemberCombobox.tsx` — they have no click handlers and are visual dead code; (b) make the state transitions legible (idle / searching / empty / has-results) so R1's "no player found" state reads distinctly from the loading and empty-before-typing states. Broader polish (keyboard navigation, mobile tap targets, full affordance redesign) is explicitly **not** in scope here and is a follow-up brainstorm.

**Wizard bug**

- R8. When a placeholder is created inside the team-creation wizard, it appears immediately in the target roster slot and in the dropdown's member list — with no page refresh. This is a stale-cache / list-invalidation defect today and must be fixed as part of this work; the UX improvements above are worthless if the record does not appear where it should.

**Visual tag**

- R9. Every UI surface that displays a player name attaches a tag when that player is a placeholder: team rosters, lineups, live scoring, opponent views, box scores, standings, and the LO merge UI.
- R10. Two tag states:
  - **"Placeholder"** — neutral/gray. Applied when the placeholder has zero recorded stats.
  - **"Needs Merge"** — amber. Applied the moment a placeholder accumulates any stats (first game played).
- R11. The tag is visible to all roles who see the name — captains, scorekeepers, opponents, and LOs. It is not hidden behind admin-only views.

**Delete**

- R12. A placeholder with zero stats may be deleted by the team's captain (verified at the authorization layer to own the placeholder's team) or by the league operator. The zero-stats check is enforced **transactionally inside the DELETE** — if stats are recorded between the UI check and the DELETE, the operation fails and the UI surfaces "this placeholder just recorded stats; refresh to see Needs Merge." Delete removes the member record entirely.
- R13. A placeholder with any stats may not be deleted by anyone. The only path to retire such a record is merge (R17–R21). Attempting to delete shows a message steering the user to the merge flow. Note: `PlaceholderRemovalModal` already blocks all captain deletes today; this requirement is a **delta** — split its behavior by the shared "has stats" predicate (see Key Decisions) so no-stats placeholders gain a real delete path per R12 and stats-bearing placeholders keep the block with updated messaging.

**Merge (LO-facing)**

- R14. LOs have a dedicated "Placeholders" management page in the operator section listing every placeholder in their organization. Default sort/grouping surfaces "Needs Merge" (amber) ahead of "Placeholder" (gray).
- R15. When an email is saved on a placeholder — at creation (R3) or on later edit — the UI immediately shows a **Confirm-before-send** step: *"Send claim invite to jane@foo.com right now?"* with **Send** / **Not yet**. The email is stored on the placeholder either way; only the invite dispatch is gated by the captain's explicit confirmation. This catches typos and removes the auto-send abuse vector (stranger, rival, shared household email) while keeping the one-click fast path for captains who know the email is right. If a captain (or LO) later re-saves the same email on the same placeholder, the confirm step re-appears only if no open invite already exists for that (member, email) pair — existing open invites are reused, not duplicated.
- R16. When the invited registered user clicks the claim link, they see a **confirmation screen** showing the placeholder's identifying data — name, nickname, team, game count, current handicap — with **Confirm** and **This isn't me** actions. Merge fires only after explicit Confirm. The server also requires the logged-in user's auth email to match the invited email (forwarded-link mismatches are rejected with a clear message that the person whose email received the invite must be the one to claim). On Confirm, merge runs automatically via the existing claim/merge pipeline (`src/login/ClaimPlayer.tsx` → `claim-placeholder` Edge Function → `merge_placeholder_into_member` RPC); the snapshot step from R18 is added inside that shared pipeline so the auto-accept path is reversible too. "This isn't me" routes the placeholder into the LO's merge queue with a note that the invite was rejected, and the invite is marked closed.
- R17. For placeholders without an email (or whose invite was never accepted), the LO merge UI presents a side-by-side picker:
  - Left column: the placeholder, with all known identifying data (name, nickname, team, recent games, handicap).
  - Right column: a searchable list of registered users, **scoped to the LO's organization as a hard authorization boundary** (not only a UI filter). State may be used as a secondary UI filter within the org scope, but cannot widen the query beyond the org.
  - A "Merge" action at the bottom performs the merge after a confirmation step.
- R18. Immediately before any merge (whether triggered by accepted invite per R16 or by LO-initiated merge per R17), the system records a snapshot of the placeholder's pre-merge state. This snapshot is the basis for an LO-facing "Undo last merge" action available for a bounded retention window. Snapshot insertion lives inside the shared merge procedure so both paths are reversible. Snapshots are LO-readable within their org scope only, auto-purged at the retention window boundary, deleted on successful undo, and included in any user-account data deletion flow for the registered user involved.
- R19. When both the placeholder and the chosen registered user have recorded stats, the merge flow adds an additional confirmation step that explicitly flags stat collision and summarizes what will move where. The final "Confirm" button is disabled until the LO actively acknowledges.
- R20. Post-merge the placeholder record is deleted. No new stats, games, or lineup references may be written against it. Any in-flight references already captured against the placeholder are rewritten to the merged-into registered user.
- R21. The merge UI supports reversing the most recent merge via an undo action that restores the snapshotted placeholder and un-links any rewritten references within the retention window. Undo is **single-level** — only the most recent merge per LO is reversible; earlier snapshots remain queryable for audit but cannot be undone via this UI. If the registered user has recorded new stats (games, handicap changes) **after** the merge but within the retention window, undo surfaces those post-merge writes and requires explicit LO confirmation; otherwise undo is blocked with an explanation. Post-merge writes stay attached to the registered user on successful undo.
- R22. Every merge (R16 auto-accept or R17 LO-initiated), undo (R21), and placeholder delete (R12 or R20) writes a first-class audit log entry capturing: actor, timestamp, placeholder ID, snapshot reference, target registered user ID (for merges), and affected FK tables. The audit log is LO-readable within their org scope — not derived from incidental FK rewrite side effects.

## Success Criteria

- A captain can add 5 placeholders to an 8-person roster in under a minute — not the "disaster" the live test produced.
- In the next round of live testing, no captain or scorekeeper needs to ask the operator for help placing or resolving a placeholder.
- Placeholder status — and "needs merge" status — is visible at a glance in every player-facing surface, including live scoring.
- An LO can sit down with an accumulated "Needs Merge" backlog and work it to zero in one sitting without leaving the merge UI.
- Zero stale-state bugs: a newly created placeholder always appears immediately in its target slot and in the dropdown, from every entry point (wizard, team editor, lineup).
- No path exists to accidentally delete a placeholder that has stats; no path exists to accidentally merge to the wrong registered user without at least one confirmation step.

## Scope Boundaries

- **Not** building a public "claim yourself by name" flow for unregistered users. The existing email-invite path remains the user-initiated route; this brainstorm does not create a new self-serve claim UI.
- **Not** supporting placeholder merging across organizations. Placeholders are org-scoped; an LO only sees and manages their own org's placeholders.
- **Not** building a full merge history browser. A bounded "undo last merge" is enough for this iteration.
- **Not** addressing placeholder-to-placeholder deduping (the case where the same human was added as a placeholder on two different teams). That is a follow-up topic.
- **Not** redesigning the claim/invite email template itself. Content tweaks only where needed to reflect the auto-trigger.
- **Not** introducing a new auth path for placeholder-only users. Placeholders remain unauthenticated records until merged.

## Key Decisions

- **Scope placeholders to their team's league/organization rather than by state.** State exists today as a filter to keep the LO's registered-user search tractable. Placeholders are always created in the context of a specific team → league → operator, which is a tighter scope than state. State is dropped from the placeholder create form and is not required for placeholder records.
- **Two-state visual tag (Placeholder / Needs Merge).** Amber "Needs Merge" draws operator attention to records that carry real data. Gray "Placeholder" reads as a routine roster entry that does not yet need attention.
- **Inline fast-add gated behind an explicit "no player found" state.** Typo defense: a captain searching "Jon Smtih" for a registered "Jon Smith" will see "no player found" and must consciously decide to create a placeholder — not silently fast-add one.
- **Confirm-before-send for the claim invite.** Email entry alone does NOT fire an invite. After the captain or LO saves an email, the UI surfaces a confirm step before dispatch. This closes the auto-invite abuse vector (typos, stranger email, harassment) while staying one click away from the fast path. Email is always stored on the placeholder; only dispatch is gated.
- **Accepting user must confirm identity.** Clicking the invite link shows the placeholder's identifying data; merge only fires on explicit Confirm by a logged-in user whose auth email matches the invited email. Closes the forwarded-link and wrong-account attack surfaces that "silent auto-merge on click" would leave open.
- **Captain delete permitted for no-stats placeholders.** Fixing a typo on a placeholder the captain just created is not a ticket-worthy event. Zero stats means zero downside risk.
- **Snapshot-before-merge + undo.** Merges move real stats across accounts. Undo is the safety net that lets an LO act decisively instead of agonizing over each merge.
- **Delete placeholder after merge.** Prevents a stale placeholder from accidentally receiving new data or showing up in subsequent lineup dropdowns.
- **Two-stats confirmation step.** Most merges will be placeholder-with-stats → registered-user-without. The both-have-stats case is the one that loses data if done wrong, so it gets its own explicit confirmation.
- **Single "has stats" predicate.** One shared predicate — defined once in code — drives the tag color (R10), the delete guard (R12/R13), and the two-stats confirmation (R19). The exact inclusion/exclusion rules (voided matches, forfeit-only participation, lineup-only appearance) are pinned during planning but must resolve to **one** predicate used by all three sites, not three that can drift apart.
- **Undo retention window: 7 days.** Long enough for an LO to notice and reverse a mistake within the natural league cadence (weekly matches); short enough that snapshot storage does not grow unbounded. Snapshots older than 7 days are auto-purged.
- **Merge is audit-logged, not silent.** Because merges move stats across accounts, every merge/undo/delete emits a first-class audit record (R22), not a side effect inferred from FK rewrites. This is non-negotiable for a data-integrity feature.
- **Org is the authorization boundary, state is a UI convenience.** Consistent with the decision to drop state from placeholder creation: the LO's registered-user search (R17) is hard-scoped to the LO's organization. State may narrow the result list within that scope but never widens it.

## Dependencies / Assumptions

- The existing claim/merge pipeline (`src/login/ClaimPlayer.tsx` → `claim-placeholder` Edge Function → `merge_placeholder_into_member` RPC) already implements R16's auto-merge-on-accept end-to-end. This work extends that pipeline (adds the snapshot step from R18 inside the shared procedure, adds the auto-invite trigger from R15 on the create/edit side), not replaces it.
- Assumes `members` records reliably trace team → league → operator/organization, so org-scoping the LO merge UI is straightforward. This relationship needs verification during planning.
- Assumes `MemberCombobox` (`src/components/MemberCombobox.tsx`) is the single player-selection surface used by team editor, team wizard, match lineup, and scoring. Any additional selection surfaces would need parallel treatment.
- Assumes placeholder stats coverage — what counts as "has stats" — can be derived from existing joins (game participation, scoring records). The exact definition must be pinned down during planning, including edge cases like "was in a lineup but the match was voided."

## Outstanding Questions

### Resolve Before Planning

*(none blocking; all open items below can be handled during planning)*

### Deferred to Planning

- [Affects R8][Technical] Which state layer is stale in the wizard — TanStack Query cache, the wizard's local state, Zustand, or `MemberCombobox`'s internal search list? Planning should trace the actual mutation→query invalidation path.
- [Affects R15][Technical] Auto-invite trigger — hook into the members create/update mutation, or a dedicated invite service? De-dupe rules when an email is edited, re-saved, or matches a previously invited address on a different placeholder.
- [Affects R18, R21][Technical] Snapshot storage format — dedicated `placeholder_merges` table with JSONB payload, vs. soft-delete with `merged_into_id`. Retention window is decided (7 days, per Key Decisions); format and per-row `merge_id` tagging of rewritten FKs (so undo touches only rows the merge moved) are the remaining technical work.
- [Affects R14, R17][Needs research] Verify the `organizations` / `operators` / `leagues` / `teams` / `members` relationship chain actually supports a clean "placeholders in my org" query. If the chain is incomplete, this becomes a scoping decision in planning.
- [Affects R10][Technical] "Has stats" definition — first recorded game appearance? First completed match? Does a participation in a voided match count? Must be pinned down before the tag toggle logic is implemented.
- [Affects R20][Technical] Which foreign-key references must be rewritten on merge — game participations, lineup entries, handicap history, audit logs? Inventory needed during planning.
- [Affects R19][User decision] Optional: for the both-have-stats case, should the system actively notify the registered user of the pending merge (email / in-app banner), or is LO confirmation alone sufficient? Leaving as LO-only for now; revisit after first production merges.

## Next Steps

-> /ce:plan for structured implementation planning
