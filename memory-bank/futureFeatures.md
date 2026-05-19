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

### Org Member Affiliation + "Find a League" Discovery + Recruitment Pipeline
**Status**: Future consideration — surfaced 2026-05-17 during messaging announcement-scope discussion

**The gap**: Today the only way a regular player becomes "known" to an organization is by getting rostered on a team in one of its leagues. There's no concept of a player **opting into** an org, **expressing interest**, or even **being discoverable** by an LO who's recruiting. The org sees a roster, the player sees the teams they're on, and that's it.

**Why this blocks other features**:

1. **3-tier announcement scopes** (from earlier discussion above) — org-wide and global tiers depend on a "who's in this org's audience" answer that doesn't exist today.
2. **"Find a League" homepage button** — currently a coming-soon placeholder. To actually work, players need to be able to (a) see what orgs/leagues exist near them and (b) declare "I'm interested" in a way the org can act on.
3. **Player-side classifieds** ("Looking for a Team" from the other future-features section) — needs a place where players can be visible to captains/LOs without being on a roster yet.
4. **Recruitment for LOs** — an LO trying to grow their league has no funnel today; they're entirely dependent on word-of-mouth + existing captains' networks. A real recruitment pipeline could materially help orgs grow, which is a sales/retention story.

**Proposed foundation — `org_member_affiliations` table**:

| field | meaning |
|---|---|
| `member_id` | the player |
| `organization_id` | the org they're affiliated with |
| `status` | `interested` (opted-in but not playing) / `active` (currently rostered) / `inactive` (was rostered, no current team) |
| `joined_at` | when the row was created |
| `auto_added` | true = created automatically by rostering; false = player opted in directly |
| `discoverable` | bool — does the player want LOs to see their profile in recruitment searches? (privacy default: false) |

**How rows get created**:
- **Auto on roster** — getting added to a team auto-creates the row with `status='active'`, `auto_added=true`. Pre-existing rows get upgraded to active.
- **Self-serve via Find-a-League** — player browses orgs, hits "I'm interested" → row created with `status='interested'`, `auto_added=false`, `discoverable=true` by default since they actively expressed interest.
- **LO invite** — LO sends an invite link; player accepts → row created.

**Status transitions**:
- `interested → active` when first rostered
- `active → inactive` when the player has zero current-season rosters in any league belonging to this org
- `inactive → active` when re-rostered

**"Find a League" page (homepage button)**:
- Lists organizations + their leagues, filterable by location, game type, skill level, day of week
- Each org has a public profile page (name, location, leagues, season schedule, contact)
- Player can click "I'm interested" → creates the affiliation row → LO sees them in their recruitment queue
- Optional: messaging hook → "Message the LO" button (uses existing messaging system once the affiliation row gives them a reason to be discoverable)

**LO recruitment side**:
- LO dashboard gets a "Interested players" list showing all `interested` and `discoverable=true` affiliations
- LO can filter/search, reach out via the messaging system
- When the LO rosters them, the status auto-flips to `active`

**Announcement scope tiers this unlocks** (from earlier discussion):
- **Season** (existing) → rostered players in this season only
- **Org-wide** → `org_member_affiliations` where `status='active'`
- **Global** → `org_member_affiliations` where `status IN ('active','interested')` — reaches the interested-but-not-yet-playing pool too. Useful for "we have an open spot, anyone want to join?"

**Open questions**:
- Does an org have a public-facing profile page, or is "Find a League" purely a search interface?
- Privacy default for new affiliations — discoverable or not? (Recommend: opted-in via Find-a-League = discoverable; auto-added via roster = NOT discoverable by default, separate setting)
- Can a player be affiliated with multiple orgs simultaneously? (Likely yes — different leagues, different orgs, normal case)
- Does the LO need approval rights over `interested` affiliations, or is it open?
- How does this interact with existing invite/registration flow — does Find-a-League replace it for new players, or is it an alternate entry point?

**Cost framing**:
- Schema + affiliation lifecycle triggers: ~1 day
- Find-a-League page + org profile page: ~2-3 days
- LO recruitment dashboard: ~1-2 days
- Wiring announcement scope tiers on top of the new data: ~1 day
- Privacy + discoverability settings: ~0.5 day

Realistically a 1–2 week project, but the **payoff is large**: it's the foundation for org-wide announcements, classifieds, recruitment, and the homepage "Find a League" promise. It also makes the platform meaningfully more useful for LOs trying to grow their leagues, which is a real sales/retention argument.

**Why not now**: large scope, touches multiple subsystems (auth/profile, org pages, messaging, recruitment UX). Worth doing properly post-MVP, not bolted on. Ed (2026-05-17): "I have to figure out something too" — open design problem, not ready to build.

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

### Captain Announcement Moderation (per-captain + league-wide)
**Status**: Future consideration — surfaced 2026-05-17 during Phase 1 messaging walkthrough

**Concept**: League Operators need a way to silence captains who abuse the league Announcements channel without disabling announcements entirely for the league.

**Use Case (Ed, 2026-05-17)**: "I'm a league op. The captains' announcements are great, but one captain keeps trying to get a date for his grandma despite warnings. I should be able to block that specific guy, not turn off all captain announcements."

**Two layers (both wanted)**:

1. **Per-captain block** *(primary, surgical)*
   - `can_announce` boolean on the captain's per-league row (defaults to true)
   - LO sees a list of captains in their league with a toggle per captain
   - When flipped off: the "Send Announcement" button in the composer is greyed/hidden for that captain in that league only; tooltip explains why
   - Punishes the abuser, leaves the other captains alone

2. **League-wide kill switch** *(secondary, nuclear)*
   - League-level `captain_announcements_enabled` boolean (defaults true)
   - When off: ALL captains in the league lose the announcement button regardless of per-captain flag
   - For escalation scenarios or if the LO just doesn't want captains broadcasting at all

**Server-side enforcement**: needs to be paired with the project-wide RLS enablement effort (LIST_FOR_ED #29) — UI gate alone is bypassable via API. RLS policy on the announcements-channel insert path should check both flags before allowing the post.

**Cost estimate**: ~2hr for the data layer + LO UI + composer gate. RLS policy adds a bit more.

**Why not now**: Phase 1 messaging is demo-ready; spam moderation isn't a sales-meeting story. Captures real friction discovered during testing.

---

### Player "Looking for a Team" Classifieds
**Status**: Future consideration — surfaced 2026-05-17 during Phase 1 messaging walkthrough

**Concept**: A lightweight classifieds board (NOT a one-to-many announcement) where players can post "I'm available, looking for a team" and captains can post "I have an open spot." Two-way matchmaking.

**Why it's NOT just an announcement**: announcements are broadcasts from one authority figure to a captive audience. Classifieds are structured listings that captains/players actively browse — different mental model, different UI, different data model.

**Minimum viable shape**:
- New `postings` table: `posting_id`, `member_id`, `league_id`, `type` (`seeking_team` | `seeking_player`), `skill_level`, `days_available`, `notes`, `created_at`, `expires_at`, `status` (open/closed/expired)
- Posters fill in a structured form (not free-text) so listings are searchable/filterable
- Per-league board page showing all open postings
- Optional: notify members when a matching new posting appears (e.g., a captain looking for a 6-7 SL player gets pinged when one posts)
- Auto-expire after N days unless renewed

**Use cases**:
- New player joins org, hasn't been picked up by a team yet → posts "seeking_team"
- Captain mid-season loses a player to injury → posts "seeking_player"

**Cost estimate**: real feature, not a tweak. Probably ~1 week including schema, form, list page, basic notifications.

**Why not now**: solid post-MVP feature; not in scope for Phase 1 messaging or the sales meeting demo.

---

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

*This is a living document - add ideas as they come up during development and user feedback sessions.*