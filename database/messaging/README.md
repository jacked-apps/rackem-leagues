# Messaging System Database Files

> **2026-05-13 — `user_reports.sql` archived.** The live schema for the
> `user_reports` table now lives in
> `supabase/migrations/20251130010824_baseline.sql`. The legacy draft was
> moved to `archive/database-messaging-user_reports.sql` for historical
> reference; do not run it against any environment. (Messaging Phase 1 /
> Unit 9 cleanup.)

## Quick Start

**For applying latest fixes only:**
```sql
-- Run this single file in Supabase SQL Editor
\i MIGRATION_messaging_fixes.sql
```

**For complete setup (new database):**
```sql
-- Run this single file to set up entire messaging system
\i SETUP_messaging_system.sql
```

## File Organization

### 🚀 **Main Files** (Use These!)

| File | Purpose | When to Use |
|------|---------|-------------|
| `MIGRATION_messaging_fixes.sql` | Apply latest bug fixes | After pulling latest code changes |
| `SETUP_messaging_system.sql` | Complete system setup | New database or full rebuild |

### 📁 **Schema Files** (Individual Components)

These are the building blocks. Usually you don't run these individually:

| File | Description |
|------|-------------|
| `conversations.sql` | Main conversations table |
| `conversation_participants.sql` | Who's in each conversation |
| `messages.sql` | Message content and metadata |
| `blocked_users.sql` | User blocking relationships |
| `message_read_receipts.sql` | Read receipt tracking |

### ⚙️ **Function Files** (Database Logic)

Database functions for conversation management:

| File | Description |
|------|-------------|
| `create_conversation_function.sql` | DM conversation creation |
| `create_group_conversation_function.sql` | Group chat creation |
| `create_announcement_conversation_function.sql` | League announcements |
| `create_organization_announcement_function.sql` | Organization-wide announcements |

### 🗑️ **Legacy/Deprecated** (Don't Use These)

These were individual migration files, now consolidated:

- `fix_dm_conversation_function.sql` → Included in `MIGRATION_messaging_fixes.sql`
- `fix_blocked_users_rls.sql` → Included in `MIGRATION_messaging_fixes.sql`

## What Each Fix Does

### Fix 1: DM Conversation Function
**Problem:** When creating a new DM with someone, a group chat opened instead
**Symptom:** "cool dudes" group appeared when trying to DM a group member
**Fix:** Function now checks for exactly 2 participants (DM only)

### Fix 2: Blocked Users RLS
**Problem:** Blocking failed with "row violates security policy" error
**Symptom:** 403 error when trying to block users
**Fix:** RLS policies now correctly lookup user_id from members table

## Integration with Main Database

The messaging system can be added to `rebuild_all_tables.sql` by:

1. Adding drop statements at the top:
```sql
DROP TABLE IF EXISTS message_read_receipts CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS blocked_users CASCADE;
```

2. Including at the end (before "REBUILD COMPLETE"):
```sql
\i messaging/SETUP_messaging_system.sql
```

## Testing After Setup

1. **Block/Unblock:** Settings → Privacy & Safety → Blocked Users
2. **Direct Messages:** New Message → Select one person
3. **Group Messages:** New Message → Select 2+ people, add group name
4. **Conversation refresh:** Unblock someone, conversation reappears

## Troubleshooting

**If blocking doesn't work:**
```sql
\i MIGRATION_messaging_fixes.sql
```

**If group opens instead of DM:**
```sql
\i MIGRATION_messaging_fixes.sql
```

**For complete reset:**
```sql
\i SETUP_messaging_system.sql
```
