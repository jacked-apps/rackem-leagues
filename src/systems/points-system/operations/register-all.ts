/**
 * @fileoverview Register every threshold operation.
 *
 * Importing this module (side-effect only) guarantees the full set of threshold
 * operations is registered — needed by the workshop loader + save-time guard,
 * which build/resolve rows that may reference ANY operation (including ones the
 * prepackaged compositions don't import). ES module caching makes each
 * operation's top-level registration run exactly once even when a composition
 * also imports it.
 */

import './read-pref';
import './chart-lookup-3v3';
import './fargo-start-points-for-side';
import './arithmetic-round-product';
import './chart-lookup';
import './evaluate-threshold-expression';
import './games-needed-formula';
import './fargo-games-won';
