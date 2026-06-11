/**
 * @fileoverview Glossary entry schema (R4 contract).
 *
 * Single source of truth for what an operator-facing glossary entry contains.
 * Consumed by GlossaryInfoButton (popover), the Learn-hub Glossary page, and
 * the `pnpm glossary:verify` drift audit.
 *
 * shortDef is a plain string (max 1-2 sentences) — what the popover shows.
 * longDef is React.ReactNode (rich content) — what the Learn-hub deep dive shows.
 *
 * @see docs/league-system/ — L1 canonical reference (locked, read-only).
 * @see docs/plans/2026-05-28-001-feat-operator-help-system-phase-1-plan.md — Unit 1.
 */

import type { ReactNode } from 'react';

/**
 * Repo-relative pointer into the locked L1 canonical reference. Used by the
 * drift audit (Unit 7) to verify entries remain anchored as L1 evolves.
 */
export interface L1Anchor {
  /** Repo-relative path to the L1 .md file. */
  path: string;
  /** Optional in-file section anchor (matches `{#anchor}` or heading slug). */
  anchor?: string;
}

/**
 * One glossary entry. All top-level fields are required (the L1Anchor's
 * `anchor` is the only optional) — the entry shape is the R4 contract.
 */
export interface GlossaryEntry {
  /** Stable kebab-case identifier. Used as URL fragment and slug-union member. */
  slug: string;
  /** The official name we use in this app (e.g., "FargoRate"). */
  canonicalName: string;
  /** Colloquial synonyms an operator might search for (e.g., "fargo rating"). */
  aliases: readonly string[];
  /** Plain text. Max 1-2 sentences. Shown in the InfoButton popover. */
  shortDef: string;
  /** Rich content. Shown on the Learn-hub Glossary page. */
  longDef: ReactNode;
  /** Reference to the matching L1 page for the drift audit. */
  l1_anchor: L1Anchor;
  /**
   * Other glossary slugs to explore — **adjacent concepts NOT mentioned
   * in the body prose.** Rendered as a "Related:" list at the bottom of
   * each entry on the Learn page.
   *
   * Convention (per Ed 2026-05-29) — each entry has three distinct link
   * roles, no duplication across them:
   *   1. In-body links: every term mentioned in longDef is an inline
   *      link (`<a href="#slug">`). Click while reading.
   *   2. "Relevant topics:" line at the end of longDef: a tidy menu of
   *      the same in-body links, gathered for a quick "next read."
   *   3. `related` (this field): edge concepts NOT in the body — things
   *      to explore beyond what the prose covered.
   *
   * Don't put in-body terms in `related`. Don't omit the "Relevant
   * topics:" menu from longDef when you have multiple in-body links.
   */
  related: readonly string[];
  /**
   * ISO date Ed personally reviewed this entry's content. Hidden from the
   * UI — purely a content-tracking marker so we can see which entries
   * still need a focused review pass. Run `pnpm glossary:progress` to
   * list reviewed vs unreviewed.
   */
  reviewedByEd?: string;
  /**
   * Marks this term as a League Operator (LO) controllable setting. Renders
   * as a small chip at the top of the Learn page entry so:
   *   - operators see "I control that" at a glance
   *   - players see "I can ask my operator to try this"
   *
   *   - 'live'    — the LO can configure this in the current wizard
   *   - 'planned' — designed as an LO setting but not yet in the wizard
   *
   * Omit for terms that aren't operator-configurable (concepts, vocabulary,
   * mechanics).
   */
  loSetting?: 'live' | 'planned';
}
