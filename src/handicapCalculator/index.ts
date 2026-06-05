/**
 * @fileoverview Public surface of the Handicap Calculator feature.
 *
 * Re-exports only the page and its gate. Nothing else from this folder
 * should be imported elsewhere — keeps the feature self-contained and
 * removable in one motion (delete folder + 2 lines in NavRoutes.tsx).
 */

export { HandicapCalculator } from './HandicapCalculator';
export { NonProdGate } from './NonProdGate';
