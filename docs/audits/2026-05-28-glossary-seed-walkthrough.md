# Glossary Seed List — League Creation Wizard Walkthrough

**Status:** DRAFT — Ed to red-pen.
**Date:** 2026-05-28
**Source:** Every step file in `src/wizards/league-v2/steps/` + `leagueWizardConfig.ts` + `leagueFormatOptions.ts`. Pulled every visible label, info-button title/body, card title, description, and helper text.

## Instructions for Ed

- **Strike through any term that doesn't belong** (wrong, confusing, vestigial CSI baggage).
- **Fix any definition that's wonky.** They should each be 1–2 plain-English sentences (the popover form). The deep dive lives in the glossary's `longDef`.
- **Add any term I missed** that an LO actually sees in the wizard.
- I marked uncertain calls with **[?]**. Tell me which way to go.
- I flagged vestigial / wrong terms at the bottom.

---

## Structural / container terms

| Term | Where it shows | Proposed 1-sentence definition | Notes |
|---|---|---|---|
| **League** | Intro, throughout | A specific game + night combination that runs over time (e.g., "8-Ball on Mondays") — set up once, then hosts recurring seasons. | Core concept. From LeagueIntroStep prose. |
| **Season** | Intro, Start Date | One specific run of league play under a league — has a start date, weekly matches, and ends with playoffs (if configured). | Multiple seasons can run under one league. | Ed.  seasons run one after the other to form consistant play.
| **Match** | throughout | One team-vs-team meeting played on a specific night; contains multiple games (e.g., 18 in 3v3, 25 in 5v5). | |
| **Matchup** | Match Format, Pairing Format | A single player-vs-player face-off within a match. | **[?] Ambiguous.** In the wizard it means "player vs player." In casual speech it often means "team vs team." Which one is canonical for you? | Ed. matchups are the sibling to season. it is which team plays which team on a specific night.  matchup for 12 teams would have 6 matches.
| **Pairing** | Pairing Format step | A single player-vs-player face-off within a match. | **[?] Same as Matchup?** They're used as synonyms in the wizard. Pick one canonical name or define both as the same thing? | Ed.  pairing is not a term we use too much yet. or shouldn't   pairing is a term for when 2 players play a "race" so teams playing individual races (not round robin style) would have pairings.
| **Game** | throughout | A single rack between two players; you win a game by winning the rack. | |
| **Rack** | Pairing Format, throughout | A single game in pool — racking the balls, breaking, then playing them out; can also be used as a verb (to rack). | **[?]** Is "rack" used both as the unit (1 game = 1 rack) AND as the rack-of-balls noun? | Ed.  rack is used vanacularly in both ways.  we use it mostly to signify who does not break in a single game. the racker.
| **Qualifier / Descriptor** | Qualifier step | An optional name tag added to the league name for when you run multiple leagues of the same game on the same day (e.g., "East Side", "Beginner"). | **Vestigial flag below.** |

## Game types

| Term | Where it shows | Proposed 1-sentence definition | Notes |
|---|---|---|---|
| **8-Ball** | Game Type step | Classic stripes and solids — one team takes the stripes, the other takes the solids, then the 8-ball wins. | |
| **9-Ball** | Game Type step | Rotation game using balls 1–9; hit the lowest-numbered ball first, sink the 9 to win the rack. | |
| **10-Ball** | Game Type step | Call-pocket rotation using balls 1–10; must call which pocket the 10 falls into. | | Ed.  this game is call pocket the entire game unlike 9 ball.  you must call a ball and a pocket for a legal shot.

## League format / shape

| Term | Where it shows | Proposed 1-sentence definition | Notes |
|---|---|---|---|
| **League Format** | League Format step | The bundle of decisions that defines how this league plays — team size, handicap, match structure. | | Ed.  this may be close approximation for scoring system or at least the basics of it.
| **Preset** | League Format step | One of the prepackaged formats (3v3 Standard, 5v5 Standard, 5v5 Fargo Rated) that locks in every modular setting at once. | |
| **Tested Preset** | Threshold Source, Review | A preset whose handicap threshold chart has been calibrated against real-world play and ships with the app. | Specific to threshold/handicap context. |
| **Custom** | League Format step | Configure every league setting yourself, one question at a time — longer setup but full control. | |
| **3v3 Standard** | League Format step | 3 players per team, points handicap, double round robin (18 games per match). | | Ed.  handicap determines a target amount of games for each team to win the match.  a point is awarded for each game above that target, and deducted for each game below it.   ties are settled by another round best 2 of 3 games.
| **5v5 Standard** | League Format step | 5 players per team, percentage handicap, single round robin (25 games per match). | | Ed.  handicap determines a target for the amount of games for the win.  and another target 70% of that.  .1 points are given for each win  at the 70% target total jumps to 1.5.  at the win target total jumps to 3.0 .1 are added before the jump.
| **5v5 Fargo Rated** | League Format step | 5 players per team, Fargo handicap, single round robin; uses Fargo ratings to set thresholds. | | Ed.  Fargo rates are used to calculate a number of points the weaker team starts with.  each game awards 10 points to the winner.  losing player is awarded the number of balls pocketed.   can be from 0-7 points. winning team has the most points at the end of the match.(all games played)

## Teams / players

| Term | Where it shows | Proposed 1-sentence definition | Notes |
|---|---|---|---|
| **Lineup** | Lineup Size, ThresholdSource narrative | The set of players from a team who actually play during a given match night (chosen from the larger roster). | |
| **Lineup Size** | Lineup Size step | How many players per team actually play each match night. | |
| **Roster** | Roster Size step | The full set of players signed up to a team — must be at least the lineup size; extras serve as substitutes. | |
| **Roster Size** | Roster Size step | The maximum number of players a team can carry on its roster. | |
| **Substitute** | Roster/Lineup narratives | A roster player who isn't in the lineup for a given match. | | Ed.   2 types of substites are supported by the app. 1. anonymous sub.   a player whos handicap is known by the league that plays in place of a missing player they play "anonymously" so their play wont affect thier handicap.  this allows the player to play their best and does not entice them to lose on purpose to lower his handicap.   2 double duty.  this allows one of the players in the lineup to play in 2 positions.  the opposing team sees the available choices and can pick which player is the one to play in 2 positions.
| **Captain** | ThresholdSource narrative | Team leader; sets the lineup and adjusts handicap thresholds at lineup lock. | Mentioned in step prose, not as a UI label here — but operators clearly know it. | Ed.  In this app he manages the team in almost every way.  can change name, add remove players. etc.
| **Lineup Lock** | ThresholdSource narrative | The moment a captain finalizes their lineup before a match — also when manual thresholds get entered for off-preset combos. | |

## Match structure

| Term | Where it shows | Proposed 1-sentence definition | Notes |
|---|---|---|---|
| **Match Format** | Match Format step | How individual games inside a match get generated (single or double round robin, individual races, etc.). | |
| **Round Robin** | Match Format step | A format where every player on one team faces every player on the other team. | |
| **Single Round Robin** | Match Format step | Each player faces each opposing player once. | |
| **Double Round Robin** | Match Format step | Each player faces each opposing player twice — once breaking, once racking. | |
| **Individual Races** | Match Format step | Each matchup is a race to a target instead of a single rack. | Currently disabled — coming soon. |
| **Pairing Format** | Pairing Format step | Whether each player-vs-player matchup is decided by one rack or a race to N. | |
| **Single Rack** | Pairing Format step | One rack per matchup; the winner of that rack wins the pairing. | |
| **Race to N** | Pairing Format step | Each matchup plays a race to N racks (e.g., race to 7); first to N wins the pairing. | |
| **Race / Race To** | throughout | A first-to-N format. | Generic — appears in many places. |

## Handicap concepts

| Term | Where it shows | Proposed 1-sentence definition | Notes |
|---|---|---|---|
| **Handicap** | throughout | A skill compensation mechanism that lets uneven players compete fairly. | | Ed.  MORE fairly.
| **Handicap System** | Handicap System step | The method used to calculate skill compensation (Points, Percentage, Fargo, Skill Level, or None). | |
| **Handicap Mechanism** | Mechanism step | How the handicap result is applied to the match — extra games to win, bonus start points, race-length adjustment, or none. | "System" picks the formula. "Mechanism" picks how it's applied. |
| **Points (handicap)** | Handicap System step | Handicap formula: (Wins − Losses) / Weeks Played; produces a value from −2 to +2. | **Different from "points scoring."** |
| **Percentage (handicap)** | Handicap System step | Handicap formula: Wins / Total Games Played, expressed as a percent. | Used by 5v5 Standard. | Ed.  this is a straight win loss percentage.  dont say used by 5v5 standard that name can change and then this definition is broken. AND it ties it to a specific thing meaning it potentially can NOT be used other places.  NO DRIFT
| **Fargo / FargoRate** | Handicap System step | Player skill rating from 100 to 850 maintained by FargoRate (an external organization); higher is stronger. | Already in the glossary as `fargorate`. |  Ed.  i just found out there is no cap by design  so it can go over 1000 if necessary.  evidently.
| **BCAPL Skill Level** | Handicap System step | Integer 1–9 skill level from BCAPL's published Skill Level Chart. | Currently disabled in the wizard per the brainstorm — reserved. |  Ed.  i think this got mixed up with an apa skill level this might not be a good definition
| **No Handicap** | Handicap System / Mechanism | All players compete on equal terms; no skill compensation applied. | |
| **Extra Games** | Mechanism step | The higher-rated team needs to win more games than the lower-rated team to take the match. | |
| **Start Points** | Mechanism step | The lower-rated team begins the match with a points credit. | Fargo 10-7 pattern. |
| **Race Length Adjustment** | Mechanism step | Each pairing has its own race length set by the rating gap (stronger player needs more racks). | BCAPL Skill Level pattern. | Ed.  this is essentially the same as extra games.
| **Threshold** | throughout | The number of games a team needs to win (or tie) a match — produced by the handicap chart for that match's lineups. | | Ed.  synonyms used benchmark milestone.  target number of games/points.
| **Threshold Chart** | Threshold Source step | The lookup table that maps team ratings → thresholds for each match. | | Ed. lookup table or formula creating the table.
| **Calibrated** | Threshold Source step | A threshold chart that's been tested against real-world play and ships with the app. | |
| **Manual Entry** | Threshold Source step | Captains enter the agreed thresholds at lineup lock — the fallback when no calibrated chart exists for the combo. | | Ed.  any time a team/player/user manually enters a handicap threshold or amount of points given or target to aquire.
| **Unhandicapped** | Threshold Source step | League plays without handicaps — every team needs the same number of wins regardless of skill. | | Ed. see No Handicap above.
| **Rating** | Threshold Source narrative | A player's skill number used by the handicap system (e.g., a Fargo rating like 491, or a Skill Level like 5). | | Ed. a skill level calculated by A handicap system or the handicap system used for that particular league.

## Points / scoring

| Term | Where it shows | Proposed 1-sentence definition | Notes |
|---|---|---|---|
| **Win Condition** | Win Condition step | Whether the match is decided by games won or by points scored. | | Ed. the metric that ultimately decides which team wins a match. Usually Games or points.
| **Games (win condition)** | Win Condition step | The team that wins more games wins the match. | BCA-style. | Ed.  the team that wins more games or hits their threshold (target number of games)
| **Points (win condition)** | Win Condition step | The team with more accumulated points wins the match. | Fargo-style. **Different from "points handicap."** | Ed. the team that earned more points or hits their threshold (target number of points.)
| **Points Calculator** | Points Calculator step | The formula that turns game results into league points. | "Don't track points" is a valid choice. | Ed. any device that helps decide how many points to give to a team or player.
| **Linear Above Threshold** | Points Calculator step | A three-band points formula (above-win, tie band, below-tie); BCA 3v3 default. | | Ed.  points given for games above threshold (target number of games) or deducted for each game below the threshold if that number of games was not reached.
| **Accumulate with Milestone Jumps** | Points Calculator step | Per-game accumulation with stepped bonuses at milestones (70% of threshold, then threshold itself); BCA 5v5 default. | | Ed.  again dont mention what its attached to or specific things.   a number of points a team is set to when they hit a specific threshold(target number of games) any points earned prior are disregarded the points "jump" to the set number of points
| **Accumulated per Game** | Points Calculator step | Per-game scoring with winner-fixed + loser-counter values (e.g., winner 10, loser balls pocketed); Fargo 10-7 default. | | Ed. No refrences.   a number of points given for a particular game.  can be for winning or losing player. can be a set number.  derived from other metrics or entered manually at scoring time.
| **Tie band** | Points Calculator, Win Condition | A range of games-won values where both teams score 0 points — used to encode "if you're close, no points awarded." | |  Ed.  i have not heard this term
| **Win threshold** | Points Calculator step | The games-won target to win the match. | |
| **Tie threshold** | Points Calculator step | The lower bound of the tie band. | | Ed.  The number of games or points needed for a team to "tie" (end at an even heat) at the end of a match.
| **Multiplier** | Points Calculator step | Per-formula factor on the linear-above-threshold formula (default 1). | | Ed/  a way to strenghten or weaken a handicap systems effectiveness.

## Standings

| Term | Where it shows | Proposed 1-sentence definition | Notes |
|---|---|---|---|
| **Standings** | Standings Sort step | The season-long team ranking table. | | Ed that shows what "place" each team is in and their records.
| **Standings Sort Priority** | Standings Sort step | Which stat is the leftmost / primary sort column in the standings table. | | Ed. the metric most important to rank each team.
| **Match Wins** | Standings Sort step | Total number of match-level wins for a team across the season. | | Ed.  Basically says how many matches ("nights") this team has won
| **Total Points** | Standings Sort step | Total points accumulated across the season. | | Ed by each Team or player (depending on the table.)
| **Total Games Won** | Standings Sort step | Total individual games won by a team across the season. | |

## Tiebreaker

| Term | Where it shows | Proposed 1-sentence definition | Notes |
|---|---|---|---|
| **Tiebreaker** | Tiebreaker step | What happens when a match ends tied. | Only shown when the format can actually produce a tie. | Ed. the method used to decide how to decide who wins if the regular play ends in a tie.
| **Best of 3 (Tiebreaker)** | Tiebreaker step | Tied matches play three short-race games; first team to win 2 takes the match. | BCA 3v3 default. | Ed. no references.  this should be extra round (tie break modules have not been coded yet).  the team plays one more round of games to determine a winner. (best of 3 or best of 5 normally.)
| **Single Short Race** | Tiebreaker step | Tied matches play one extra rack to decide the winner. | Faster than best-of-3. | Ed. again speculative. not coded.
| **Accept Tie** | Tiebreaker step | No tiebreaker — the match stays tied and standings reflect it. | | Ed.  League operators decision to allow tied matches to stand as is.
| **Manual Tiebreaker** | Tiebreaker step | When a match ends tied, the operator is prompted to decide the winner. | Catch-all for non-codified rules. | Ed.  again speculative NOT the operator.  Catch all way for a league to decide winner that has not been supported by our app.  scorekeepers will enter the results of who won the tiebreaker manually.

## Date / schedule

| Term | Where it shows | Proposed 1-sentence definition | Notes |
|---|---|---|---|
| **Start Date** | Start Date step | The date of the first match — sets the season's day-of-week, season name (Spring/Summer/Fall/Winter), and year. | |
| **Match Night** | Start Date narrative | A specific date that matches are played on (matches repeat weekly on the same day). | **[?]** "Match night" vs "match date" vs "match day" — which is canonical? |  Ed. Match is cononical.  "night" is a false equivication i am VERY guilty of.  matches are usually played at night.  match "in the wild" has also been used to describe a single game or round of play.   Night should not be used.

---

## 🚩 Vestigial / wrong terminology I noticed

1. **"Division Descriptor"** — `leagueWizardConfig.ts` line 76 sets the Qualifier step's title to "Division Descriptor." But you dropped "Division" as a term. The step file is called `QualifierStep.tsx`. **Recommend renaming the step title to "Descriptor" or "League Qualifier."**  Ed. i agree.  although explaining it as "sometimes called division discriptor" might be helpful.  for translating from other league system.s.

2. **"BCA Classic"** — appears in `HandicapSystemStep.tsx` ("BCA Classic (max +2 min -2)") and `MechanismStep.tsx` ("BCA Classic" in the Extra Games card). Per your L1 brand-naming, "BCA alone refers to the standards body, not the league" — should it be **"BCAPL Classic"** in user-facing copy? Ed.  this was a NOT a choice i made or liked.  and yes i thing it needs to be changed neither or classic.  each are their own "tested" packages.

3. **"BCA 3v3" / "BCA 5v5"** — used in `PointsCalculatorStep.tsx` and elsewhere ("BCA 3v3 default"). Same brand-naming question. Should these be **"BCAPL 3v3" / "BCAPL 5v5"**?  Ed.  yes this was before i was informed that bcapl was a thing i should be using. these should be changed.

4. **"Race Winner"** — referenced in BCAPL Skill Level's info-button ("Pair with the Race-to-N pairing format and Race Winner scoring") but never defined in the wizard or in obvious code. **[?] Should this be a glossary entry, or is it just an unfortunate phrase?**  Ed.  i have not seen/noticed the term race winner.  in any context.  and bcapl skill level is a mixup of apa skill level i think.  so it should be scrubbed or fixed.

5. **"matchup" vs "pairing"** — used interchangeably throughout the wizard. Pick one canonical word, or define both as the same thing with one as alias?
Ed.  matchup has to do with teams pairing has to do with individuals at least in my mind.
---

## Open questions for you

1. **Matchup vs Pairing** — same thing or different things? Pick one canonical name.
2. **Match Night / Match Date / Match Day** — which is canonical?
3. **Rack** — noun-only (a game), or also verb (to rack)?
4. **Did I miss anything an LO actually sees** in the wizard? Anything I included that's not really visible to them?
5. **The BCA → BCAPL brand cleanup** — should I update the wizard copy too, or is that out of Phase 1 scope and just gets a glossary entry that says "BCA Classic also called BCAPL Classic"?

---

## Next step

You red-pen this file (strike-through, comments, whatever works). I'll then:
- Author the glossary entries for the surviving terms (split across `src/glossary/entries/*.tsx`).
- Flag the vestigial terms (Division Descriptor, BCA-vs-BCAPL) for follow-up fixes.
- Continue with Unit 2 (the GlossaryInfoButton component).
