/**
 * @fileoverview Types for the chain runtime.
 *
 * A Scoring System is an ordered list of modules. The runtime hands
 * each module the state bag (empty at first, populated by previous
 * modules thereafter) and a read-only Context for side-effect handles
 * (DB client, match data, etc.). Modules read from the bag, compute
 * one specific thing, and write back to the bag. They never talk to
 * each other directly.
 *
 * See the "Core Architectural Principles" section at the top of
 * CLAUDE.md for the principles these types implement.
 */

/**
 * The state bag — the only read/write surface between modules.
 *
 * Keys are strings; values are whatever the producing module writes.
 * The runtime does NOT validate types. The Workshop (future) catches
 * type mismatches at composition time. Modules cast on read.
 */
export type StateBag = Record<string, unknown>;

/**
 * Read-only context passed to every module. Carries side-effect
 * handles modules may need (DB client, current match data, etc.).
 *
 * The runtime is zero-knowledge about what's in Context — it just
 * passes Context through. Modules type-narrow what they need from
 * it. Extension is open: any module that needs a new handle adds it
 * to its caller's Context.
 */
export interface Context {
  readonly [key: string]: unknown;
}

/**
 * A single module in a Scoring System's chain.
 *
 * Each module reads keys from the bag, does ONE specific computation
 * (or one specific side effect, for seed modules), and writes results
 * back to the bag. May be sync or async — the runtime awaits either
 * way.
 *
 * If `run` throws, the runtime catches and logs; subsequent modules
 * still execute. The scoring page must never crash because of a
 * module failure (see principle 7 in CLAUDE.md).
 */
export interface Module {
  /** Used in log messages when this module throws. */
  readonly name: string;
  /**
   * Read from `bag`, compute, write back to `bag`. Side effects
   * (DB reads, file reads, etc.) go through `context`. Return nothing
   * — any output is a bag write.
   */
  run(bag: StateBag, context: Context): Promise<void> | void;
}
