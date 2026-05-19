# Stack Test Plan — 2026-05-19

Manual test runbook for the 4-PR draft stack. Goal: tick every box once, then we flip the drafts to real PRs.

**Stack tip:** `feat/league-finances-calculator` — includes all 4 PRs (#120 + #121 + #122 + #123). Test from this branch and you exercise the whole bundle.

| PR | Branch | Feature |
|---|---|---|
| #120 | `feat/new-season-from-previous` | Next-season-from-previous wizard |
| #121 | `feat/captain-reup-sheet` | Captain re-up modal + status card |
| #122 | `feat/wizard-reup-prefill` | Wizard reads re-up data + dev seed |
| #123 | `feat/league-finances-calculator` | League finances + payout calculator |

---

## 🤖 Already verified (Claude — you don't need to redo)

These are done. Listed here as evidence, not as work for you.

- ✅ `npx tsc -b --noEmit` exits 0 on the stack tip
- ✅ All non-DB-touching unit tests pass on the stack tip (1446 pass / 9 file failures are all in `src/__tests__/database/` which require local Supabase + the 4 pre-existing `AppDrawer.test.tsx` failures on main from the nav IA overhaul — neither is from this stack)
- ✅ 42 finance math unit tests pass (income / LO cut / prize distribution / payout plan orchestrator)
- ✅ Route `/operator/start-next-season/:leagueId` registered in `NavRoutes.tsx`
- ✅ Route `/reup` registered in `NavRoutes.tsx`
- ✅ "Start Next Season" CTA wired in `LeagueDetail.tsx` (gated on `isNextSeasonRipe`)
- ✅ `LeagueReupStatusCard` mounted in `LeagueDetail.tsx`
- ✅ `CaptainReupSyncer` mounted globally in `App.tsx`
- ✅ `LeagueFinancesSection` mounted in `LeagueDetail.tsx`
- ✅ `OrgFinanceDefaultsCard` mounted in `OrganizationSettings.tsx`
- ✅ `useSeasonLockedPayouts` consumed by `Standings.tsx`
- ✅ 3 new migrations present + parseable: `20260517000010_create_season_from_previous_rpc.sql`, `20260517000020_captain_reup_sheet.sql`, `20260518000010_league_finances.sql`

---

## 🔧 Setup (one-time, ~5 min)

Do these once at the start. Skip whichever you don't need to repeat.

- [ ] **Check out the stack tip + pull:**
  ```
  git checkout feat/league-finances-calculator
  git pull
  ```
- [ ] **Reset local Supabase** (applies all migrations including the 3 new ones):
  ```
  supabase db reset
  ```
  *Alternative if you only want to apply the 3 new ones manually:* paste each of these into Studio in order:
  - `supabase/migrations/20260517000010_create_season_from_previous_rpc.sql`
  - `supabase/migrations/20260517000020_captain_reup_sheet.sql`
  - `supabase/migrations/20260518000010_league_finances.sql`
- [ ] **Run dev seed:** paste `database/dev_bootstrap_full.sql` into Studio. Produces realistic-named teams + a captain + members + 2 leagues (fresh + near-end-of-season). Idempotent.
- [ ] **Make a season "ripe"** so PR #120 has something to test against: paste `database/dev_make_season_ripe.sql` into Studio.
- [ ] **Start the dev server:** in your terminal: `pnpm run dev`
- [ ] **Log in** as `operator@test.com` / `test-password-123`

---

## ✅ Smoke pass — does anything crash? (~3 min)

Quick "load each page" sweep before the deep tests. Each item is one click.

- [ ] Operator dashboard loads (`/operator-dashboard/<orgId>`)
- [ ] League detail loads (click into the ripe league from the dashboard) — should see League Status + new 💰 **League Finances** section + Teams + Schedule cards, no console errors
- [ ] Org settings loads (`/operator-settings/<orgId>`) — should see new **Finance Defaults** card
- [ ] Standings page loads for an active season (no Prize column yet — that's expected before lock-in)
- [ ] As the captain (log out, log in as `captain1@test.com` / `password`), navigate to `/reup` — page renders

If any of those crashes, stop and tell me what you saw before continuing.

---

## PR #120 — Next-season-from-previous wizard

**Where:** League detail page for the ripe league.

- [ ] **CTA visible:** the league detail page shows a "Start Next Season" CTA card (📅 icon) instead of the generic "Let's Go" CTA. Copy reads "Your current season is wrapping up..."
- [ ] **Click flow:** clicking the button takes you to `/operator/start-next-season/<leagueId>` (URL bar should match)
- [ ] **Start-date picker** (rebuilt post-first-test): the Start Date step shows **three radio choices** anchored on the previous season's last played week:
  - "Start immediately" = last week + 7 days
  - "Take a week off" = last week + 14 days
  - "Take more time off" = custom DateStepper, minDate = last week + 21 days, locked to the league's play DOW
  - Defaults to "Start immediately". All three dates should land on the league's play day (e.g. all Thursdays for League 2).
- [ ] **Team list step:** previous season's teams appear pre-selected for the new season
- [ ] **Venue step:** previous season's venues appear pre-selected
- [ ] **Submit works:** clicking Create on the final step lands you somewhere sensible (probably the new season's league detail page) and a new season exists in the DB

**Optional / nice-to-check:**
- [ ] Hit `/operator/start-next-season/<bogus-uuid>` directly — page should fail gracefully (error state, not blank/crash)

---

## PR #121 — Captain re-up sheet

**Where:** logged in as a captain. Easiest captain login: `captain1@test.com` / `password`.

- [ ] **Prompt fires:** when you log in (or open the drawer), a re-up prompt appears for at least one team
- [ ] **Re-up "yes" path:** click the re-up CTA → land on `/reup` → fill in the form → submit → no error toast
- [ ] **Persistence:** refresh the page; the team you re-upped no longer prompts
- [ ] **Decline path:** for a second team (if you have one), choose decline → submit → no prompt next visit

**Operator side** (log back in as operator):
- [ ] **Status card:** the league detail page shows a `LeagueReupStatusCard` listing the captains + their re-up status (re-upped / declined / pending)
- [ ] **Status reflects reality:** the captain you just re-upped shows as "re-upped"; the one you declined shows as "declined"

**Optional:**
- [ ] **Dismiss vs decline:** close the modal without choosing → next visit should re-prompt (dismissal ≠ decline)

---

## PR #122 — Wizard reads re-up data + dev seed

**Combined test with PR #120's wizard** — open the next-season wizard for the same league you just re-upped some captains on.

- [ ] **Declined captains excluded:** in the team list step, the team(s) whose captain *declined* are NOT pre-selected (or are marked "not returning")
- [ ] **Re-upped captains included:** the team(s) whose captain *re-upped* ARE pre-selected
- [ ] **Dev seed sanity:** in the dashboard team rosters, players have realistic names (not "Player 1 Team 2")
- [ ] **Two leagues visible:** the dashboard shows both seeded leagues (one fresh, one near-end-of-season)

---

## PR #123 — League finances + payout calculator (the headline)

Most surface area; budget ~10 min.

### Org-level defaults

**Where:** `/operator-settings/<orgId>` → scroll to **Finance Defaults** card.

- [ ] **Card visible** with default values pre-filled ($10/player, $2 green fee, 10% LO cut, 50/30/20 shape, 3 places, $25 rounding)
- [ ] **Edit + save:** change price to $12, click Save → toast "Organization finance defaults saved", refresh → $12 persists

### League-level settings

**Where:** league detail page → 💰 **League Finances** section.

- [ ] **Section appears** between league overview and Teams card
- [ ] **Settings card badge:** says "Using org defaults" until you edit; after first save flips to "League override active"
- [ ] **Reset-to-org-defaults button:** click it → badge flips back to "Using org defaults", values revert to org-level

### Running Projection (read-only card above settings)

- [ ] **Numbers populate live:** edit the price in the Settings card; the Projected Prize Pool number updates as you type (no save needed for the projection to react)

### Expenses + Credits + Dropped Teams (need an active season)

**Where:** Same league page, below the Settings card.

- [ ] **Quick-add chips:** click a 🏆 Trophies chip → form pre-fills description "Trophies" → enter $200 → Add → row appears in the list, summary shows Expenses: $200
- [ ] **LO-funded checkbox:** add a 🎁 LO gift expense ($100, leave the LO-funded checkbox ON) → it goes under "🎁 LO-funded", does NOT reduce the "Projected Prize Pool"
- [ ] **Credit chip:** click 💰 Sponsor cash, enter $50, Add → appears in list, summary credits increase
- [ ] **Dropped Teams card:** pick a team from the dropdown, enter a drop week (e.g., 6), click "Mark dropped" → team appears in dropped list → Projected Prize Pool decreases (because lost weeks of income subtract)

### Payout Calculator (the headline)

**Where:** Same league page, below the projection. Card has a blue accent border.

- [ ] **Mode: auto** is default. Pool number matches the projection's "Projected Prize Pool" minus pool-funded individual awards
- [ ] **Mode: manual_pool:** switch to "Manual — I'll type the pool $ amount" → input field appears → type 5000 → table shows 1st=$2500, 2nd=$1500, 3rd=$1000 (50/30/20 of 5000)
- [ ] **Mode: target %:** switch to "% of formula pool — pay out X%" → type 50 → pool is half of the auto pool
- [ ] **Shape selector:** change to "Doubling (1st = 2× 2nd)" → 1st place jumps proportionally higher, 2nd halves, 3rd quarters
- [ ] **Sliding scale:** change to "Sliding scale (linear)" → top-heavy but gentler than doubling
- [ ] **Flat:** change to "Flat (everyone equal)" → all places equal
- [ ] **Places paid input:** change from 3 to 5 → table grows to 5 rows
- [ ] **Individual awards section:** two awards seeded — 🏆 Top Shooter ($100, pool-funded) + 🎁 Outstanding Achievement ($50, LO-funded)
- [ ] **Pool-funded reduces team pool:** the "Pool before individual awards" line shows `pool`; the "Team prize pool" line shows `pool − $100` (Top Shooter); LO-funded $50 does NOT subtract
- [ ] **Add a custom award:** click Add award → enter "Beer fund" / $25 / LO-funded checked → no change to team pool, but the LO-funded summary increases

### Lock-in

**Where:** Same calculator card, bottom.

- [ ] **Lock button visible** (only when an active season exists)
- [ ] **Lock → green banner:** click "Lock in these payouts..." → confirmation toast, calculator switches to a green "Payouts locked" banner showing final pool + date
- [ ] **Standings page picks it up:** navigate to the season's standings page → table now has a **Prize** column with $ amounts per rank, and an **Individual Awards** card appears at the bottom
- [ ] **Unlock escape hatch:** back on the calculator card, click the small "Unlock" ghost button → banner disappears, calculator returns to editable state, Standings prize column disappears

**Optional:**
- [ ] **Edit settings after lock:** verify locked snapshot doesn't change when you edit settings (snapshot is frozen)

---

## When this list is empty…

1. Comment in the PR threads with anything you saw worth flagging
2. Tell me which PRs (if any) need fixes; I'll patch on the appropriate branch
3. Once you're satisfied: flip the four drafts → real PRs (`gh pr ready <number>` or via GitHub UI)

---

*Generated 2026-05-19. If the stack rebases against main, the migrations + entry points may need re-verification — ping me to re-run the Claude pass.*
