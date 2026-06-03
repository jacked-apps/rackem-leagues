/**
 * @fileoverview The chain runtime — the entire engine for running a
 * Scoring System.
 *
 * The runtime is zero-knowledge. It does not know what any module
 * does, what keys exist in the bag, what's in Context, or which
 * system is running. It just iterates the chain.
 *
 * - Create an empty bag
 * - For each module: try to run it, log on throw, continue
 * - Return the populated bag
 *
 * This file MUST contain zero references to system identity
 * (`handicap_type`, `mechanism`, `winCondition`, `fargo`, `points`,
 * `percentage`, `skill_level`). Adding any such reference here would
 * violate principle 5 in CLAUDE.md.
 */

import type { Context, Module, StateBag } from './types';

/**
 * Run a Scoring System's chain of modules against an empty state bag.
 *
 * The runtime never throws. If a module throws, the error is logged
 * via `console.warn` and the runtime continues with the next module.
 * The returned bag reflects whatever modules ran successfully.
 *
 * @param chain Ordered list of modules to run (the Scoring System)
 * @param context Read-only side-effect handles (match data, DB client, …)
 * @returns The state bag after all modules have run
 */
export async function runSystemChain(
  chain: readonly Module[],
  context: Context,
): Promise<StateBag> {
  const bag: StateBag = {};

  for (const mod of chain) {
    try {
      await mod.run(bag, context);
    } catch (err) {
      console.warn(`[chain] module "${mod.name}" threw`, err);
    }
  }

  return bag;
}
