---
summary: Turn on a code check that flags a save fired off and never waited on
kind: task
added: 2026-11-16
checked: 2026-11-16
---

Ed, 2026-11-16, on double taps: "im sure there are places where this problem
can occur and i just not found it yet."

The Button's double-tap lock (`src/components/ui/button.tsx`) now stops a
quick second tap anywhere. What it can't stop is a slow second tap while a
save is still going, on a button whose handler fires the save and doesn't
return it (`mutate()`, `void save()`). The Button only knows a save is in
flight when the handler hands the promise back.

Two standard typescript-eslint rules catch that shape as the code is written:
`no-floating-promises` and `no-misused-promises`. They need type-aware
linting (the config uses `tseslint.configs.recommended` today, which isn't).

A trial run on 2026-11-16 flagged about 270 spots in 117 files (170 and 98).
Most are harmless (navigate, invalidateQueries) and only need a `void`. Each
real save found should be returned to its Button, or the Button given
`isLoading`. Triage first, then turn the rules on so CI fails new ones.

Watch the cost: type-aware lint is slower; check `pnpm run lint` time before
and after.
