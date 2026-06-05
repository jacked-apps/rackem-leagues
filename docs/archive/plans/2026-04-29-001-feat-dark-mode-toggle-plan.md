---
title: "feat: Add Dark Mode Toggle"
type: feat
status: active
date: 2026-04-29
origin: docs/brainstorms/2026-04-29-dark-mode-requirements.md
---

# feat: Add Dark Mode Toggle

## Overview

Wire up the existing dark-mode CSS variable system so users can actually toggle between light and dark themes. The CSS foundation (`:root` + `.dark` variables, `@custom-variant dark`, shadcn `dark:` utilities) is already complete — this plan covers the provider plumbing, the toggle UI, and migrating hardcoded Tailwind colors so both modes render correctly.

## Problem Statement / Motivation

The app defines a complete `.dark` CSS variable palette in `index.css` (lines 115-147) and shadcn components already ship with `dark:` variant classes, but there is no `ThemeProvider` wired up and no way for users to switch themes. The `useTheme()` call in `sonner.tsx` works by accident (falls back to `"system"`). Users on dark-OS get a broken experience with hardcoded `bg-white` and `text-gray-900` scattered across ~30 files. (see origin: docs/brainstorms/2026-04-29-dark-mode-requirements.md)

## Proposed Solution

Use `next-themes` (already installed, v0.4.6) as the ThemeProvider with `attribute="class"` to toggle the `.dark` class on `<html>`. Add a three-way theme toggle (light / dark / system) inside the `AppDrawer`. Migrate hardcoded Tailwind color classes to semantic equivalents or add `dark:` counterparts.

## Technical Considerations

- **Tailwind v4 class strategy**: `@custom-variant dark (&:is(.dark *))` in `index.css:4` requires the `.dark` class on an ancestor — `next-themes` with `attribute="class"` handles this by toggling on `<html>`.
- **No SSR**: This is a client-only Vite app, so `suppressHydrationWarning` on `<html>` is not needed. No FOUC script is needed either — `next-themes` injects a blocking `<script>` by default.
- **Vite boilerplate remnants**: `index.css:12-13` still has `color: rgba(255,255,255,0.87)` and `background-color: #242424` from Vite's scaffold. These set dark-ish defaults before `@layer base` kicks in, causing a potential flash. Must be removed.
- **PWA meta-theme-color**: If `index.html` has a `<meta name="theme-color">`, it may need a media query variant for dark mode.

## Acceptance Criteria

### Phase 1: Provider + Toggle (Core Wiring)

- [ ] Remove Vite boilerplate color remnants from `index.css:12-13`
- [ ] Wrap app in `ThemeProvider` in `App.tsx` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `storageKey="rackem-theme"`
- [ ] Create `src/components/ThemeToggle.tsx` — a three-option toggle (Light / Dark / System) using shadcn components
- [ ] Add `ThemeToggle` to `AppDrawer` in its own section at the bottom (above Sign Out)
- [ ] Verify `sonner.tsx` `useTheme()` resolves correctly with the provider in place
- [ ] Verify localStorage persistence works across page reloads

### Phase 2: Hardcoded Color Migration

- [ ] Migrate `PageHeader.tsx` hardcoded colors (`bg-white` → `bg-background`, `text-gray-900` → `text-foreground`, etc.)
- [ ] Migrate `SubHeader` / identity slot hardcoded colors in `PageHeader.tsx`
- [ ] Audit and migrate hardcoded colors in `src/player/` pages
- [ ] Audit and migrate hardcoded colors in `src/operator/` pages
- [ ] Audit and migrate hardcoded colors in `src/profile/` pages
- [ ] Audit and migrate hardcoded colors in `src/components/` (non-UI)
- [ ] Review `src/components/scoring/scoreboardColors.ts` — add `dark:` counterparts to centralized color map
- [ ] Spot-check all pages in both modes to confirm no white-on-white or dark-on-dark text

### Out of Scope (see origin)

- Color palette redesign — use existing `.dark` variables as-is
- `BilliardRackIcon.tsx` hardcoded SVG colors — follow-up task
- Per-page or per-component theme overrides

## Success Metrics

- Visiting the app respects OS light/dark preference out of the box (R2)
- User can manually switch themes and the choice persists on reload (R3)
- All existing shadcn components render correctly in both modes (R5)

## Dependencies & Risks

- **`next-themes` compatibility with Tailwind v4**: The `@custom-variant dark (&:is(.dark *))` selector requires the `.dark` class on an ancestor of the target element. `next-themes` adds it to `<html>`, which is an ancestor of everything — this works.
- **Hardcoded color volume**: ~230 occurrences across ~30 files. Bulk find-and-replace for common patterns (`bg-white` → `bg-background`, `text-gray-900` → `text-foreground`, `bg-gray-50` → `bg-muted`, etc.) followed by manual review.

## Implementation Notes

### ThemeProvider Placement (`App.tsx`)

```tsx
import { ThemeProvider } from 'next-themes';

<ErrorBoundary>
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="rackem-theme">
    <div ...>
      ...
    </div>
  </ThemeProvider>
</ErrorBoundary>
```

### ThemeToggle Component Pattern

Three-way toggle using shadcn `Button` with `variant="ghost"` and lucide icons (`Sun`, `Moon`, `Monitor`). Uses `useTheme()` from `next-themes`. Place in `AppDrawer` as a new section between the nav links and Sign Out footer.

### Common Color Migration Map

| Hardcoded | Semantic Replacement |
|-----------|---------------------|
| `bg-white` | `bg-background` or `bg-card` |
| `text-gray-900` | `text-foreground` |
| `text-gray-600` / `text-gray-500` | `text-muted-foreground` |
| `bg-gray-50` / `bg-gray-100` | `bg-muted` |
| `border-gray-200` / `border-gray-300` | `border-border` |
| `bg-gray-200` | `bg-accent` |
| `text-gray-700` | `text-foreground` or `text-accent-foreground` |

### Vite Boilerplate Cleanup (`index.css`)

Remove lines 12-13 from `:root`:
```css
/* DELETE these two lines — Vite scaffold remnants */
color: rgba(255, 255, 255, 0.87);
background-color: #242424;
```

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-29-dark-mode-requirements.md](docs/brainstorms/2026-04-29-dark-mode-requirements.md) — Key decisions: use `next-themes` with class strategy, default to system preference, persist via localStorage
- App entry: `src/App.tsx:21-37`
- CSS variables: `src/index.css:6-57` (light), `src/index.css:115-147` (dark)
- Dark variant: `src/index.css:4`
- Sonner theme usage: `src/components/ui/sonner.tsx:8,12`
- Header (toggle placement): `src/components/PageHeader.tsx:127`
- App drawer: `src/components/layout/AppDrawer.tsx:75`
- Scoreboard colors: `src/components/scoring/scoreboardColors.ts`
- Prior fix: commit `d4a7d8e` — removed Vite boilerplate breaking light mode buttons
