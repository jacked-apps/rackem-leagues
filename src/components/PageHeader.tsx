/**
 * @fileoverview Reusable Page Header Component
 *
 * Provides consistent header styling across pages with:
 * - Back navigation link
 * - Page title
 * - Optional subtitle
 * - Organization context (for operator pages)
 * - Sticky positioning
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import { useOrganization } from '@/api/hooks/useOrganizations';

interface PageHeaderProps {
  /** Path to navigate back to (use with Link) */
  backTo?: string;
  /** Text for the back link (e.g., "Back to My Teams") */
  backLabel?: string;
  /** Optional onClick handler for back button (overrides backTo Link behavior) */
  onBackClick?: () => void;
  /** Main page title */
  hideBack?: boolean;
  /** Optional pre-title text displayed above the main title (e.g., "Welcome to") */
  preTitle?: string;
  /** Main page title - can be a string or JSX element (e.g., with InfoButton) */
  title: React.ReactNode;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Optional organization ID to display organization context */
  organizationId?: string;
  /** Optional content to render in the top-right corner (e.g., auth buttons) */
  rightContent?: React.ReactNode;
  /** Optional children to render below title/subtitle (e.g., action buttons) */
  children?: React.ReactNode;
}

/**
 * Reusable page header component
 *
 * Provides consistent sticky header with back navigation and optional organization context
 *
 * @example
 * <PageHeader
 *   backTo="/my-teams"
 *   backLabel="Back to My Teams"
 *   title="Team Schedule"
 *   subtitle="Mondays"
 *   organizationId="org-uuid" // Shows org name badge
 * />
 */
export function PageHeader({ backTo, backLabel, onBackClick, hideBack = false, preTitle, title, subtitle, organizationId, rightContent, children }: PageHeaderProps) {
  const { organization } = useOrganization(organizationId);

  return (
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="px-4 py-3 relative">
        {/* Right content (e.g., auth buttons) - positioned top right */}
        {rightContent && (
          <div className="absolute top-3 right-4">
            {rightContent}
          </div>
        )}
        {!hideBack && backLabel && (
          onBackClick ? (
            <button
              onClick={onBackClick}
              className="flex items-center gap-2 text-sm text-gray-600 mb-2 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </button>
          ) : backTo ? (
            <Link to={backTo} className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          ) : null
        )}
        {organization && (
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-600">
              {organization.organization_name}
            </span>
          </div>
        )}
        {preTitle && (
          <p className="text-xl font-bold text-gray-700">{preTitle}</p>
        )}
        <h1 className="text-2xl lg:text-4xl font-semibold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-md lg:text-xl text-gray-600">{subtitle}</p>
        )}
        {children}
      </div>
    </header>
  );
}
