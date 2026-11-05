/**
 * @fileoverview Public surface of the Handicap Calculator feature.
 *
 * Re-exports only the page. Nothing else from this folder should be
 * imported elsewhere — keeps the feature self-contained and removable in
 * one motion (delete folder + 2 lines in NavRoutes.tsx). The route gate it
 * ships behind is the shared `@/components/NonProdGate`.
 */

export { HandicapCalculator } from './HandicapCalculator';
