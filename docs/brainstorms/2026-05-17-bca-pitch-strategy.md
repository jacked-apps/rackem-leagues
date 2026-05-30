# BCA Pitch Strategy

> **Date:** 2026-05-17
> **Status:** Captured from working conversation; iterate before the meeting
> **Audience:** Ed (the pitch), referenceable by anyone helping prep
> **Purpose:** Triage what belongs in the BCA pitch — what's strong, what's defensible, what's risky to overpromise.

---

## Positioning (the one-liner)

> "You have great math. You have an existing user base. Your tools are powerful but complex. We've built a simpler operator + player experience that uses your math as the standard. Partner with us, replace your tool, or absorb us — whatever serves your members best."

The pitch is **complementary, not competitive.** CSI/BCA owns the handicap math and the rulebook. Rack'em Leagues owns the operator/player UX.

---

## Why this conversation works for them

CSI/BCA is **understaffed and overworked.** Their current tools are technically powerful but adoption is gated by complexity — operators bounce off. Every new league they sign up takes hours of hand-holding. Their growth is throttled by their own tool complexity, not by market demand.

A simpler operator app means more leagues signed up, less support load, more dues collected. That's a problem Rack'em Leagues directly solves.

---

## MUST be in the pitch (the headline differentiators)

These are the load-bearing items. Strip everything else, leave these.

### 1. The wizard vs. their settings labyrinth
Operators create a league through a guided wizard with sane defaults instead of navigating a settings panel. Demo this first — it's the headline. ("Watch — three minutes from zero to a configured league.")

### 2. Add-us-as-staff onboarding ⭐
**The killer onboarding move.** Already built (`useAddOrganizationStaff` + `useRemoveOrganizationStaff` are working today).

> "You don't need to learn our app. You don't need to give us your data. Add my team as staff to your org for 20 minutes. We'll set everything up. Then remove us. Your existing techs can use the same workflow — same skill set, no retraining."

This is BCA-specific gold: they have BCA-techs already doing customer setup work in their existing tool. Tell them those same humans can do the same work in this app via temporary staff access. Zero training cost.

### 3. Unified app (not three separate apps)
- Scoring
- Standings + stats
- League management
- In-app messaging
- (Soon) dues collection

CSI/BCA forces operators to juggle multiple apps for these. One app, one login, one mental model.

### 4. In-app messaging without phone numbers
Solves the real pain operators and captains have: "Anyone want to sub Tuesday?" goes out to all rostered players without contact-info exchange. Phase 1 shipped (PRs #108–#111). Demo-ready.

### 5. The Fargo partnership ask (NOT a defense)
Don't pitch this as "let me prove I implement your math." Pitch it as:

> "Give me your formula and I'll use it directly so we're guaranteed identical. We want your numbers to be the standard; we want to use them. Let's make this collaborative from day one."

Reframes a potential weakness into a partnership opening.

### 6. Anyone-playing-can-score
Every player on the table can confirm scoring, not just one designated scorer per team. Reduces single-point-of-failure for captain-less weeks.

### 7. Live scoreboards (including OTHER matches)
You can watch your match live AND see what's happening on other tables in the same league. Spectator + accountability story.

### 8. Searchable rulebook
**This is built and demo-ready today.** Operators and players can search the official BCA/CSI rulebook in-app. Frame the AI extension as future ("designed to support AI ref-question answering"), not as a current product.

---

## SHOULD be in the pitch (strong supporting points)

These reinforce the MUSTs. Use them as second-tier differentiators.

### Modular configuration with "here be dragons" advanced mode
The system supports handicap × team-size × format × points × tiebreaker × win-calculator as independent modules. Preset combos are wizard-easy for the 90% case. An "advanced settings" gate with a clear "you're leaving tested territory" warning unlocks mixing-and-matching for power users — standard pattern (Windows advanced settings, browser about:config, AWS root account). Liability shifts cleanly: you warned them.

### Three-tier onboarding model
1. **Free presets** — operator self-serve
2. **Human-assisted setup** — via the staff-add feature (already shipping)
3. **AI-assisted setup** — paid future tier ("just enough to pay for itself")

The middle tier is unique — most competitors only offer (1) and (3).

### The "you bring catalog, we add presets" partnership angle
Every BCA-standard tournament format becomes a Rack'em preset. They get adoption; Rack'em gets demo-able coverage for everything they offer. Content-and-distribution flywheel, not just a tool sale.

### Dues collection
Stripe integration is in progress (Jack). Faux credit card form already in the app for league-fee testing. Membership-dues path either lands by demo day or commits to "one week from yes."

### Past-member messaging visibility (Archived chats)
Players who leave a team can still browse their chat history but can't post. Captains can't accidentally lock themselves out of a team chat mid-season (server-side `cannot_leave` flag is released automatically when the season completes). These are quality-of-life touches that demo well.

---

## COULD be in the pitch (nice-to-haves if time)

Mention only if asked or if it lands naturally. Don't lead with these.

### AI shot-watching as future R&D
Casual proof-of-concept: a buddy in Ed's league filmed 3 shots and fed them to Gemini with "foul or not?" Gemini got 3/3 right on double-hit calls. **Tiny sample, not a product, but proof the underlying capability exists.**

How to frame: *"We've seen Gemini correctly call a double-hit from a phone video. Small sample. We think the foul-call space is wide open if you want a partner on it."* Frame as a **future R&D conversation**, not a feature. "Let's explore this together" beats "we've built a product."

### AI-assisted wizard config (paid tier)
"Describe your league in plain English; AI fills in the wizard." Realistic near-term feature. Don't promise a date.

### Find-a-League player discovery
Future homepage feature. Players opt into orgs without being on a team yet. Documented in `memory-bank/futureFeatures.md` under "Org Member Affiliation + Find a League + Recruitment Pipeline." Don't pitch it as built.

### Phase 2 messaging
Push notifications, per-chat mute controls, quiet hours, rate-limit, pause picker, @mentions. Documented in `memory-bank/futureFeatures.md` under "Messaging Phase 2 — Notification Subsystem." Pitch as "obvious next" if asked, not as a built feature.

### Captain announcement moderation
LOs can mute specific captains who spam the announcement channel, or kill the whole captain-announce ability league-wide. Documented in `memory-bank/futureFeatures.md`. Realistic ~2hr feature when needed.

---

## DON'T pitch yet (overpromising risk)

### Fargo math verification claim
**Do not say** "we've verified our Fargo math is correct against BCA's calculator." It's *probably* correct — Ed has done the research — but it's not formally validated. **Say instead:** "We implemented Fargo from the published formulas. We'd love to use your reference implementation directly to guarantee alignment." (See MUST #5.)

### AI ref system as a product
It's a Gemini chat conversation, not an integrated product. Frame as R&D, not as feature. (See COULD #1.)

### Org-wide / global announcements
Today's announcements are per-season only. The broader scope tiers (org-wide, global) require an `org_member_affiliations` table that doesn't exist yet. Documented in futureFeatures.md. Don't claim this is built.

### Native mobile app
Web-only with mobile-responsive design today. React Native port is planned but doesn't exist. Older docs that reference "the mobile app" are forward-looking. If asked, say "mobile-responsive web today; native app on the roadmap with our mobile partner."

### Player classifieds / "Looking for a Team"
Designed in `memory-bank/futureFeatures.md`, not built. Don't claim.

### Specific dates for any "coming soon" feature
The only commitment Ed should make is "I can have X done in a week" for items that ARE genuinely a week away (dues being the current example). Don't promise dates for things in the "future bet" pile (AI shot-watching, Find-a-League, etc.).

---

## Demo flow (proposed sequence)

1. **Open the home page logged out** — show "Find a League" coming soon as a vision item; emphasize the public-discovery framing
2. **Log in as operator → click "Go to My Dashboard"** (just-shipped #4) — instant access, not buried in a menu
3. **Open the wizard** — create a fresh league using a preset; 3 minutes max
4. **Show the advanced-mode gate** — "here be dragons" warning if leaving the preset
5. **Add a team via TeamEditorModal** — show the just-shipped #16 incremental slots (5 slots visible for 5v5, trailing empty dropdown, no button noise)
6. **The kill move: add yourself as staff** — switch to a "BCA tech" account, demo the staff doing setup, remove yourself
7. **Open messaging** — show the captain-pings-for-a-sub flow end to end (Joe broke his ankle → tap → done)
8. **Show the rulebook** — search for "push out" or some BCA-specific term; show the searchable rule render
9. **Mention the future bets** — AI-assisted setup, foul-call R&D, Find-a-League — *as a question, not a claim:* "Where do you want to take this next?"

---

## Background context

Ed's bio: 20 years as an LO running BCA leagues. Personal frustration with their tooling drove him through paper → Excel → Google Sheets → AppScript → JavaScript → React. The whole app exists because the BCA/CSI tool was too complex for him to use comfortably — which means it's too complex for the typical operator.

That backstory IS the credibility. He's not a tech vendor making promises; he's a customer who built the thing he wanted.

---

## Open questions before the meeting

- Is Stripe / dues collection actually live by demo day? (If not — drop from pitch.)
- Is the advanced-mode "here be dragons" gate visibly present in the wizard today? (If not — small 30-min UI add. See MUST #1.)
- Has the captain-pings-for-a-sub flow been smoke-tested end-to-end on the latest main? (Worth a 10-min dev walk before the meeting.)
- Does Ed have a screen-recording setup ready in case live demo has connectivity issues? Backup plan = recorded walkthrough.
