---
date: 2026-05-28
topic: operator-help-system
---

# Operator Help & Learn System

## Problem Frame

A new league operator (LO) on the app is a known persona: knows pool, has played in a league before, has never run a league, has never used this app. They arrive with their own colloquial vocabulary ("8 on the snap," "golden break," "the runback") and zero familiarity with this app's screens, dials, or canonical terms.

Two failure modes today:

1. **Stuck-on-screen failures.** Wherever the LO lands — a wizard step, a settings panel, a standings page — they hit a term, a dial, or a status badge they don't recognize, and there's no in-place way to get unstuck. They either guess (and ship a broken league) or bounce.
2. **Vocabulary collisions.** The app enforces one canonical name per concept ("Break and Run"). The LO's home league called it something else. Search a wrong term → find nothing → assume the app doesn't support what they're trying to do.

The fix isn't a static help page. It is **help that meets the LO where they are**, backed by a single source of truth that resolves their vocabulary to ours. The deep-dive Learn destination is real, but it is the bottom of the funnel, not the top.

**Evidence basis.** No LOs use the platform in production today (the app has not launched). The persona and failure-mode framing reflect Ed's direct conversations with prospective LOs and his experience as a long-time league player, not production telemetry. This is a forward-looking bet, not a fix for observed pain. A lightweight validation step — at least one outside-LO interview against early UI — is a Phase 1 acceptance gate. If that validation contradicts the persona, the requirements re-base before further investment.

This brainstorm scopes the **operator** audience only. Player-facing learning (the previously-sketched L4 surface) is out of scope here and remains a future branch.

## Strategic Context

- **L1 already exists and is locked.** `docs/league-system/` is the canonical reference, audience = "developer + AI sessions." It documents every Module, every Scoring System, every dial. It is dense, code-name-mapped, jargon-allowed. It is NOT operator-facing copy. (See `docs/league-system/README.md`.)
- **The earlier brainstorm `docs/brainstorms/2026-05-12-league-system-documentation-requirements.md` framed this work as L3 + L4 of a four-layer doc model.** L3 = in-wizard operator decision tool. L4 = public /info rebuild for players. This brainstorm formalizes the operator portion (L3-shaped, broadened from "in-wizard" to "the whole operator area") and adds the **alias/synonym layer**, which neither L3 nor L4 originally specified.
- **The InfoButton component already exists** at `src/components/InfoButton.tsx`. It is viewport-aware, click-outside-dismissing, supports rich children. **However,** spreading it widely is not pure content work — its API today takes free-form title + children, with no glossary-binding, no slug lookup, and no missing-entry failure mode. A thin glossary-bound wrapper (`GlossaryInfoButton`) is real infrastructure work that precedes coverage. (See R-INFRA1.)
- **`docs/league-system/glossary.md` was in the L1 plan but was never written.** Verified absent on disk. The L1 plan's glossary was for dev/Claude audience; the operator-facing glossary specified here is its own artifact and does not block on writing the L1 glossary.

## Requirements

**Architecture and Phasing**

- **R1.** The target-state operator help experience consists of three coordinated layers: (a) inline InfoButtons on operator screens, (b) a persistent context-aware Help button visible from any operator page, (c) a deep-dive Learn hub at `/operator-learn`. All three read from a single shared glossary data source. **Delivery is phased:**
  - **Phase 1 (this branch).** Glossary data source + `GlossaryInfoButton` wrapper + InfoButton coverage on the league-creation wizard (`src/wizards/league-v2/`), the season-creation wizard (`src/wizards/season-v2/`), and the operator dashboard area. Learn hub ships with the Glossary section only (no Walkthroughs, no Concepts). No persistent Help button in Phase 1.
  - **Phase 2 (later branch, gated on Phase 1 evidence).** Persistent Help button + Learn hub Walkthroughs and Concepts sections.
  - **Phase 2 entry gates:** (a) usage signal that InfoButtons are clicked, (b) at least one outside-LO interview completed, (c) settled context-detection mechanism + granularity for the Help button (see R9-OQ).
- **R2.** A new operator never has to leave the screen they are on to get a working answer about a term, dial, field, or status badge in front of them — *for any case where they know what to ask*. The Phase 2 Help button covers the "I don't even know what to ask" case (per R10).
- **R3.** The system is **always available, never forced.** No required onboarding gauntlet, no blocking tutorials. The LO finds the help organically.

**Glossary Data Source**

- **R4.** A single glossary data source defines every term the operator help system uses. **This is a normative schema contract** — each entry MUST contain: canonical name, aliases (the colloquial synonyms operators may search for), short definition (1–3 sentences, InfoButton-sized), long definition (paragraph-sized, for the Learn hub), `l1_anchor` reference (the `docs/league-system/...` page or section the entry sources from), and a list of related dials/features. Storage form (TypeScript module, JSON, Supabase table, Markdown with frontmatter) is deferred to planning; the schema above is the requirements-level contract any storage choice must satisfy.
- **R5.** All three help layers (InfoButtons, Help-button search, Learn hub Glossary page) read from this single source. There is no parallel copy of any term's definition anywhere else in operator help. This is the load-bearing decision that prevents drift *within* the operator help layer. Cross-layer drift between operator copy and L1 is a separate concern handled by R13.
- **R6.** Aliases are first-class search keys. Searching the LO's own term (e.g., "golden break") returns the canonical entry. The Glossary entry renders the canonical name as the headline with aliases shown as ("also called: …"). The LO learns the canonical name passively, without being corrected. **Alias seed sources** for the initial population: (a) Ed's experience as a long-time pool league player, (b) the BCAPL LO Handbook 2020 (already cited in L1 sources), (c) the FargoRate glossary where available, (d) at least one outside-LO interview. **Alias backlog mechanism:** the Phase 2 Help panel logs zero-result queries; those queries feed an alias backlog so coverage improves with use.

**InfoButton Coverage**

- **R7.** Every term, dial, form field, and status badge on an operator-scoped Phase 1 screen that meets the coverage rubric (R7a) has an InfoButton. The InfoButton title is the canonical name; the body is the entry's short definition plus a "Learn more →" link that deep-links to the matching Learn-hub Glossary entry by slug.
- **R7a (Coverage rubric — "needs an InfoButton" test).** A surface element needs an InfoButton if AT LEAST ONE is true:
  - it is not a plain-English noun a casual pool player would define unprompted (e.g., "FargoRate," "Race To," "Threshold," "Mechanism")
  - it is a canonical term with any known alias in the glossary
  - it is a status badge or dial whose meaning is not the literal word displayed (e.g., a "B" badge meaning "breaker," a numeric handicap "+2")

  Coverage is verified by one outside LO walking the wizard end-to-end — they call out every "what does this mean?" moment, and each must already resolve to an InfoButton or be added.
- **R8.** Phase 1 "operator-scoped screens" means: the league-creation wizard (`src/wizards/league-v2/`), the season-creation wizard (`src/wizards/season-v2/`), the operator dashboard (`src/operator/OperatorDashboard.tsx`), league settings, venue management, player management, and the operator Learn hub itself. **Routes wrapped in `withMember` (Standings, ScoreMatch, TeamStats, etc.) are NOT in Phase 1 scope** — their content is shared with players, and spreading operator-voice help on shared routes leaks operator-context content to the player audience, which the brainstorm explicitly excludes. A future branch may revisit shared-route help with role-gated InfoButtons.

**Infrastructure Wrapper**

- **R-INFRA1.** Phase 1 includes building a thin glossary-binding InfoButton wrapper (working name `GlossaryInfoButton`) that takes a glossary slug, looks up the entry, renders canonical title + short definition + "Learn more →" deep link, and **fails loudly on missing slugs** (dev-mode visible error; production fallback to the literal slug with a console warning). This wrapper is the only sanctioned way to mount help on a glossary term in Phase 1 code. Direct usage of the base `InfoButton` with inline copy is permitted only for non-glossary content (one-off page guidance).

**Persistent Help Button (Phase 2)**

- **R9.** A fixed-position Help control is visible from every operator-scoped page. Clicking it opens a small panel containing: (a) a search input over the glossary (canonical names + aliases), (b) context-aware suggestions — a short list of glossary entries relevant to the current page, and (c) a link to the full Learn hub. **The Help control must be visually distinct from inline InfoButtons** (which already render a circular "?" pill) — e.g., a labeled "? Help" pill, a life-ring icon, or a different color. A glance must distinguish "answer this specific term" (inline) from "I'm stuck, help me" (global). Opening the Help panel dismisses any open InfoButton popup, and opening an InfoButton while the Help panel is open closes the panel.
- **R10.** The Help button is the **escape hatch** for the LO who is stuck but does not know what term to look up. The InfoButton answers a known question; the Help button answers "I don't even know what to ask."
- **R9-OQ (Phase 2 open question, blocks Phase 2 implementation).** Context-aware suggestions must resolve at what granularity — page, wizard-step, or dial? Page-level is cheap; step- or dial-level couples to wizard state and is significantly more work. The granularity required for R10 to actually deliver value (a stuck LO finds something useful without typing) must be decided before Phase 2 implementation. Mechanism (URL pattern matching, route metadata, manual registration) is downstream of that decision.

**Learn Hub**

- **R11.** The Learn hub lives at `/operator-learn` and is reachable from the operator navigation. **Phase 1 hub = Glossary section only** (alphabetical, alias-aware, deep-linkable to individual entries by slug). **Phase 2** adds two more sections: Walkthroughs (task-organized: "Set up your first league," "Run a match night," "Handle a forfeit," — exact list deferred to a Phase 2 brainstorm) and Concepts (operator-friendly renderings of the L1 Module topics).
- **R12.** **Phase 2 work.** Concepts pages are operator-voice content that source their truths from L1 but are not L1 itself. L1 stays locked. The technical shape of Concepts (Markdown files parallel to L1 vs CMS-style content store) is a Phase 2 planning decision.

**Relationship to L1**

- **R13.** L1 (`docs/league-system/`) remains the locked canonical reference. Nothing in this branch edits L1 content. **Drift detection mechanism:** every glossary entry's `l1_anchor` field (per R4) names the L1 page or section it sources from. A periodic-audit script (or CI check, depending on storage form) scans the glossary's anchor references against the actual L1 file structure; broken or missing references fail the check. When operator copy and L1 disagree, L1 wins and the operator copy is corrected — never the reverse — and the audit catches the disagreement instead of relying on humans noticing.
- **R14.** The operator help system is the previously-deferred **L3** of the four-layer model, with the surface broadened from "in-wizard" to "the entire operator area." It is NOT L4 — player-facing help remains a future branch.

## Success Criteria

**Phase 1 (verified at branch ship):**

- A first-time LO can answer "what does this dial do?" on every league-creation wizard step without leaving the wizard. (Capability test.)
- A first-time LO who searches "golden break" finds the canonical "Break and Run" entry in the glossary on the first try. (Alias test.)
- One outside LO walks the league-creation wizard end-to-end with no more than two "I have no idea what this means" moments that aren't already covered by an InfoButton. (Outcome test — the gating usability check before broad rollout.)
- Every glossary term that appears in operator UI has exactly one definition, in a centralized glossary source — not duplicated across files or data stores.
- The drift-audit script (R13) reports zero broken `l1_anchor` references after Phase 1 launch.

**Phase 1 behavioral metric (instrumented, reviewed at 30 days post-launch):**

- League-v2 wizard completion rate for first-time LOs (measured from first-step view to final-step submit) is the headline metric. No fixed target before baseline; Phase 1 establishes the baseline. If wizard completion is below 50% at 30 days, Phase 2 gates re-prioritize over additional content.

**Phase 2 (deferred):**

- A first-time LO who is stuck on a page but does not know what to ask can click the Help button and find a relevant glossary entry suggested without typing.

## Scope Boundaries

- **Player-facing help.** Players are explicitly out of scope. The earlier brainstorm's L4 remains its own future branch.
- **Editing L1.** No file under `docs/league-system/` is edited by this branch. L1's policy gate (`PRINCIPLES.md` §7) is honored.
- **AI / chat assistant.** A natural-language conversational assistant is NOT in scope. The Help button is search + suggestions over a curated source, not an LLM.
- **The `BecomeLeagueOperator` sales page.** Stays a pre-signup marketing surface.
- **Onboarding tours / forced walkthroughs.** No required path the LO must complete.
- **Sign-up / application / pricing surfaces.**
- **Step-2 code renames from the L1 plan** (`bca3v3` → `points_3man`, etc.). Independent work tracked in the 2026-05-12 brainstorm.
- **Operator help on `withMember` shared routes** (Standings, ScoreMatch, TeamStats). Excluded from Phase 1 per R8 because of audience-leakage risk.

## Key Decisions

- **Phase delivery, not big-bang.** Phase 1 = glossary + `GlossaryInfoButton` + coverage on the league-creation flow. Phase 2 = Help button + Walkthroughs + Concepts, only after Phase 1 evidence justifies them. This avoids committing content-production effort to layers whose value is unvalidated. (Per R1.)
- **Single shared glossary source within operator help.** Three help layers, one source — drift within the operator layer is structurally impossible. (Per R5.)
- **Two-source reality between operator copy and L1 acknowledged.** Operator-voice and dev-voice prose can't be the same prose by definition. Drift between them is caught by the R13 `l1_anchor` audit, not by hope.
- **Aliases are first-class.** The LO's vocabulary is the input, not an error case. (Per R6.)
- **Help comes to the LO; the LO does not come to help.** Inline is primary. The Learn hub is the deep-dive destination, not the entry point. (Per R2, R10.)
- **No forced onboarding.** Self-discovery via ubiquity wins. (Per R3.)
- **Persona is a working hypothesis.** No production LO data exists yet. A lightweight outside-LO validation step is a Phase 1 acceptance gate before broad content production.

## Dependencies / Assumptions

- **`InfoButton` base component is production-suitable** for the popover mechanism (viewport-aware, scroll-resilient, click-outside-dismisses). Confirmed by reading `src/components/InfoButton.tsx`. A glossary-binding wrapper (`GlossaryInfoButton`, R-INFRA1) is new Phase 1 infrastructure on top of it.
- **L1 (`docs/league-system/`) is the source of truth for technical facts.** Operator copy reflects L1; on disagreement, L1 wins.
- **Operator-area routes exist.** `OperatorDashboard.tsx` and `OperatorWelcome.tsx` confirm the operator area has a home for the Learn hub link, and route convention is flat-hyphenated (`operator-welcome`, `operator-dashboard/:orgId`) so `operator-learn` follows the pattern.
- **Outside-LO availability.** Phase 1 acceptance includes a usability walk-through with at least one outside LO (not Ed). If none is reachable, the criterion downgrades to "Ed simulates a first-time-LO read-through" with a written disclaimer.

## Outstanding Questions

### Resolve Before Planning

*(None — the product shape is decided. Planning may proceed.)*

### Deferred to Planning

- [Affects R4][Technical] Storage shape of the glossary data source — TypeScript module, JSON file, Supabase table, or Markdown with frontmatter? The R4 schema is the contract; planning picks a form that satisfies it, comparing against project conventions (Markdown frontmatter aligns with `docs/league-system/`; TS module aligns with the existing `src/systems/` registry pattern).
- [Affects R7a, R8][Process] Outside-LO identification and recruitment for the Phase 1 usability walk-through.
- [Affects R-INFRA1][Technical] Is `GlossaryInfoButton` a wrapper around the existing `InfoButton`, or a sibling component that calls the same hooks? Existing `InfoButton` has many call sites — a wrapper change must not break them.
- [Affects R6][Process] Initial alias-seed harvesting workflow: who reads the BCAPL LO Handbook, who interviews the outside LO, who curates the FargoRate-derived imports.
- [Affects R9, R9-OQ][Phase 2 product] Context-aware suggestion granularity decision (R9-OQ) — Phase 2 prerequisite.
- [Affects R11][Phase 2 product] Initial Walkthroughs list (3–5 tasks based on Phase 1 LO failure-mode frequency observed during outside-LO walk).
- [Affects R12][Phase 2 technical] Concepts pages: Markdown files vs CMS-style content store.
- [Affects R9][Phase 2 design] Mobile/responsive treatment of the Help control on narrow viewports (placement corner, panel sizing, full-screen vs floating).
- [Affects R7, R11][Technical] "Learn more →" link open-behavior: new tab from wizard contexts (preserves state) vs in-tab elsewhere. Pick a default.

## Next Steps

→ `/ce:plan` for Phase 1 implementation planning. Phase 2 gets its own brainstorm + plan after Phase 1 evidence.
