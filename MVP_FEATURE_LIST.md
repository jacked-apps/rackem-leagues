MVP LIST

\*\* = Mobile first build

Minimum needed

1.  create next season flow
2.  rules \*\*
3.  invite system \*\*
4.  schedule management (league operator) - view/modify schedule match ups, and table assignments
5.  score match/ match dispute (league operator) interface to manually change and score matches.

IMPORTANT FEATURES

1.  messaging system \*\*
2.  payout calculator
3.  scorecard dispute page (league operator)

FUTURE FEATURES

1. AI integrated rules \*\*
2. AI integrated video shot referee \*\*
3. AI league operator assistant

---

## BACKLOG NOTES

### Email Invite System for Placeholder Players (Researched Dec 2025)

**Concept**: When creating a Placeholder Player, optionally collect email and send invite link.

**Tech Stack**:

- **Resend** (email API): Free tier = 3,000 emails/month, 100/day. No credit card required.
- **Supabase Edge Functions**: Server-side TypeScript to call Resend API.
- Docs: https://supabase.com/docs/guides/functions/examples/send-emails
- Resend + Supabase guide: https://resend.com/docs/send-with-supabase-edge-functions

**Requirements**:

- Own domain for sending (e.g., `invites@rackem-leagues.com`)
- Store `RESEND_API_KEY` in Edge Function secrets

**Flow**:

```
Captain creates PP with optional email
  → Edge Function sends invite with /register?claim={memberId}
  → Player clicks link → registers → auto-linked to PP record
```

**Why This Matters**: Bypasses the merge problem entirely when email is provided upfront. Merge system only needed as fallback for PPs without email or players who ignore invite.

---

### Messaging — Future Polish (Triaged 2026-05-15)

After the Phase 1 polish triage on 2026-05-14/15, the items below were
**decided NOT to build now**. Reasoning is captured here so the parking
decision is findable later. Items that *were* agreed to build live in
`docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md`
Units 10–14.

**Phase-3-gated (wait-and-see):**

- **Reactions** (chips on a message — 👍 ❤️ etc., curated set, picker,
  realtime sync). Medium cost (new `message_reactions` table + picker
  UI + realtime). Highest social-value-per-cost item of the medium
  tier. Hold until Phase 3 ships and the usage-gate metric comes in;
  pull forward as the **#1 priority post-gate** if Phase 3 looks
  positive. Rationale for waiting: cost is medium, nothing depends on
  it, and "emoji messages" (Unit 13) cover most of the same use cases
  at a fraction of the cost.

**Already covered by Phase 2 planning (in `docs/brainstorms/2026-04-21-messaging-system-overhaul-requirements.md`):**

- **Per-chat mute UI** (Notify / Mentions / Mute tri-state) — the
  `notification_mode` column shipped in Phase 1 Unit 1, but the UI
  to toggle it requires the Phase 2 notification infrastructure.
- **Operator "push-through" for muted notifications** — Ed's idea of a
  last-ditch league-operator override to get a captain to read
  something. Depends on Phase 2 existing first.

**Skipped (will not build):**

- **Typing indicators** ("Alice is typing…"). Skipped — low retention
  value vs. medium cost, and the "tattle-tale" UX downside is real for
  small known groups. Familiar ≠ valuable. May revisit but not on the
  near horizon.
- **Pinned messages.** Low usage for this context. Ed's call.
- **Plain @mentions.** Groups are small enough to make
  notification-routing-by-mention low-value here. Different cost
  profile from "mention to invite."
- **"Mention-to-invite"** (typing `@name` of a non-member auto-adds
  them to the chat). Genuinely interesting but a meaningfully bigger
  feature than plain mentions — separate, larger project; not on the
  near horizon.
- **Custom 9-ball / 10-ball emoji.** Would need a custom-emoji system
  (DB markers + image swap at render + copy-paste handling). That's a
  medium-large project, not the "essentially free" emoji-message ship.
  Standard 🎱 (8-ball) reads as "pool" to most people; revisit if
  there's strong demand.
- **Handshake emoji 🤝.** Cut — it's a physical action between two
  people who are co-present, doesn't translate to a remote-chat
  context.

**Already shipped in Phase 1 — listed here only so they don't get
re-proposed:**

- Per-conversation unread badges + total nav count.
- Block / unblock discoverability via `PlayerNameLink` popover
  (View Profile / Send Message / Report Player / Block User on tap).
- Past-member read-only banner (UI). Note: the data-layer RLS
  enforcement of "see only up to when you left" is deferred to the
  RLS-enablement project — captured in `LIST_FOR_ED.md` #29.
