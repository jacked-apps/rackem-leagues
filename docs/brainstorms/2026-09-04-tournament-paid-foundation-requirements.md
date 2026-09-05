---
date: 2026-09-04
topic: tournament-paid-foundation
parent: docs/brainstorms/2026-08-26-tournament-bracket-requirements.md
roadmap_item: 1 (Real players + reusable pool + join)
---

# Tournament Paid Tier — Foundation: Real Players, Reusable Pool & Self-Add

> **This is roadmap item #1** from the paid roadmap in
> `docs/brainstorms/2026-08-26-tournament-bracket-requirements.md` — *the
> foundation most other paid features stand on.* It answers **WHAT** the paid
> identity layer is, not HOW to build it. Scoring, handicap races, money
> tracking, venue/tables, and phone alerts are **later brainstorms**; where the
> conversation touched them, they are captured here as **forward hooks**, not
> designed.

## Problem Frame

The free Tournaments tool (built, PR #264, gated on `BRACKETS_ENABLED`) runs on
**plain typed names that are thrown away when the tournament closes.** That is
correct for the free funnel, but it means a returning organizer starts from a
blank page every time, and nothing a player does in a tournament is real,
durable, or connected to them.

The paid tier's promise is **"set it up once, then it mostly runs itself"** — the
organizer does one painful setup (players, handicap system, race rules, venue),
and after that players self-score, the system calls the next pair to an open
table, and races are handicapped. Every piece of that depends on one thing that
does not exist yet: **real players with durable identity inside a tournament.**

This foundation delivers that identity layer:

- **Real accounts instead of typed names** — a player's name (and later
  handicap) travels with them; no re-typing each event.
- **Players self-add** by scanning a QR code / opening a share link.
- **A reusable pool** so a returning organizer's regulars are already there.
- **Durable, tagged results** so tournament play can count as real play.

The free tier is untouched — it stays "just names, nothing saved." Internal code
and routes stay `bracket*` (the name `Tournament` is taken by
`src/types/tournament.ts`, the BCA/APA championship-lookup concept).

## The Model (decided with Ed, 2026-09-04)

0. **The tier gate is a "Premium features" checklist, not a flag.** Paid setup
   has a step listing every paid feature as a toggle — *use self-scoring, use
   handicap races, use venue + tables, use phone alerts, collect an entry fee* —
   each flipped on for *this* tournament. As features get built, each **plugs a
   new row** into that list; the gate is designed once. A tournament is "**paid**"
   **derived** from *any* box being checked (no separate on/off switch to keep in
   sync). The **foundation itself is the baseline**, not a checkbox — going
   premium *gives* you real players + pool + self-add, and the checkboxes are the
   à-la-carte layer on top. The **paywall** sits at the **commit point**
   (start/use), *after* setup — a real checkout that **reuses the existing
   `PaymentCardForm`** at **$0 for now** (Jack wires Stripe + a real price later).
   The checked boxes + their settings **are** the
   reusable saved setup (see model #6). *(This is unit 1 — everything else clicks
   into it.)*

0b. **Tournaments are player-run, not organizational.** *Any player* can run a
   tournament — the organizer is a plain member, with **no league/org behind
   them**. So the organizer's **roster and any walk-up placeholders they create
   are anchored to the player**, not to an org (unlike league placeholders, which
   are operator/org-scoped). The saved setup + roster is a **per-player asset** —
   "owning" it just means **we save it so he can reuse it**, *not* that reuse is
   free.

0c. **Pricing leans per-tournament, first run likely free.** The player pays
   **each time** he runs a tournament; "owning the setup" only spares him
   rebuilding it, it does **not** buy future runs. The lean is a **free first
   tournament** (so he builds it, runs it, and feels the hassle it removes) then
   **pay-per-tournament** after. The saved setup + automation is exactly what
   makes repeat runs painless enough to be **worth the price** — that value bar
   ("saves a *lot* of hassle") is the whole justification. *(Strong product lean;
   final pricing is still Jack's — see PF0d.)*

1. **Real identity on participants.** The goal is that everyone in a paid
   tournament is a **registered account** (name + handicap travel everywhere). A
   walk-up who won't register becomes a **full app placeholder** — the same
   record type leagues already use: persistent, findable, and it **merges** into
   a real account if that person signs up later. The free-tier hook
   (`bracket_participants.member_id`, currently nullable/unused) is what this
   fills in.

2. **Participant *kind* is first-class.** Every participant is either a
   **registered member** or a **placeholder**, and that kind is the branch point
   for every later feature (scoring, alerts, races). It is decided and stored
   here; the features that read it come later.

3. **The organizer roster = "past players."** Everyone *this organizer* has ever
   had in one of *their* tournaments. Organizer-scoped, grows over time, and
   **pre-fills the hopper every event** so the organizer never starts blank.
   This is *their* list — not a search over every player in the whole app.

4. **Hopper → official list.** Two-stage entry:
   - **Hopper** = the candidate pool ("who *might* play"). Fills two ways: the
     organizer's past players are already sitting in it, and new people drop
     themselves in by **scanning the QR / opening the link**.
   - **Official list** = "who's actually in." A player moves hopper → official
     list when admitted. The organizer can also drop someone straight onto the
     official list flagged **unpaid** (the late arrival).
   - The **money half** (entry fee, paid/unpaid tracking) is a *later* piece
     (roadmap #3). This foundation builds the **hopper → official-list
     structure** and the admit action; the "paid" flag snaps onto it later.

5. **Same-name disambiguation** = **nickname + player number**, carrying over the
   league rule: when two same-named players would collide, their **nicknames
   must differ** so there is always a unique handle. Surfaces wherever the
   organizer picks a player or admits from the hopper.

6. **Reusable setup (saved config).** The one-time setup — handicap system, race
   rules (max/min race, loser-side race difference), venue — is **saved and
   reused**: next event it's already there, editable from that starting point.
   Only the player list changes event to event. *Later:* the saved setup is
   **transferable to other organizers** ("use my setup") and there may be
   **out-of-the-box starter templates**.

7. **Paid tournaments persist; free ones don't.** Because a tournament game can
   later count toward a player's real handicap, paid tournaments **save their
   participants and match results durably**, tagged with full context (organizer,
   tournament, game type, opponent, result, race). This is the backbone the rest
   of the paid line stands on, and it is the clean split from the free tier's
   purge-on-close behavior.

## Requirements

> **In scope = the identity foundation only.** Requirements marked **[hook]**
> are captured because the conversation settled a decision, but their full
> behavior belongs to a later brainstorm; here they exist only as a stored
> attribute or a durable data shape.

**Tier gate & premium-features checklist (unit 1)**
- PF0a. Paid setup includes a **"Premium features" checklist** — one toggle per
  paid feature — that the organizer flips on for this tournament. The surface is
  **extensible**: each future paid feature adds one row; the gate is built once.
- PF0b. A tournament's **tier is derived** — it is "paid" iff **at least one**
  premium feature is checked. There is no separate paid/free switch to keep in
  sync. The **foundation (real players + pool + self-add) is the baseline** of
  paid mode, not a checklist row.
- PF0c. The gate is **two moments**, reusing existing payment UI:
  - **Verify at setup** — reuse `src/components/PaymentCardForm.tsx` (its **mock
    $0.00 authorization**, already used in the LO application at
    `src/leagueOperator/questionDefinitions.tsx`) to put a **verified card on
    file**. It tokenizes the card and **always passes** today.
  - **Charge at start** — the money moment is the **"start this tournament"**
    action, which charges the stored token. **$0 / no-op for now**, so starting
    is free; this is the single clean seam where **Jack later drops in the real
    Stripe charge + non-zero price**. Nothing else about the gate depends on him.
  - This split fits the money model (PF14a / model #0c): **one card on file,
    charged per tournament start, first start free** (verify always; charge
    conditionally).
- PF0d. The **flag that decides "paid" lives on the tournament** (this event is
  premium) — which fits the **per-tournament pricing lean** (model #0c: pay each
  run, first likely free). Keep the *readers* (every feature checking the tier)
  decoupled from the *setter*, so the final monetization model changes only
  **how** the tier is set, not everything that reads it. **[hook: pricing /
  first-free / final model → Jack / business gate]**
- PF0e. The checked premium features + their settings **are** the reusable saved
  setup (see PF14) — next tournament they're pre-checked and pre-configured.
- PF0f. Premium features may **depend on each other** (e.g. phone alerts need
  venue+tables; payout needs entry fee), so the checklist is **not** fully
  independent — checking one may require another. The dependency rules are
  handled **per feature as each lands**, not designed now. **[hook]**

**Identity & participant kinds**
- PF1. A paid-tournament participant links to a **real member record** via
  `bracket_participants.member_id` (registered account or placeholder).
- PF2. Every participant carries a first-class **kind** — `registered` vs
  `placeholder` — readable by every later feature. **[hook: scoring/alerts/races
  branch on it]**
- PF3. An unregistered walk-up is created as a **full app placeholder**
  (persistent, globally findable, mergeable), *not* a throwaway name and *not* a
  new lifecycle-exempt concept. If they register later, their tournament history
  merges into the new account via the existing merge machinery.
- PF3a. Because tournaments are **player-run with no org** (model #0b), a
  tournament-created placeholder is **owned by the organizing player**, not an
  operator/org. The league placeholder machinery is currently org-scoped, so it
  must be **generalized to accept a player owner**. **[resolve at plan time — the
  direction is player-owned; the mechanism is the open part]**
- PF4. The free tier is unchanged — plain typed names, purged on close. Paid vs
  free is a property of the tournament, and the two participant models coexist.

**The organizer roster ("past players")**
- PF5. Each organizer has a **roster of their past players** — every member who
  has been a participant in one of that organizer's tournaments — scoped to that
  organizer and growing automatically as they run events.
- PF6. The roster **pre-fills the hopper** at setup so regulars are one tap away;
  the organizer drops the ones not attending and adds anyone new.
- PF7. Reaching *your own* past players needs **no per-player consent** — the
  roster is a candidate list, not participation. Reaching **strangers across the
  whole app** is explicitly **out of scope** for this foundation.

**Hopper & official list** *(Ed's worked-out flow, 2026-09-04)*
- PF8. A paid tournament has a **hopper** (candidate pool) distinct from its
  **official list** (admitted players who appear in the bracket).
- PF9. There are **three ways into the hopper**:
  - (a) **Search** by name / player number and add — from the organizer's past
    players or a system search.
  - (b) **Share link** — the player follows it and adds themselves.
  - (c) **QR code** — the player scans it and adds themselves.
  The link/QR encode **only the tournament**; a self-join records **only the
  requester's own identity** (one identity in the hopper at most once). *(Carries
  R24/R27.)*
- PF10. Self-add (b/c) drives toward a **registered account** — an
  unauthenticated scanner is prompted to sign in / register before landing in
  the hopper. **[hook: exact auth flow finalized with the sign-in work]**
- PF11. **Managing a hopper entry = tap the name → a context menu** with:
  - **Eject** — remove them from *this* hopper (they stay in the roster and can
    be searched back in; this is not a persistent ban).
  - **Set as paid** — move to the official list, flagged paid.
  - **Add as unpaid** — move to the official list, flagged unpaid (late arrival).
  The menu **actions** live here; the **paid/unpaid money semantics** are a
  **[hook: roadmap #3]**.
- PF11a. A **persistent "ban from all my tournaments"** is *not* v1 — eject is
  per-hopper only. **[hook: optional later nicety]**
- PF12. The hopper and its menu show **nickname + player number + home
  city/league** so the organizer can distinguish same-name players before
  ejecting/admitting. *(Carries R26.)*

**Same-name handling**
- PF13. Participants are disambiguated by **nickname + player number**; the
  system enforces that colliding same-name players have **distinct nicknames**
  within a tournament (mirrors the league same-team rule).

**Reusable setup**
- PF14. A paid tournament's **setup config** — the **checked premium features**
  (PF0a/PF0e) *and* each one's settings (handicap system, race rules, venue) — is
  **saved and reusable**: a returning organizer starts from their last setup
  (boxes pre-checked, values pre-filled) and edits from there, changing only the
  player list. Every configurable paid feature must contribute its settings to
  this saved config **from day one** (the parent doc's "copy tournament"
  principle).
- PF14a. The saved setup + roster is a **per-player asset**, anchored to the
  organizing member (model #0b). "Owning" it means **it is saved for reuse** —
  it does **not** grant free future runs; the player **pays per tournament**
  (lean: first run free). **[hook: pricing/first-free is monetization — Jack /
  PF0d]**
- PF15. **[hook: later]** The saved setup is **transferable to another
  organizer** and there may be **starter templates**. Shape the saved config so
  it *can* travel; do not build sharing/templates now.

**Durable results**
- PF16. Paid tournaments **persist participants and completed match results**
  durably (they are **not** swept like free-tier data).
- PF17. Each saved result is **tagged with context** — organizer, tournament,
  game type, both participants, winner, and race length — rich enough that a
  future handicap engine can slice tournament games by organizer, by
  all-tournaments, or fold them into league/global. **[hook: roadmap #5 reads
  this; it is not read here]**

## Success Criteria

- An organizer picks premium features from a **checklist**, and the tournament
  becomes "paid" **because** a box is checked — a **fake, flag-gated wall** at
  start lets them through free; a future feature ships by **adding one row** to
  that same checklist.
- A returning organizer opens setup and their **past players are already
  present**; they build the field by picking regulars + adding a few new names,
  never re-typing the roster.
- A new player **scans the QR, registers, and appears in the hopper**; the
  organizer admits them to the official list; a walk-up who won't register is
  added as a **placeholder** that will merge if they sign up later.
- Two same-named players are **always tellable apart** (nickname + number +
  home) at pick and admit time.
- The organizer's **handicap/race/venue setup survives** to the next tournament,
  editable from that starting point.
- A completed paid tournament's **results are still there afterward**, tagged
  richly enough that the future handicap work can consume them — nothing about
  the free tier's behavior changed.

## Key Decisions

- **The tier gate is a checklist, built first (unit 1).** Every paid feature is a
  toggle row; "paid" is *derived* from any box checked; the foundation is the
  baseline. Designing the gate once means each later feature just adds a row — no
  retrofit. The paywall is a **fake, flag-gated pass-through** now; the real
  unlock and monetization model are Jack's, and the tier's *setter* is kept
  decoupled from its *readers* so that decision doesn't ripple.
- **Goal = registered; fallback = full placeholder.** Reuses the exact machinery
  built for "a real person without an account yet who may register and merge
  later." Cost accepted: casual bar-night walk-ups become permanent records.
  *(This intentionally supersedes the free-tier R9 "distinct, lifecycle-exempt
  entrant" concept — that rule protects the ephemeral free tier; the paid tier
  wants persistence, so it uses real placeholders.)*
- **Roster is organizer-scoped, not global.** "Past players" = people *you've*
  run. This sidesteps the global-pool consent problem entirely for v1 while
  still killing the re-typing pain.
- **Hopper vs official list is the entry structure; money is a later layer.**
  Build the two-stage flow now so roadmap #3 only adds the fee/paid semantics.
- **Participant kind is stored now, read later.** The foundation's job is to
  record `registered` vs `placeholder`; the features that branch on it
  (scoring, alerts, races) are separate brainstorms.
- **Paid persists, free purges.** Handicap feedback forces durable, tagged
  results — the defining data difference between the tiers.
- **Capture rich results; don't build the engine that reads them.** The handicap
  cascade (league → tournament → per-organizer) is roadmap #5's design.

## Forward Hooks (captured here, designed elsewhere)

These were decided or raised in conversation and must not be lost, but they
belong to later brainstorms:

- **Scoring policy (→ roadmap #4, winner self-confirmation).** A tournament match
  is only 2 people, unlike a league where any teammate can score. So kind
  decides the path: registered-vs-registered → self-score; registered-vs-
  placeholder → trust the registered player *or* official enters; placeholder-vs-
  placeholder → official enters. The organizer sets the **policy up front**:
  *accept single-registered-player scoring* vs *official manually enters every
  placeholder match*.
- **Handicap sourcing & the "tournament handicap" (→ roadmap #5, handicap
  races).** Tournament games can be a handicap source **behind a setting**, using
  the existing first-N-games mechanism. Because league players stabilize (~200
  games / ~3 seasons), this mainly moves **new** players. Tournament games also
  form their **own handicap context** ("tournament handicap"), possibly
  **scoped per-organizer** ("Joe Smith's tournaments") via the same specific→
  broad cascade. This foundation only guarantees the **data exists and is tagged**
  (PF16–PF17).
- **Money / paid-unpaid (→ roadmap #3).** The admit action and an
  unpaid-direct-add exist here; entry-fee amounts and paid/unpaid tracking are #3.
- **Transferable setups & templates (→ later).** PF15.

## Dependencies / Assumptions

- **Builds directly on the free-tier schema.** `bracket_participants.member_id`
  already exists as the nullable hook; `brackets` / `bracket_matches` already
  carry the match tree. This foundation populates the hook and adds the roster /
  hopper / paid-persistence layer alongside the existing tables. *(Verify the
  exact shape at plan time.)*
- **Placeholder machinery is reused but generalized to a player owner.** Members
  table already holds registered (`user_id` set) and placeholder (`user_id` null,
  `system_player_number`) records, with a merge system, archive rules, and
  org-scoping. Tournaments are player-run with no org (model #0b), so a
  tournament-created placeholder is **owned by the organizing player** — the
  org-scoped machinery must be generalized to accept a player owner (PF3a). The
  *direction* is decided; the *mechanism* is a plan-time detail.
- **Self-add auth flow** rides on the passwordless / one-door sign-in work
  (`feat/passwordless-sign-in`, flag-gated) — a scanner who isn't logged in is
  routed through it before landing in the hopper.
- **Checkout reuses existing payment UI.** `src/components/PaymentCardForm.tsx`
  is a reusable tokenized card-entry component doing a **mock $0.00 authorization**
  (verify → pass/fail, always passes today), already wired into the LO
  application (`src/leagueOperator/questionDefinitions.tsx`); `src/about/Pricing.tsx`
  also exists. The gate reuses the verify at setup and adds a **charge-at-start**
  step ($0 now). **Jack's only remaining piece** is Stripe connectivity + the real
  per-tournament price at start — everything else (checklist, verify, $0
  charge-at-start, tier flag) ships without him. *(Confirm `PaymentCardForm`'s
  exact reuse surface + token persistence at plan time.)*
- **Handicap data sources exist** (team-format `starting_handicap_*`, BCA/custom
  systems, per-member Fargo) but a universal singles number is not stored;
  detailed in roadmap #5.

## Outstanding Questions

### Resolved with Ed (2026-09-04)
- **Placeholder ownership** — **player-owned.** Tournaments are player-run with no
  org, so a tournament-created placeholder belongs to the organizing player; the
  org-scoped machinery is generalized to accept a player owner (PF3a). Mechanism
  is a plan-time detail, direction is set.
- **Add-player / hopper flow** — **Ed's worked-out design captured** (PF9/PF11):
  three ways in (search / link / QR); manage via tap-name → menu (eject / set
  paid / add unpaid). Eject is per-hopper, not a persistent ban.
- **Roster growth semantics** — **added on admission, sticky after.** A member
  joins the organizer's roster the moment they're admitted; ejecting them from a
  hopper does **not** remove them from the roster (so they can be searched back
  in). Cancelled-tournament clutter is accepted as rare/harmless.

### Resolve before planning (this foundation)
- _None outstanding — the foundation is fully specified. Remaining unknowns are
  plan-time mechanics (placeholder player-owner generalization, `PaymentCardForm`
  reuse surface + token persistence), not product decisions._

### Deferred to their own brainstorms (do not solve here)
- Scoring trust model + organizer policy toggle → **#4**.
- Handicap cascade, "tournament handicap," per-organizer scoping, the
  count-toward-handicap **integrity question** (an organizer running soft matches
  to pad a number — *whose* setting authorizes it) → **#5**.
- Entry fee / paid-unpaid semantics → **#3**.
- Venue, tables, smart sequencing, phone alerts → **#2 / #6**.
- Transferable setups + starter templates → later.

## Shared with the league side

Two of this foundation's downstream features are **shared league+tournament
systems**, not tournament-only (per the parent roadmap): **self-scoring** (#4)
and **handicap races** (#5). The league's modular scoring already reserves the
race-length mechanism and has the many-eyes confirmation concept. This
foundation's **durable, tagged results** (PF16–PF17) and **participant kind**
(PF2) are the shape those shared engines will read — build them so both halves
benefit, not as a tournament-only duplicate.

## Future Idea — Tournament Series (NOT this foundation)

**Captured 2026-09-05 (Ed) — do not build here; a later parent-roadmap item
(~#8).** A **tournament series**: a number of individual tournaments run and
aggregated as **one larger tournament** — a tour/season with stops whose results
roll up into an overall standing / champion. Well beyond this foundation; parked
so the idea isn't lost. Fold into
`docs/brainstorms/2026-08-26-tournament-bracket-requirements.md`'s Paid Feature
Roadmap when that branch is next touched.

## Next Steps

→ `/ce:plan` **done** — see
`docs/plans/2026-09-04-001-feat-tournament-paid-foundation-plan.md`. Several
decisions **evolved during planning** (this section's earlier "persistent tagged
results" / "player-owned placeholder" language is superseded): walk-ups are
**tournament-scoped disposable entrants** (not app placeholders), and
**tournaments themselves are disposable** — only the per-player **setup** is saved;
results-persistence, if any, is a per-player handicap-history concern for roadmap
#5. See the plan's "Resolved Decision" for the current shape. Then resume
`/ce:brainstorm` per remaining paid feature in the parent roadmap.
