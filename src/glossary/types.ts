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
  /** Other glossary slugs related to this one. */
  related: readonly string[];
}
