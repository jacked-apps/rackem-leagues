/**
 * @fileoverview Organization Staff Card Component
 *
 * Displays organization staff members with ability to add new staff.
 * Shows staff list with names and positions (owner, admin, league_rep).
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MemberSearchCombobox } from '@/components/MemberSearchCombobox';
import { UserPlus, X } from 'lucide-react';
import { useOrganizationStaff, useAddOrganizationStaff, useRemoveOrganizationStaff, useUserProfile } from '@/api/hooks';
import { logger } from '@/utils/logger';

interface OrganizationStaffCardProps {
  /** Organization ID to fetch staff for */
  organizationId: string;
  /** Current user's member ID (for adding staff) */
  currentMemberId: string;
}

/**
 * Organization Staff Card Component
 *
 * Displays list of staff members for an organization.
 * Allows adding new staff members as admins.
 */
export const OrganizationStaffCard: React.FC<OrganizationStaffCardProps> = ({
  organizationId,
  currentMemberId,
}) => {
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');

  // Fetch staff and user profile
  const { data: staff = [], isLoading: staffLoading } = useOrganizationStaff(organizationId);
  const { member } = useUserProfile();

  // Add/remove staff mutations
  const addStaffMutation = useAddOrganizationStaff();
  const removeStaffMutation = useRemoveOrganizationStaff();

  const handleAddStaff = async () => {
    if (!selectedMemberId || !currentMemberId) return;

    try {
      await addStaffMutation.mutateAsync({
        organizationId,
        memberId: selectedMemberId,
        position: 'admin',
        addedBy: currentMemberId,
      });
      setShowAddStaff(false);
      setSelectedMemberId('');
    } catch (err) {
      logger.error('Failed to add staff', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleRemoveStaff = async (staffId: string, memberId: string) => {
    try {
      await removeStaffMutation.mutateAsync({
        staffId,
        memberId,
        organizationId,
      });
    } catch (err) {
      logger.error('Failed to remove staff', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Organization Staff</CardTitle>
          <Button onClick={() => setShowAddStaff(true)} size="sm" loadingText="none">
            <UserPlus className="h-4 w-4 mr-1" />
            Add Staff
          </Button>
        </CardHeader>
        <CardContent>
          {staffLoading ? (
            <p className="text-muted-foreground text-sm text-center py-4">Loading staff...</p>
          ) : staff.length === 0 ? (
            <div className="text-center py-6">
              <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">No staff members yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {staff.map((staffMember) => (
                <div
                  key={staffMember.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {staffMember.member.first_name} {staffMember.member.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {staffMember.position.replace('_', ' ')}
                    </p>
                  </div>
                  {staffMember.position !== 'owner' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveStaff(staffMember.id, staffMember.member_id)}
                      disabled={removeStaffMutation.isPending}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Search for a member to add them as an admin to your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <MemberSearchCombobox
              value={selectedMemberId}
              onValueChange={setSelectedMemberId}
              placeholder="Search for member..."
              label="Select Member"
              excludeIds={staff.map((s) => s.member_id)}
              organizationId={organizationId}
              userState={member?.state || null}
              defaultFilter="state"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddStaff(false)} loadingText="none">
                Cancel
              </Button>
              <Button
                onClick={handleAddStaff}
                disabled={!selectedMemberId || addStaffMutation.isPending}
                loadingText="Adding..."
              >
                {addStaffMutation.isPending ? 'Adding...' : 'Add as Admin'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
