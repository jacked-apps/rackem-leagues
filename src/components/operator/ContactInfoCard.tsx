/**
 * @fileoverview Contact Information Card
 *
 * Displays and allows editing of organization contact information:
 * - Contact email (with visibility control)
 * - Contact phone (with visibility control)
 *
 * Each section is independently editable with its own edit/save/cancel buttons.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { supabase } from '@/supabaseClient';
import type { Organization } from '@/api/queries/organizations';
import { logger } from '@/utils/logger';

// Contact visibility type from organizations table
type ContactVisibility = 'public' | 'my_organization' | 'my_teams';

interface ContactInfoCardProps {
  organization: Organization;
  onUpdate: () => void;
}

type EditingSection = 'email' | 'phone' | null;

// Helper to get visibility label
const getVisibilityLabel = (visibility: ContactVisibility): string => {
  const labels: Record<ContactVisibility, string> = {
    public: 'Public',
    my_organization: 'My Organization',
    my_teams: 'All Players',
  };
  return labels[visibility];
};

export const ContactInfoCard: React.FC<ContactInfoCardProps> = ({
  organization,
  onUpdate,
}) => {
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState(organization.organization_email);
  const [emailVisibility, setEmailVisibility] = useState<ContactVisibility>(organization.organization_email_visibility);
  const [phone, setPhone] = useState(organization.organization_phone);
  const [phoneVisibility, setPhoneVisibility] = useState<ContactVisibility>(organization.organization_phone_visibility);

  const startEditingSection = (section: EditingSection) => {
    // Reset form to current values
    setEmail(organization.organization_email);
    setEmailVisibility(organization.organization_email_visibility);
    setPhone(organization.organization_phone);
    setPhoneVisibility(organization.organization_phone_visibility);
    setError(null);
    setEditingSection(section);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setError(null);
  };

  const saveEmail = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          organization_email: email.trim(),
          organization_email_visibility: emailVisibility,
        })
        .eq('id', organization.id);

      if (updateError) throw updateError;

      setEditingSection(null);
      onUpdate();
    } catch (err) {
      logger.error('Failed to update email', { error: err instanceof Error ? err.message : String(err) });
      setError('Failed to update email');
    } finally {
      setIsSaving(false);
    }
  };

  const savePhone = async () => {
    if (!phone.trim()) {
      setError('Phone is required');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          organization_phone: phone.trim(),
          organization_phone_visibility: phoneVisibility,
        })
        .eq('id', organization.id);

      if (updateError) throw updateError;

      setEditingSection(null);
      onUpdate();
    } catch (err) {
      logger.error('Failed to update phone', { error: err instanceof Error ? err.message : String(err) });
      setError('Failed to update phone');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Contact Email Section */}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm text-muted-foreground font-medium">Contact Email</p>
            {editingSection !== 'email' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditingSection('email')}
              >
                Edit
              </Button>
            )}
          </div>

          {editingSection === 'email' ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  placeholder="contact@example.com"
                />
              </div>
              <div>
                <Label htmlFor="emailVisibility">Visibility</Label>
                <Select value={emailVisibility} onValueChange={(value) => setEmailVisibility(value as ContactVisibility)}>
                  <SelectTrigger id="emailVisibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="my_organization">My Organization</SelectItem>
                    <SelectItem value="my_teams">All Players</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveEmail} disabled={isSaving} size="sm" loadingText="Saving...">
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={cancelEditing} disabled={isSaving} size="sm" loadingText="none">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-foreground">
              <p>{organization.organization_email}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Visible to: {getVisibilityLabel(organization.organization_email_visibility)}
              </p>
            </div>
          )}
        </div>

        {/* Contact Phone Section */}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm text-muted-foreground font-medium">Contact Phone</p>
            {editingSection !== 'phone' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditingSection('phone')}
              >
                Edit
              </Button>
            )}
          </div>

          {editingSection === 'phone' ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="phoneVisibility">Visibility</Label>
                <Select value={phoneVisibility} onValueChange={(value) => setPhoneVisibility(value as ContactVisibility)}>
                  <SelectTrigger id="phoneVisibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="my_organization">My Organization</SelectItem>
                    <SelectItem value="my_teams">All Players</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={savePhone} disabled={isSaving} size="sm" loadingText="Saving...">
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={cancelEditing} disabled={isSaving} size="sm" loadingText="none">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-foreground">
              <p>{organization.organization_phone}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Visible to: {getVisibilityLabel(organization.organization_phone_visibility)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
