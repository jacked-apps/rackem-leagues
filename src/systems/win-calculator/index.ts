/**
 * @fileoverview Win Calculator Module — public surface.
 *
 * The pure judge that declares a match winner from the shared match state and
 * its LO-assigned config. Import from here:
 *
 *   import { decideWinner, buildWinCalcConfig } from '@/systems/win-calculator';
 *
 * Canonical model: `docs/league-system/modules/win-calculator.md`.
 */

export type { ComparatorMode, Verdict, WinCalcConfig, WinCalcState } from './types';
export { decideWinner, type WinCalcResult } from './judge';
export { buildWinCalcConfig } from './configs';
