# Player & Captain Onboarding — New-League Cold Start Requirements

> **Date:** 2026-05-28
> **Status:** Brainstorm complete — open questions resolved 2026-05-28; ready for planning
> **Origin:** Brainstorm exploring "what's best for the app before Ed's meeting,"
> which converged on player/captain onboarding as the highest-leverage work.
> Related: `docs/brainstorms/2026-05-17-bca-pitch-strategy.md` (this is the
> CSI/BCA value prop — operators are lost at exactly this moment).

---

## Problem Statement

Getting people **onto the app and onto the correct team** is the biggest
friction in the product, and it concentrates almost entirely at one moment:
**the cold start of a brand-new league.**

- **Steady state is basically solved.** Once a league is rolling, returning
  teams/players carry over season-to-season, so recurring onboarding is light.
- **The cold start is the nightmare.** A new league means new teams, new
  captains, and 60–70 new players who must all get in at roughly the same time —
  often the first league night, with a hard wall (e.g., matches start at 7:30,
  half the players arrive early, half arrive right on time).
- **The amplifier:** nobody at any level is tech-savvy. LOs, captains, and
  players alike. (Example: a perfectly capable captain who knows the legacy APA
  app but is lost the moment she's shown anything new.)
- **The current failure mode:** the LO becomes the single help desk for
  *everyone* — teaching every captain and player how to get the app, log in,
  find their team, find the schedule, get to tonight's match, and score it. The
  LO is bombarded and the whole thing stalls.

Today's onboarding is a **one-to-one push**: someone who knows each person's
email types it in, one at a time, then chases an email/QR/handoff handshake.
Delegating to captains spread the load but didn't change the shape — it's still
"enter every email." And once a player logs in, there's no reliable path to the
team they're supposedly on ("Find a League" is a dead button), so they get lost.

This matters now because the app is pre-launch with **no real users**, and the
scarcest asset is *real usage / a first pilot league*. Onboarding friction is
the #1 barrier to that — and it's the exact moment CSI/BCA loses operators, so
solving it is also the spear tip of the partnership pitch.

## Goals

- A non-tech **captain** can onboard their whole team by doing two things:
  **share one link/QR, and tap "approve"** as people appear. No typing emails,
  no per-player data entry.
- A non-tech **player** can get from "never heard of the app" to "on my team,
  looking at tonight's match" with the fewest possible steps and **zero
  navigation** — ideally just: scan → sign in → land on tonight's match.
- The **LO's** cold-start job shrinks to "are my ~10 captains set?" — the LO is
  never the help desk for individual players.
- A new league night can **start on time** with captains scoring, while players
  trickle onto their own devices over the night and season (onboarding is
  progressive, not a hard 7:30 deadline for all 70).
- Everything is **additive** — the new easy paths sit alongside the existing
  email/QR/handoff flows; nothing that works today is removed.

## Non-Goals

- **Steady-state / returning-player onboarding.** Handled by season carryover;
  not the target here.
- **Helping leagues form** (recruiting enough people, agreeing on a night/game).
  That's a real-world organizing problem the app barely touches.
- **Public league discovery ("Find a League")** as a search-and-browse front
  door — deferred follow-on (see below).
- **LO/captain lost-player *search*** as a discovery tool — deferred follow-on.
- **Just-in-time at-the-table claim** as a distinct flow — deferred follow-on
  (though the in-person QR is in scope as a distribution channel).
- **Replacing the existing onboarding methods.** They stay.
- **Reworking the registration/auth system itself.** Simplifying it is noted as
  a consideration, not a goal of this work (one exception: the join-token must
  survive it — see Functional Requirements).

## Users / Actors

- **League Operator (LO):** sets up the league + teams (already served by the
  league wizard), and onboards **captains**. Often non-technical.
- **Captain:** controls their own team's roster; onboards **players**. Often
  non-technical (the binding constraint — the cascade only works if they can
  operate it).
- **Player:** joins a team, keeps score, wants to see how they're doing. Often
  non-technical; may onboard before the night or trickle in during it.

## User Stories / Scenarios

1. **Captain onboards their team (the common case).**
   A captain pastes one persistent team link into the group chat their team
   already uses (Messenger, SMS), or shows a QR at the table. Each player taps
   it, signs in, says "add me, Joe Johnson," and appears in the captain's
   pending list. The captain taps approve. Joe is on the team and lands on
   tonight's match.

2. **Player self-adds with no placeholder waiting.**
   A brand-new player (or a sub the captain never listed) taps the team link,
   types their own name ("add me"), and the captain approves — creating *and*
   filling the roster spot in one tap. The captain never pre-typed anything.

3. **Player who won't use the app (permanent placeholder).**
   The captain still manually creates a placeholder (name only) so that player
   can sit in lineups, be scored, and appear in stats. The self-add path is the
   easy lane; the manual placeholder remains the fallback.

4. **Opening night, 60–70 players, hard 7:30 wall.**
   Captains (onboarded beforehand) can score their matches at 7:30 regardless of
   how many players have set up their own devices. Players onboard progressively
   via the team link/QR and join the scoring/confirming as they get set up.

5. **Non-tech captain needs hand-holding.**
   A captain who's lost in any new app is walked through a short wizard:
   "Step 1: here's your team link / QR. Step 2: share it. Step 3: approve people
   as they appear." The LO is walked through the mirror wizard for adding
   captains.

6. **Player taps the link and registers from scratch.**
   A player with no account taps the team link, goes through the multi-step
   registration (page → confirmation email → click link → profile form → member
   created), and still lands **on the correct team** at the end — the join
   intent survives the whole flow, including clicking the email link on a
   different device than they started on.

## Functional Requirements

**The unifying primitive** (applies recursively: org → team-captain, team →
player): *share an artifact → the person self-claims → they land on their role →
one level up approves.*

- **Persistent, roster-aware team join link/QR.**
  - Lives with the team for the **whole season** — captain shares it once and
    never regenerates it; new mid-season players use the same link.
  - On open, reads the **live roster** and shows: open placeholder spots
    (claimable), already-claimed spots (visible but taken). A player can only
    claim an *open* spot.
  - Supports **"I'm not listed — add me"**: the player provides their own name;
    approval creates and claims the spot together (match-or-create, not
    blind-create).
- **Captain approval is the gate.** Because the link is persistent and
  shareable (and can be forwarded), a claim is a **request** until the captain
  approves. The lifecycle (open placeholder → claim requested → claimed) maps
  onto the existing invite-status model. The mental model the captain learns
  once: *send the address (the link, any channel), then open the door (one
  approve tap) when the person shows up.* Approval is always required — there is
  no in-person auto-approve mode (see Resolved Decisions).
- **Captain's approval surface + notice ("the doorbell").** The captain must
  *notice* pending claims or they pile up and players stay stuck. The team page
  is the triage board: each spot shows **claimed / waiting-for-approval / open**.
  Pending claims surface to the captain wherever they currently are — a
  **"N waiting to join" card on their home page**, a **count in the menu**, and
  (mobile) an indicator on the **bottom bar** so it reaches them on the
  lineup/scoring pages, which have no menu. The indicator appears only while
  claims are pending and clears when handled — it is **not** a permanent chrome
  badge. Rationale: approvals are act-now signals (unlike messages, which stay
  quiet by design), so surfacing them where the captain is, is warranted.
- **Approval is match-or-create.** When a person self-adds, the captain can
  **link them to an existing record** (a placeholder already made, a returning
  player) instead of always creating a new one — preventing duplicate players /
  split stats. (Lower-stakes at a true cold start, where there's little to
  collide with, but required wherever pre-made placeholders or returning players
  exist.)
- **Land-on-role through signup (critical).** The join intent must carry all the
  way through registration so the person lands **on their team / tonight's
  match**, never on a generic home page. Because registration is multi-step and
  includes an email round-trip, the join token must be **persisted server-side,
  associated with the pending registration (keyed to email)** — *not* carried in
  client/browser state — so it survives the email hop and a device switch
  (register on laptop, click the email link on phone).
- **Manual placeholder creation stays.** For players who will never use the app.
- **Onboarding wizards (reuse the existing wizard scaffold):**
  - **Captain → players:** short (2–3 screens) — get/copy the link, show the QR,
    approve incoming people. Optimized to remove *fear of the unfamiliar*, since
    the underlying task is tiny.
  - **LO → captains:** the mirror wizard, one level up (bones already exist in
    the teams wizard).
- **Land on "tonight's match."** Once on their team, a player sees tonight's
  match front-and-center with a one-tap path into scoring — collapsing "find
  team / find schedule / get to scoring" to zero navigation.

## Constraints & Considerations

- **Web app, not native** — "get the app" is just opening a URL, so a QR is an
  instant install-free entry point. Lean on this.
- **Auth/registration is multi-step and includes an email round-trip.** This is
  the main non-tech wall (and the reason the join token can't be client-carried).
  - **Passwordless / shorter sign-in — committed; its own brainstorm next;
    build first.** This is the single biggest non-tech stumble (registration is
    the wall — see User Story 6). Decided: we are doing passwordless, but it is
    specced in a **separate brainstorm** rather than folded in here. Recommended
    to **sequence first**, because collapsing the multi-step registration to
    "enter contact → type a code" also shrinks the hardest requirement in this
    doc (the join-token surviving the email round-trip / device switch). This cut
    stays **login-method-agnostic** via the token-persistence requirement, so it
    is not blocked on passwordless landing. (See Resolved Decisions.)
  - **Progressive profile:** consider attaching the player to the team as early
    in the chain as possible (e.g., at the email-click step) so a half-finished
    profile still lands them on the team, with profile completion trickling in
    later.
- **Forwarded/shared links** are expected (persistent + shared in group chats) —
  the approval gate is the safety net, not link secrecy.
- **The cascade is the load-distributor and must be preserved.** If any design
  routes individual *player* questions/approvals up to the LO, it breaks the one
  thing protecting the LO from the cold-start flood. The LO's world is "my
  captains," full stop.
- **Non-tech at every level** is the overriding design constraint — minimize
  novelty, maximize guidance (wizards), kill every avoidable point of confusion
  (each one is a question to a non-tech LO/captain).
- **Reuse over new build.** Existing pieces to build on (verified present):
  `src/login/ClaimPlayer.tsx`, `src/components/invite/ShareLinkSection.tsx`,
  `src/components/modals/PendingInvitesModal.tsx`,
  `src/api/hooks/useInviteStatuses.ts`, `src/api/hooks/useOrganizationInvites.ts`,
  `src/api/mutations/members.ts`, captain assignment in the teams wizard
  (`src/wizards/teams-v2/steps/CaptainsTeamsStep.tsx`) + `src/hooks/useRosterEditor.ts`,
  org-staff via `src/api/hooks/useOrganizationStaffMutations.ts`, and the wizard
  scaffold (`src/wizards/`, `src/data/seasonWizardSteps.tsx`).

## Resolved Decisions

All five open questions from the brainstorm were resolved on 2026-05-28:

- **Approval at scale — no bulk action for v1.** The cascade itself distributes
  the load: no captain faces 60–70 players, only their own ~5–8; the LO faces
  ~10 captains. Individual approve (one tap per recognized name) is not a burden.
  An "approve all pending" is a trivial fast-follow if real usage ever shows a
  captain drowning — not built now.
- **In-person vs remote — always require the approval tap.** One consistent model
  the captain learns once ("send the address; open the door when they arrive").
  No special in-person auto-approve mode: it would require the app to distinguish
  in-person from remote and would give the captain two behaviors to learn.
- **Onboarding-status visibility — team page is the triage board, plus a
  "doorbell."** Detailed in the "Captain's approval surface + notice" functional
  requirement above. Claimed / waiting / open on the team page; a "N waiting to
  join" home card + menu count + mobile bottom-bar indicator surface pending
  claims where the captain is, and clear when handled. Underlying principle
  (refines the existing messages-visibility rule): **surface act-now signals
  where the user currently is; keep can't-act-now signals quiet** — the
  discriminator is "can I act on this right now?", not "is it on the chrome?".
- **Passwordless sign-in — committed; its own brainstorm next; build first.**
  Yes, we are doing passwordless. It is specced in a **separate brainstorm**
  (its own thorny decisions: how the code reaches the player, returning users,
  lost-access recovery, security), not folded in here. Recommended to build
  **first**, because it collapses the registration wall (User Story 6) and
  shrinks the join-token-survival work — the hardest requirement in this doc.
  This cut stays login-method-agnostic so it is not blocked on it.
- **Wizard depth — thin first-run wizard over a dead-simple team page.** Three
  cards (get/copy the link → share it → approve people as they appear), reusing
  the existing wizard scaffold; it drops the captain on the team page, which is
  the durable surface they live on afterward. The LO gets the mirror wizard for
  onboarding captains.

## Success Criteria

- A captain onboards a full team **without typing a single player's email** —
  share link + approve taps only.
- A new player gets from QR to "on my team, tonight's match in view" in a
  handful of taps, and **never lands lost on a generic home page** — even when
  registering fresh and clicking the email link on a different device.
- On opening night, **matches start on time** with captains scoring, with no LO
  involvement in individual player onboarding.
- The LO's cold-start interactions are bounded to **captains**, not players.
- Nothing that works today (email/QR/handoff, manual placeholders) is removed.

## Appendix / References

- `docs/brainstorms/2026-05-17-bca-pitch-strategy.md` — the pitch this serves;
  CSI loses operators at exactly this cold-start moment.
- **Committed companion (next brainstorm, build first):** **passwordless auth**
  — see Resolved Decisions. Sequenced ahead of this cut because it shrinks the
  hardest requirement here.
- Deferred follow-ons (named, not designed here): public **Find-a-League**
  discovery; LO/captain **lost-player search**; **just-in-time at-the-table**
  claim as a distinct flow; **progressive profile** completion; **season
  carryover** (already largely handled).
- Related future-feature notes: `memory-bank/futureFeatures.md`
  ("Org Member Affiliation + Find a League + Recruitment Pipeline").
