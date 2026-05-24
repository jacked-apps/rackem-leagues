/**
 * @fileoverview Org-switcher dropdown for the PageHeader.
 *
 * Rendered only on operator routes. Shows the active organization name
 * with a Building2 icon. Multi-org operators get a dropdown to switch;
 * single-org operators see a static display.
 *
 * Switching always navigates to the new org's operator dashboard.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { Building2, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganizations } from '@/api/hooks/useOrganizations';
import { useUserProfile } from '@/api/hooks/useUserProfile';

/**
 * Compact org-switcher for the sticky header bar.
 *
 * - Multi-org: dropdown with all orgs, active org highlighted
 * - Single-org: static display with org name, no dropdown affordance
 * - No orgs: renders nothing
 */
export function OrgSwitcher() {
  const { member } = useUserProfile();
  const { organizations } = useOrganizations(member?.id);
  const params = useParams();
  const navigate = useNavigate();

  if (!organizations || organizations.length === 0) return null;

  // Determine the active org from route params
  const activeOrgId = params.orgId ?? null;
  const activeOrg = activeOrgId
    ? organizations.find((o) => o.id === activeOrgId)
    : null;

  const displayName = activeOrg?.organization_name ?? 'Select Org';
  const isSingleOrg = organizations.length === 1;

  // Single-org: static display
  if (isSingleOrg) {
    return (
      <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-primary">
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="truncate max-w-32">{organizations[0].organization_name}</span>
      </div>
    );
  }

  // Multi-org: dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-primary transition-colors hover:bg-primary/10"
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate max-w-32">{displayName}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => navigate(`/operator-dashboard/${org.id}`)}
            className={org.id === activeOrgId ? 'bg-primary/15 font-medium text-primary' : ''}
          >
            <Building2 className="mr-2 h-4 w-4" />
            <span className="truncate">{org.organization_name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
