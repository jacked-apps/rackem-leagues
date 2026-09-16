---
date: 2026-09-16
topic: member-designations
---

# Designations and Organization Permissions

## Problem Frame

A member can hold exactly **one** role today. `members.role` is a Postgres enum
with three values — `player`, `league_operator`, `developer` — and it is a single
column, so it physically cannot say "this person is a league operator **and** a
host." Every capability on the roadmap needs it to.

Three things are already straining against that limit:

1. **The column is being hand-puppeted to mean something it does not.**
   `addOrganizationStaff` in `src/api/mutations/organizationStaff.ts` sets a
   member's role to `league_operator` — not because they are one, but because
   that is the only way to make operator pages visible to them. Removal then has
   to ask "are they staff anywhere else?" and manually flip it back. That is a
   second source of truth kept in sync by hand, and it is a live bug.

2. **Adding a capability means changing the database.** `user_role` is an enum,
   so each new value is a schema migration, and enum values are effectively
   permanent once added.

3. **Nothing can expire.** Capabilities that will be sold with a lifetime — the
   game-room host, possibly a tournament-organizer subscription — have nowhere to
   record when access ends.

And a fourth pressure surfaced during the brainstorm, which reframes the rest:
**organization staff needs real, granular, sub-scoped permissions.** In Ed's
words: *"staff on this particular league and can't see the other leagues"*;
*"allowed to deal with all players but not league settings."* An organization
contains several leagues, and a single `league_operator` flag cannot express any
of that.

## The Two Families

"Role" is being used for two genuinely different things. Separating them is the
central decision of this document.

| | **Designation** (Family 1) | **Permission** (Family 2) |
|---|---|---|
| What it describes | The person | What someone may do, and where |
| Question shape | `has(member, 'host')` | `can(member, 'edit_league_settings', { orgId, leagueId })` |
| Examples | developer, host, tournament organizer, venue owner, **may own an organization** | primary owner, admin, scoped staff; team captain; scorekeeper |
| Where it lives | A new designations store | The relationship table that already owns it (`organization_staff`, `teams.captain_id`) |
| Can it expire? | Yes — some are sold with a lifetime | Ends when the relationship ends |

The two meet in a specific, deliberate way: **the designation opens the door, the
permission says which rooms.** "May own an organization" is a person-level
entitlement, gated by a card on file. *Owner of this particular organization* is
a permission inside one org. Venue owner will work the same way. Host holds only
a designation — there are no rooms to enumerate. This is the shape Databricks
uses for plan-gated workspace-creation entitlements versus in-workspace roles.

**"A league operator is a staff member with total access"** (Ed, 2026-09-16) is
correct and is the industry pattern. It collapses what used to be a special role
into the ordinary permission model at its highest setting.

## Requirements

Requirements are grouped by concern and carry a **build phase** marker. Phase 1
is the work that is actionable now. Phase 2 waits for a capability that is
actually sold, because until then it has nothing to act on (see Build Split).

---

### Organization permissions — Phase 1

- **O1.** Code asks **what someone may do, not what they are.** A single check —
  *can this member perform this action in this scope?* — replaces every scattered
  `isOperator()` / `role === 'x'` test. Named roles are bundles of permissions
  sitting behind that check.
- **O2.** Adding, splitting, or renaming a role **changes no calling code.** Only
  the contents of the bundle change. This is the property that makes the granular
  permission list — which does not exist yet — an extension rather than a rewrite,
  and it is the single highest-leverage requirement in this document.
- **O3.** A staff grant carries an **optional league scope**. Empty means *every
  league in the organization*; filled means *only that league*. This is how
  "total access" is expressed without inventing a second concept, and it is the
  same mechanic GitHub and Notion use for org-wide versus per-resource roles.
- **O4.** The scope column exists **from day one**, before the granular
  permission list is known. Retrofitting scope onto an unscoped grant table is
  the most commonly regretted omission in this problem space, because it forces
  touching every check site.
- **O5.** An organization has **exactly one primary owner.** They carry billing,
  they are the only member who can delete the organization, and no one can remove
  them.
- **O6.** Ownership is **transferable** in one deliberate act. This is the only
  way the seat changes hands, and it is what makes an organization survive its
  founder moving on — without co-equal owners who can each delete everything.
- **O7.** An organization **can never be ownerless.** Enforced as its own
  invariant at the database level, not as a permission check.
- **O8.** Primary owner is a **role holding every permission**, not a special
  branch in the checking layer. Its distinguishing powers — delete the
  organization, transfer ownership, manage billing — are permissions in its
  bundle that no other bundle contains. There is no `isOwner()` escape hatch,
  because a hidden branch is invisible to auditing.
- **O9.** The three levels at launch are **primary owner**, **admin** (everything
  operational; not deletion, transfer, or billing), and **scoped staff** (a
  subset, optionally limited to one league). `organization_staff` already carries
  `owner` / `admin` / `league_rep`; this formalizes them and adds the scope.
- **O10.** Where several grants apply, **the most permissive wins** — grants are
  additive, matching GitHub's model. A member who is org-wide staff *and*
  league-scoped staff holds the union, never the intersection.
- **O11. Permissions are stored atomically only when the granular list exists.**
  Phase 1 ships named roles plus the scope column plus the O1 check. The
  permission-per-row catalog that lets an operator compose custom bundles is a
  later data migration, which O1/O2 make safe. Building it now would be inventing
  a permission list nobody has written down.
- **O12.** No relationship-based authorization engine (Zanzibar / OpenFGA /
  SpiceDB / Oso / Casbin). Nothing described here needs arbitrary per-object
  sharing — "let this one non-staff player see this one match" — which is the
  documented threshold for needing one. This is hierarchical scoped RBAC, the
  case plain role-plus-scope is designed for.

### Designations — Phase 1

- **D1.** A member can hold **any number of designations at once**, independently
  granted. Holding one neither implies nor blocks another, with exactly one
  carve-out (D7).
- **D2.** Each designation a member holds records: **which designation**, **when
  it was granted**, **when it ends** (empty means never), **how it was obtained**,
  and **who granted it** where a person was responsible. An audit trail is the
  point — "who gave this account the developer designation" must be answerable.
- **D3.** A member has **at most one un-ended record per designation**, enforced
  by the database as a partial unique index keyed on the record having no end
  timestamp. The invariant keys on a *stored* end fact, never on "expiry is in
  the future" — Postgres cannot index a time-varying predicate, so a purely
  time-based rule would be an application-maintained invariant, exactly the kind
  this work exists to kill.
- **D4.** The set of possible designations is **data, not schema.** Adding one is
  a row insert, not a migration. Enum values also cannot practically be removed
  once added, which matters for a list that will be experimented with.
- **D5.** Ending a designation early is supported structurally — a live record can
  be closed before its end date, and the record distinguishes **lapsed** from
  **revoked** so the two are not indistinguishable afterward.
- **D6. `player` is not a designation.** Having a member record is what makes
  someone a player. The store holds only what is earned, bought, approved, or
  granted.
- **D7. `developer` is a master key.** It satisfies every designation check and
  every permission check by definition. This is today's behavior —
  `ProtectedRoute` waves developers through every role check — and it is what a
  solo developer needs at 2am. It is the single carve-out to D1.
- **D8.** When a page is visible **by master key** rather than by real access, the
  app **says so visibly.** Without this, a permissions bug gets debugged by the
  one account that bypasses permissions, and looks fine.
- **D9.** There is a **bootstrap path** for the first developer designation on a
  fresh or restored database that does not require already holding it. A resolver
  bug must not be able to lock every human out of the only surface that can fix it.
- **D10. "May own an organization"** is a designation, gated on a verified card on
  file. It is what the league-operator application grants. Owning a *specific*
  organization is a Family 2 permission (O5).

### Asking the question — Phase 1

- **A1.** There is **one consistent way to ask**, used by every caller: a check by
  designation for Family 1, and the same check with a scope for Family 2.
- **A2.** Callers **never know where the answer is stored.**
- **A3. Organization staffing is resolved live, never mirrored into a designation
  record.** Whether someone has operator access is computed at ask time from
  their `organization_staff` rows — nothing is written when staffing changes.
  Writing a derived record instead would relocate the `addOrganizationStaff` bug
  into a new table rather than remove it: the same two-writes-kept-in-sync, the
  same "are they staff anywhere else?" scan on removal, the same drift.
- **A4.** The same layer answers the **set** question as well as the yes/no one —
  *which members hold a given designation* — because member search already
  filters by role server-side (`src/api/queries/memberSearch.ts`, the `staff`
  filter). Filtering and paging stays a database-side operation, never a
  client-side filter over all members.
- **A5.** The answer is available to both the **app** and to **database
  row-level security policies**, so permission logic is written once rather than
  duplicated in SQL and TypeScript.
- **A6.** Designations and permissions are fetched and cached **alongside the
  member profile** in the existing profile hook, adding no round trip on page
  load. This cached copy drives **UI affordances only** — showing, hiding,
  warning.
- **A7. The cache is never the authority.** Every gated action is permitted by a
  **server-side** check evaluated against current time at the moment the action
  is attempted. The profile cache is intentionally long-lived (15-minute stale
  time, no refetch on focus, per `src/api/client.ts`), so a cached answer can
  report a lapsed designation as live. A stale boolean in a browser may never be
  the only thing between a lapsed member and a paid capability.
- **A8. Granting and revoking are privileged writes**, made through a server-side
  path that independently verifies the caller's authority — never a
  client-side-gated screen writing to the table directly. This holds during the
  interim while row-level security is disabled, and both new stores are
  explicitly in scope for the upcoming security pass.

### Retiring `members.role` — Phase 1

- **M1.** Every reader **and writer** of `members.role` moves to the new checks,
  and the column is then **dropped**. It is not left in place unread — an unread
  column that can still be written is how the second source of truth returns.
- **M2.** Row-level security policies referencing `members.role` are rewritten to
  call **one database helper** rather than inlining the check, so the upcoming
  security pass has a single place to reason about.
- **M3.** That helper is written in **plpgsql, not plain SQL**, is marked
  **`STABLE`**, and pins **`search_path`**. Each of these prevents a specific,
  documented failure: Postgres inlines simple SQL functions during planning,
  which silently strips `SECURITY DEFINER` context and reopens the recursion it
  was meant to prevent; `STABLE` lets the result be computed once per statement
  instead of once per row; an unpinned `search_path` is a privilege-escalation
  path.
- **M4.** Policies use a cached identifier-list helper rather than correlated
  per-row subqueries, which degrade from milliseconds to seconds as tables grow.
- **M5.** Adding or removing organization staff **stops writing to a role
  column.**
- **M6.** Staffing is **not only app code.** `organizations` carries an AFTER
  INSERT trigger (`create_owner_staff_trigger` → `create_owner_staff()`, baseline
  migration lines 522 and 2768) that inserts the creator as `owner` in
  `organization_staff`. Whatever grants access must cover that database-side
  path, or the very first operator — the person who just created the org — gets
  nothing. That is the highest-traffic case.
- **M7.** Staff visibility and permissions stay **behaviorally identical** to
  today. This phase changes how access is recorded and asked about, not who has
  it. The granular split is a later, deliberate product decision.

### Lifetimes — Phase 2

- **L1.** A designation with no end date is the **normal case**, not an edge case.
  Developer and "may own an organization" never expire on their own.
- **L2.** Expiry is checked **when starting something new**, never mid-activity.
  Work already in flight runs to completion; what lapses is the ability to start
  the next one. What is sold is the ability to start something, so the start is
  the honest place to check — and checking continuously would drag billing state
  into the scoring path, which is locked as the thing that must never break.
- **L3. L2 is a contract on consumers, not a free property.** Anything startable
  under a designation must have a **bounded lifetime and a defined completion
  event**, and must re-check at its next natural internal boundary — next game,
  next round. Without this, a host opens a room the day before expiry, never
  closes it, and holds the capability forever: the paywall becomes "buy one
  month, stay open." Any capability that cannot bound itself needs an explicit
  grace window instead, decided when that capability is designed.
- **L4. Lapse-and-rebuy is a new record, not a revival.** A designation that
  expired months ago and is bought again starts a fresh record with a fresh
  granted-at. Only a still-live record is extended. This keeps the gap honest and
  stops a renewal computed as "old end date plus a year" from granting an end
  date already in the past.
- **L5.** Expiry is **never a proxy for payment-method health.** A stale card must
  not strip an operator of access to leagues that are mid-season.
- **L6.** Card freshness is handled independently, off the card data already on
  `organizations` (`card_last4`, `card_brand`, `expiry_month`, `expiry_year`,
  `payment_verified`). It may block *new* charges or new league creation; it may
  not revoke anything. A newer per-member `payment_methods` table also exists;
  reconciling the two is Jack's payment-consolidation work.
- **L7.** A member is **warned in advance** of an expiring designation. The
  delivery channel is decided with the first capability that actually expires,
  against a real product rather than in the abstract.

### Boundary with billing — Phase 2

- **B1.** The designations store holds **the grant, not the money.** Prices,
  receipts, bundles, per-use counters, subscription plans, and Stripe records live
  in billing and are never read here.
- **B2.** Billing acts on a designation in exactly three ways: **grant one, move
  its end date, or close it.** Closing is required because a per-use model — "20
  tournaments for a price" — ends at a balance of zero rather than on a date; the
  counter stays in billing and billing closes the record when it empties.
- **B3.** A bundle that sells several capabilities for one price writes **several
  independent records.** The designations store never learns what a bundle is.
  This is the test that the boundary is in the right place.

## Build Split

**Phase 1 is buildable now and fixes a live bug.** Phase 2 has nothing to act on
yet, and that is not a scheduling preference — it is a fact about the system:

- The only designations that exist on merge day are developer and "may own an
  organization," and **L1 says neither expires.**
- Host and tournament organizer do not exist. There is no game-room code in the
  repository at all.
- No purchase flow exists to set an end date, and pricing is Jack's decision,
  unmade.

Shipping L2–L7 and B1–B3 now means shipping expiry semantics, renewal rules,
advance warnings, and a billing boundary that **no code path can exercise**. The
design is settled and recorded here so it does not get re-litigated; the build
waits for the first capability actually sold with a lifetime.

**There is also a sequencing reason Phase 1 should not slip.** The row-level
security pass is a hard pre-launch blocker, and policies today reference
`members.role`. If the security pass runs first, those policies are authored
against a column this work then drops — they get written twice. If Phase 1 runs
first, the pass has one helper to reason about. That is the concrete argument for
doing this now rather than when a paid capability appears.

## Success Criteria

- A member is simultaneously a developer, the primary owner of one organization,
  and league-scoped staff in someone else's — and every surface reflects all
  three correctly.
- A staff member scoped to one league cannot see the organization's other
  leagues, and granting that scope required no code change at any check site.
- Adding a **designation to the list** requires no schema migration and no change
  to how any caller asks its question. (A capability's own tables and policies are
  that capability's work; this is about the designation, not the feature.)
- Splitting "league rep" into two narrower roles later touches role definitions
  only — zero call sites.
- `members.role` no longer exists, and no code path writes a role as a side
  effect of doing something else.
- Removing someone from organization staff requires **no compensating write**
  anywhere.
- An operator whose credit card expired can still open their leagues.
- *(Phase 2)* A host whose subscription lapses mid-room finishes that room, and
  cannot open a new one — enforced server-side, not by a cached boolean.

## Scope Boundaries

- **The granular permission list is not invented here.** Phase 1 ships three
  named levels plus the scope column plus the check layer. Which specific powers
  get split out of "admin" is a product decision made when Ed knows what he wants,
  and O1/O2 are what make it cheap then.
- **No purchase flows.** Nothing here sells anything. Until a capability brings
  its own purchase path, designations are granted from a developer-only surface.
- **No pricing model.** Subscription versus per-use, bundles, seats-per-year —
  billing decisions, deliberately unresolved.
- **Revocation consequences are a separate brainstorm.** Ending a designation is
  supported; deciding what becomes of an ex-operator's leagues, seasons, and teams
  is an offboarding problem with its own weight.
- **Team captaincy and scorekeeping are untouched.** Both are Family 2 and keep
  their existing homes. The known duplication between `teams.captain_id` and
  `team_players.is_captain` — which the schema itself documents as redundant — is
  a separate cleanup. Scorekeeping is undesigned; when designed it lands as a
  team-scoped permission and needs nothing from this work.
- **Game room seat math stays in the game room.** That a host contributes some
  number of scoring seats, and that multiple hosts stack, is that feature's
  business. This system answers only how many hosts are present.

## Key Decisions

- **Ask what someone may do, not what they are.** Role strings scattered through
  a codebase are the documented failure mode: every business-logic change forces
  touching every call site. One indirection now is the difference between
  extending this later and rewriting it.
- **Scope column from day one.** The most commonly regretted omission in this
  problem space, and Ed surfaced the need before a single check was written.
- **One primary owner, transferable — not co-equal owners.** Matches Ed's
  instinct and the Slack / Google Business Profile pattern. Several co-owners
  means several people who can each delete everything against one card that
  belongs to whoever set it up first. Transfer covers the founder-moves-on case
  in one deliberate act.
- **Owner is a role, plus one invariant.** The permission model treats it as an
  ordinary bundle holding everything; ownerlessness is prevented separately. The
  two are additive, not competing models.
- **Organization staffing is resolved, never mirrored.** A stored derived record
  would relocate the motivating bug into a new table rather than remove it.
- **Two families, two homes, one question shape.** A single table with a generic
  scope column pointing at teams, organizations, or venues depending on the row
  means the database can no longer enforce it points at anything real — allowing
  a captain of a team that does not exist. Foreign-key integrity is a primary
  reason to use a relational database and is not traded for tidiness. The
  unification is delivered at the asking layer, where it costs nothing.
- **Designations are data, not an enum.** Directly answers "adding new roles every
  time," and enum values cannot practically be removed once added.
- **The column is dropped, not orphaned.** Ed's instinct to leave the slot unread
  was the right *sequence*, wrong *endpoint*: a column nothing reads but
  everything can write invites the `organizationStaff` bug back. A middle option —
  block writes now, drop later — buys the same protection with less coupling and
  is a legitimate fallback if the live reader inventory turns out larger than
  expected. Removal is cheap here regardless: all project data is disposable test
  data.
- **Plain role-plus-scope, not a relationship engine.** OpenFGA and its relatives
  solve arbitrary per-object sharing. This is hierarchical scoped RBAC, and
  adopting a tuple-store service for it buys real operational overhead for a shape
  that does not need one. The models compose later if a genuine per-object sharing
  need appears.
- **Phase 2 is designed but not built.** Expiry machinery with nothing that can
  expire is dead code that rots before its first use.

## Dependencies / Assumptions

- **`league_operators` no longer exists.** It is created by no migration and is
  marked legacy in `src/types/operator.ts`; it was replaced by `organizations`
  (org details plus card on file, with `created_by`) and `organization_staff`
  (positions `owner` / `admin` / `league_rep`). It survives only in the stale
  `database/schema_dump.sql` and a local data dump. **A member may own more than
  one organization.**
- **`database/schema_dump.sql` is stale** — it lacks `organization_staff`, which
  exists in `supabase/migrations/20251130010824_baseline.sql`. Every claim about
  the live schema must be verified against migrations or the live database, not
  the dump. The count of policies referencing `members.role` (8 occurrences in
  the dump) is therefore a floor, not a figure.
- **A developer today implicitly holds every role.**
  `useUserProfile.canAccessLeagueOperatorFeatures()` returns true for
  `developer`, and `ProtectedRoute` waves developers through every `requiredRole`
  check. D7 preserves this deliberately.
- **Row-level security is currently disabled** by pre-launch decision. Policies
  referencing `members.role` still exist and still must be rewritten, but nothing
  breaks at runtime while they change.
- **No game-room code exists.** A repository search returns nothing. The host
  designation is defined with no consumer to validate against, which is part of
  why it is Phase 2.
- **The tournament paid foundation**
  (`docs/brainstorms/2026-09-04-tournament-paid-foundation-requirements.md`)
  decided tournaments are player-run with no organization behind them, paid per
  tournament with a card on file. That model grants no designation and needs no
  end date. A tournament-organizer designation only becomes real if a subscription
  model is later chosen — which is Jack's call and is not assumed here.

## Outstanding Questions

### Resolve Before Planning

*(none — the product decisions needed to plan Phase 1 are settled)*

### Deferred to Planning

- [Affects A1, A5][Technical] Whether the single checking layer is a database
  function, a client-side hook, or both mirroring each other — and, if both, the
  mechanism that keeps them in agreement. A7 already forbids the client copy from
  being authoritative.
- [Affects M1, M2][Technical] Exact inventory of `members.role` **readers and
  writers**, verified against the live database rather than the stale dump. Known
  writers: the operator-application path
  (`src/leagueOperator/LeagueOperatorApplication.tsx`), the generic role-update
  mutation (`src/api/mutations/members.ts` / `useMemberMutations`, whose
  TypeScript union includes an `admin` value not in the enum), and
  `organizationStaff.ts` on add and remove. Known readers beyond the obvious: the
  `log_report_status_change` trigger function, which *writes an audit value*
  derived from role; the member-search `staff` filter; and the generated
  `src/types/database.types.ts` surface.
- [Affects M2, M4][Needs research] Per-request cost of resolving permissions
  inside policies once row-level security is re-enabled, measured on the largest
  policy-guarded tables rather than assumed cheap.
- [Affects D1, D2][Technical] What happens to designations when two member
  records merge — placeholder-into-member today, member-into-member planned.
  Neither the existing merge machinery nor this document says which side wins.
- [Affects D10, O5][Technical] Whether "may own an organization" is stored as a
  designation record or resolved from a verified card on file, given that the
  league-operator application already writes both an organization and a role.
- [Affects O3][Technical] Whether league scope needs to nest further — a staff
  member scoped to one season or division within a league — or whether league is
  the terminal scope.

## Next Steps

-> `/ce:plan` for Phase 1
