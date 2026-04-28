/**
 * @fileoverview Organization-wide house-rules manager (Branch 2, Unit 5).
 *
 * Replaced the old external-links landing. An LO lands here from their
 * operator settings to add, edit, and remove rules that apply across every
 * league in the organization. League-scoped rules live on LeagueSettings
 * (Unit 6). Official CSI rules read from `/rules`.
 */

import { Link, useParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';

import { HouseRulesList } from '@/rules/HouseRulesList';

export const LeagueRules: React.FC = () => {
  const { orgId = '' } = useParams<{ orgId: string }>();

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo={`/operator-settings/${orgId}`}
        backLabel="Back to Settings"
        title="House Rules"
        subtitle="Rules that apply to every league in this organization"
      />
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-700">
            House rules override or enhance the official CSI rulebook for your players. Add rules here
            and they'll show up for every league in this organization.
          </p>
          <Button asChild variant="outline" size="sm" loadingText="none" className="mt-3 gap-2">
            <Link to="/rules">
              <BookOpen className="h-4 w-4" />
              View the official rulebook
            </Link>
          </Button>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <HouseRulesList scope={{ type: 'organization', organizationId: orgId }} />
        </div>
      </div>
    </div>
  );
};

export default LeagueRules;
