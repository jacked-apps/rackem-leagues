/**
 * @fileoverview Organization Basic Information Card
 *
 * Displays and allows editing of organization name and mailing address.
 * Each section is independently editable with its own edit/save/cancel buttons.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { supabase } from '@/supabaseClient';
import type { Organization } from '@/api/queries/organizations';
import { logger } from '@/utils/logger';

interface OrganizationBasicInfoCardProps {
  organization: Organization;
  onUpdate: () => void;
}

type EditingSection = 'name' | 'address' | null;

export const OrganizationBasicInfoCard: React.FC<OrganizationBasicInfoCardProps> = ({
  organization,
  onUpdate,
}) => {
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [organizationName, setOrganizationName] = useState(organization.organization_name);
  const [address, setAddress] = useState(organization.organization_address);
  const [city, setCity] = useState(organization.organization_city);
  const [state, setState] = useState(organization.organization_state);
  const [zipCode, setZipCode] = useState(organization.organization_zip_code);

  const startEditingSection = (section: EditingSection) => {
    // Reset form to current values
    setOrganizationName(organization.organization_name);
    setAddress(organization.organization_address);
    setCity(organization.organization_city);
    setState(organization.organization_state);
    setZipCode(organization.organization_zip_code);
    setError(null);
    setEditingSection(section);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setError(null);
  };

  const saveName = async () => {
    if (!organizationName.trim()) {
      setError('Organization name is required');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ organization_name: organizationName.trim() })
        .eq('id', organization.id);

      if (updateError) throw updateError;

      setEditingSection(null);
      onUpdate();
    } catch (err) {
      logger.error('Failed to update organization name', { error: err instanceof Error ? err.message : String(err) });
      setError('Failed to update organization name');
    } finally {
      setIsSaving(false);
    }
  };

  const saveAddress = async () => {
    if (!address.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      setError('All address fields are required');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          organization_address: address.trim(),
          organization_city: city.trim(),
          organization_state: state.trim().toUpperCase(),
          organization_zip_code: zipCode.trim(),
        })
        .eq('id', organization.id);

      if (updateError) throw updateError;

      setEditingSection(null);
      onUpdate();
    } catch (err) {
      logger.error('Failed to update mailing address', { error: err instanceof Error ? err.message : String(err) });
      setError('Failed to update mailing address');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Organization Name Section */}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm text-muted-foreground font-medium">Organization Name</p>
            {editingSection !== 'name' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditingSection('name')}
              >
                Edit
              </Button>
            )}
          </div>

          {editingSection === 'name' ? (
            <div className="space-y-3">
              <Input
                value={organizationName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrganizationName(e.target.value)}
                placeholder="Your Organization Name"
              />
              <div className="flex gap-2">
                <Button onClick={saveName} disabled={isSaving} size="sm" loadingText="Saving...">
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={cancelEditing} disabled={isSaving} size="sm" loadingText="none">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-foreground">{organization.organization_name}</p>
          )}
        </div>

        {/* Mailing Address Section */}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm text-muted-foreground font-medium">Mailing Address</p>
            {editingSection !== 'address' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditingSection('address')}
              >
                Edit
              </Button>
            )}
          </div>

          {editingSection === 'address' ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={state}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setState(e.target.value)}
                    placeholder="State"
                    maxLength={2}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  value={zipCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setZipCode(e.target.value)}
                  placeholder="12345"
                  maxLength={10}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveAddress} disabled={isSaving} size="sm" loadingText="Saving...">
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={cancelEditing} disabled={isSaving} size="sm" loadingText="none">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-foreground">
              <p>{organization.organization_address}</p>
              <p>
                {organization.organization_city}, {organization.organization_state}{' '}
                {organization.organization_zip_code}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
