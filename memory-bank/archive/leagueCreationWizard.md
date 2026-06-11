# League Creation Wizard Documentation

## Overview

Multi-step wizard for league operators to create new leagues. This wizard guides operators through the essential league setup process with step-by-step validation and clear explanations.

## Wizard Steps

1. **Game Type Selection** (8-ball, 9-ball, 10-ball)
2. **Start Date Selection** (determines day of week)
3. **Season Length** (12-20 weeks or custom)
4. **Custom Season Length** (conditional step - only if custom selected)
5. **BCA National Tournament Scheduling** (found dates, ignore, or custom)
6. **BCA Custom Dates** (conditional step - only if custom selected)
7. **APA Nationals Start Date**
8. **APA Nationals End Date**
9. **Team Format Selection** (5-man vs 8-man teams)
10. **Review & Create**

## Design Philosophy

- **Focus on core league rules** during creation process
- **Venue selection moved** to team registration (more natural workflow)
- **Team format choice determines handicap system** automatically
- **Step-by-step approach** prevents overwhelming operators
- **Clear explanations** of team formats help informed decisions
- **Validation at each step** ensures complete league setup
- **Database operations logged** but not executed (dummy operations for development)

## Integration Points

- **Links from OperatorDashboard** "Create League" buttons
- **Uses operator profile data** for organization details
- **Integrates with VenueCreationWizard** for venue management
- **localStorage persistence** for form data and current step
- **Will eventually integrate** with league management system

## Tournament Scheduling System

### BCA Tournament Integration
- **Automatic database search** when step is reached
- **Dynamic radio button choices** with found dates, ignore option, and custom entry
- **Community verification** with vote counts from other operators
- **Smart URL generation** for current championship dates
- **Conditional navigation** skips custom date step if not needed

### APA Tournament Integration
- Similar pattern to BCA with APA-specific URLs
- Separate start/end date collection
- Tournament conflict avoidance for player retention

## Team Format Explanations

### 5-Man Teams + Custom Handicap
- **Faster matches** (28% shorter than 8-man)
- **Easier to start** (need fewer players)
- **Great for smaller venues**
- **Everyone gets more playing time**
- **Heavy handicapping** for competitive balance
- **Double round robin** format (18 games per match)

### 8-Man Teams + BCA Standard Handicap
- **Standard league format** used widely
- **Established handicap system** with proven balance
- **Larger team rosters** provide flexibility
- **Traditional match structure**
- **Less handicapping dependency**

## State Management

### localStorage Persistence
- **Form data** stored in 'league-creation-wizard'
- **Current step** stored in 'league-wizard-step'
- **Automatic cleanup** on completion or cancellation
- **Graceful fallbacks** if localStorage unavailable

### Conditional Navigation
- **Season length** - skips custom step if standard length chosen
- **BCA tournaments** - skips custom dates if using found dates or ignoring
- **Backward navigation** intelligently handles skipped steps

## Data Flow

### League Name Generation
- **Separate state fields** for dayOfWeek, season, year
- **On-demand generation** for preview display
- **Multiple formatted names** for different contexts
- **Database-ready names** generated at creation time

### Validation System
- **Real-time validation** with error feedback
- **Step-by-step verification** prevents invalid progression
- **Date range validation** for tournament scheduling
- **Required field enforcement**

## Future Enhancements

- **BCA API integration** for live tournament dates
- **Venue management** integration improvements
- **League templates** for common configurations
- **Multi-organization** support
- **Advanced handicap** customization options