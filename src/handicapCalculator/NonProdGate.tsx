/**
 * @fileoverview Local route gate for the Handicap Calculator feature.
 *
 * Renders children in development + staging only. Redirects to home in
 * production. Lives inside the feature folder (not shared) so the whole
 * calculator can be deleted in one motion.
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
