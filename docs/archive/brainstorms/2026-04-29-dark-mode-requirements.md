---
date: 2026-04-29
topic: dark-mode
---

# Dark Mode

## Problem Frame
The app has no user-facing theme switching despite having a complete dark-mode CSS variable system already defined in `index.css`. Users cannot toggle between light and dark themes or have the app respect their OS preference.

## Requirements
- R1. Wrap the app in a ThemeProvider that manages light/dark/system theme state
- R2. Default to the user's OS color-scheme preference (system)
- R3. Persist the user's manual theme choice across sessions (localStorage)
- R4. Provide a theme toggle control accessible from the main UI (e.g., header/navbar)
- R5. Ensure the Sonner toast component (already using `useTheme()`) works correctly with the provider

## Success Criteria
- Visiting the app respects OS light/dark preference out of the box
- User can manually switch themes and the choice persists on reload
- All existing shadcn components render correctly in both modes

## Scope Boundaries
- Not redesigning any color palette (existing `.dark` CSS variables are used as-is)
- Not adding per-page or per-component theme overrides
- Not addressing the hardcoded colors in `BilliardRackIcon.tsx` (cosmetic, can be a follow-up)

## Key Decisions
- Use `next-themes` (already installed) as the theme provider since it handles class-based toggling, localStorage, system detection, and SSR/hydration — and shadcn's Sonner component already imports it
- Default theme: `system` (follows OS preference)
- Toggle location: to be decided during planning based on existing header/navbar layout

## Next Steps
-> `/ce:plan` for structured implementation planning
