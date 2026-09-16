/**
 * @fileoverview Route gate for features that ship GATED: merged to main, live
 * on dev + staging, invisible in production until Ed reviews them on staging
 * and says to un-gate (see "Feature Gating Workflow" in CLAUDE.md).
 *
 * Renders children in development + staging only; redirects to home in
 * production. Wrap the ROUTE with it — and gate every door (nav link, button,
 * card) with the same `!isProduction` so production never shows a door to a
 * room that is gone. When un-gating, remove the wrapper and the door
 * conditions together.
 *
 * Users: Handicap Calculator (`tools/calc`), Game Room (`rooms/**`).
 */

import { Navigate } from 'react-router-dom';
import { isProduction } from '@/config/environment';

interface NonProdGateProps {
  children: React.ReactNode;
}

export function NonProdGate({ children }: NonProdGateProps) {
  if (isProduction) return <Navigate to="/" replace />;
  return <>{children}</>;
}
