# Wizard-Aware Page Standard — Requirements

**Date:** 2026-06-12
**Status:** Ready for `ce:plan`
**Type:** Architectural convention (this brainstorm is inherently technical, so it
carries design-level detail by design).

## Problem & Context

Wizards are a **deliberate, reusable, first-class primitive** in this app — Ed built
them to be easy to assemble and expects to build **many** more. That makes one pattern
recurring, not a one-off: **a page that's used both standalone AND as a step inside a
wizard, where the two contexts want different navigation/exit buttons.**

The triggering pain: `src/operator/TeamManagement.tsx` ("Manage Teams", ~860 lines) is
reached two ways — (a) **standalone** from the league dashboard for a quick team edit,
and (b) as a **step in the season-setup flow**. Its fixed bottom bar always shows BOTH
"Save & Exit → league" AND "Save & Continue → **Playoff Setup**". So a quick edit from
the dash still dangles the wizard's "Continue → Playoffs," dragging the operator into the
setup flow. The page has **setup-flow navigation knowledge baked into an edit page** —
the wrong coupling. **Matchups** is the same shape but worse: it has **no standalone
route at all** — `MatchupsCard` (`src/components/operator/MatchupsCard.tsx:80`) bounces
you back into `/create-league/...?leagueId=` (the whole wizard) just to edit matchups.

### What the framework already provides (verified)

The wizard framework (`src/components/wizard/`) **already models exactly the behavior we
want — for steps rendered inside the shell**:
- A step component receives `WizardStepProps` (`src/components/wizard/types.ts:25`),
  including `onNext()` / `onBack()` from the shell.
- A step config (`WizardStepConfig`) has **`hideNext` / `hideBack` / `hideCancel`**
  flags (`types.ts:85-102`) so a step can say *"hide your default footer buttons; I'll
  render my own and call your `onNext()` myself."* The code comment cites the exact
  "Save & Exit + Save & Continue on a schedule review" case — **this pattern is already
  in use** for a schedule step.

So Ed's instinct ("the wizard owns the buttons; the page hides its own") **is already the
framework's model** — but only for things rendered *as steps inside the shell*
(`WizardFlowShell`). Teams and Matchups never plug into it because they're **separate
routed pages** the flow navigates *out* to — so they fake the nav with hardcoded buttons.

## Ed's Bar (the WHAT — his domain)

Ed does not own the wizard internals (Claude built them) and explicitly delegated the
*mechanism* to Claude. What Ed requires:
- **DRY** — reuse the same components for the wizard and the standalone use. Same page if
  feasible; if not, **two thin pages sharing the same components**.
- **A single standard** — one consistent, repeatable way used **throughout**, not an
  ad-hoc decision per page.
- **Simple** (standing KISS preference) — no speculative framework machinery.

## The Standard (locked decision)

**One content piece, two thin shells.** Any surface that must live both standalone and in
a wizard is split into three parts:

1. **Content component** — the actual editing UI (e.g. venues + captains + teams), with
   **no exit/footer/navigation chrome of its own**. This is the single reusable piece
   (DRY). It exposes whatever the shells need to drive it (e.g. a "ready/dirty/save"
   signal), but it never decides *where you go next*.
2. **Standalone page** (a route) — renders the content + a plain footer whose only exit is
   **"Done → back to where you came from"** (for Teams: the league page). Reached from the
   league dashboard. Knows **nothing** about playoffs or any other flow step.
3. **Wizard step** — renders the **same** content inside `WizardFlowShell` as a normal
   step, using the **existing** `WizardStepConfig` contract (`hideNext`/`onNext` etc.).
   The **wizard** supplies Continue/Back; "what's next" (e.g. playoffs after teams) lives
   in the **flow definition**, not in the page.

Every shared surface follows this **identical 3-part shape** → the consistent, repeatable
standard. "Build a wizard, reuse the content" becomes routine. The bad coupling (an edit
page knowing the next setup step) is *removed*, not toggled.

> Why not "literally the same page in both"? A full standalone *page* carries route-level
> concerns (its own `PageHeader`, layout, URL/`useParams` data loading) that don't belong
> inside a wizard shell (double headers, etc.). Extracting the **content** is the feasible
> DRY — which is exactly Ed's "two pages, same components." (see Ed's direction)

## Requirements

- **R1 — Establish the convention as the standard.** Define the 3-part shape (content /
  standalone page / wizard step) once, clearly enough that any future shared surface
  follows it the same way. The wizard step uses the **existing** shell contract — no new
  framework mechanism unless a gap is found.
- **R2 — Remove nav coupling from the content.** The shared editing content must not know
  or hardcode "next is playoffs" (or any flow step). "What's next" lives in the flow.
- **R3 — Standalone exits go somewhere sensible, not into the wizard.** From the league
  dashboard, Manage Teams shows a single **Done/Save → back to the league** exit. No
  "Continue → Playoffs."
- **R4 — Wizard setup still flows correctly.** Inside the create/season-setup flow, the
  Teams step still advances to Playoffs (now driven by the wizard, not the page). League
  creation must not break.
- **R5 — Apply to Teams first, then Matchups.** Teams (`TeamManagement`) is the first
  adopter (most used). Matchups is the second — and gains its **own standalone route** so
  editing matchups no longer re-opens the whole create-league wizard.
- **R6 — Consistency.** Teams and Matchups (and future surfaces) adopt the *same* shape —
  no per-page bespoke nav logic.

## Scope Boundaries

- **Not** rebuilding the wizard framework — this adopts the existing
  `WizardFlowShell` / `WizardStepConfig` contract.
- **Not** redesigning the per-page UI of Teams or Matchups (same fields/controls; only the
  chrome/nav split changes).
- **Not** changing other already-working wizard steps that already render inside the shell
  correctly (e.g. the schedule-review step) — they're the reference, not the target.

### Deferred / separate

- Splitting the rest of the 860-line `TeamManagement` god-component beyond what this
  extraction naturally does (LIST_FOR_ED #5) — this work *advances* it but isn't scoped to
  finish it.
- Matchups itself is in-scope but **second** (after Teams proves the pattern).

## Success Criteria

- From the league dashboard, **Manage Teams is its own clean page**: edit, Save/Done,
  back to the league — never pushed toward playoffs.
- Creating a league still walks Season → Teams → Playoffs → … correctly, with the wizard
  (not the page) owning the Continue button.
- Teams and Matchups share **one content component each**, wrapped by a standalone page
  and a wizard step — the same documented shape — so the next shared surface is a
  copy-the-pattern job.
- Editing matchups no longer re-opens the create-league wizard.

## Open Questions for Planning

- **Content extraction shape for `TeamManagement`** (860 lines): what's the clean seam
  between "content" and "chrome/nav"? What does the content expose to its shells (a
  save/ready signal? an imperative save handle? `onDirtyChange`?) so both the standalone
  "Done" and the wizard "Continue" can trigger a save + proceed.
- **How the Teams content enters the setup flow as a step** vs. today's navigate-out-to-a-
  route: does it become a real step component inside `WizardFlowShell`, and if so how does
  the season-setup flow config reference it? (Confirm whether the season-setup path is a
  `WizardFlowShell` flow or a hand-rolled page chain.)
- **Standalone chrome:** the standalone page keeps its `PageHeader`/layout; confirm the
  content component is header-agnostic so the wizard step doesn't double up.
- **Where each standalone "Done" returns** (Teams → league page; Matchups → league page) —
  and whether to preserve "came from" for a smarter back-target later (probably not now).
- **Matchups standalone surface:** new route + which existing matchups step component(s)
  the content wraps.
- **Convention home:** do we write the 3-part standard down somewhere durable (a short doc
  / a tiny helper or naming convention) so future wizards follow it without re-deriving?
