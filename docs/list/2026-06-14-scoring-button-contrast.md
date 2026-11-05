---
summary: Re-check scoring-page buttons for unreadable text in dark mode
kind: task
added: 2026-06-14
checked: 2026-11-04
---

Some scoring-page buttons have text that's barely visible in dark mode. Same
bug class as `feedback_dark_mode_fixed_bg_text_colors`: a fixed background
(like `bg-*-50`) paired with theme text (`text-foreground`) that flips.

Open PRs #314 and #309 fix the known spots. What's left: after they merge,
re-check the remaining buttons in light and dark mode.

When fixing, pair fixed backgrounds with fixed text colors. Ed is colorblind,
so any color-coded button also needs a text or icon label.

Files to sweep:

- `src/components/scoring/UnifiedScoreboard.tsx`
- `src/components/scoring/ThreeVThreeScoreboard.tsx`
- `src/components/scoring/GamesList.tsx`
- `src/components/scoring/MatchEndVerification.tsx`
- `src/player/ScoreMatch.tsx`
- any shared scoring button helpers
