/**
 * @fileoverview SubModule registry exports + defaults.
 *
 * Today every shipping `SystemModule` enables BOTH sub kinds —
 * matches current MatchLineup behavior where the dropdown always
 * offers both. When the workshop / LO settings dashboard lands, that
 * dial moves to per-league configuration; for now `defaultEnabledSubs`
 * is the single source of truth.
 */

import { anonymousSubModule } from './anonymous';
import { doubleDutySubModule } from './doubleDuty';

export type { SubKind, SubModule } from './types';
export { anonymousSubModule } from './anonymous';
export { doubleDutySubModule } from './doubleDuty';

/**
 * The default set of enabled sub modules for shipping system presets.
 * Matches current behavior: both anonymous and double-duty available.
 *
 * Future: when an LO disables one via the workshop, the per-league
 * `enabledSubs` will diverge from this default.
 */
export const defaultEnabledSubs = [anonymousSubModule, doubleDutySubModule];
