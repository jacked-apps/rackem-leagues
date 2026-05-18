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

### Modular / Customizable Scoreboard
**Status**: Dreamy — probably not, but maaaayyybeee. Flagged 2026-05-18.

**Concept**:
The Points System Decomposition (Unit 5 of the modular Scoring System migration, see `docs/brainstorms/2026-05-18-points-system-decomposition-requirements.md`) locked in a "single-mechanism-for-everything" principle: every value the system tracks (chart targets, initial points, milestone jumps, win signals, per-match running totals, chips, flags, etc.) gets assigned via the SAME trigger machinery into a unified named-variable namespace. As a downstream consequence, the scoreboard becomes a READER of variables, not a special-cased renderer with its own data path.

**What this would enable**:
- **Default scoreboard**: shows a sensible variable subset (`home_points`, `away_points`, `homeWinTarget`, `awayWinTarget`, etc.) — what 95% of leagues want, hand-curated.
- **Custom scoreboards by LO**: pick ANY subset of available variables, in any layout. Want to show all 6 chart values (home/away × win/tie/lose)? Pull from variables that already exist. Want to surface `endgame_chip` mid-match? It's a variable. Want a "milestone proximity" indicator using whatever the milestone trigger assigned? It's a variable.
- **New scoring features automatically become displayable**: add a new threshold, a new trigger, a new variable — scoreboards can render it without any scoreboard code changes.
- **No drift possible**: what the scoreboard shows IS the operational value, by construction. Not a parallel computation that might disagree as the system evolves.

**What's missing for this to be real**:
- **Variable display metadata** — labels, format hints, role hints (e.g., "this is a points total", "this is a chip state", "this is a target the team is racing to"). Same `displayHints` concept the existing per-game calculators use; would extend to variable-level rather than calculator-param-level.
- **A scoreboard composition UI** — LO-facing wizard for picking + arranging variables. Several tiers of complexity (drag-and-drop layout editor; template gallery; etc.).
- **Variable namespace stability** — once LOs configure custom scoreboards referencing variables by name, renaming variables becomes a breaking change. Needs care.

**Why it's dreamy**:
- Real upside for power-user LOs who want to differentiate their leagues with custom presentation.
- Architecturally for free (the foundation is already built once Unit 5 lands).
- The wizard UI work is non-trivial — would be its own multi-week effort.

**Why it might be "probably not"**:
- 95% of leagues are perfectly served by a well-curated default scoreboard.
- The "configure your own scoreboard" feature appeals to a niche.
- LO-facing customization adds support burden (debugging "why doesn't my scoreboard show X?" queries).

**Not doing now** — Phase A of Unit 5 just lays the foundation. If the appetite materializes after the modular Scoring System ships and a few LOs ask for custom presentations, this becomes a tractable next-tier project. Until then, flagged as a happy capability we got for free architecturally.

---

*This is a living document - add ideas as they come up during development and user feedback sessions.*