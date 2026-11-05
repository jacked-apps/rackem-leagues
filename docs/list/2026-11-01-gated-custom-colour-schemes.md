---
summary: Custom colour schemes (preview), a fourth theme choice beside Light, Dark and System
kind: task
added: 2026-11-01
checked: 2026-11-05
---

High Contrast, Blue & Gold, Felt, Pastel and Strawberry & Cream, one look each (`src/themes/`). Ed wants players to try them for feedback.

This is a decision tool, not necessarily a feature. The outcome may be "fold the winner into the standard theme and delete Custom" rather than "un-gate Custom".

## Gate

`palettesEnabled` (`!isProduction`) in `src/themes/palettes.ts`.

## Entry points

- the Custom button in `src/components/ThemeToggle.tsx` (Profile page)
- the start-up apply in `src/main.tsx`

## Verify on staging

Ed (and his wife) compare readability across the app in each scheme.
