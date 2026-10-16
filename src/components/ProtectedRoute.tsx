/**
 * @fileoverview Protected route component for authentication and authorization
 * Handles multiple levels of access control including authentication, roles, and application status
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/useUser';
import { useUserProfile } from '@/api/hooks';
import type { UserRole } from '@/types';

/**
 * Props for the ProtectedRoute component
 * Allows fine-grained control over access requirements
 */
interface ProtectedRouteProps {
  children: React.ReactNode; // Component to render if access is granted
  requireAuth?: boolean; // Whether user must be authenticated (default: true)
  requiredRole?: UserRole; // Specific role required to access this route
  requireApprovedApplication?: boolean; // Whether user must have completed member application
  redirectTo?: string; // Where to redirect if access is denied (default: '/login')
}

/**
 * Protected route wrapper component that handles authentication and authorization
 *
 * This component implements a hierarchical access control system:
 * 1. Authentication check (is user logged in?)
 * 2. Role-based access control (does user have required role?)
 * 3. Application status check (has user completed member application?)
 *
 * @param children - The component to render if all access checks pass
 * @param requireAuth - Whether authentication is required (default: true)
 * @param requiredRole - Specific role needed to access the route
 * @param requireApprovedApplication - Whether user needs completed member application
 * @param redirectTo - Fallback redirect path if access is denied
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requiredRole,
  requireApprovedApplication = false,
  redirectTo = '/login',
}) => {
  const { user, loading: authLoading } = useUser();
  const {
    member,
    loading: profileLoading,
    hasRole,
    canAccessLeagueOperatorFeatures,
    canAccessDeveloperFeatures,
  } = useUserProfile();
  const location = useLocation();

  // Show loading state while checking authentication or fetching member data
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // First check: Authentication requirement
  if (requireAuth && !user) {
    // Preserve where they were headed so the login screen can send them back.
    const attempted = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${redirectTo}?redirect=${attempted}`} replace />;
  }

  // Second check: permission-based access control.
  // We ask what the member MAY do, not what they ARE — operator access is
  // resolved live from staff grants, and developers are waved through by the
  // master key (both handled inside these gates).
  if (requiredRole) {
    const hasAccess =
      requiredRole === 'developer'
        ? canAccessDeveloperFeatures()
        : requiredRole === 'league_operator'
          ? canAccessLeagueOperatorFeatures()
          : hasRole(requiredRole); // any other role guards exactly (e.g. 'player')

    if (!hasAccess) {
      // An operator who lacks the *specific* access a route needs (e.g. a
      // developer-only page) gets the unauthorized page; a plain player falls
      // back to their home. Preserves the pre-existing redirect behavior.
      if (canAccessLeagueOperatorFeatures()) {
        return <Navigate to="/unauthorized" replace />;
      }
      return <Navigate to="/my-teams" replace />;
    }
  }

  // Third check: Application completion requirement
  if (requireApprovedApplication && !member) {
    // Carry the intent through profile completion (consumed once onboarding's
    // progressive-profile work lands; harmless until then).
    const attempted = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/complete-profile?redirect=${attempted}`} replace />;
  }

  // All checks passed - render the protected content
  return <>{children}</>;
};