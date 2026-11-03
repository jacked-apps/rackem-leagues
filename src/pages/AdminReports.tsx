/**
 * @fileoverview AdminReports Component
 *
 * Developer/admin interface for system-wide report management.
 * Provides:
 * - View ALL reports across the entire system
 * - Filter by status, category, severity
 * - Escalated reports view
 * - Full action capabilities
 * - System-wide oversight and trends
 *
 * Only accessible to users with 'developer' role.
 */

import { useEffect, useState } from 'react';
import { useMemberId } from '@/api/hooks';
import {
  getReportDetails,
  updateReportStatus,
  takeReportAction,
  REPORT_CATEGORIES
} from '@/utils/reportingQueries';
import type { Json } from '@/types/database.types';
import { supabase } from '@/supabaseClient';
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
import {
  Tabs,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { AlertCircle, Clock, CheckCircle, XCircle, ArrowUp, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface Report {
  id: string;
  category: string;
  description: string;
  severity: string | null;
  // Nullable column, but it defaults to 'pending' and is never cleared.
  status: string;
  created_at: string;
  evidence_snapshot: Json | null;
  context_data: Json | null;
  escalated_to_dev: boolean | null;
  reporter: {
    id: string;
    first_name: string;
    last_name: string;
    system_player_number: number;
  };
  reported_user: {
    id: string;
    first_name: string;
    last_name: string;
    system_player_number: number;
  };
}

/** Exactly what getReportDetails returns on success (report + history). */
type ReportDetails = NonNullable<Awaited<ReturnType<typeof getReportDetails>>['data']>;

/** The action kinds takeReportAction accepts (the Select holds them as strings). */
type ReportActionType = Parameters<typeof takeReportAction>[3];

export function AdminReports() {
  const memberId = useMemberId();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [actionNotes, setActionNotes] = useState('');
  const [actionType, setActionType] = useState<string>('no_action');

  /**
   * Load all reports on mount
   */
  useEffect(() => {
    loadAllReports();
  }, []);

  /**
   * Filter reports when tab or data changes
   * Note: filterReports is intentionally excluded from deps as it's a stable function
   * that only reads from state (activeTab, allReports) which are already in deps
   */
  useEffect(() => {
    filterReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, allReports]);

  /**
   * Fetch ALL reports from database (developer privilege)
   */
  const loadAllReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_reports')
      .select(`
        id,
        category,
        description,
        severity,
        status,
        created_at,
        evidence_snapshot,
        context_data,
        escalated_to_dev,
        reporter:members!reporter_id(
          id,
          first_name,
          last_name,
          system_player_number
        ),
        reported_user:members!reported_user_id(
          id,
          first_name,
          last_name,
          system_player_number
        )
      `)
      .order('created_at', { ascending: false });

    if (data && !error) {
      setAllReports(data as Report[]);
    }
    setLoading(false);
  };

  /**
   * Filter reports based on active tab
   */
  const filterReports = () => {
    let filtered = allReports;

    switch (activeTab) {
      case 'pending':
        filtered = allReports.filter(r => r.status === 'pending');
        break;
      case 'under_review':
        filtered = allReports.filter(r => r.status === 'under_review');
        break;
      case 'escalated':
        filtered = allReports.filter(r => r.escalated_to_dev === true || r.status === 'escalated');
        break;
      case 'resolved':
        filtered = allReports.filter(r => r.status === 'resolved' || r.status === 'dismissed');
        break;
      case 'all':
        filtered = allReports;
        break;
    }

    // Sort by severity (critical first) then by date (oldest first)
    filtered.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = (severityOrder[a.severity as keyof typeof severityOrder] || 99) -
                           (severityOrder[b.severity as keyof typeof severityOrder] || 99);
      if (severityDiff !== 0) return severityDiff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    setFilteredReports(filtered);
  };

  /**
   * Load full report details
   */
  const handleViewReport = async (reportId: string) => {
    const { data, error } = await getReportDetails(reportId);
    if (data && !error) {
      setSelectedReport(data as ReportDetails);
    }
  };

  /**
   * Take action on a report (developer level)
   */
  const handleTakeAction = async () => {
    if (!selectedReport || !memberId) return;

    if (actionNotes.trim().length < 10) {
      toast.error('Please provide detailed notes about this action (at least 10 characters)');
      return;
    }

    const { error } = await takeReportAction(
      selectedReport.report.id,
      memberId,
      'developer',
      actionType as ReportActionType,
      actionNotes.trim()
    );

    if (!error) {
      toast.success('Action recorded successfully');
      setActionNotes('');
      setActionType('no_action');
      setSelectedReport(null);
      loadAllReports();
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

    if (!confirmed) return;

    const { error } = await updateReportStatus(selectedReport.report.id, 'resolved');
    if (!error) {
      toast.success('Report marked as resolved');
      setSelectedReport(null);
      loadAllReports();
    }
  };

  /**
   * Dismiss report
   */
  const handleDismiss = async () => {
    if (!selectedReport) return;

    const confirmed = await confirm({
      title: 'Dismiss Report?',
      message: 'Dismiss this report?',
      confirmText: 'Dismiss',
      confirmVariant: 'destructive',
    });

    if (!confirmed) return;

    const { error } = await updateReportStatus(selectedReport.report.id, 'dismissed');
    if (!error) {
      toast.success('Report dismissed');
      setSelectedReport(null);
      loadAllReports();
    }
  };

  /**
   * Get badge color based on severity
   */
  const getSeverityColor = (severity: string | null) => {
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
  const getStatusIcon = (status: string | null) => {
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
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-8 w-8" />
          <h1 className="text-3xl font-bold">System Reports Management</h1>
        </div>
        <p className="text-muted-foreground">Developer view: All reports across the entire system</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{allReports.filter(r => r.status === 'pending').length}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{allReports.filter(r => r.status === 'under_review').length}</div>
            <div className="text-xs text-muted-foreground">Under Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{allReports.filter(r => r.escalated_to_dev).length}</div>
            <div className="text-xs text-muted-foreground">Escalated</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{allReports.filter(r => r.status === 'resolved').length}</div>
            <div className="text-xs text-muted-foreground">Resolved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{allReports.length}</div>
            <div className="text-xs text-muted-foreground">Total Reports</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="under_review">Under Review</TabsTrigger>
          <TabsTrigger value="escalated">Escalated</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="all">All Reports</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Reports ({filteredReports.length})</CardTitle>
              <CardDescription>
                {activeTab === 'all' ? 'All system reports' : `${activeTab.replace('_', ' ')} reports`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : filteredReports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reports in this category</p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {filteredReports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => handleViewReport(report.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedReport?.report.id === report.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted border-border'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {REPORT_CATEGORIES[report.category as keyof typeof REPORT_CATEGORIES]}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {report.reported_user.first_name} {report.reported_user.last_name}
                            </div>
                          </div>
                          <Badge variant={getSeverityColor(report.severity)}>
                            {report.severity}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {getStatusIcon(report.status)}
                          <span>{report.status.replace('_', ' ')}</span>
                          {report.escalated_to_dev && <ArrowUp className="h-3 w-3 text-destructive" />}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(report.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Report Details - Reuse same UI as operator version */}
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
                        {selectedReport.report.escalated_to_dev && (
                          <Badge variant="destructive">ESCALATED</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Submitted {new Date(selectedReport.report.created_at).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Badge variant={getSeverityColor(selectedReport.report.severity)}>
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
                      <br />
                      <span className="text-xs text-muted-foreground">{selectedReport.report.reporter.email}</span>
                    </p>
                  </div>

                  {/* Reported User */}
                  <div>
                    <Label>Reported User</Label>
                    <p className="text-sm mt-1 font-medium">
                      {selectedReport.report.reported_user.first_name} {selectedReport.report.reported_user.last_name}
                      {' '}(#{selectedReport.report.reported_user.system_player_number})
                      <br />
                      <span className="text-xs text-muted-foreground">{selectedReport.report.reported_user.email}</span>
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
                    {selectedReport.updates.map((update) => (
                      <div key={update.id} className="text-sm border-l-2 pl-3 py-1">
                        <div className="font-medium">
                          Status changed: {update.old_status} → {update.new_status}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          By {update.updater.first_name} {update.updater.last_name} ({update.updater_role})
                          {' '}• {new Date(update.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}

                    {/* Actions Taken */}
                    {selectedReport.actions.map((action) => (
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

              {/* Take Action (Developer) */}
              {selectedReport.report.status !== 'resolved' && selectedReport.report.status !== 'dismissed' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Take Action (Developer)</CardTitle>
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
                          <SelectItem value="account_deletion">Account Deletion</SelectItem>
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
                        Minimum 10 characters. Document your decision thoroughly.
                      </p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={handleTakeAction} loadingText="Recording Action">
                        Record Action
                      </Button>
                      <Button variant="outline" onClick={handleResolve} loadingText="Marking Resolved">
                        Mark Resolved
                      </Button>
                      <Button variant="outline" onClick={handleDismiss} loadingText="Dismissing">
                        Dismiss
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
      {ConfirmDialogComponent}
    </div>
  );
}
