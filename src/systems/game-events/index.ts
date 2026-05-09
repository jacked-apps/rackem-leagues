/**
 * @fileoverview Game-events registry — looks up an event definition by its
 * stable `name`. The registry is the runtime dispatch point for the
 * event-as-data pattern: the modal reads applicable events here, the
 * mutation reads attribution rules here, stats queries reference event
 * names here.
 *
 * Population: each Tested Seed event is registered automatically as a
 * module-load side effect (see `registerSeedGameEvents` below). Tests can
 * call `clearRegistry()` then `registerSeedGameEvents()` to set up a clean
 * fixture.
 *
 * Mirrors `src/systems/calculators/index.ts` exactly — same shape, same
 * self-registration pattern, same null-on-miss `getGameEvent` semantics.
 * The 2026-05-02 silent-zero-points incident (calculator registry empty at
 * module load → silent failure) is the canonical "registry not populated
 * before first read" bug; do not introduce alternative lookup paths that
 * bypass `registerSeedGameEvents`.
 *
 * @see docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md (Unit 1)
 */

import type { GameEventDefinition } from './types';

// ============================================================================
// Registry
// ============================================================================

const registry = new Map<string, GameEventDefinition>();

/**
 * Register an event definition under its `name`. Throws on duplicate names —
 * a collision indicates a bug. Tests call `clearRegistry` between cases.
 */
export function registerGameEvent(definition: GameEventDefinition): void {
  if (registry.has(definition.name)) {
    throw new Error(
      `[game-events] Duplicate registration: an event named "${definition.name}" is already registered`,
    );
  }
  registry.set(definition.name, definition);
}

/**
 * Look up an event definition by name. Returns `null` if no event with that
 * name is registered. Caller handles the missing case (typical pattern is
 * to skip rendering, never throw).
 */
export function getGameEvent(
  name: string | null | undefined,
): GameEventDefinition | null {
  if (name == null) return null;
  return registry.get(name) ?? null;
}

/**
 * List all registered event definitions. Used by the modal to derive the
 * applicable event set for a given game type, and by Phase 2's LO admin UI.
 */
export function listGameEvents(): ReadonlyArray<GameEventDefinition> {
  return Array.from(registry.values());
}

/**
 * Clear the registry. Tests only — production code never calls this.
 */
export function clearRegistry(): void {
  registry.clear();
}

// Re-export types for ergonomic imports.
export type { GameEventDefinition, AttributedTo } from './types';
export { resolveEnabledEvents } from './resolveEnabledEvents';

// ============================================================================
// Seed event registration
// ============================================================================

import { breakAndRun } from './definitions/break_and_run';
import { goldenBreak } from './definitions/golden_break';
import { runout } from './definitions/runout';
import { winByForfeit } from './definitions/win_by_forfeit';
import { breakFouled } from './definitions/break_fouled';
import { early8 } from './definitions/early_8';
import { scratchOn8 } from './definitions/scratch_on_8';
import { eightWrongPocket } from './definitions/eight_wrong_pocket';

const seedEvents: ReadonlyArray<GameEventDefinition> = [
  breakAndRun,
  goldenBreak,
  runout,
  winByForfeit,
  breakFouled,
  early8,
  scratchOn8,
  eightWrongPocket,
];

/**
 * Register the seed events. Idempotent — safe to call multiple times.
 *
 * Called automatically as a module-load side effect below so the runtime
 * registry is populated as soon as anything imports from this file. Tests
 * that need a clean slate call `clearRegistry()` then this function.
 */
export function registerSeedGameEvents(): void {
  for (const event of seedEvents) {
    if (!registry.has(event.name)) {
      registry.set(event.name, event);
    }
  }
}

// Self-register at module load. Mirrors the calculator-registry self-register
// pattern. Without this, production callers hit an empty registry and silently
// render no events — same shape as the 2026-05-02 silent-zero-points bug.
registerSeedGameEvents();
