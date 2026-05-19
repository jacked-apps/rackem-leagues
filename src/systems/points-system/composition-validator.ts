/**
 * @fileoverview Composition-build validation for PointsSystem compositions.
 *
 * Enforces the locked trigger-model invariants at composition construction
 * time so drift can't sneak through:
 *
 *   1. **Threshold references resolve.** Every trigger's `input.thresholdRef`
 *      must name a threshold that exists in `composition.thresholds`.
 *
 *   2. **Trigger inputSpec is shape-compatible with the bound threshold.**
 *      The trigger declares what it expects (outputType + outputSide); the
 *      threshold declares what it produces. Mismatch is caught at build
 *      time, not at runtime where wrong values would silently feed
 *      downstream code. (Range is informational pending Team Geometry
 *      context at build time.)
 *
 *   3. **Terminal triggers are last.** A trigger with `terminal: true` may
 *      not be followed by any other trigger in the array. Terminal triggers
 *      halt the cascade — anything after would silently never fire.
 *
 *   4. **Trigger names are unique within a composition.** Prevents typos +
 *      makes downstream debugging easier.
 *
 * Compositions call `validatePointsSystem(composition)` as the last step of
 * their factory function. Throws with a precise message on any violation.
 *
 * @see ./types.ts — the PointsSystem / Trigger / ThresholdRow shapes
 */

import type {
  PointsSystem,
  ThresholdOutputSide,
  ThresholdRow,
  Trigger,
} from './types';

/**
 * Side compatibility: `'shared'` is a wildcard either way; same side OK;
 * cross-side is the violation.
 */
function sidesCompatible(
  thresholdSide: ThresholdOutputSide,
  triggerSide: ThresholdOutputSide,
): boolean {
  if (thresholdSide === 'shared' || triggerSide === 'shared') return true;
  return thresholdSide === triggerSide;
}

/**
 * Check a single trigger's inputSpec against its bound threshold's output.
 * Throws on mismatch.
 */
function validateInputSpec(
  composition: PointsSystem,
  trigger: Trigger,
  threshold: ThresholdRow,
): void {
  if (!trigger.inputSpec) return;

  if (trigger.inputSpec.outputType !== threshold.outputType) {
    throw new Error(
      `Composition "${composition.name}": trigger "${trigger.name}" expects outputType="${trigger.inputSpec.outputType}" but bound threshold "${threshold.name}" produces "${threshold.outputType}"`,
    );
  }

  if (!sidesCompatible(threshold.outputSide, trigger.inputSpec.outputSide)) {
    throw new Error(
      `Composition "${composition.name}": trigger "${trigger.name}" expects outputSide="${trigger.inputSpec.outputSide}" but bound threshold "${threshold.name}" produces side="${threshold.outputSide}" (cross-side wiring; use a 'shared' threshold or matching-side threshold)`,
    );
  }
}

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

    if (trigger.input) {
      if (!thresholdNames.has(trigger.input.thresholdRef)) {
        throw new Error(
          `Composition "${composition.name}": trigger "${trigger.name}" references unknown threshold "${trigger.input.thresholdRef}". Available: ${[...thresholdNames].join(', ')}`,
        );
      }
      const threshold = composition.thresholds[trigger.input.thresholdRef]!;
      validateInputSpec(composition, trigger, threshold);
    } else if (trigger.inputSpec) {
      throw new Error(
        `Composition "${composition.name}": trigger "${trigger.name}" declares inputSpec but has no input — inputSpec describes the shape of a bound threshold, so an input is required when inputSpec is present`,
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
