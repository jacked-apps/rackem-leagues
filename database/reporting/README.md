# User Reporting System

> **2026-05-13 — `user_reports.sql` archived.** The live schema for the
> `user_reports` table now lives in
> `supabase/migrations/20251130010824_baseline.sql`. The legacy draft was
> moved to `archive/database-reporting-user_reports.sql` for historical
> reference; do not run it against any environment. (Messaging Phase 1 /
> Unit 9 cleanup.)

## Overview

A comprehensive, legally-compliant reporting system for handling user misconduct. Designed with accountability, evidence preservation, and proper escalation workflows.

## Key Features

### 🔒 **Legal Protection**
- **Immutable records** - Reports cannot be deleted, only resolved
- **Complete audit trail** - Every status change and action is logged
- **Evidence preservation** - Automatic snapshots of reported content
- **Chain of custody** - Track who handled what and when

### 📊 **Report Categories**
- **Inappropriate Message** - Offensive or profane content
- **Harassment** - Persistent unwanted contact
- **Fake Account** - Suspected fake/bot accounts
- **Cheating** - Match fixing or score manipulation
- **Poor Sportsmanship** - Unsportsmanlike conduct
- **Impersonation** - Pretending to be someone else
- **Spam** - Repeated unwanted messages
- **Other** - Other violations

### 🔄 **Workflow**
```
Report Created (pending)
     ↓
Operator Reviews (under_review)
     ↓
Action Taken / Escalated to Dev
     ↓
Resolved / Dismissed
```

### 👥 **Access Control**
- **Players:** Can file reports and view their own submissions
- **Operators:** Can view/manage reports for players in their leagues
- **Developers:** Full access to all reports, handle escalations

## Database Schema

### Tables

**user_reports** - Main report records (IMMUTABLE)
- Reporter and reported user
- Category, description, severity
- Evidence snapshot (JSONB)
- Context data (conversation_id, match_id, etc.)
- Status tracking
- Assignment

**report_actions** - Action audit trail
- Warning, suspension, ban records
- Who took action and why
- Suspension durations

**report_updates** - Status change history
- Every status transition logged
- Who made the change and when

## How to Use

### For Players

**Reporting a User:**
1. Click on any player's name (blue link)
2. Select "Report User" from menu
3. Choose category and describe issue
4. Submit - operator will review

**Viewing Your Reports:**
- Settings → My Reports (not implemented yet)
- See status of all reports you've filed

### For Operators

**Reviewing Reports:**
- Operator dashboard → Pending Reports (to be implemented)
- View reports for players in your leagues
- Update status, take action, or escalate

**Actions Available:**
- **Warning** - Verbal/written warning
- **Temporary Suspension** - Ban for X days
- **Permanent Ban** - Permanent removal
- **No Action** - Dismiss report
- **Escalate** - Send to developer

### For Developers

**Full Access:**
- View all reports across all leagues
- Handle escalated cases
- Permanent ban authority
- Account deletion capability

## Security & Privacy

### Reporter Privacy
- Reporter identity kept confidential
- Reported user does not see who filed report
- Only operators/developers see full details

### Evidence Preservation
Reports automatically capture:
- **Messages:** Full message text before deletion/edit
- **Match Data:** Scores, dates, participants
- **User Info:** Account details at time of report
- **Context:** Conversation IDs, match IDs, etc.

All evidence stored in `evidence_snapshot` (JSONB) - immutable.

### Data Retention
- Reports **cannot be deleted**
- Only status changes allowed
- Full history maintained forever
- Complies with legal requirements for record-keeping

## Setup

### 1. Create Tables
```sql
\i reporting/user_reports.sql
```

This creates:
- All enums (report_category, report_status, etc.)
- All tables (user_reports, report_actions, report_updates)
- All indexes
- All RLS policies
- All triggers

### 2. Frontend Integration

The report modal is already integrated in `PlayerNameLink` component:
- Click any player name → "Report User"
- Modal opens with category selection
- Evidence automatically captured

## Code Examples

### Creating a Report (TypeScript)
```typescript
import { createUserReport } from '@/utils/reportingQueries';

// Simple report
await createUserReport(
  reporterId,
  reportedUserId,
  'poor_sportsmanship',
  'Player was verbally abusive during match'
);

// Report with evidence
await createUserReport(
  reporterId,
  reportedUserId,
  'inappropriate_message',
  'Sent offensive message',
  { message_text: 'offensive content here' }, // Evidence
  { conversation_id: 'uuid' } // Context
);
```

### Reporting a Message
```typescript
import { reportMessage } from '@/utils/reportingQueries';

await reportMessage(
  reporterId,
  senderId,
  messageId,
  messageContent, // Original text
  conversationId,
  'Contains threats and profanity'
);
```

### Taking Action (Operator/Dev)
```typescript
import { takeReportAction } from '@/utils/reportingQueries';

// Issue warning
await takeReportAction(
  reportId,
  operatorMemberId,
  'operator',
  'warning',
  'First offense - warned user about conduct'
);

// Temporary suspension
await takeReportAction(
  reportId,
  operatorMemberId,
  'operator',
  'temporary_suspension',
  'Repeated harassment - 7 day suspension',
  new Date('2025-11-01').toISOString() // Suspension end
);
```

## Future Enhancements

### Phase 2
- [ ] Operator dashboard for report management
- [ ] Email notifications for report status changes
- [ ] Bulk action capabilities
- [ ] Report analytics and trends

### Phase 3
- [ ] Auto-detection integration (profanity filter flags)
- [ ] User reputation scoring
- [ ] Appeal process for banned users
- [ ] Report templates for common issues

## Best Practices

### For Writing Good Reports
1. **Be Specific:** Include dates, times, specific examples
2. **Be Factual:** Stick to what happened, not assumptions
3. **Be Complete:** Provide all relevant context
4. **Be Honest:** False reports may result in penalties

### For Handling Reports
1. **Review Evidence:** Check all evidence before deciding
2. **Be Fair:** Consider context and history
3. **Document Actions:** Always explain your decision
4. **Escalate When Needed:** Don't hesitate to escalate serious issues
5. **Follow Up:** Ensure actions are enforced

### For Developers
1. **Respect Privacy:** Only access reports when necessary
2. **Maintain Logs:** Never modify audit trail
3. **Regular Reviews:** Periodic audits of report handling
4. **Training:** Ensure operators understand process

## Legal Compliance

This system is designed to meet basic legal requirements for:
- **Record Retention:** Immutable, permanent records
- **Audit Trail:** Complete history of all actions
- **Privacy Protection:** Reporter confidentiality
- **Due Process:** Evidence preservation for appeals
- **Transparency:** Clear status tracking

⚠️ **Consult Legal Counsel:** This is a starting point. Consult with legal counsel about specific requirements for your jurisdiction and use case.

## Troubleshooting

**"Permission denied" when creating report**
- Check RLS policies are enabled
- Verify user is authenticated
- Confirm reporter_id matches auth.uid()

**Reports not showing for operator**
- Verify operator is assigned to league
- Check reported user is in operator's league
- Ensure season is marked as 'active'

**Can't delete old report**
- By design! Reports are immutable
- Change status to 'dismissed' or 'resolved' instead
- Contact developer if truly necessary

## Questions?

Report system questions should be escalated through:
1. Check this README first
2. Review code comments in `user_reports.sql`
3. Check TypeScript function docs in `reportingQueries.ts`
4. Contact developer team
