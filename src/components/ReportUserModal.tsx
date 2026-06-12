/**
 * @fileoverview Report User Modal Component
 *
 * Modal for reporting users for various violations.
 * Creates immutable report records with evidence preservation.
 *
 * Features:
 * - Multiple report categories
 * - Required description
 * - Evidence preservation (context passed from parent)
 * - Privacy protection for reporter
 *
 * Usage:
 * <ReportUserModal
 *   reportedUserId="uuid"
 *   reportedUserName="John Doe"
 *   onClose={() => setShowModal(false)}
 *   contextData={{ conversation_id: 'uuid' }} // Optional
 *   evidenceSnapshot={{ message_text: 'content' }} // Optional
 * />
 */

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMemberId, useCreateUserReport } from '@/api/hooks';
import { REPORT_CATEGORIES } from '@/utils/reportingQueries';
import type { ReportCategory } from '@/utils/reportingQueries';
import { Modal } from '@/components/shared';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

interface ReportUserModalProps {
  reportedUserId: string;
  reportedUserName: string;
  onClose: () => void;
  contextData?: Record<string, any>; // conversation_id, match_id, etc.
  evidenceSnapshot?: Record<string, any>; // message_text, score_data, etc.
  defaultCategory?: ReportCategory;
}

export function ReportUserModal({
  reportedUserId,
  reportedUserName,
  onClose,
  contextData,
  evidenceSnapshot,
  defaultCategory
}: ReportUserModalProps) {
  const memberId = useMemberId();
  const createReportMutation = useCreateUserReport();
  const [category, setCategory] = useState<ReportCategory>(defaultCategory || 'other');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!memberId) {
      setError('You must be logged in to submit a report');
      return;
    }

    if (description.trim().length < 10) {
      setError('Please provide a detailed description (at least 10 characters)');
      return;
    }

    setError(null);

    createReportMutation.mutate(
      {
        reporterId: memberId,
        reportedUserId,
        category,
        description: description.trim(),
        evidenceSnapshot,
        contextData,
      },
      {
        onSuccess: () => {
          toast.success('Report submitted successfully. A league operator will review it shortly.');
          onClose();
        },
        onError: (error) => {
          logger.error('Failed to submit report', { error: error instanceof Error ? error.message : String(error) });
          setError('Failed to submit report. Please try again.');
        },
      }
    );
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Report User"
      icon={<AlertTriangle className="h-5 w-5 text-warning" />}
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <Modal.Body className="space-y-4">
          {/* Reporting */}
          <div className="p-3 bg-warning/10 border border-warning/40 rounded-md">
            <p className="text-sm text-warning">
              <strong>You are reporting:</strong> {reportedUserName}
            </p>
            <p className="text-xs text-warning mt-1">
              Reports are reviewed by league operators. False reports may result in penalties.
            </p>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Report Category *</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as ReportCategory)}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REPORT_CATEGORIES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe the issue in detail. Include specific examples if possible."
              className="min-h-[120px]"
              required
              minLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 10 characters. Be specific and provide context.
            </p>
          </div>

          {/* Privacy Notice */}
          <div className="p-3 bg-info/10 border border-info/40 rounded-md">
            <p className="text-xs text-info">
              <strong>Privacy:</strong> Your identity will be kept confidential. The reported user will not see who filed this report.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/40 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            disabled={createReportMutation.isPending}
            loadingText="none"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={createReportMutation.isPending || description.trim().length < 10}
            className="bg-orange-600 hover:bg-orange-700"
            isLoading={createReportMutation.isPending}
            loadingText="Submitting..."
          >
            {createReportMutation.isPending ? 'Submitting...' : 'Submit Report'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
