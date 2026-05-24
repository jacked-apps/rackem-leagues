# Messaging System Implementation Progress

> ## ⚠️ HISTORICAL DOCUMENT — read the banner before relying on anything below
>
> **Last meaningful update:** 2025-01-19. **Current as of:** Phase 5 (Realtime Features) of *this document's* old plan. This doc has not been kept current with the database baseline migration (`supabase/migrations/20251130010824_baseline.sql`) or the messaging overhaul that started 2026-04-21.
>
> **Current sources of truth (use these, not this doc):**
>
> - **Requirements:** `docs/brainstorms/2026-04-21-messaging-system-overhaul-requirements.md`
> - **Phase 1 implementation plan:** `docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md`
> - **Authoritative schema:** `supabase/migrations/20251130010824_baseline.sql` (the SQL CREATE statements shown below this banner are stale — the live schema differs in column names and constraints)
> - **Findings from review:** `docs/brainstorms/2026-04-21-messaging-system-overhaul-findings.md`
>
> **Phase numbering caveat:** This document uses its own internal "Phase 1–9" numbering for the original messaging build (UI → schema → real data → realtime → user safety → etc.). The 2026-04-21 messaging overhaul uses a *different* "Phase 1–5" numbering for the rebuild (foundations → notifications → match-night chats → social polish → moderation). **The two numbering schemes are unrelated.** When this doc says "Phase 3 (auto-created conversations)" it does NOT mean Phase 3 of the overhaul (match-night chats); it means a piece of work that was deferred in 2025 and is now being picked up as part of overhaul Phase 1.
>
> **Salvageable content** (still useful, cited by the new Phase 1 plan):
>
> - The Phase 3 design notes below (utility names: `createSeasonConversations`, `addCaptainsAndOperators`, `addTeamMembers`; the operator-also-captain dedup guard). The Phase 1 plan reuses these names and the dedup pattern.
>
> **Do NOT rely on this doc for:**
>
> - Current SQL schemas — they're stale; use the baseline migration
> - Current "what's done" status — it's a January 2025 snapshot
> - Phase numbering when discussing the 2026 overhaul

---

## Overview

Building a real-time messaging system for league communications with support for:

- Direct messages (1-on-1)
- Auto-managed group chats (Team Chat, Captain's Chat)
- Season announcements (read-only broadcasts)

---

## System Architecture

### League Structure Understanding

- **Organization** = All encompassing entity for single operator(e.g., "Ed's BCA League")
- **League** = Ongoing entity (e.g., "9-Ball Tuesday")
- **Season** = Time period within league (e.g., "Spring 2025")
- **Team** = Group of players in a specific season

### Conversation Types

#### 1. Direct Messages

- User → User (1-on-1)
- Created manually via "New Message"
- Both can reply

#### 2. Team Chat (Auto-Created)

- All team members can send/receive
- Auto-created when season becomes 'active'
- Auto-managed membership (synced with team_players table)
- Use case: "I'll be late", "need a sub", coordination

#### 3. Captain's Chat (Auto-Created)

- All captains + league operator(s) for a season
- Everyone can reply (back-and-forth discussion)
- Auto-created when season becomes 'active'
- Replaces operator's phone group text
- Use case: Rule questions, scheduling, season coordination

#### 4. Season Announcements (Auto-Created)

- Operator → All current season players
- Read-only for players (cannot reply)
- Auto-created when season becomes 'active'
- Use case: Schedule changes, important league updates

---

## Permission Model (MVP - Phase 1)

### League Operator

- ✅ Send announcements to **current season** (all players)
- ✅ Participate in **Captain's Chat** (back-and-forth)
- ✅ Send direct messages to anyone
- ✅ Create manual group chats

### Team Captain

- ✅ Participate in **Captain's Chat** (back-and-forth)
- ✅ Participate in **Team Chat** (back-and-forth)
- ✅ Send direct messages to anyone

### Regular Player

- ✅ Participate in **Team Chat** (back-and-forth)
- ✅ View **Season Announcements** (read-only)
- ✅ Send direct messages to anyone

### Future Permissions (Phase 8+)

- ❌ Announce to entire organization (all past/current players)
- ❌ Announce to organization current-only
- ❌ Announce to captains-only
- ❌ Cross-league announcements
- ❌ Historical season communications

---

## Message System Rules

### Time Limits (Accountability + Flexibility)

- **Edit window**: 5 minutes after sending (fix typos)
- **Delete window**: 15 minutes after sending (remove mistakes)
- After limits: Message is permanent

### Character Limits

- **Max message length**: 2000 characters (prevents spam walls)

### Group Size Limits

- **Direct messages**: 2 people (by definition)
- **Manual group chats**: 25 people max
- **Auto-managed chats**: No limit (based on team/season size)
- **Announcements**: No limit (can broadcast to entire season)

### Operator Privileges

- ✅ Send season-wide announcements
- ✅ Delete reported messages (after review)
- ✅ Pin important announcements
- ❌ Cannot view all conversations (privacy)
- ❌ Cannot edit other users' messages

---

## Implementation Checklist

### ✅ Phase 1: UI Components (COMPLETED - 2025-01-16)

- [x] **Messages Page** (`/src/pages/Messages.tsx`)

  - Two-column layout
  - Header with "New Message" button
  - Empty state when no conversation selected
  - Route: `/messages`
  - Integrated NewMessageModal

- [x] **ConversationList Component** (`/src/components/messages/ConversationList.tsx`)

  - Search bar for filtering conversations
  - List of conversations with previews, timestamps, unread badges
  - "Announcement" badge for announcement threads
  - Click to select conversation
  - Mock data (3 example conversations)

- [x] **MessageView Component** (`/src/components/messages/MessageView.tsx`)

  - Message bubbles (left = others, right = current user)
  - Sender names and timestamps
  - Text input with send button
  - Enter key to send
  - Auto-scroll to bottom
  - Mock data for conversations

- [x] **NewMessageModal Component** (`/src/components/messages/NewMessageModal.tsx`)

  - Search by name or member number
  - Filter tabs: All | My Leagues | My Teams
  - User list with context badges
  - Click user to start conversation
  - Mock data (5 example users)

- [x] **Navbar Integration** (`/src/navigation/NavBar.tsx`)

  - Envelope icon with unread badge (hardcoded "3")
  - Only visible to approved members

- [x] **Dashboard Integration** (`/src/dashboard/Dashboard.tsx`)

  - Messages card/button linking to `/messages`

- [x] **Routing** (`/src/navigation/NavRoutes.tsx`)

  - Added `/messages` route to memberRoutes

- [x] **TypeScript & Build**
  - Fixed all type errors
  - All builds successful
  - Ready for database integration

---

### ✅ Phase 2: Database Schema (COMPLETED - 2025-01-19)

**Status**: Complete - All tables created with RLS policies and triggers

#### Tables to Create

##### 1. **`conversations` table**

Stores conversation metadata

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Conversation type
  type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'announcement', 'auto_team', 'auto_captains')),

  -- Auto-managed conversations
  auto_managed BOOLEAN DEFAULT false,
  scope TEXT, -- 'team' | 'season_players' | 'season_captains'
  scope_id UUID, -- team_id or season_id

  -- Display info
  title TEXT, -- null for direct messages, required for groups/announcements

  -- Metadata
  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ, -- for sorting conversations

  -- Indexes
  CONSTRAINT valid_auto_managed CHECK (
    (auto_managed = false) OR
    (auto_managed = true AND scope IS NOT NULL AND scope_id IS NOT NULL)
  )
);

CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_scope ON conversations(scope, scope_id) WHERE auto_managed = true;
```

##### 2. **`conversation_participants` table**

Links users to conversations

```sql
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Permissions
  can_reply BOOLEAN DEFAULT true, -- false for announcement recipients
  is_admin BOOLEAN DEFAULT false, -- can manage group (add/remove participants)

  -- Read tracking
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(conversation_id, member_id)
);

CREATE INDEX idx_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_participants_member ON conversation_participants(member_id);
CREATE INDEX idx_participants_unread ON conversation_participants(member_id, last_read_at);
```

##### 3. **`messages` table**

Stores actual messages

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES members(id) ON DELETE SET NULL,

  -- Content
  content TEXT NOT NULL CHECK (LENGTH(content) <= 2000),

  -- Edit tracking
  edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Soft delete (for moderation)
  deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES members(id)
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
```

##### 4. **`blocked_users` table** (Phase 6, but add to schema now)

User blocking/muting

```sql
CREATE TABLE blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Type of block
  type TEXT NOT NULL CHECK (type IN ('block', 'mute')),
  -- block = cannot message, cannot see in search
  -- mute = no notifications, but can still read

  -- Metadata
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX idx_blocked_users_blocker ON blocked_users(blocker_id);
```

##### 5. **`user_reports` table** (Phase 6, but add to schema now)

User reporting for moderation

```sql
CREATE TABLE user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES members(id) ON DELETE SET NULL,

  -- Report details
  reason TEXT NOT NULL CHECK (reason IN ('harassment', 'spam', 'inappropriate', 'abuse', 'other')),
  description TEXT NOT NULL,

  -- Context (what triggered the report)
  context_type TEXT, -- 'message' | 'profile' | 'match'
  context_id UUID, -- message_id, match_id, etc.

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'action_taken', 'dismissed')),
  reviewed_by UUID REFERENCES members(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reports_status ON user_reports(status, created_at DESC);
CREATE INDEX idx_reports_reported ON user_reports(reported_id);
```

#### RLS Policies

**conversations table:**

- Users can see conversations they're participants in
- Users can create direct/group conversations
- Only operators can create announcements

**conversation_participants table:**

- Users can see participants in their conversations
- Conversation admins can add/remove participants

**messages table:**

- Users can see messages from their conversations
- Users can send messages if can_reply = true
- Users can edit their own messages (within 5 min)
- Users can delete their own messages (within 15 min)
- Operators can delete any message (after report review)

**blocked_users table:**

- Users can only see/manage their own blocks

**user_reports table:**

- Users can see their own submitted reports
- Operators can see all reports

#### SQL Files Created

- [x] `/database/messaging/conversations.sql`
- [x] `/database/messaging/conversation_participants.sql`
- [x] `/database/messaging/messages.sql`
- [x] `/database/messaging/blocked_users.sql`
- [x] `/database/messaging/user_reports.sql`
- [x] `/database/messaging/create_conversation_function.sql` - SECURITY DEFINER function for DM creation
- [x] `/database/messaging/messaging_rls_policies.sql` - All RLS policies
- [x] `/database/messaging/enable_realtime.sql` - Realtime publication setup
- [x] Updated `/database/rebuild_all_tables.sql` to include messaging tables

#### Triggers Implemented

- [x] Update `conversations.updated_at` on change
- [x] Update `conversations.last_message_at` when new message inserted
- [x] Update `messages.updated_at` on edit
- [x] Prevent message edit after 5 minutes
- [x] Prevent message delete after 15 minutes
- [x] Increment `unread_count` when message received
- [x] Reset `unread_count` when user reads messages

---

### 📋 Phase 3: Auto-Created Conversations (WAITING ON SEASON WIZARD COMPLETION)

**Status:** Design complete, waiting for season wizard code to be finalized before implementing to avoid conflicts.

**When does auto-creation happen?**

- When season wizard completes and badge changes to "active"
- Triggered automatically (no operator action needed)
- Conversations created silently (no notifications, just exist when users navigate to Messages)

#### Design Decisions (2025-01-19)

**Four Auto-Created Conversation Types:**

1. **Team Chat** (one per team)
   - Scope: `team`, auto_managed: true, type: `team_chat`
   - Participants: All players on the team
   - Permissions: Everyone can send/receive
   - **Message History Rule:** New players only see messages from their join date forward (privacy by default)
   - **Captain Override:** Captain can share older history with specific players via "Share History" button
   - Auto-maintains: Players added/removed as roster changes

2. **Captain's Chat** (one per season/division)
   - Scope: `season`, auto_managed: true, type: `captains_chat`
   - Participants: All team captains + league operator
   - **Guard against duplicates:** If operator is also a captain, don't add twice
   - Permissions: Everyone can send/receive (back-and-forth discussion)
   - Use case: Rule questions, scheduling, coordination

3. **Season/Division Announcements** (one per season/division)
   - Scope: `season`, auto_managed: true, type: `announcements`
   - Participants: All players in this season/division (ACTIVE players only)
   - Permissions: Only operator can write, all players read-only
   - Auto-maintains: Players added/removed as rosters change
   - Use case: Schedule changes, important league updates

4. **Organization Announcements** (one per organization)
   - Scope: `organization`, auto_managed: true, type: `announcements`
   - Participants: All players in ALL ACTIVE seasons in organization
   - **Excludes past players** (they can be messaged separately via manual operator action in future)
   - Permissions: Only operator can write, all players read-only
   - Use case: Organization-wide announcements

#### Database Schema Changes Needed

Add to `conversation_participants` table:
- `history_visible_from TIMESTAMPTZ` - Controls how far back player can see messages
- Default: Set to `joined_at` for new participants
- Captain can update to earlier date to share history

#### Implementation Tasks

- [ ] Add `history_visible_from` column to `conversation_participants`
- [ ] Create utility: `createSeasonConversations(seasonId, organizationId, operatorId)`
- [ ] Create utility: `createOrganizationAnnouncements(organizationId, operatorId)` (if not exists)
- [ ] Create utility: `addParticipantsFromSeason(conversationId, seasonId, canReply)`
- [ ] Create utility: `addCaptainsAndOperators(conversationId, seasonId)` with duplicate guard
- [ ] Create utility: `addTeamMembers(conversationId, teamId)`
- [ ] Database trigger: Auto-add/remove players when `team_players` changes
- [ ] Hook into season wizard "activate" flow (WAIT FOR WIZARD COMPLETION)
- [ ] Captain UI: "Share History" button in team chat settings
- [ ] Update `fetchConversationMessages()` to respect `history_visible_from`

---

### ✅ Phase 4: Real Data Integration (COMPLETED - 2025-01-19)

#### Message Queries Utility (`/src/utils/messageQueries.ts`)

- [x] **fetchUserConversations(memberId)**

  - Get all conversations user is participant in
  - Include last message preview
  - Include unread count
  - Sort by last_message_at DESC
  - Fetch other participant's name for DMs

- [x] **fetchConversationMessages(conversationId)**

  - Get messages for conversation
  - Include sender details (name, member number)
  - Order by created_at ASC (chronological)
  - Only return non-deleted messages

- [x] **createOrOpenConversation(memberId1, memberId2)**

  - Uses database function `create_dm_conversation` (SECURITY DEFINER)
  - Checks if direct conversation already exists
  - Returns existing or creates new conversation
  - Automatically adds both participants

- [x] **sendMessage(conversationId, senderId, content)**

  - Insert message
  - Validates content length (2000 char limit)
  - Triggers automatically update conversation metadata
  - Triggers automatically increment unread counts

- [x] **updateLastRead(conversationId, memberId)**

  - Update conversation_participants.last_read_at = now()
  - Triggers automatically reset unread_count to 0

#### Component Updates

- [x] Replaced mock data in ConversationList with real queries
- [x] Replaced mock data in MessageView with real queries
- [x] Replaced mock data in NewMessageModal with real queries
- [x] Added loading states for all queries
- [x] Created `useConversationParticipants` hook for recipient data
- [x] Added error handling for failed queries

---

### ✅ Phase 5: Realtime Features (COMPLETED - 2025-01-19)

#### Enable Realtime on Tables

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
```

- [x] Created `/database/messaging/enable_realtime.sql`
- [x] Tables added to realtime publication
- [x] Fixed JWT token authentication for realtime WebSocket connection

#### Realtime Subscriptions

- [x] **Subscribe to new messages** (MessageView)

  - Listen for INSERT on messages table
  - Filter by conversation_id
  - Fetch complete message with sender info
  - Append to message list when received
  - Auto-scroll to bottom
  - Auto-mark as read when viewing

- [x] **Subscribe to conversation updates** (ConversationList)

  - Listen for INSERT on messages table (all conversations)
  - Reload conversations to get updated preview and timestamp
  - Conversation list re-sorts automatically

- [x] **Dynamic unread counts** (ConversationList)

  - Listen for UPDATE on conversation_participants
  - Filter by current user_id
  - Reload conversations to get updated unread badges
  - Database triggers handle increment/reset logic

- [x] **Read receipts** (useConversationParticipants hook)

  - Listen for UPDATE on conversation_participants
  - Update recipient's last_read_at in real-time
  - MessageBubble shows ✓ (sent) or ✓✓ (read)

- [ ] **Typing indicators** (Future - Phase 9)
  - Use Realtime Presence API
  - Show "{User} is typing..." when composing

#### Implementation

```typescript
// Example: Subscribe to messages
useEffect(() => {
  const channel = supabase
    .channel(`conversation-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      }
    )
    .subscribe();

  return () => channel.unsubscribe();
}, [conversationId]);
```

---

### 🎨 Phase 6: User Interactions & Safety (TODO)

#### PlayerNameLink Component

- [ ] **Create Component** (`/src/components/PlayerNameLink.tsx`)

  - Wraps any player name display
  - Shows as clickable text
  - Hover/click opens popover menu:
    - "View Profile"
    - "Send Message"
    - "Report User"
    - "Block User" (if not already blocked)
  - Uses shadcn Popover component

- [ ] **Replace all player name displays**
  - Team rosters
  - Match results
  - League standings
  - Message sender names
  - EXCEPT: dropdowns, inputs, form fields

#### Block/Mute Implementation

- [ ] Create block/mute UI in popover
- [ ] Create utility functions:
  - `blockUser(blockerId, blockedId)`
  - `muteUser(muterId, mutedId)`
  - `unblockUser(blockerId, blockedId)`
  - `getBlockedUsers(userId)`
- [ ] Filter blocked users from:
  - New message search
  - Conversation participants
  - Message visibility
- [ ] Settings page: Manage blocked/muted users

#### Report User System

- [ ] Create report modal component
- [ ] Create utility: `reportUser(reporterId, reportedId, reason, description, contextId)`
- [ ] Operator dashboard: View all reports
- [ ] Operator actions: Review, dismiss, take action
- [ ] Auto-hide messages from users with 3+ pending reports

---

### 🎯 Phase 7: Quick-Create Shortcuts (TODO)

#### Operator Shortcuts (in Season Dashboard)

- [ ] **"Announce to Season" button**

  - Opens modal showing: "24 players will receive this"
  - Text input for announcement
  - Send → Creates announcement conversation
  - Auto-adds all season participants (can_reply = false)

- [ ] **"Open Captain's Chat" button**
  - Opens existing auto-created captain's chat
  - If doesn't exist, create it

#### Captain Shortcuts (in Team Page)

- [ ] **"Open Team Chat" button**
  - Opens existing auto-created team chat
  - If doesn't exist, create it

#### Implementation

- [ ] Add buttons to Season Dashboard (operator view)
- [ ] Add button to Team page (captain view)
- [ ] Create modal for quick announcements
- [ ] Create utility: `sendQuickAnnouncement(scope, scopeId, content)`

---

### 🔧 Phase 8: Performance & Polish (TODO)

- [ ] **Performance**

  - Pagination for message history (load older messages)
  - Virtual scrolling for long conversations
  - Debounce search input
  - Add database indexes for common queries

- [ ] **Error Handling**

  - Network error recovery
  - Failed message retry with visual indicator
  - Connection status indicator
  - Graceful degradation if Realtime fails

- [ ] **Accessibility**

  - Keyboard navigation (arrow keys, enter)
  - Screen reader support (ARIA labels)
  - Focus management in modals
  - High contrast mode support

- [ ] **Mobile Responsiveness**
  - Stack layout on mobile (list OR messages view, not both)
  - Swipe gestures (optional)
  - Touch-friendly tap targets (44px minimum)

---

### 🚀 Phase 9: Future Enhancements (Backlog)

- [ ] Message reactions (👍, ❤️, 😂)
- [ ] File/image attachments
- [ ] Voice messages
- [ ] Message threading/replies
- [ ] GIF support
- [ ] Message search within conversations
- [ ] Pinned messages
- [ ] @Mentions with notifications
- [ ] Message forwarding
- [ ] Organization-wide announcements (all past players)
- [ ] Captain-only announcements
- [ ] Multi-league operator permissions
- [ ] Historical season communications

---

## Game Plan: Step-by-Step Implementation

### Week 1: Database Foundation

**Goal**: Get data storage working

1. ✅ Create tracking document (this file)
2. ⏭️ Create SQL files for all 5 tables
3. ⏭️ Add RLS policies to each table
4. ⏭️ Add triggers for auto-updates
5. ⏭️ Update `rebuild_all_tables.sql`
6. ⏭️ Run migrations on local Supabase
7. ⏭️ Test with manual SQL inserts

**Deliverable**: Database ready to store messages

---

### Week 2: Core Messaging

**Goal**: Send/receive direct messages

1. ⏭️ Create `messageQueries.ts` utility file
2. ⏭️ Implement `fetchUserConversations()`
3. ⏭️ Implement `fetchConversationMessages()`
4. ⏭️ Implement `sendMessage()`
5. ⏭️ Replace mock data in ConversationList
6. ⏭️ Replace mock data in MessageView
7. ⏭️ Test: Send message between two users

**Deliverable**: Can send/receive direct messages

---

### Week 3: User Search & Conversation Creation

**Goal**: Start new conversations

1. ⏭️ Implement `fetchUsersForNewMessage()`
2. ⏭️ Implement `createOrOpenConversation()`
3. ⏭️ Replace mock data in NewMessageModal
4. ⏭️ Wire up "New Message" → Select user → Open conversation
5. ⏭️ Test: Start conversation with search

**Deliverable**: Can search for users and start conversations

---

### Week 4: Realtime Updates

**Goal**: Messages appear instantly

1. ⏭️ Enable Realtime on tables (SQL)
2. ⏭️ Subscribe to new messages in MessageView
3. ⏭️ Subscribe to conversation updates in ConversationList
4. ⏭️ Implement dynamic unread counts
5. ⏭️ Update navbar badge in real-time
6. ⏭️ Test: Two browser windows, send message, see it appear

**Deliverable**: Real-time messaging works

---

### Week 5: Auto-Created Conversations

**Goal**: Team chats and announcements auto-create

1. ⏭️ Create `createSeasonConversations()` utility
2. ⏭️ Create helper functions for adding participants
3. ⏭️ Hook into season activation flow
4. ⏭️ Test: Activate season → chats auto-create
5. ⏭️ Handle team roster changes (auto add/remove)

**Deliverable**: Chats auto-created when season starts

---

### Week 6: Quick-Create Shortcuts

**Goal**: Easy announcement sending

1. ⏭️ Add "Announce to Season" button (operator dashboard)
2. ⏭️ Add "Open Captain's Chat" button (operator dashboard)
3. ⏭️ Add "Open Team Chat" button (team page)
4. ⏭️ Create quick announcement modal
5. ⏭️ Test: Send season announcement

**Deliverable**: Operators can easily send announcements

---

### Week 7: User Safety Features

**Goal**: Block, mute, report users

1. ⏭️ Create PlayerNameLink component
2. ⏭️ Implement block/mute functionality
3. ⏭️ Implement report user system
4. ⏭️ Create operator report review dashboard
5. ⏭️ Filter blocked users from search/messages

**Deliverable**: Users can block/report, operators can moderate

---

### Week 8: Polish & Testing

**Goal**: Production-ready

1. ⏭️ Add message edit/delete (with time limits)
2. ⏭️ Add loading states everywhere
3. ⏭️ Add error handling
4. ⏭️ Test all user flows end-to-end
5. ⏭️ Fix bugs
6. ⏭️ Mobile responsiveness
7. ⏭️ Performance optimization

**Deliverable**: Messaging system ready for users!

---

## Current Status

**Phase**: 5 (Realtime Features) - COMPLETED ✅
**Next Phase**: 3 (Auto-Created Conversations) or 6 (User Interactions & Safety)
**Last Updated**: 2025-01-19

**What we have:**

- ✅ Complete UI components
- ✅ Database schema with RLS policies and triggers
- ✅ Real data queries for direct messages
- ✅ **Full realtime messaging** (messages, read receipts, unread badges)
- ✅ Message send/receive working end-to-end
- ✅ User search and conversation creation
- ✅ Routing and navigation

**What's working:**

- ✅ Direct messages (1-on-1) with realtime updates
- ✅ Conversation list with search
- ✅ Message history with sender info
- ✅ Unread count badges (realtime)
- ✅ Read receipts ✓/✓✓ (realtime)
- ✅ New message modal with user search

**What's next (choose one):**

1. **Phase 3: Auto-Created Conversations** - Team chats, Captain's chat, Announcements
2. **Phase 6: User Interactions & Safety** - Block/mute/report users
3. **Phase 7: Quick-Create Shortcuts** - Operator announcement buttons

---

## Technical Notes

### Realtime Capabilities

- **Free Tier**: 200 concurrent connections, 2GB monthly bandwidth
- **Setup**: Add tables to supabase_realtime publication
- **Usage**: Subscribe to INSERT/UPDATE/DELETE events
- **Cleanup**: Always unsubscribe when component unmounts

### Component Architecture

- Messages page = container component
- ConversationList, MessageView, NewMessageModal = presentational
- All components use shadcn/ui
- Mock data at top of files for easy replacement

### File Locations

- **Pages**: `/src/pages/Messages.tsx`
- **Components**: `/src/components/messages/`
- **Utilities**: `/src/utils/messageQueries.ts` (to be created)
- **Database**: `/database/` (SQL files to be created)

---

## Resources

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Supabase RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/sql-createtrigger.html)
