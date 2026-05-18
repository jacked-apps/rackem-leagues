# League Finances + Prize-Payout Calculator — Requirements / Brainstorm

> **Date:** 2026-05-18
> **Status:** Brainstorm — needs Ed sign-off on open questions before plan + implementation
> **Estimated scope:** ~2–3 days (math engine + setup UI + end-of-season calculator UI + persistence)
> **Branch:** `brainstorm/league-finances-calculator`
> **Note:** This is a **calculator + record-keeper**, NOT a payment processor. The app helps the LO figure out who gets paid what; the LO still handles cash, checks, Venmo, etc. themselves. No receipts, no payouts processed, no compliance burden.

---

## The problem

Every season, the LO collects money from players each week, sets aside venue green fees, covers misc expenses, takes a cut for themselves, and pays out prizes to the top teams (and sometimes individual players). Today this is all paper + spreadsheet + mental math, with the LO ad-hoc-ing the prize structure at the end based on "how much do we have, how do I want to split it." Easy to:

- Miss an expense (forgot the trophies bill again)
- Forget to deduct green fees from one of the weeks
- Pick a payout split that looks weird ($732.47 to 1st place) instead of a nice round number
- Realize halfway through writing checks that you under-charged for your own cut

The app already knows: how many teams, how many players, how many weeks played. So most of the income side is just a multiplication. The debit side and the payout structure are where the LO needs help.

## The goal

A **finances tab on the league page** that:
1. Lets the LO set the per-player fee + green fee + any operator cut + the prize-distribution shape at season start (one-tap default OR full dial)
2. Auto-calculates the running total + projected prize pool as the season progresses
3. At end of season, presents a payout calculator with multiple sensible options (round numbers vs straight % vs hybrid), with an "adjust your cut" slider so the LO can see "if I take $50 less, 1st place gets $X more"
4. Saves the final payout structure to the season's record so it's auditable later

Operator handles the actual cash. App just does the math + record-keeping.

## The mental model

```
INCOME                        per week per player
  Fee in                            $10
    │
    ├─→ Green fee out  ────────►    $2   → venue
    │                               ────
    └─→ Goes to pool                $8

POOL ACCUMULATES OVER SEASON
  $8 × lineup_size × team_count × weeks_played
  e.g.   $8 × 5     × 8          × 12     = $3,840

DEDUCTIONS FROM POOL
  - App fee (whatever Rack'em charges this org)
  - LO cut (% of pool OR flat fee, LO's choice)
  - Misc expenses (trophies, paper, ink, banquet, etc. — LO adds line items)

ACTUAL PRIZE POOL  = whatever's left

PRIZE DISTRIBUTION
  - Team payouts (1st, 2nd, 3rd, …)
  - Optionally individual payouts (high single game, undefeated player, etc.)
  - Operator picks shape: round numbers OR straight % OR custom
```

---

## Decisions the LO makes (and when)

### At season start (Setup tab)

| Setting | Default | LO can dial? |
|---|---|---|
| Per-player weekly fee | $10 | yes |
| Green fee per player per week | $2 | yes (sometimes 0) |
| App fee | (read-only; from org's subscription terms) | no |
| LO cut shape | % of pool (default 10%) | yes: % OR flat $ |
| Prize-distribution shape | "doubling": 1st = 2× 2nd, 2nd = 2× 3rd, etc. — 3 places paid | yes: places paid + shape |
| Round-number target | $50 increments | yes: $1 / $5 / $10 / $25 / $50 / $100 / "no rounding" |

Defaults are based on the most common LO patterns; advanced operators dial them.

### During the season (Running view)

Mostly read-only — shows the running income, deductions, and projected prize pool. Updates each week. The LO can:
- Add a misc expense line as they go ("Bought trophies — $180")
- Adjust the LO cut % at any time (recomputes the projected pool live)

### At end of season (Calculator tab)

The LO sees the **actual prize pool** ready to distribute. The calculator shows three view modes the LO can toggle between:

1. **Round numbers** — applies the LO's prize-distribution shape to the pool, then rounds each prize to the nearest target ($50 increments by default). Any rounding-up overflow comes out of the LO's cut; any rounding-down spare gets bumped to 1st place (so the LO can hand out clean numbers).
2. **Straight percentages** — exact-to-the-cent payouts based on the configured shape. Will yield weird numbers like $732.47 but is mathematically "fair."
3. **Custom** — LO types in each prize amount directly; calculator shows running total + any over/underage that needs to come from (or go to) the LO's cut.

A **single slider** at the top adjusts the LO's cut by $ amount (or %), and every prize line updates live so the LO can see "if I take $50 less I can bump 2nd place up by $50."

The final calculated structure gets **saved to the season** when the LO clicks "Lock in payouts" — visible later as part of the season's archived record. (Optional next step: a "Payout sheet" the LO can print/share showing each team's name + dollar amount.)

---

## Open questions for Ed (need answers before plan)

### A. Player view — do they see this at all?

**Pick one:**
1. **LO-only.** Players never see any of this. Finances are operator-internal.
2. **Players see the season-final payouts** for their team (and maybe their personal share).
3. **Players see the running pool projection mid-season** (transparency, "if we keep playing the prize is on track to be $X").

My pick: **(1) LO-only for v1**, (2) as a future polish. (3) is interesting but might pressure operators uncomfortably.

### B. How does the app know each week's actual collections?

Two paths:
1. **Inferred from match data.** App assumes every rostered player on every match owed a fee. Counts match-player-rows. Operator overrides per week if reality differs ("only 7 players showed instead of 10 — we still collected for 10 because subs paid"). Operator can also mark a week as "voided" if cancelled entirely.
2. **Operator enters actuals each week.** Simple form: "this week we collected $X from Y players." More work but more accurate.

My pick: **(1) inferred + per-week override**. App does the work; operator corrects when needed.

### C. Forfeit / no-show — does the player still owe?

Real league behavior varies. Some leagues require the no-show player to pay anyway (so the team still owes the venue's green fee + the prize pool stays whole). Others let no-shows skip the fee.

**Pick one:**
1. Assume default = "no-show still pays" (matches most BCAPL/CSI leagues I've heard of); LO override available.
2. Default = "no-show doesn't pay" (more lenient).
3. Per-league setting (LO picks at setup).

My pick: **(1) default to "no-show still pays"**, with per-league override. Matches the most common pattern + protects the prize pool.

### D. LO cut: flat fee vs. percentage

The LO might want either:
- **Flat fee** ("I take $50/week regardless")
- **% of pool** ("I take 10% — bigger leagues pay me more")
- **Both** ("$25/week base + 5% of pool")

My pick: **support all three**, with % being the default. Drop-down at setup time + the slider on the end-of-season calculator lets them dial it.

### E. Mid-season expenses — do they affect the running pool projection?

When the LO adds "$180 — trophies" as a misc expense in week 6, does the projected end-of-season pool drop by $180 immediately? Or only "applied at end of season"?

My pick: **applied immediately to the running projection.** Want the operator to see the impact in real time.

### F. Multi-season operator cut accounting

Some LOs run 4 seasons/year and want a year-end view: "how much did I take in total operator cut across all leagues, all seasons this year?" Out of scope for v1 but worth noting for futureFeatures.

### G. Sponsor money / outside income

Some leagues get sponsorship (bar tab, equipment donations, sponsor money). Should the calculator accept "outside income" line items that boost the prize pool without coming from player fees?

My pick: **yes, support "additional income" line items.** Same shape as misc expenses but on the credit side. LO adds them as they come in.

### H. Where does this UI live in the navigation?

**Pick one:**
1. New tab on the league page (alongside Teams / Schedule / Standings / etc.) — "Finances"
2. New page off the operator dashboard (Org-level — covers all the org's leagues)
3. Both — overview at org level, detail per league

My pick: **(1) for v1** — single-league focused. The org-level rollup (option 3) is a Phase 2 polish item once we know what data shape to aggregate.

### I. Saving partial state mid-season

If the LO opens the end-of-season calculator early (week 10 of 12) to see "what would it look like if we ended now," is that just a preview, or do we save their tweaks?

My pick: **preview-only until they hit "Lock in payouts" at season end.** Otherwise mid-season tweaks would persist and confuse the final-state calculator.

### J. App fee — how does the system know the right number?

The org has a subscription with us. The app fee shown in the finance breakdown should match the org's actual subscription rate. **Pick one:**
1. Org-level setting (operator types it; we trust them).
2. From the Stripe subscription tier (when subscriptions are real).
3. Hardcoded "$0" until subscriptions exist; LO sets it manually later.

My pick: **(3) for v1**. App fee defaults to $0; LO can override per-league/per-season. Real Stripe integration is a Phase 2 thing once we have subscription tiers defined.

---

## Proposed feature shape

### Setup tab (start of season)

A small form on the league page. Operator sets:
- Per-player weekly fee + green fee (with sensible defaults)
- LO cut (flat / % / both)
- Prize-distribution config (places paid + shape)
- Round-number target

One-click "use defaults" populates everything; the dial-everything mode is one click away.

### Running tab (mid-season)

Read-mostly view showing:
- Income: weekly running total based on inferred match data + any LO overrides
- Deductions: green fees out, LO cut so far (live as it accrues), misc expenses
- Projected prize pool at season end (estimates remaining weeks at the same rate)
- "Add misc expense" + "Add outside income" buttons

### Calculator tab (end of season)

The headline view. Top section: actual prize pool ready to distribute. Middle: three calculation modes (round / % / custom) with the prize lines updating live. Bottom: "Lock in payouts" button + a slider for LO cut adjustment.

### Locked-in state (post-activation)

Season's archived record shows the final payouts as part of the standings page. Read-only audit trail.

---

## What's explicitly out of scope (v1)

- **Actual payment processing.** Operator handles cash/Venmo/checks themselves.
- **Player-facing visibility** of finances (LO-only for v1)
- **Org-level rollup across leagues** (single league for v1)
- **Multi-currency** (USD only)
- **Tax forms / 1099 generation** (separate concern entirely; LO's CPA territory)
- **Sponsorship CRM** (just a line-item credit, not a sponsor management feature)
- **Player wallet / store credit** (different feature shape; future possibility)

---

## What could come after this (futureFeatures candidates)

- **Org-level finance rollup** — "across all my leagues this year, here's the picture"
- **Player wallet** — running balance per player, credits/debits, applied to next season's fees
- **Tax-time export** — CSV of all transactions for the LO's accountant
- **Player-facing transparency mode** — opt-in, players see the running pool
- **Mid-season payout adjustments** — split prize pool into multiple disbursements (e.g., half-season + season-end)
- **Auto-suggest LO cut** based on league size + season length (training data over time)

---

## External examples worth checking before final design

Ed (2026-05-18): "im sure there are examples out there we can find that would show other metrics i may have missed." Worth a 30-min research pass to look at:
- BCAPL local-league payout structures (their handbook may publish a template)
- APA prize-tier defaults
- CSI Master Pool Player League payout formulas
- Common bar-league "house calcs" (forums / Reddit pool league discussion)

Surfacing what's standard helps the "one-tap default" stay genuinely sensible, and may identify metrics or expense types I missed (e.g., handicap-tracking subscription fees, paid scorekeeper compensation, etc.).

I can run a web research pass after Ed answers the open questions if he wants.
