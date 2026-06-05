# Management System - Implementation Plan

## 🏢 **System Hierarchy**

```
Organization ( Operator)
└── s (Specific game + night combinations)
    └── Seasons (Time-bound competitions)
        └── Teams (Groups of players)
            └── Players (Individual participants)
```

## 📋 **Detailed Breakdown**

### **1. Organization Level**

- **What**: The operator's entire operation
- **Contains**: All s they're responsible for
- **Examples**: "North Valley Pool", "Metro BCA s", "Smith's Pool Organization"

### **2. Level**

- **What**: Specific game + night + location + format combination that runs continuously
- **Characteristics**:
  - Same game type (8-ball, 9-ball, straight pool, etc.)
  - Same night of the week
  - Same team format (5-man or 8-man)
  - Same general location/venue area
  - Runs season after season with similar teams
- **Examples**:
  - "North Valley 9-Ball Tuesday (5-man format)"
  - "South Valley 9-Ball Tuesday (8-man format)"
  - "Downtown 8-Ball Thursday (5-man format)"
  - "Westside 9-Ball Monday (8-man format)"

### **3. Season Level**

- **What**: Time-bound competition within a
- **Structure**:
  - Set number of regular season weeks
  - 1 championship/playoff week
  - 1 week off between seasons
  - **Preferred Flow**: Week Off → Championship → New Season Start
- **Characteristics**:
  - Teams may vary between seasons (teams can join/leave)
  - Schedule generated based on number of teams
  - Standings tracked throughout season

### **4. Team Level**

- **What**: Group of players competing together
- **Two Team Formats**:

#### **5-Man Team Format**

- **Roster**: 5 players total per team
- **Active Players**: 3 players play on any given night
- **Match Structure**: Double round robin (each player plays each opponent twice)
- **Total Games per Match**: 3 vs 3 = 9 individual games (3×3×2 rounds)

#### **8-Man Team Format**

- **Roster**: 8 players total per team
- **Active Players**: 5 players play on any given night
- **Match Structure**: Single round robin (each player plays each opponent once)
- **Total Games per Match**: 5 vs 5 = 25 individual games (5×5×1 round)

- **Common Characteristics**:
  - Can participate across multiple seasons
  - Roster may change between seasons
  - Team captain manages the team

### **5. Player Level**

- **What**: Individual participants
- **Characteristics**:
  - Can be on multiple teams
  - Can play in multiple s
  - Individual stats and ratings

---

## 🛠️ **Implementation Priority Order**

### **Phase 1: Core Structure**

1. **Organization Management**

   - Create organization profile
   - Basic settings and preferences

2. **League Creation & Management**

   - Create new leagues (game type + night + location + format)
   - Choose handicap system (BCA Standard or Custom 5-man)
   - Edit league details
   - Archive old leagues
   - List all operator's leagues

3. **Season Management**
   - Create new season within a
   - Set season parameters (weeks, start date, etc.)
   - Season scheduling logic
   - Season status (upcoming, active, completed)

### **Phase 2: Team & Player Management**

4. **Team Management**

   - Add teams to seasons
   - Team registration for upcoming seasons
   - Team details and rosters
   - Team history across seasons

5. **Player Management**
   - Player registration system
   - Player profiles and stats
   - Team assignments

### **Phase 3: Scheduling & Competition**

6. **Schedule Generation**

   - Round-robin schedule creation
   - Holiday/break management
   - Venue assignment
   - Schedule publishing

7. **Match Management**
   - Match result entry
   - Standings calculation
   - Individual game tracking

### **Phase 4: Championship & Reporting**

8. **Playoff System**

   - Championship bracket creation
   - Playoff scheduling
   - Finals management

9. **Reporting & Analytics**
   - Season reports
   - Player statistics
   - League performance metrics

10. **Handicap System Education & Tools**
    - Interactive guides for both handicap systems
    - BCA Standard System documentation
    - Custom 5-man System detailed explanation
    - Handicap calculation tools
    - System comparison guide for operators

---

## 🎯 **Key Business Rules**

### ** Continuity**

- Same teams generally continue season after season
- New teams can join, existing teams can leave
- identity (game + night) remains consistent

### **Season Flow**

- Regular season → Championship week → Week off → New season
- Flexible number of teams per season
- Consistent game rules within a

### **Organization Flexibility**

- One operator can run multiple leagues
- Leagues can have different formats/rules
- Geographic separation (North/South Valley)

### **Team Format & Match Structure Rules**

#### **5-Man Team Format**
- **Roster Size**: 5 players total per team
- **Active Players per Night**: 3 players compete
- **Match Structure**: Double round robin
  - Each player plays each opponent **twice**
  - Player A1 vs B1 (Game 1), A1 vs B1 (Game 2)
  - Player A1 vs B2 (Game 1), A1 vs B2 (Game 2), etc.
- **Total Individual Games per Team Match**: 18 games (3 × 3 × 2)
- **Benefits**: Shorter matches, fewer players needed per night

#### **8-Man Team Format**
- **Roster Size**: 8 players total per team
- **Active Players per Night**: 5 players compete
- **Match Structure**: Single round robin
  - Each player plays each opponent **once**
  - Player A1 vs B1, A1 vs B2, A1 vs B3, A1 vs B4, A1 vs B5
- **Total Individual Games per Team Match**: 25 games (5 × 5 × 1)
- **Benefits**: More players get to play, longer matches

#### **Format Consistency Rules**
- **League format cannot change mid-season** (5-man stays 5-man throughout)
- **Format can change between seasons** (league can switch 5-man to 8-man for new season)
- **Mixed formats allowed across different leagues** (Operator can have both types)

### **Handicap Systems**

#### **8-Man Team Format (BCA Standard System)**
- **System Type**: Official BCA handicap system
- **Usage**: Standard across BCA-sanctioned leagues
- **Complexity**: Standard industry approach
- **Management**: Well-documented BCA guidelines

#### **5-Man Team Format (Custom Double Round Robin System)**
- **System Type**: Proprietary handicap system (your creation)
- **Usage**: Optimized specifically for 5-man double round robin format
- **Complexity**: More sophisticated than BCA system
- **Management**: Requires detailed explanation to operators
- **Advantage**: Fine-tuned over years of real-world usage

#### **Handicap System Selection & Implementation**
- **Selection Point**: Operators choose handicap system during league creation
- **System Lock-In**: Handicap system cannot change mid-season (same as team format)
- **Operator Education**: Comprehensive comparison and explanation of both systems
- **Benefits/Drawbacks**: Clear guidance on which system works best for different situations
- **Implementation Needs**:
  - Interactive comparison tool during league creation
  - Detailed documentation for each system
  - Automated calculation tools for both systems
  - "Handicap System 101" education materials

---

## 💾 **Database Schema Implications**

### **Core Tables Needed**

```sql
organizations ( operator's business)
├── s (9-ball Tuesday, 8-ball Thursday, etc.)
│   ├── seasons (Spring 2024, Fall 2024, etc.)
│   │   ├── teams (Team registration for specific season)
│   │   ├── matches (games between teams)
│   │   └── standings (calculated results)
│   └── _settings (rules, format, etc.)
├── players (individual people)
├── team_rosters (players assigned to teams per season)
└── venues (pool halls/locations)
```

---

## 🚀 **Immediate Next Steps**

1. **Start with Creation Wizard** - Most fundamental feature
2. **Build Season Management** - Core operational flow
3. **Add Team Registration** - Essential for getting started
4. **Implement Schedule Generator** - Make it functional

This structure allows operators to:

- Run multiple s simultaneously
- Handle seasonal variations in team participation
- Maintain continuity over time
- Scale operations across different locations/nights

---

_Ready to discuss priorities and implementation details!_
