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
- Pick a payout split that looks weird ($732.47 to 1st place) instead of a nice round number
- Realize halfway through writing checks that you under-charged for your own cut

The app already knows team count, lineup size, and total regular-season weeks. So the income side is a one-line formula the moment those are set. The LO just needs to tell us the price-per-player-per-night + green fee, and we can project the prize pool from Day 1.

## The goal — a slick payout calculator (the rest is supporting cast)

Per Ed (2026-05-18): **"this is MOSTLY a tool to figure out prize payouts. the rest is fluff and qol. so dont go crazy on the credit debit side — go crazy on the calculate payouts nifty slick and cool side."**

So the design priorities are:

1. **HEADLINE — payout calculator.** End-of-season tool that takes a prize pool number and turns it into nice prize allocations (round numbers / straight % / custom), with an LO-cut slider that updates everything live. This is where we polish the UX.
2. **Supporting — auto-computed income + simple expense entry.** The formula tells us the projected pool from Day 1 (`price × lineup_size × teams × weeks`). Expenses + credits are a simple list with dates. Persisted because LOs want a "what did I spend and when" reference, but kept lean.
3. **Bonus entry point — "I have $X, figure it out for me."** LO can skip income tracking entirely and just feed in a manual pool amount → straight to the calculator. Power-user shortcut.

**Three ways the LO can get to a prize-distribution:**
- (A) Set up income inputs at season start → app calculates pool → calculator runs at end
- (B) Skip the formula, enter a manual pool amount → calculator runs immediately
- (C) Hybrid: formula-based projection + LO override at the end

Operator handles the actual cash. App just does the math + record-keeping.

**Critical simplification (per Ed 2026-05-18):** the app does NOT try to track each week's actual collections. It runs a deterministic formula from the configured inputs. If reality drifts from the formula (a player no-showed and didn't pay, a sub paid extra), the LO accounts for that manually. No ledger, no per-week reconciliation.

## The mental model

```
PROJECTED INCOME (formula from Day 1 — uses TOTAL season weeks, not "so far")
  price_per_player × lineup_size × team_count × total_regular_season_weeks
  e.g.   $10        × 5            × 8           × 12                       = $4,800

PROJECTED GREEN FEES (same formula, different multiplier)
  green_per_player × lineup_size × team_count × total_regular_season_weeks
  e.g.   $2          × 5            × 8           × 12                      = $960

PROJECTED PRIZE POOL (before LO deductions)
  income − green fees = $4,800 − $960 = $3,840

LO DEDUCTIONS (set at end-of-season — but visible mid-season as projection)
  - App fee (defaults $0; LO can override per-season)
  - LO cut (% of pool OR flat fee OR both; LO's choice)
  - Misc expenses (trophies, paper, ink, banquet, etc. — LO adds line items)
  - Misc credits (sponsorship, extra raffles — LO adds line items)

ACTUAL PRIZE POOL  = projected pool − deductions + credits

PRIZE DISTRIBUTION
  - Team payouts (1st, 2nd, 3rd, …)
  - Optionally individual payouts (high single game, undefeated player, etc.)
  - Operator picks shape: round numbers OR straight % OR custom
```

Everything to the left of the divider is COMPUTED. Everything to the right is OPERATOR INPUT. The whole thing collapses to a one-page form + a calculator view.

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

### B. How does the app know each week's actual collections? — SETTLED 2026-05-18

**It doesn't track them.** The app runs a formula: `price_per_player × lineup_size × team_count × total_regular_season_weeks`. LO enters price + green fees ONCE at season start. App projects everything from there. If reality drifts (no-shows, sub overcharges, missed weeks), the LO accounts for it manually in the final calculator via misc-expense or "actual income override" inputs.

Mid-season "what should we have right now" view = the same formula with `weeks_played_so_far` instead of `total_regular_season_weeks`. Useful as a sanity check; not authoritative.

### C. Forfeit / no-show vs. team drop — SETTLED 2026-05-18

**Forfeit / no-show is the TEAM's problem, not the app's.** Per Ed (2026-05-18): "team is expected to pay for subs noshows. the cost is the cost for the team." So per-night per-team = `lineup_size × price_per_player`, regardless of who actually showed up. Subs settle up with the team internally; no-shows still owe the team. Forfeit nights = team still owes for the night. The app's income formula treats the team as the unit of obligation.

**Team drop mid-season IS something the app cares about.** When a team quits entirely partway through a season, two things happen:
1. They stop paying → income from them stops as of the drop week
2. They drop out of the prize hunt (can't win)

Without handling, the formula would over-count income from a dropped team for the remaining weeks. **Calculator needs a "Team drops" section** where the LO can:
- List each team that dropped + the week they dropped
- Calculator subtracts the lost weeks from income automatically (`price × lineup_size × dropped_team_count × weeks_remaining_after_drop`)

For v1, this is just an LO-entered list of `(team_id, week_number_they_dropped)` pairs. The calculator computes the lost income from there. Future polish: auto-detect from `teams.status = 'withdrawn'` (if the LO marks the team withdrawn in Team Management, the calculator could pre-fill the drop entry).

### D. LO cut: flat fee vs. percentage — SETTLED 2026-05-18

Support all three modes: **flat $/week**, **% of pool**, or **both** (flat base + %). % of pool is the default. Drop-down at setup time + the slider on the end-of-season calculator lets the LO dial it live.

### E. Mid-season expenses — do they affect the running pool projection? — STANDING PICK 2026-05-18

**Applied immediately to the running projection.** When the LO adds "$180 trophies" as an expense, the projected end-of-season pool drops by $180 right then. Lets the operator see what's left to play with as the season goes.

### F. Multi-season operator cut rollup — DROPPED 2026-05-18

Per Ed: not needed. Not in v1, not in futureFeatures, not a thing.

### G. Sponsor money / outside income — SETTLED 2026-05-18

Yes, support misc-credit line items the same way as misc-debit (trophies, ink). LO adds them as they come in. Lift the pool by the credit amount.

### H + I. Where does this live + persistence model — SETTLED 2026-05-18 (with structure)

Per Ed: two-level configuration with persistence.

**Org level — "Org Finance Defaults":**
- New section on the org settings page (`/operator-settings/:orgId`)
- LO sets org-wide presets: default price-per-player-per-night, default green-fees-per-player-per-night, default LO cut shape, default prize-distribution shape, default round-number target
- Any league created under this org **inherits these defaults** unless overridden

**League level — "Finances" tab on the league page:**
- New tab on `LeagueDetail.tsx` (alongside Teams / Schedule / Standings)
- Starts pre-filled from org defaults; LO can override per-league
- Persisted: all the inputs + the expense/credit line items (with dates) + the final locked-in payouts
- LO can view their expense list anytime: "what did I spend, when did I spend it"

**Calculator views inside the Finances tab:**
- "Running projection" view (default if season is active) — formula-based pool + running deductions
- "Payout calculator" view (default if season is completed) — the headline slick tool

Per Ed: "this is MOSTLY a tool to figure out prize payouts. the rest is fluff and qol." So the expenses/credits list is intentionally lean — just a date + amount + description form. Calculator UI is where we put the polish budget.

### J. App fee — SETTLED 2026-05-18

The proposed pricing is on `src/leagueOperator/BecomeLeagueOperator.tsx` — **$1 per team per week + $10 setup per season.** Fully computable from data the app already has:

```
app_fee = (team_count × season_length × $1) + $10
```

No LO input required. Calculator shows it as an automatic deduction with a tooltip explaining the math. If a future pricing change happens, we update the formula in one place.

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
