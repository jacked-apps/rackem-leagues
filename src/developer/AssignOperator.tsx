/**
 * @fileoverview Developer-only tool to place a member as a League Operator.
 *
 * Phase 1 (slice 3) of the designations / organization-permissions work. Until a
 * real purchase flow exists, this is the ONLY way to grant operator access
 * outside the self-service LO application (Scope Boundaries: "designations are
 * granted from a developer-only surface").
 *
 * WHAT "MAKE A LEAGUE OPERATOR" MEANS HERE: an operator is the OWNER of an
 * organization. Creating an organization for a member auto-inserts them as
 * `owner` in organization_staff (the create_owner_staff DB trigger); operator
 * access is then resolved LIVE from that grant (no members.role write). A mock
 * card is attached because real payments are not wired yet.
 *
 * Route is developer-gated (withDeveloper); the nav links into it are gated the
 * same way in AppSidebar / AppDrawer.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MemberSearchCombobox } from '@/components/MemberSearchCombobox';
import { useUserProfile } from '@/api/hooks';
import { useCreateOrganization } from '@/api/hooks/useOrganizationMutations';
import { useUpdateMemberRole } from '@/api/hooks/useMemberMutations';
import { getAllLeagueOperators } from '@/api/queries/operators';
import { getDevelopers } from '@/api/queries/members';
import { queryKeys } from '@/api/queryKeys';
import { generateMockPaymentData } from '@/types/operator';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

/**
 * Developer tool: pick a registered member, name their organization, and stand
 * them up as its owner — i.e. a League Operator.
 */
export const AssignOperator: React.FC = () => {
  const { member } = useUserProfile();
  const createOrganization = useCreateOrganization();
  const updateMemberRole = useUpdateMemberRole();

  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [selectedDevMemberId, setSelectedDevMemberId] = useState('');

  // Current operators = owners of organizations, so the developer can see who
  // already has access and confirm a new one landed.
  const { data: operators = [], isLoading: operatorsLoading } = useQuery({
    queryKey: [...queryKeys.operators.all, 'all-owners'],
    queryFn: getAllLeagueOperators,
  });

  // Current developers (master key holders), for the same reason.
  const { data: developers = [], isLoading: developersLoading } = useQuery({
    queryKey: [...queryKeys.members.all, 'developers'],
    queryFn: getDevelopers,
  });

  const canSubmit = !!selectedMemberId && orgName.trim().length > 0 && !createOrganization.isPending;

  const handleAssign = async () => {
    if (!canSubmit) return;

    try {
      // The selected member is the org's creator → the trigger makes them owner.
      // Address/contact are left blank on purpose: this is a developer tool over
      // disposable data, and the operator can fill real details later. A mock
      // card satisfies the not-null payment columns until billing is real.
      await createOrganization.mutateAsync({
        organization_name: orgName.trim(),
        created_by: selectedMemberId,
        organization_address: '',
        organization_city: '',
        organization_state: '',
        organization_zip_code: '',
        organization_email: '',
        organization_phone: '',
        ...generateMockPaymentData(),
      });

      toast.success(`Created "${orgName.trim()}" — that member is now a League Operator.`);
      setSelectedMemberId('');
      setOrgName('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to assign league operator', { error: message });
      toast.error(`Failed to assign operator: ${message}`);
    }
  };

  const canAssignDev = !!selectedDevMemberId && !updateMemberRole.isPending;

  const handleAssignDeveloper = async () => {
    if (!canAssignDev) return;

    try {
      // Developer is still a members.role flag (the small, deferred-store path
      // we agreed on). Assigning it lights up the master key everywhere it's
      // already consumed: dev routes, canAccessDeveloperFeatures, and operator
      // access via the master-key branch in the check layer.
      await updateMemberRole.mutateAsync({
        memberId: selectedDevMemberId,
        role: 'developer',
      });

      toast.success('That member is now a Developer.');
      setSelectedDevMemberId('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to assign developer', { error: message });
      toast.error(`Failed to assign developer: ${message}`);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assign League Operator</h1>
        <p className="text-sm text-muted-foreground">
          Developer tool. Creates an organization for a member and makes them its
          owner — which is what gives them access to the operator pages.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Make someone a League Operator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="operator-member">Member</Label>
            <MemberSearchCombobox
              id="operator-member"
              value={selectedMemberId}
              onValueChange={setSelectedMemberId}
              placeholder="Search for a registered member..."
              userState={member?.state || null}
              defaultFilter="all"
              filters={['all', 'state']}
              registeredOnly
              showClear
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="operator-org-name">Organization name</Label>
            <Input
              id="operator-org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Downtown Pool League"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleAssign} disabled={!canSubmit} loadingText="Creating...">
              {createOrganization.isPending ? 'Creating...' : 'Create org & assign operator'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current League Operators</CardTitle>
        </CardHeader>
        <CardContent>
          {operatorsLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading operators...</p>
          ) : operators.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No league operators yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {operators.map((op) => (
                <li
                  key={op.id}
                  className="flex items-center justify-between rounded p-2 hover:bg-muted"
                >
                  <span className="text-sm font-medium">{op.organization_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {op.first_name} {op.last_name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Make someone a Developer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Grants the developer master key — access to every operator page and the
            developer tools. Use sparingly.
          </p>
          <div className="space-y-2">
            <Label htmlFor="developer-member">Member</Label>
            <MemberSearchCombobox
              id="developer-member"
              value={selectedDevMemberId}
              onValueChange={setSelectedDevMemberId}
              placeholder="Search for a registered member..."
              userState={member?.state || null}
              defaultFilter="all"
              filters={['all', 'state']}
              registeredOnly
              showClear
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAssignDeveloper} disabled={!canAssignDev} loadingText="Assigning...">
              {updateMemberRole.isPending ? 'Assigning...' : 'Assign as developer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Developers</CardTitle>
        </CardHeader>
        <CardContent>
          {developersLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading developers...</p>
          ) : developers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No developers yet.</p>
          ) : (
            <ul className="space-y-2">
              {developers.map((dev) => (
                <li
                  key={dev.id}
                  className="flex items-center justify-between rounded p-2 hover:bg-muted"
                >
                  <span className="text-sm font-medium">
                    {dev.first_name} {dev.last_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    #P-{String(dev.system_player_number).padStart(5, '0')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
