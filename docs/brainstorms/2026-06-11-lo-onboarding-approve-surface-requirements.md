# LO Onboarding Approve Surface — Requirements

**Date:** 2026-06-11
**Status:** Ready for `ce:plan`
**Related (already built):** PR #212 (join-requests surface always-visible at league + org level)

## Problem & Context

The **league operator (LO) is the ultimate onboarder** — the "captain of captains."
Like every other league-management system, the LO can place any person on any team,
set/change captains, name teams, and remove players. The app's twist is letting
**captains help** by onboarding their *own* players (and registering themselves), to
lighten the LO's load — but captain self-serve is an **assist on top of** the LO's
full control, never a replacement for it.

**Vocabulary (locked by Ed):**
- **Register** = a person creates their own login (email + short profile). *Universal
  and always self-service — no one ever registers anyone else.* Not onboarding.
- **Placeholder** = a stand-in on a roster, *holding the place* of a registered (or
  future-registered) user. A captain is simply a placeholder in the captain spot; a
  player is a placeholder in a roster spot.
- **Onboarding** = connecting a registered (or unregistered) user to a placeholder
  (they **combine/merge**, and the registered user takes the placeholder's place),
  **and/or** landing a person on a team. The same operation for captains and players.

### Key principle: one shared surface, scoped by who's looking

Onboarding players is the **same act whether a captain or the LO does it** — same
look, same feel, same component (like an admin and an owner seeing the same screen).
The **only** difference is **scope**, decided entirely by the server feed:
- A **captain** sees the doorbell for **their own team(s)**.
- The **LO** (org staff) sees the doorbell for **every team in the org**.

This is already how the code works: one component (`JoinRequestList` /
`JoinRequestCard`) on both the captain's My Teams page and the LO's pages, with
`get_join_requests_for_approver` returning "teams where you're the captain **OR**
every org team if you're staff." So this effort builds **one surface**, not two —
just rich enough to scale to the LO's many-teams view.

### Why the LO must be a catch-all onboarder: the captain chicken-and-egg

A captain **cannot answer their own doorbell**, by construction:
- The doorbell only rings for teams where you are the **registered** captain
  (`teams.captain_id = your member`).
- An unregistered captain placeholder has no login — not an actor, nothing rings.
- Even right after the captain registers, `teams.captain_id` still points at the
  **placeholder** until the merge — so their fresh account **isn't the captain yet**
  and doesn't hear that team's doorbell.

So a captain can't accept their own join request. **Someone with existing authority
over the team — the LO — must accept the first captain in.** That merge makes the
captain's account the real captain, and *only then* does their doorbell start ringing
so they can onboard their players. The LO is the one who **breaks the loop** — which
is exactly why the LO must be able to answer the door for every team.

### What's already true in the code (verified)

- The LO (org staff / auto-added owner) can **both see and accept every join request**
  in their org — not just the team captain. (`get_join_requests_for_approver` and
  `approve_join_request` both authorize "captain OR org staff".) So incoming requests
  are **not** in authorization-limbo.
- The captain→player cascade works: captain shares the team's `/join/:token`
  (`InviteMyTeamButton`); a player registers + "asks to join"; the captain/LO sees a
  doorbell count ("Join requests (N)") and a per-request card (`JoinRequestCard`) that
  offers "connect to a placeholder (merge)" or "just add them".
- Connecting a request to the **captain placeholder** correctly promotes the new
  account to the registered captain (the merge rewrites `teams.captain_id`).
- **PR #212** already surfaces the LO's full request feed, always-visible, on the
  **Operator Dashboard** (org-wide) and each **League page** (league-scoped).

### The real gap

The LO answers the door for **potentially dozens of teams at once**. The current
approve card is too thin for that scale — *"John accepted the invite — is this one of
your players?"* with a bare list of placeholder names. An LO juggling many teams can't
tell **which team**, **who the captain is**, **which roster spots are placeholders**, or
**which placeholder John actually is** — and the easy **"just add them"** silently
creates a duplicate when a placeholder/captain spot was meant to be filled.

## Goals

0. Build **one shared approve surface** for captain and LO alike (scoped by the
   server feed), not two — the captain sees their team(s), the LO sees all teams.
1. Make that surface **informative enough to answer the door confidently** — each
   incoming request carries its own team context (matters most at the LO's scale, but
   helps the captain too).
2. **Keep it scannable** across dozens of teams — detail on demand, not a wall of noise.
3. **Prevent the footgun** — don't let an accidental "just add" create a duplicate when
   an open placeholder (especially the captain) should be connected instead.
4. Route the LO to this surface (doorbell).
5. Preserve captain self-serve as the additive helper; don't take the LO's job away.

## Requirements

### R1 — Each request shows its full team context
For every incoming request, the LO can see (at a glance or one tap):
- The **incoming person's name** + any info they provided at registration.
- The **team** they're for (and its **league**).
- The **captain** of that team, and **whether the captain spot is still a placeholder**.
- The team's **roster**, with **placeholders clearly marked** (registered vs placeholder),
  so the LO can see which spot this person fills.

### R2 — Make the captain case obvious
When a team's captain is still a placeholder, that's surfaced prominently on its
requests, so onboarding a captain is an obvious "connect them to the captain spot,"
not a guess buried in a list.

### R3 — Scannable at scale
The surface organizes many requests across many teams so the LO isn't overwhelmed
(e.g., grouped by team / league, summary-first with expand-for-detail). Exact layout
is a planning decision; the requirement is "usable with dozens of teams onboarding."

### R4 — Guard the duplicate footgun
"Just add them as new" must not silently create a duplicate person when there's an
open placeholder (especially the captain placeholder) that this person likely fills.
Connecting-to-a-placeholder is the guided default; plain-add is a deliberate,
secondary choice.

### R5 — Doorbell routes the LO to their surface
The "Join requests (N)" doorbell count currently sends everyone to `/my-teams` (the
player page). For the LO it should lead to their operator surface (Operator Dashboard /
League page) where they manage this.

### R6 — Connect/drop both supported
Per the onboarding definition: the LO can **connect** the incoming person to an
existing placeholder (merge — registered user takes the placeholder's place) **or**
**drop/land** them onto the team as a new roster member.

## Scope Boundaries

- **Not** changing registration — it stays universal self-service.
- **Not** removing the captain self-serve cascade — it remains the additive helper that
  funnels into the LO's view; the LO still sees and overrides everything.
- **Not** (here) building a separate LO-initiated *invite-a-specific-person-to-a-specific-
  team* flow or full direct roster management — those already partly exist
  (`TeamManagement` / `TeamEditorModal`) and are a separate thread. This doc is about the
  **approve/doorbell surface** that lets the LO answer the door informatively at scale.

### Deferred / separate

- LO-initiated invites (LO picks a person → invites them *for a chosen team*) and a
  full first-class "LO direct onboarding / roster control" surface — note as the next
  thread once the approve surface is solid.

## Success Criteria

- An LO with many teams onboarding can open one surface, see each incoming person **with
  their team, captain, and placeholder-marked roster**, and confidently **connect them to
  the right placeholder** (captain or player) **or drop them on the team** — without
  accidentally creating duplicates.
- A captain's own incoming requests no longer sit unhandled: the LO sees and can act on
  them (visibility via #212), with the captain placeholder clearly flagged.
- The doorbell takes the LO to that surface.

## Open Questions for Planning

- Exact layout for scale: group-by-team vs group-by-league vs flat-with-filters; inline
  expand vs a detail modal per request.
- How much roster detail to show inline vs on expand (R1 vs R3 tension).
- Whether to enrich the existing feed/RPC (`get_join_requests_for_approver`) with team
  roster + captain-placeholder flags, or fetch per-card on expand.
- Reuse vs extend `JoinRequestCard` / `JoinRequestList` (built in the cascade + #212).
