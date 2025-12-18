/**
 * @fileoverview ReportsManagement Component
 *
 * League operator interface for reviewing and managing user reports.
 * Provides:
 * - List of pending and active reports
 * - Detailed report view with full audit trail
 * - Action buttons (review, escalate, resolve, dismiss)
 * - Read receipts (when operator views a report, status changes to 'under_review')
 * - Action tracking (warnings, suspensions, etc.)
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMemberId } from '@/api/hooks';
import {
  getPendingReportsForOperator,
  getReportDetails,
  updateReportStatus,
  takeReportAction,
  escalateReport,
  REPORT_CATEGORIES
} from '@/utils/reportingQueries';
import { PageHeader } from '@/components/PageHeader';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { AlertCircle, Clock, CheckCircle, XCircle, ArrowUp } from 'lucide-react';
import { AlertDialog } from '@/components/AlertDialog';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface Report {
  id: string;
  category: string;
  description: string;
  severity: string;
  created_at: string;
  evidence_snapshot: any;
  context_data: any;
  reporter: {
    id: string;
    first_name: string;
    last_name: string;
    system_player_number: string;
  };
  reported_user: {
    id: string;
    first_name: string;
    last_name: string;
    system_player_number: string;
  };
}

interface ReportDetails {
  report: any;
  updates: any[];
  actions: any[];
}

export function ReportsManagement() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const memberId = useMemberId();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionNotes, setActionNotes] = useState('');
  const [actionType, setActionType] = useState<string>('no_action');

  // Dialog states
  const [alertDialog, setAlertDialog] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  /**
   * Load pending reports on mount and when orgId changes
   */
  useEffect(() => {
    if (!orgId) {
      // No org ID - redirect to dashboard
      navigate('/dashboard');
      return;
    }
    loadReports();
  }, [orgId, navigate]);

  /**
   * Fetch pending reports from database for this organization
   */
  const loadReports = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await getPendingReportsForOperator(orgId);
    if (data && !error) {
      setReports(data as any);
    }
    setLoading(false);
  };

  /**
   * Load full report details when operator clicks on a report
   * Automatically marks report as 'under_review' (read receipt)
   */
  const handleViewReport = async (reportId: string) => {
    const { data, error } = await getReportDetails(reportId);
    if (data && !error) {
      setSelectedReport(data as ReportDetails);

      // Mark as under review if still pending (read receipt)
      if (data.report.status === 'pending') {
        await updateReportStatus(reportId, 'under_review');
        loadReports(); // Refresh list
      }
    }
  };

  /**
   * Take action on a report (warning, suspension, etc.)
   */
  const handleTakeAction = async () => {
    if (!selectedReport || !memberId) return;

    if (actionNotes.trim().length < 10) {
      setAlertDialog({
        show: true,
        title: 'Notes Required',
        message: 'Please provide detailed notes about this action (at least 10 characters)',
        type: 'warning'
      });
      return;
    }

    const { error } = await takeReportAction(
      selectedReport.report.id,
      memberId,
      'operator',
      actionType as any,
      actionNotes.trim()
    );

    if (!error) {
      setAlertDialog({
        show: true,
        title: 'Success',
        message: 'Action recorded successfully',
        type: 'success'
      });
      setActionNotes('');
      setActionType('no_action');
      setSelectedReport(null);
      loadReports();
    }
  };

  /**
   * Escalate report to developer for serious issues
   */
  const handleEscalate = async () => {
    if (!selectedReport) return;

    const confirmed = await confirm({
      title: 'Escalate Report?',
      message: 'Escalate this report to a developer? Use this for serious issues that require developer attention.',
      confirmText: 'Escalate',
      confirmVariant: 'destructive',
    });

    if (confirmed) {
      const { error } = await escalateReport(selectedReport.report.id);
      if (!error) {
        setAlertDialog({
          show: true,
          title: 'Success',
          message: 'Report escalated to developer successfully',
          type: 'success'
        });
        setSelectedReport(null);
        loadReports();
      }
    }
  };

  /**
   * Mark report as resolved
   */
  const handleResolve = async () => {
    if (!selectedReport) return;

    const confirmed = await confirm({
      title: 'Resolve Report?',
      message: 'Mark this report as resolved?',
      confirmText: 'Resolve',
      confirmVariant: 'default',
    });

    if (confirmed) {
      const { error } = await updateReportStatus(selectedReport.report.id, 'resolved');
      if (!error) {
        setAlertDialog({
          show: true,
          title: 'Success',
          message: 'Report marked as resolved',
          type: 'success'
        });
        setSelectedReport(null);
        loadReports();
      }
    }
  };

  /**
   * Dismiss report (no action needed)
   */
  const handleDismiss = async () => {
    if (!selectedReport) return;

    const confirmed = await confirm({
      title: 'Dismiss Report?',
      message: 'Dismiss this report? This indicates the report was reviewed but no action is needed.',
      confirmText: 'Dismiss',
      confirmVariant: 'default',
    });

    if (confirmed) {
      const { error } = await updateReportStatus(selectedReport.report.id, 'dismissed');
      if (!error) {
        setAlertDialog({
          show: true,
          title: 'Success',
          message: 'Report dismissed',
          type: 'success'
        });
        setSelectedReport(null);
        loadReports();
      }
    }
  };

  /**
   * Get badge color based on severity
   */
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  /**
   * Get status icon
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'under_review': return <AlertCircle className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      case 'dismissed': return <XCircle className="h-4 w-4" />;
      case 'escalated': return <ArrowUp className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo={`/operator-dashboard/${orgId}`}
        backLabel="Back to Organization"
        title="Reports Management"
        subtitle="Review and manage user reports for your leagues"
      />

      <div className="container mx-auto px-4 max-w-7xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Pending Reports ({reports.length})</CardTitle>
              <CardDescription>Reports awaiting review</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending reports</p>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => handleViewReport(report.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedReport?.report.id === report.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {REPORT_CATEGORIES[report.category as keyof typeof REPORT_CATEGORIES]}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Reported: {report.reported_user.first_name} {report.reported_user.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(report.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant={getSeverityColor(report.severity) as any}>
                          {report.severity}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Report Details */}
        <div className="lg:col-span-2">
          {selectedReport ? (
            <div className="space-y-6">
              {/* Report Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {getStatusIcon(selectedReport.report.status)}
                        Report Details
                      </CardTitle>
                      <CardDescription>
                        Submitted {new Date(selectedReport.report.created_at).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Badge variant={getSeverityColor(selectedReport.report.severity) as any}>
                      {selectedReport.report.severity} severity
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Category */}
                  <div>
                    <Label>Category</Label>
                    <p className="text-sm mt-1">
                      {REPORT_CATEGORIES[selectedReport.report.category as keyof typeof REPORT_CATEGORIES]}
                    </p>
                  </div>

                  {/* Reporter */}
                  <div>
                    <Label>Reported By</Label>
                    <p className="text-sm mt-1">
                      {selectedReport.report.reporter.first_name} {selectedReport.report.reporter.last_name}
                      {' '}(#{selectedReport.report.reporter.system_player_number})
                    </p>
                  </div>

                  {/* Reported User */}
                  <div>
                    <Label>Reported User</Label>
                    <p className="text-sm mt-1 font-medium">
                      {selectedReport.report.reported_user.first_name} {selectedReport.report.reported_user.last_name}
                      {' '}(#{selectedReport.report.reported_user.system_player_number})
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <Label>Description</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">
                      {selectedReport.report.description}
                    </p>
                  </div>

                  {/* Evidence */}
                  {selectedReport.report.evidence_snapshot && (
                    <div>
                      <Label>Evidence</Label>
                      <pre className="text-xs mt-1 p-3 bg-muted rounded-md overflow-x-auto">
                        {JSON.stringify(selectedReport.report.evidence_snapshot, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Context */}
                  {selectedReport.report.context_data && (
                    <div>
                      <Label>Context</Label>
                      <pre className="text-xs mt-1 p-3 bg-muted rounded-md overflow-x-auto">
                        {JSON.stringify(selectedReport.report.context_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action History */}
              {(selectedReport.updates.length > 0 || selectedReport.actions.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Action History</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Status Updates */}
                    {selectedReport.updates.map((update: any) => (
                      <div key={update.id} className="text-sm border-l-2 pl-3 py-1">
                        <div className="font-medium">
                          Status changed: {update.old_status} → {update.new_status}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          By {update.updater.first_name} {update.updater.last_name} ({update.updater_role})
                          {' '}• {new Date(update.created_at).toLocaleString()}
                        </div>
                        {update.update_notes && (
                          <div className="text-xs mt-1">{update.update_notes}</div>
                        )}
                      </div>
                    ))}

                    {/* Actions Taken */}
                    {selectedReport.actions.map((action: any) => (
                      <div key={action.id} className="text-sm border-l-2 border-red-500 pl-3 py-1">
                        <div className="font-medium">
                          Action: {action.action_type.replace('_', ' ')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          By {action.actor.first_name} {action.actor.last_name} ({action.actor_role})
                          {' '}• {new Date(action.created_at).toLocaleString()}
                        </div>
                        <div className="text-xs mt-1">{action.action_notes}</div>
                        {action.suspension_until && (
                          <div className="text-xs text-red-600">
                            Suspended until: {new Date(action.suspension_until).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Take Action */}
              {selectedReport.report.status !== 'resolved' && selectedReport.report.status !== 'dismissed' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Take Action</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="actionType">Action Type</Label>
                      <Select value={actionType} onValueChange={setActionType}>
                        <SelectTrigger id="actionType">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no_action">No Action Needed</SelectItem>
                          <SelectItem value="warning">Issue Warning</SelectItem>
                          <SelectItem value="temporary_suspension">Temporary Suspension</SelectItem>
                          <SelectItem value="permanent_ban">Permanent Ban</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="actionNotes">Action Notes (Required)</Label>
                      <Textarea
                        id="actionNotes"
                        value={actionNotes}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setActionNotes(e.target.value)}
                        placeholder="Explain what action you're taking and why..."
                        className="min-h-[100px]"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Minimum 10 characters. Be specific about your decision.
                      </p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={handleTakeAction} loadingText="Recording...">
                        Record Action
                      </Button>
                      <Button variant="outline" onClick={handleResolve} loadingText="Resolving...">
                        Mark Resolved
                      </Button>
                      <Button variant="outline" onClick={handleDismiss} loadingText="Dismissing...">
                        Dismiss
                      </Button>
                      <Button variant="destructive" onClick={handleEscalate} loadingText="Escalating...">
                        <ArrowUp className="h-4 w-4 mr-2" />
                        Escalate to Developer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a report to view details</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Alert Dialog (success/warning messages with OK button) */}
      {alertDialog?.show && (
        <AlertDialog
          title={alertDialog.title}
          message={alertDialog.message}
          type={alertDialog.type}
          onOk={() => setAlertDialog(null)}
        />
      )}

      {ConfirmDialogComponent}
      </div>
    </div>
  );
}

export default ReportsManagement;
