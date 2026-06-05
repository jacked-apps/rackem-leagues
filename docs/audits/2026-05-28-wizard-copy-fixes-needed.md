# Wizard Copy Fixes — Surfaced by Glossary Seed Walkthrough

**Status:** TODO list for Ed
**Date:** 2026-05-28
**Source:** `docs/audits/2026-05-28-glossary-seed-walkthrough.md` red-pen pass

Everything below is wizard / step / config copy that surfaced as wrong, vestigial, or off-brand during the seed walkthrough. Organized by impact level so you can hand it off (or kill items you disagree with) without re-deriving.

---

## 🔴 Priority 1 — User-facing copy (LO sees these on screen)

### 1. "Division Descriptor" → "Descriptor" (or "League Qualifier")

| File | Line | Current | Suggested |
|---|---|---|---|
| `src/wizards/league-v2/leagueWizardConfig.ts` | 76 | `title: 'Division Descriptor'` | `title: 'Descriptor'` |

You said: keep "sometimes called division descriptor" in the glossary entry as an alias, for ops translating from other systems. The wizard title itself should drop "Division."

---

### 2. "BCA Classic" — scrub everywhere user-visible

You said: *"this was NOT a choice i made or liked. each are their own 'tested' packages."* So no "BCA Classic" anywhere; each prepackaged scoring system is its own named thing.

| File | Line | Current | Notes |
|---|---|---|---|
| `src/wizards/league-v2/steps/HandicapSystemStep.tsx` | 18 | `description: 'BCA Classic (max +2 min -2)'` | The Points handicap card. Suggest just `'Range −2 to +2'` or drop the brand entirely. |
| `src/wizards/league-v2/steps/MechanismStep.tsx` | 26 | `'BCA Classic. The handicap chart says: higher-rated team needs N games to win...'` | Strip "BCA Classic." prefix. The rest of the explanation is fine. |
| `src/wizards/league-v2/steps/StandingsSortStep.tsx` | 25 | `'Match wins → games won → points (BCA Classic default)'` | Drop "(BCA Classic default)". |
| `src/wizards/league-v2/steps/PairingFormatStep.tsx` | 24 | `'... Used by BCA Classic and Fargo 10-7.'` | Drop the whole "Used by..." sentence (NO DRIFT — don't tie definitions to packages). |

---

### 3. "BCA 3v3" / "BCA 5v5" → "BCAPL 3v3" / "BCAPL 5v5" or drop the brand prefix

You said: *"this was before i was informed that bcapl was a thing i should be using. these should be changed."*

| File | Line | Current | Suggested |
|---|---|---|---|
| `src/wizards/league-v2/steps/PointsCalculatorStep.tsx` | 38 | `'... BCA 3v3 default.'` | Drop the "BCA 3v3 default" sentence (NO DRIFT). |
| `src/wizards/league-v2/steps/PointsCalculatorStep.tsx` | 43 | `<p>The classic BCA 3v3 points formula:</p>` | `<p>The points formula:</p>` |
| `src/wizards/league-v2/steps/PointsCalculatorStep.tsx` | 60 | `'... BCA 5v5 default.'` | Drop the "BCA 5v5 default" sentence. |
| `src/wizards/league-v2/steps/PointsCalculatorStep.tsx` | 65 | `<p>BCA 5v5 tiered points:</p>` | `<p>Tiered points:</p>` |
| `src/wizards/league-v2/steps/TiebreakerStep.tsx` | 32 | `'BCA 3v3 default. When a match ends tied...'` | Strip "BCA 3v3 default." prefix. |
| `src/wizards/league-v2/comboCoherence.ts` | 192-193 | `'(BCA 3v3, BCA 5v5, Fargo 5v5)'` | `'(Points 3v3, Percentage 5v5, FargoRate 5v5)'` or whatever your canonical preset names are now. |
| `src/wizards/league-v2/steps/ThresholdSourceStep.tsx` | 101 | `'... calibrated against the standard BCA 5v5 percentage handicap table.'` | `'... calibrated against the standard percentage handicap table.'` |

---

### 4. "Race Winner" — scrub

You said: *"i have not seen/noticed the term race winner. in any context."*

| File | Line | Current | Suggested |
|---|---|---|---|
| `src/wizards/league-v2/steps/HandicapSystemStep.tsx` | 49 | `'... Pair with the Race-to-N pairing format and Race Winner scoring.'` | Drop the entire sentence. |

---

### 5. "BCAPL Skill Level" — likely APA Skill Level (confused term)

You said: *"i think this got mixed up with an apa skill level... so it should be scrubbed or fixed."*

| File | Lines | Current | Action |
|---|---|---|---|
| `src/wizards/league-v2/steps/HandicapSystemStep.tsx` | 43-50 | The whole `skill_level` card titled "BCAPL Skill Level" with 1–9 description | **Decision needed:** scrub the card entirely (it's already disabled/reserved per the brainstorm), OR rename to "APA Skill Level" and clarify it's an APA system. SL1–SL9 is APA terminology; BCAPL mandates FargoRate. |

The reserved-but-hidden treatment is already in the brainstorm (`docs/brainstorms/2026-05-12-league-system-documentation-requirements.md` R12). Whichever direction you pick, the card title needs to NOT say "BCAPL Skill Level."

---

### 6. "Match night" / "night" — drop the equivocation

You said: *"Match is cononical. 'night' is a false equivication i am VERY guilty of. Night should not be used."*

| File | Line | Current | Suggested |
|---|---|---|---|
| `src/wizards/league-v2/steps/HandicapSystemStep.tsx` | 79 | `'... how start points or thresholds are calculated each match night.'` | `'... each match.'` |
| `src/wizards/league-v2/steps/LeagueIntroStep.tsx` | 18 | `'A league represents a specific game and night combination...'` | `'A league represents a specific game and weekly time slot...'` or pick your wording — the point is "night" isn't right. |
| `src/wizards/league-v2/steps/LineupSizeStep.tsx` | 20 | `label="How many players play each match night?"` | `label="How many players play in each match?"` |
| `src/wizards/league-v2/steps/LineupSizeStep.tsx` | 26 | `'... during a match night.'` | `'... during a match.'` |
| `src/wizards/league-v2/leagueFormatOptions.ts` | (?) | Check for "match night" wording in info-button content | Drop "night" |

---

## 🟡 Priority 2 — Code comments (not user-visible, but they shape the team's vocabulary)

These don't ship to operators but they're load-bearing for whoever reads the code. Worth fixing together with the user-facing copy so the codebase speaks consistently.

| File | Line | Note |
|---|---|---|
| `src/wizards/league-v2/leagueWizardConfig.ts` | 8-10 | Doc comment uses "PRESET" / "CUSTOM" path naming — fine, but verify the preset names referenced are current. |
| `src/wizards/league-v2/comboCoherence.ts` | 51, 59 | Comments `// BCA 3v3` and `// BCA 5v5`. Rename to your current canonical names. |
| `src/wizards/league-v2/presetMappings.ts` | 42 | `'... default to the BCA Classic priority list.'` Rename. |
| `src/wizards/league-v2/steps/MechanismStep.tsx` | 5 | Comment: `'extra_games: higher-rated team must win more games (BCA Classic)'`. Drop the parenthetical. |
| `src/wizards/league-v2/steps/PointsCalculatorStep.tsx` | 12-13 | Comments: `(BCA 3v3 default)` and `(BCA 5v5 default)`. Rename or drop. |
| `src/wizards/league-v2/steps/StandingsSortStep.tsx` | 6 | Comment: `'wins_first: ... (BCA Classic default)'`. Drop or rename. |
| `src/wizards/league-v2/steps/ThresholdSourceStep.tsx` | 43, 53 | Comments: `// Tested Preset: BCA 3v3 ...` and `// Tested Preset: BCA 5v5 ...`. Rename. |

---

## 🟢 Priority 3 — Test descriptions (lowest priority but trivial to update)

These are `it(...)` test descriptions. They don't run; they're just the test name. Renaming them keeps the codebase consistent.

| File | Lines | Current | Action |
|---|---|---|---|
| `src/wizards/league-v2/__tests__/comboCoherence.test.ts` | 36, 42 | `'BCA 3v3 (...)'`, `'BCA 5v5 (...)'` | Rename to current canonical preset names. |
| `src/wizards/league-v2/__tests__/useCreateLeagueV2.contract.test.ts` | 68, 79 | `'standard_3v3 preset writes BCA 3v3 preferences'` | Rename. |
| `src/wizards/league-v2/__tests__/presetMappings.test.ts` | 37, 45, 53 | Three tests referencing "BCA Classic priority". | Rename. |
| `src/wizards/league-v2/__tests__/ThresholdSourceStep.test.tsx` | 19, 32 | `'classifies BCA 3v3 ...'`, `'classifies BCA 5v5 ...'` | Rename. |

---

## ✅ Already good — confirmed in the walkthrough

These terms are correct as-is and don't need touching:

- **8-Ball, 9-Ball, 10-Ball** (Game Type step) — accurate. (Optionally add the "call-pocket every shot" detail to 10-Ball's description, per your note.)
- **Single Round Robin / Double Round Robin** — accurate.
- **Round Robin** — accurate.
- **Single Rack / Race to N** — accurate (Pairing Format step).
- **Win Condition: Games / Points** — accurate.
- **Tiebreaker: Accept Tie** — accurate.

---

## Open questions for you

1. **What ARE the current canonical preset names?** The L1 brainstorm proposed:
   - `bca3v3` → `points_3man` ("Points 3-Man Division" — but you dropped Division)
   - `bca5v5` → `percentage_5man` ("Percentage 5-Man Division")
   - `fargo5v5` → `fargo_10pt_5man` ("FargoRate 10-Point 5-Man Division")

   With Division dropped, what's the new shape? "Points 3v3"? "Points 3-Man"? "Points 3-Man Format"? Decide once, apply everywhere.

2. **BCAPL Skill Level card** — scrub entirely or rename to APA Skill Level?

3. **5v5 Fargo Rated** description — your red-pen explained the actual scoring (10 to winner, 0-7 to loser by balls pocketed). Want me to fold that into the wizard card description too, or keep the card lean and let the info-button explain?

---

## How to proceed

This list is independent of the glossary work — fixes can ship on their own branch or be folded into the operator-help Phase 1 PR. My recommendation: address them all in one cleanup PR after the glossary entries land, since the glossary entries provide the canonical names the fixes should adopt.
