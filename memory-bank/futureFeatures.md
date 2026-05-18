# Future Features & Enhancement Ideas

This document captures aspirational features that would enhance the app's desirability and user engagement. These are not core functionality but ideas that could differentiate the platform and make it more compelling.

## Social & Community Features

### In-App Messaging System (Required for Contact Privacy)
**Status**: Needed for MVP - supports "in_app_only" contact visibility

**Core Requirements**:
- Basic one-to-one messaging between users
- Group messaging (operator to all teams, captain to team members, etc.)
- Message threading/conversations
- Notification system (in-app and email notification of new messages)
- Simple, no-frills design

**Use Cases**:
- Operator with "in_app_only" email/phone → players can message them through app
- Captain can message entire team
- Operator can broadcast message to all teams in a league
- Players can contact each other without sharing personal contact info

**Technical Needs**:
- `messages` table (id, sender_id, recipient_id, content, thread_id, timestamps)
- `message_threads` table (id, participants[], last_message_at)
- `group_messages` table (id, sender_id, group_type, group_id, content)
- Message read/unread status tracking
- Push notification integration

**Note**: This is **essential infrastructure**, not a "nice to have". Without it, operators who choose "in_app_only" visibility cannot be contacted.

### Player Stats & Achievements
- Personal skill progression tracking
- Achievement badges and milestones
- Historical match performance analytics
- Skill rating evolution over time

### Community Engagement (Future - Beyond Messaging)
- League discussion boards/forums
- Photo sharing from matches and tournaments
- Player spotlights and featured stories
- Social media-style activity feeds

## Gamification & Engagement

### Rewards System
- Points for participation, improvement, wins
- Seasonal challenges and competitions
- Loyalty rewards for consistent participation
- Special recognition for league volunteers

### Interactive Features
- Live match scoring with real-time updates
- Match prediction games and brackets
- Player of the month voting
- Tournament bracket predictions

## Enhanced User Experience

### Mobile App Features
- Push notifications for match schedules
- Quick check-in at venues
- Mobile-optimized scorekeeping
- Offline capability for basic functions

### Venue Integration
- Table availability checking
- Venue photos and amenities info
- Integrated directions and parking info
- Happy hour and special event notifications

## Analytics & Insights

### Advanced Operator Statistics Dashboard
**Status**: Nice to have - comprehensive stats beyond Quick Stats

**Detailed Metrics**:
- **Overall Stats**:
  - Total weeks played (all leagues/seasons combined)
  - Total matches played (2 teams playing = 1 match)
  - Total games played (individual games within matches)
  - Average matches per week
  - Average players per league
  - Average teams per league
- **Game Type Breakdown**:
  - Separate stats for 8-Ball, 9-Ball, 10-Ball
  - Games played per type
  - Teams per type
  - Most popular game type
- **Format Analysis**:
  - 5-Man vs 8-Man breakdown
  - Teams using each format
  - Seasons completed per format
- **Engagement Metrics**:
  - Player retention rate (season to season)
  - Average attendance per match night
  - Most active venues
  - Peak playing times/days
- **Historical Trends**:
  - League growth over time
  - Player base expansion
  - Seasonal patterns

**Implementation Ideas**:
- Separate "Statistics" page with detailed charts
- Expandable sections for different stat categories
- Date range filters (this season, all time, custom range)
- Export to CSV for offline analysis
- Visual charts/graphs for trends

### Personal Analytics (for Players)
- Playing pattern analysis (best days/times)
- Opponent matchup statistics
- Improvement trend tracking
- Performance heatmaps by venue

### League Insights (for Operators)
- League health and engagement metrics
- Popular playing times and venues
- Player retention analytics
- Revenue and participation trends

## Premium Features (Potential Revenue)

### Enhanced Profiles
- Custom profile themes and badges
- Extended match history
- Advanced statistics and analytics
- Priority customer support

### Advanced Tools
- Tournament bracket generation
- Custom league formats and rules
- Advanced scheduling algorithms
- Detailed financial reporting

## AI-Powered Features

### **🎯 AI Shot Referee System** ⭐ *Breakthrough Feature*
- **In-App Video Recording**: Capture disputed shots directly in the app
- **AI Analysis**: Submit video to AI model (Gemini/GPT-4V/Claude) for shot analysis
- **Instant Rulings**: Get immediate foul/legal shot determination with explanation
- **Shot Replay**: Frame-by-frame analysis with AI annotations
- **Dispute Resolution**: Digital referee for league matches
- **Learning Tool**: Players can practice and get instant feedback on technique

**Technical Implementation**:
- React Native camera integration for mobile recording
- Video compression and upload to cloud storage
- AI API integration (Google Gemini, OpenAI GPT-4V, or Anthropic Claude)
- Real-time processing with loading states
- Structured response parsing for consistent rulings

**Business Impact**:
- **Massive Differentiator**: No other pool app has this capability
- **Viral Marketing Potential**: Players will share amazing AI calls on social media
- **Professional Credibility**: Elevates casual leagues to semi-professional level
- **Revenue Stream**: Premium feature or pay-per-analysis model

## League Operator Management Features

### Assistant Operators System
**Status**: Future consideration - not yet designed

**Concept**: Allow main operators to delegate certain administrative tasks to trusted assistants

**Key Requirements** (to be determined):
- Main operator can assign assistant operators to help manage their leagues
- Assistant permissions system (what they CAN do vs what they CAN'T do)
- Main operator retains full control and payment responsibility
- Clear permission boundaries and audit trail

**Open Questions**:
- Can an assistant work for multiple main operators?
- What specific permissions should assistants have?
  - Enter match scores?
  - Approve team registrations?
  - Edit schedules?
  - View financial reports?
  - Communicate with players?
- What should assistants NOT be able to do?
  - Create new leagues?
  - Handle payments?
  - Delete leagues/seasons?
  - Remove teams?
- Does main operator grant individual permissions, or do all assistants have same fixed permissions?
- How is assistant access revoked?

**Note**: This feature should be designed after core league management is working. May require role-based access control (RBAC) system and permission framework.

## Scheduling Resources

### Team Matchup Schedules
**Resource**: bowl.com/league-schedules

This website provides perfect team scheduling PDFs for leagues ranging from 4 teams to 48 teams. These pre-made round-robin schedules handle team matchup rotations properly.

**Status**: Not yet implemented - resource saved for when we build team matchup scheduling system

**Use Case**: When generating league schedules, we'll need to determine which teams play each other each week. Rather than building complex scheduling algorithms, we can reference these proven schedules.

## Integration Opportunities

### Third-Party Services
- Calendar app integration (Google, Apple, Outlook)
- Social media sharing automation
- Streaming integration for featured matches
- Payment processing for dues and entry fees

### AI & Machine Learning Services
- Computer vision APIs for shot analysis
- Natural language processing for rule explanations
- Machine learning for improving shot detection accuracy
- Video processing and frame extraction services

### Hardware Integration
- QR code check-ins at venues
- Digital scoreboards integration
- Smart table sensors (future tech)
- Wearable device integration for activity tracking

## Notes for Consideration

- **User Research Needed**: Many features would benefit from user feedback and usage data
- **Monetization Potential**: Some features could support premium tiers or sponsorship
- **Technical Complexity**: Features range from simple additions to major architectural changes
- **Market Differentiation**: Focus on features that competitors don't offer well

---

## UX & Component Ideas

### Click-a-disabled-button to see why it's disabled
**Status**: Idea — not yet scoped

**Concept**:
Today we pair disabled buttons with a separate InfoButton (`?`) that explains
the reason. Idea: wrap the disabled-button pattern so that clicking (or tapping)
the disabled button itself pops the same InfoButton explanation. Users wouldn't
need to discover the `?`; the obvious action (pressing the button) teaches them
why it's off.

**Sketch**:
- Probably belongs as an option on the shared `Button` component — `<Button disabledReason="Create a season first" ...>`.
- When `disabledReason` is set and the button is disabled: render with `aria-disabled="true"` (not `disabled`) so it still receives pointer events, then show the InfoButton popup on click.
- Keep the current `?` alongside pattern as a fallback for keyboard / screen-reader discoverability.

**Why it's nice**:
- Disabled buttons are often the most frustrating UI state — "I can't click this and I don't know why." This closes that loop with zero extra UI when the button is enabled.
- Uses the existing InfoButton popup — nothing new for users to learn.

**Not doing now** because the current pattern works; flagged by Ed as a future polish item.

---

## Editable league + season names

Today both the league name (game_type + day_of_week + division + season + year) and the season name (same formula) are derived automatically by `generateSeasonName` and the league-name helpers. The operator can't override them — which means a league/season that needs a custom marketing name ("The Big Dawg Tour", "Wednesday Night Massacre") can't get one without touching SQL.

**Sketch**:
- League settings page → inline editable "League name" field that overrides the derived name. Stored as a nullable column on `leagues` (e.g. `display_name TEXT`); falls back to the generator when null.
- Same pattern on the season detail / season settings page → `seasons.display_name`.
- All display surfaces (league cards, schedule headers, standings, breadcrumbs, wizard summaries) read through a `getDisplayName(league)` / `getDisplayName(season)` helper that prefers the override.
- Wizard "review" step previews the derived name + offers an inline "edit" affordance before commit, so the LO can rename at creation time too.

**Why it's nice**:
- Many real-world leagues have nicknames that don't match the derived schema. Forcing the derived name everywhere is "engineer-correct, operator-wrong."
- Cheap once the column + helper are in place — every display site already reads through the same path.

**Not doing now** — flagged by Ed 2026-05-20 during the next-season wizard test pass while the wizard summary was showing the derived season name. Pending wizard testing wrap-up + the more pressing payout-calculator + finances work.

---

*This is a living document - add ideas as they come up during development and user feedback sessions.*