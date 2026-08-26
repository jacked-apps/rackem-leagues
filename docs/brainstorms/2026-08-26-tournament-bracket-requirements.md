---
date: 2026-08-26
topic: tournament-bracket
---

# Tournament Bracket Tool — Free Tier v1 (paid features follow as separate brainstorms)

## Problem Frame

The app has no standalone tournament/bracket tool. We want to add one in two tiers:

- **Free tier** — a genuinely competitive "best of the free ones" bracket tool (think Challonge/Brackethq). Any logged-in user can run a bracket for a bar night, charity event, etc. Participants are just **plain text names** — no accounts, nothing saved. This is a growth funnel: people find the free tool, then discover the league product.
- **Paid tier** — turns a bracket into a live, venue-based, "smart" tournament: real players self-add via QR, get checked in against an entry fee, receive "you're up / on deck / your table" notifications, self-confirm winners to advance the bracket, and play handicapped races. This is the differentiator generic free tools can't match — but it is **substantial net-new work** (see Key Decisions), not just wiring.

The organizer is always a logged-in user (a free account suffices); there is no fully-anonymous tournament creation.

**Build staging (decided 2026-08-26 with Ed):** ship the **Free Tier as v1**, built **paid-aware** (name the entity Bracket/Event not `Tournament`; structure participants + matches so real players, confirmation, and races can attach later — without building those now). Then take **each paid feature as its own brainstorm → plan**, sequenced easy → in-depth (see **Paid Feature Roadmap**). This validates the funnel cheaply and keeps each paid system in a focused scope. Most of the review's hardest open questions live in the paid tier, so this also defers them to the brainstorm that owns them.

## Tier Comparison

| Capability | Free | Paid |
|---|---|---|
| Who can run one | Any logged-in user | Any logged-in user |
| Formats | Single + double elim | Single + double elim |
| Participants | Plain text names | Real players (global pool) + ad-hoc entrants |
| Live shareable bracket | Yes | Yes |
| Advance winners | Organizer taps | Players self-confirm (organizer records for ad-hoc) |
| Venue + numbered tables | — | Yes |
| Entry fee + QR "hopper" check-in (paid/unpaid) | — | Yes |
| Push notifications (up / on-deck / table) | — | Yes |
| Auto-handicap races | — | Yes |
| Data saved between tournaments | Nothing | Real players persist (they're accounts) |
| Payout / prize-split math | — | Deferred to later phase |

## Requirements

> **v1 scope = "Free Tier — Bracket Basics" only.** The paid groups below are captured so the future per-feature brainstorms start from a shared reference — they are **not** part of v1. See **Paid Feature Roadmap**.

**Free Tier — Bracket Basics (v1)**
- R1. Any logged-in user can create and run a tournament at no cost.
- R2. Support single-elimination and double-elimination formats (both tiers).
- R3. Free-tier participants are plain text names only — no accounts, no identity linkage.
- R4. Organizer seeds the bracket (seeded / ranked / random ordering) and advances winners by tapping.
- R5. A live, shareable bracket view that updates as winners advance.
- R6. Free tier persists nothing between tournaments and does zero money/status tracking — parity with existing free tools.

**Participant Model & Data Lifecycle** _(free-tier lifecycle — ephemeral names, R6 + close/purge R23 — is v1; the three real-player kinds R7–R9 are FUTURE/paid)_
- R7. Paid tournaments support three participant kinds: (a) logged-in members, (b) existing system placeholders pulled in with their handicap/stats, (c) ad-hoc "tournament entrants" created during the tournament.
- R8. Ad-hoc tournament entrants (kind c) and all free-tier names are **purged when the tournament ends**. Real members and real placeholders (kinds a, b) are never modified or purged.
- R9. Tournament entrants use a **distinct internal concept/name** from the app's persistent "placeholders" so they never inherit the persistent-placeholder lifecycle rules (never-hard-delete, BCA findability, merging).
- R23. A tournament has an explicit **end/close** action that triggers the purge of ad-hoc entrants + free-tier names. Tournaments abandoned without a close are **auto-swept after a period of inactivity**, so the quarantine guarantee never depends on organizer diligence.

**Paid Tier — Player Pool & Check-in (the "Hopper") — FUTURE (own brainstorm)**
- R10. Organizer sets an entry fee for the tournament.
- R11. Players self-add to a pending **hopper** by scanning a QR code / opening a share link (uses their player number/identity).
- R12. Organizer views the hopper and moves each player onto the **official list** as they pay the fee.
- R13. A "start tournament" action admits any players still in the hopper into the bracket, flagged **unpaid** (supports late arrivals / pay-later).
- R14. Paid/unpaid status is tracked per participant. (Payout math itself is deferred.)
- R24. The QR/share link encodes **only the tournament** (never a caller-supplied identity). A hopper-join authenticates the requester and records **only their own** identity; one identity may appear in the hopper at most once; the link is invalidated when the tournament starts.
- R25. v1 does **not** process payments. "Paid/unpaid" is an organizer-asserted flag against money collected **outside the app** (cash, etc.) — no in-app charging, escrow, or refunds.
- R26. The hopper/check-in surface shows enough to **distinguish same-name players** (player number + home league) before the organizer admits/charges them.

**Paid Tier — Live Play (Venue, Tables, Notifications) — FUTURE (own brainstorm)**
- R15. A paid tournament is held at a **venue** with a set of numbered tables.
- R16. Organizer assigns ready matches to tables.
- R17. Logged-in players receive push notifications: **"you're up"** (assigned a table, with the table number) and **"you're on deck"** (your match is next).
- R18. Logged-in players can view the live bracket and see who is up / on deck / at which table.
- R27. Tournament push eligibility is tied to the **player's own join action** (QR scan / explicit accept), not to an organizer roster-add. A player the organizer adds directly is notified **in-app only** until they accept.

**Paid Tier — Winner Confirmation & Handicap Races — FUTURE (own brainstorm)**
- R19. Logged-in players **self-confirm** their match winner, which advances the bracket (reuses the existing winner-confirmation system). When an opponent is an ad-hoc entrant (not logged in), the organizer records the result.
- R20. Paid tournaments compute a **race-to-N per match** from each player's handicap/rating; the organizer can enter a rating for ad-hoc entrants or override.
- R28. The organizer has an **unconditional override** to record/force any match result — including logged-in-vs-logged-in matches where a player refuses or is unable to confirm — so the bracket can never permanently stall. (Which confirmation normally advances a match is an open decision — see Outstanding Questions.)

**Access & Scope**
- R21. The organizer must be a logged-in user (free account is sufficient); no fully-anonymous tournament creation.
- R22. A tournament is a **standalone entity** with a **global player pool** — any player from any league — not scoped to a single league. A league/org link is optional and only unlocks convenience (e.g., quick roster access), not a requirement.

## Success Criteria

**v1 (Free Tier):**
- A logged-in user with no league can run a complete single- **and** double-elimination bracket for free, seed it, tap winners to advance, and share a live link.
- The free tier covers the core capability set of common free bracket tools (names, both elim formats, live shareable bracket) with nothing saved after — and its data model is shaped so paid features (real players, confirmation, races, venue) can attach later without a rewrite.
- No tournament data leaks into or mutates the persistent member/placeholder pool; ephemeral names are gone after the tournament closes (or auto-sweep).

**Future (per paid brainstorm):** each paid feature defines its own success criteria — e.g. players self-add via QR + paid/unpaid check-in; up/on-deck/table push; self-confirm advances the bracket; handicapped races.

## Paid Feature Roadmap (each its own brainstorm → plan)

Rough sequence, easy → in-depth. Ordering is a starting point, not locked. Each carries the relevant requirements + the open question the review surfaced.

1. **Venue + numbered tables** (R15–R16) — *likely light.* Verify existing venue data fits "numbered tables." Foundation for table-based notifications.
2. **Real-player pool + join** (R7–R9, R21–R22, R27) — *medium.* Attach real players/placeholders to a bracket; QR/link join; the global-pool **consent** question; the Bracket-vs-`Tournament` **naming** decision.
3. **Hopper / entry fee / check-in** (R10–R14, R24–R26) — *medium.* Pending hopper → paid/unpaid → official list → start. QR security (R24); "paid = organizer flag, no in-app payment" (R25); same-name disambiguation (R26).
4. **Winner self-confirmation** (R19, R28) — *in-depth.* New/generalized confirmation storage (FK reality); the **1v1 trust model / what advances a match** decision; organizer override.
5. **Handicap races** (R20) — *in-depth.* Net-new **race calculators**; rating source (saved handicaps + player-entered Fargo w/ organizer confirm).
6. **Up / on-deck / table notifications** (R17, R27) — *in-depth.* New event-dispatch path on the push pipeline; depends on the push branch reaching `main`; PWA/iOS push caveats + in-app fallback.
7. **Payout helper** — *later.* Prize-split math on top of the hopper's paid data.

## Scope Boundaries

- **v1 ships the FREE tier only.** Every paid feature (confirmation, notifications, handicap races, hopper/entry-fee, venue/tables, payout) is deferred to its **own brainstorm → plan** — see Paid Feature Roadmap. Build v1 paid-aware, but build no paid feature now.
- **Payout / prize-split math is out of scope for the near term** — comes after the earlier paid features land.
- **Round-robin and Swiss formats are out of v1** (single + double elim only).
- **No anonymous tournament creation** — the organizer is always logged in.
- **Free tier is deliberately bare:** no venue, tables, notifications, handicaps, confirmation, or persistence.
- **PWA only** — no native app (per project constraint).
- No mid-tournament re-seeding or complex tiebreak rules beyond standard seeding/advancement.

## Key Decisions

- **Free = "just names," Paid = real players + live layer.** Matches how existing free tools actually work and keeps the free-tier build minimal; the paid tier is where identity, money, and notifications enter.
- **Reuse is real but thinner than it first looked (corrected by review).** The paid tier borrows *concepts and some code*, but each existing system needs real net-new work — verified against the codebase:
  - **Winner-confirmation** (`game_confirmations`): `match_id`, `game_id`, and `confirmer_id` are all NOT NULL FKs to league tables/members. A bracket match — especially with ad-hoc entrants who aren't members — can't insert a confirmation row as-is. Needs a new table or a schema generalization, and the 1v1 trust model differs from league "many-eyes" (see Outstanding Questions).
  - **Handicap/race**: the `race_length_adjustment` mechanism and its race charts are RESERVED stubs that throw — no shipping code computes a race-to-N today. R20 is net-new algorithm work.
  - **Web Push pipeline**: message/conversation-bound (dispatch takes a `message_id`, resolves recipients via `conversation_participants`). A tournament event has no message/conversation, so it needs a parallel event-dispatch path, not just a policy row + deep-link.
  - **Single-elim generator** (`src/utils/playoffGenerator.ts`): tied to league standings, requires an even bracket size, drops odd teams — only the seed-pairing math is portable. Arbitrary walk-up fields with byes are net-new; double-elim is fully net-new.
  - **Takeaway:** budget the paid tier as a substantial build, not "just wiring."
- **Tournament is standalone + global player pool.** Supports "any player from any league" and a public growth funnel, rather than nesting tournaments inside a single league's data.
- **Ad-hoc entrants are quarantined and purged.** A distinct concept from persistent placeholders, protecting the hard guardrails around real placeholder records.
- **Entry via a QR "hopper" with paid/unpaid check-in.** Organizer-controlled admission that also lays the groundwork for the deferred payout helper.

## Dependencies / Assumptions

- **Push pipeline dependency (bigger than a policy row).** Builds on the message-push system on `feat/message-push-dispatch` (gated behind `PUSH_NOTIFICATIONS_ENABLED`, not yet in `main`). That pipeline is **message/conversation-bound** — dispatch takes a `message_id`, resolves recipients via `conversation_participants`. A tournament "you're up" event has no message/conversation, so it needs a **new event-dispatch path**. Also assumes the push branch is merged + un-gated before paid notifications ship.
- **Rating source for singles races (clarified with Ed).** The app already has **two saved handicap systems** (team-format `starting_handicap_3v3/5v5` + the documented BCA / custom-5-man systems), so there *is* saved handicap data to draw on. What's missing is a universal **singles Fargo** stored per player — FargoRate is entered per-season at lineup-lock, not saved on the member. Plan: use saved handicaps where they apply; where Fargo is wanted, the **player enters their own Fargo with organizer confirmation** (or the organizer enters it). The **race calculators themselves are expected net-new work** (the `race_length_adjustment` mechanism is a reserved stub today).
- **Single-elim generator is not directly reusable.** `src/utils/playoffGenerator.ts` is standings-bound, even-bracket-only, drops odd teams; only the seed-pairing math is portable. Arbitrary entrant counts with byes are net-new; double-elim (losers bracket + grand-final reset) is fully net-new.
- **QR/link identity** assumes a stable per-player identifier to reference (verify what exists). The link must encode only the tournament, not a caller-supplied identity (see Outstanding Questions → security).
- **Naming collision.** The app already uses `Tournament` (`src/types/tournament.ts`) for BCA/APA/VNEA/UPA **championship lookups**. This bracket feature needs a **distinct name** (e.g., "Bracket" / "Event") so the two concepts don't collide in schema, routes, and types.

## Outstanding Questions

### Resolve Before Planning (Free Tier v1)
_Resolved by the free-first decision:_
- **Funnel worth building now?** → Yes, but cheaply: build the thin free tier first to validate before investing in the net-new paid systems.
- **Sequencing?** → Free tier is v1 (both single + double elim, per Ed); paid features layer on as separate brainstorms (see roadmap).
- **Public vs login bracket view?** → Free tier is **public, names-only** (no PII), so the share link works as a funnel. The paid PII view is decided in its own brainstorm.
- Confirmation trust model + global-pool consent → moved to their paid roadmap items.

_No hard blockers remain for the free-tier plan._

### Deferred to Planning (Free Tier v1)
- [Affects naming][Technical] Pick the entity name now (even free needs one) — Bracket / Event, distinct from the existing `Tournament` championship type.
- [Affects R2][Technical] Double-elimination generation (losers bracket + grand-final reset) + bye handling for non-power-of-two fields; and the double-elim rules question (does the losers finalist get two chances at the grand final?).
- [Affects R4/R5][Design] Bracket display/IA: layout for large fields on mobile (zoom/pan/round-nav), double-elim two-tree layout, seeding UI interaction, empty/pre-start state.

_Paid-tier open questions live with their **Paid Feature Roadmap** items, not here._

## Next Steps
-> `/ce:plan` for the **Free Tier v1**. Then resume `/ce:brainstorm` per paid feature in the roadmap (starting with venue).
