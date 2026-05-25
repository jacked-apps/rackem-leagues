/**
 * @fileoverview Organization Settings Page
 *
 * Overview page showing organization info and rules in card format.
 * Uses only reusable components for each settings section.
 */
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '@/api/hooks';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { DashboardCard } from '@/components/operator/DashboardCard';
import { PageHeader } from '@/components/PageHeader';
import { BookOpen, Building2, Trophy } from 'lucide-react';
import { OrganizationBasicInfoCard } from '@/components/operator/OrganizationBasicInfoCard';
import { ContactInfoCard } from '@/components/operator/ContactInfoCard';
import { PaymentMethodCard } from '@/components/operator/PaymentMethodCard';
import { OrganizationPreferencesCard } from '@/components/operator/OrganizationPreferencesCard';
import { BlackoutDatesCard } from '@/components/operator/BlackoutDatesCard';

/**
 * Organization Settings Component
 * Overview page with cards for org info and rules
 */
export const OrganizationSettings: React.FC = () => {
  const navigate = useNavigate();
  const { orgId } = useParams<{ orgId: string }>();
  const queryClient = useQueryClient();

  // Fetch organization data
  const {
    organization,
    loading,
    error: queryError,
  } = useOrganization(orgId!);

  // Function to refetch organization data
  const refetchOrganization = () => {
    queryClient.invalidateQueries({ queryKey: ['organization', orgId] });
  };

  // Convert query error to string
  const error = queryError ? (queryError as Error).message : null;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center text-muted-foreground">Loading organization settings...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !organization) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="bg-card rounded-xl shadow-sm p-6">
            <h3 className="text-destructive text-lg font-semibold mb-4">Error</h3>
            <p className="text-foreground mb-4">
              {error || 'Organization not found.'}
            </p>
            <Button onClick={() => navigate('/my-teams')} loadingText="none">
              Back to My Teams
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo={`/operator-dashboard/${organization.id}`}
        backLabel="Back to Dashboard"
        title="Organization Settings"
        subtitle="Manage your organization information and league rules"
      />
      <div className="container mx-auto px-4 max-w-6xl py-8">
        {/* Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Organization Basic Info Card */}
          <OrganizationBasicInfoCard
            organization={organization}
            onUpdate={() => refetchOrganization()}
          />

          {/* Contact Info Card */}
          <ContactInfoCard
            organization={organization}
            onUpdate={() => refetchOrganization()}
          />

          {/* Payment Method Card */}
          <PaymentMethodCard
            organization={organization}
          />

          {/* Organization Preferences Card */}
          <OrganizationPreferencesCard
            organizationId={organization.id}
            onUpdate={() => refetchOrganization()}
          />

          {/* House Rules Card — org-wide manager */}
          <DashboardCard
            icon={<BookOpen className="h-6 w-6" />}
            iconColor="text-success"
            title="House Rules"
            description="Add rules that apply to every league in this organization"
            buttonText="Manage Rules"
            linkTo={`/league-rules/${organization.id}`}
          />

          {/* Venue Management Card */}
          <DashboardCard
            icon={<Building2 className="h-6 w-6" />}
            iconColor="text-primary"
            title="Venue Management"
            description="Add and manage venues where your leagues play"
            buttonText="Manage Venues"
            linkTo={`/venues/${organization.id}`}
          />

          {/* Blackout Dates Card */}
          <BlackoutDatesCard
            organizationId={organization.id}
            onUpdate={() => refetchOrganization()}
          />

          {/* Playoff Settings Card */}
          <DashboardCard
            icon={<Trophy className="h-6 w-6" />}
            iconColor="text-highlight"
            title="Playoff Settings"
            description="Configure default playoff format and rules for your leagues"
            buttonText="View Settings"
            linkTo={`/operator-settings/${organization.id}/playoffs`}
          />
        </div>
      </div>
    </div>
  );
};

export default OrganizationSettings;
