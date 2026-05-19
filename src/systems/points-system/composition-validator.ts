/**
 * @fileoverview Composition-build validation for PointsSystem compositions.
 *
 * Enforces the locked trigger-model invariants at composition construction
 * time so drift can't sneak through:
 *
 *   1. **Threshold references resolve.** Every trigger's `input.thresholdRef`
 *      must name a threshold that exists in `composition.thresholds`.
 *
 *   2. **Terminal triggers are last.** A trigger with `terminal: true` may
 *      not be followed by any other trigger in the array. Terminal triggers
 *      halt the cascade — anything after would silently never fire, which
 *      is a category of bug we want caught at build time, not runtime.
 *
 *   3. **Trigger names are unique within a composition.** Prevents typos +
 *      makes downstream debugging easier.
 *
 * Compositions call `validatePointsSystem(composition)` as the last step of
 * their factory function. Throws with a precise message on any violation.
 *
 * @see ./types.ts — the PointsSystem / Trigger shapes
 */

import type { PointsSystem } from './types';

/**
 * Validate a PointsSystem composition against the locked trigger-model
 * invariants. Throws on the first violation found.
 */
export function validatePointsSystem(composition: PointsSystem): void {
  const thresholdNames = new Set(Object.keys(composition.thresholds));
  const seenTriggerNames = new Set<string>();
  let firstTerminalIndex: number | null = null;

  for (let i = 0; i < composition.triggers.length; i++) {
    const trigger = composition.triggers[i]!;

    if (seenTriggerNames.has(trigger.name)) {
      throw new Error(
        `Composition "${composition.name}": duplicate trigger name "${trigger.name}"`,
      );
    }
    seenTriggerNames.add(trigger.name);

    if (trigger.input && !thresholdNames.has(trigger.input.thresholdRef)) {
      throw new Error(
        `Composition "${composition.name}": trigger "${trigger.name}" references unknown threshold "${trigger.input.thresholdRef}". Available: ${[...thresholdNames].join(', ')}`,
      );
    }

    if (firstTerminalIndex !== null) {
      throw new Error(
        `Composition "${composition.name}": trigger "${trigger.name}" appears after terminal trigger "${composition.triggers[firstTerminalIndex]!.name}" (index ${firstTerminalIndex}). Terminal triggers must be last in the array — any trigger after them would never fire.`,
      );
    }

    if (trigger.terminal) {
      firstTerminalIndex = i;
    }
  }
}
