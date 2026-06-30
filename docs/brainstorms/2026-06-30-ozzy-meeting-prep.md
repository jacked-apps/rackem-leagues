# Ozzy / Fargo Meeting Prep

> **Date:** 2026-06-30
> **Status:** Outreach email sent ~2026-06-29; awaiting reply. This is the meeting script for if/when Ozzy says yes.
> **Audience:** Ed (the meeting), referenceable by anyone helping prep.
> **Companion doc:** [`2026-05-17-bca-pitch-strategy.md`](./2026-05-17-bca-pitch-strategy.md) — the full feature-level pitch triage. This doc is the **strategic spine** that goes on top of it.

---

## Who's in the room

Three Fargo/CSI leaders, all far deeper on the math/theory than Ed:
- **Ozzy** — the contact (NASA-engineer background per Ed).
- **Mike** — university professor.
- **Steve** — Microsoft software engineer.

Ed's standing is **not** "smarter than them." It's "the operator who's sat in the chair for ~15+ years and knows exactly where it hurts." That asymmetry is the whole value: they see theory from 30,000 ft; Ed sees what actually breaks on a Tuesday night. He's a **data source they don't have**, not a rival.

---

## The one disarm that matters

Ozzy has been dodging because he reads Ed as **competition for LMS**. Everything in the meeting hangs off killing that. The proof Ed leads with:

- Retired, well off, no longer runs a league (just helps friends).
- Modest side-hustle interest at most; would build it even if it earned nothing.
- **Wants Fargo to stay the source of truth** — volunteering to be *dependent* on their rating engine. A competitor never does that.

> "I'm not after LMS. I want to be the on-ramp that feeds it more players."

---

## The strategic spine (the meeting thesis)

This is the sharpened argument — newer and stronger than the feature list in the companion doc.

### 1. APA vs. BCA is a culture war Ed has a stake in
- **APA** = operating is an income/employment model. Scales because it pays people to keep adding leagues.
- **BCA** = operators run on passion for the game. More desirable for the sport, but **passion doesn't scale the way a paycheck does.**
- APA's culture treats moving *up* a skill level as something to **dread** — players are glad when their number drops, captains steer novices away from improving to stay under the 23 cap. Nobody's cheating; they've just stopped *striving*.
- BCA + Fargo do the opposite: the next level is a **badge of honor**. That's the side Ed wants to win.

### 2. The growth wall BCA hits
Every BCA league costs the same hours for minimal income, so even the most talented LO caps out at a few divisions. Ed himself was stretched running just two nights. **The bottleneck is hours-per-league, not market demand.**

### 3. The bridge — both orgs' goals point the same direction
- **Fargo's win:** more games reported → broader, better rating data. They want the **data**.
- **BCA's win:** more leagues with the freedom to run varied formats → more enticing → more members. They want the **flexibility**.
- Both collapse to the **same outcome: more people playing and paying.**
- Ed's app sits exactly where the games happen (the operator/player surface), so in one place it can **feed Fargo clean stats** *and* **give operators the easy, flexible experience BCA wants.** He's the connective tissue that makes both flywheels spin faster.

> Frame Fargo's "you care more about the data than the experience" read as **what Ed sees from the operator's chair**, or as a question — never as a verdict on their own business. Humble keeps it from reading presumptuous.

---

## The "layer" question — have the honest answer ready

Ed uses "a *layer* over LMS" (in quotes) in the email. With a NASA/Microsoft/professor audience, expect "what do you mean by layer?" The honest answer:

- **Ratings:** *"I feed LMS the stats and read your numbers back. You stay the single source of truth — I never want to store or compute a rating myself."* With their API, this piece genuinely **is** a client/layer over Fargo. Today it's file upload + a printout for manual entry; the goal is a one-click automatic push.
- **Scoring/handicap config:** Honest framing — *"I only built my own scoring because I didn't have your math. I reverse-engineered it from real leagues as best I could. Give me your reference and I'd rather just use yours so it's guaranteed identical to LMS."* This piece is Ed's **own engine that mirrors their dials**, not a call into theirs — so it's a parallel implementation, not a layer. Don't claim parity until Fargo provides the reference.

**Why this distinction helps, not hurts:** it turns into two clean asks that both make Fargo *more* authoritative (rating API + reference math). On the crown jewel — ratings — Ed is volunteering to be dependent on their engine. Maximum disarm.

---

## The two asks

1. **Rating API** — feed stats in, read numbers out; Fargo stays source of truth.
2. **Reference scoring math** — so Ed's presets are byte-identical to LMS instead of his best reverse-engineered guess.

Both reinforce "you stay authoritative; I'm the easy front end."

---

## Demo readiness — verify BEFORE the reply comes

Pulled from the companion doc's open questions; these make or break the live demo:

- [ ] Is dues / Stripe collection actually live? (If not, drop it from the pitch.)
- [ ] Is the "here be dragons" advanced-mode gate visibly present in the wizard today?
- [ ] Has the captain-pings-for-a-sub messaging flow been smoke-tested end-to-end on latest main?
- [ ] Screen-recording backup ready in case live connectivity flakes.
- [ ] The "add me as staff" onboarding move works on a clean account (the killer onboarding demo).

Proposed demo sequence lives in the companion doc ("Demo flow").

---

## Tone guardrails (from the email work)

- Lead with "no angle," not "no money." Honest > polished: *"I won't pretend this isn't partly about money — but I'm retired, well off, and don't need it. I want it."*
- "APA is bad for pool" is fine **because** Ed backs it with the skill-progression reasoning — argued opinion, not cheap shot. Shared-enemy bonding with this audience.
- Keep the ask cheap: 20–30 minutes, no prep on their end.
- Offer to listen: *"I'd love to hear your pain points and see if I can help with those too."*
