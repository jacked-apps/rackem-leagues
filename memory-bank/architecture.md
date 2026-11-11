# Architecture & Technical Context

## System Architecture

### Core Infrastructure
- **Memory Bank**: Interconnected Markdown files providing project context
- **Supabase**: Authentication, session management, and database operations
- **React Router**: Navigation with protected routes and programmatic routing
- **TypeScript**: Strict type safety across all components and utilities

### Component Architecture
- **UserContext & UserProvider**: Centralized authentication state management
- **useUserProfile**: Hook for member data management with role checking
- **Custom Hooks**: Reusable logic for form handling and data fetching
- **Component Composition**: LoginCard wrapper for consistent auth UI

## Key Technical Decisions

### **Package Management**
- **pnpm**: Exclusive package manager (not npm) for all operations
- **shadcn Integration**: `pnpm dlx shadcn@latest add <component-name>`
- **Dev Server**: `pnpm run dev` for development

### **Development Patterns**
- **Named Exports**: Preferred over default exports for consistency
- **Utility-First Architecture**: Business logic in pure functions for testing
- **Component Standards**: Start with bare shadcn components before custom styling
- **Database Simulation**: Console.log operations for partner integration
- **Type Centralization**: All reusable TypeScript types stored in `src/types/` folder
  - **NEVER** use `any` type - always define proper interfaces
  - Types organized by domain (member.ts, league.ts, venue.ts, tournament.ts)
  - Single source of truth for data structures across entire codebase
  - Import from `@/types` for convenience: `import type { Member, League } from '@/types';`
  - Update centralized type once, changes propagate everywhere
  - Better IntelliSense, type safety, and documentation
- **Info Content Centralization**: All info button content stored in `src/constants/infoContent/` folder
  - **NEVER** hardcode lengthy explanations or info content directly in components
  - Content organized by feature area in separate files (`profileInfoContent.tsx`, `leagueWizardInfoContent.tsx`, etc.)
  - Each info object exports `title` and `content` (or multiple content variants)
  - Content can be React elements for rich formatting (lists, bold, links, etc.)
  - Single source of truth - reusable across multiple components
  - Keeps components clean and maintainable

### **Validation & Data Management**
- **Zod Schemas**: TypeScript-first validation in src/schemas/ directory
- **Real-time Validation**: Form validation with error feedback and save blocking
- **Data Formatting**: Consistent formatting using utility functions (capitalizeWords)
- **Change Detection**: Only modified fields logged for efficient updates

## Design Patterns

### **Edit System Pattern**
Consistent UI flow across all editable components:
1. Edit icon indicates editable sections
2. Click reveals form fields with validation
3. Save/cancel buttons for user control
4. Real-time error feedback during editing
5. Success popup with before/after change details

### **Status System Pattern**
Color-coded visual indicators for business states:
- **Green**: Current/paid status
- **Red**: Overdue/problem status
- **Yellow**: Warning/never paid status
- Utility functions return CSS classes based on business logic

### **Database Integration Pattern**
- UI provides full functionality with user feedback
- Console.log shows exact SQL queries and parameters needed
- Partner team handles actual database operations
- Consistent error handling and success states

## Technologies Used

### **Frontend Stack**
- **React**: Component-based UI with hooks and context
- **TypeScript**: Type safety and enhanced development experience
- **Tailwind CSS v4**: Utility-first styling with @tailwindcss/vite integration
- **shadcn/ui**: Accessible components (Button, Input, Label, Card, Select)
- **Radix UI**: Underlying primitives for accessibility compliance
- **Lucide React**: Consistent iconography throughout application

### **Data & Validation**
- **Zod**: Schema validation with TypeScript integration
- **Custom Utilities**: membershipUtils.ts for business logic calculations
- **Form Management**: useReducer for complex form state
- **Real-time Formatting**: Phone numbers, text fields with live transformation

### **Infrastructure**
- **Supabase**: Authentication and database backend
- **React Router DOM**: Client-side routing with protection
- **Vite**: Build tool with environment variable support
- **class-variance-authority & clsx**: Conditional CSS class management

## Component Relationships

### **Authentication Flow**
```
UserProvider → UserContext → useUser hook → Components
Supabase ← → UserContext (session management)
Login/Register → UserContext (state updates)
Protected Routes → UserContext (access control)
```

### **Profile System Flow**
```
Profile Component → useUserProfile hook → Member data
Profile Sections → Edit Components → Validation Schemas
membershipUtils → Status calculations → UI styling
Edit Forms → Console.log → Database operation simulation
```

### **League Creation Wizard Flow**
```
LeagueCreationWizard → WizardStep[] definitions
WizardStep → QuestionStep | RadioChoiceStep (based on type)
RadioChoiceStep → SimpleRadioChoice → InfoButton
QuestionStep → Calendar | Input field → InfoButton
Tournament Steps → tournamentUtils → Dynamic URL generation
Database Search → useEffect trigger → foundTournamentDates state
```

### **Tournament Scheduling Flow**
```
BCA/APA Step Reached → useEffect triggers database search
Database Query → Mock tournament dates with vote counts
FoundTournamentDates → Dynamic radio button choices
User Selection → Found dates | Ignore | Custom entry
FormData Update → Tournament start/end dates
Subtitle JSX → Clickable link to official tournament website
```

### **Navigation Architecture**
```
App.tsx → NavBar + NavRoutes
NavRoutes → Array-based route generation
  ├─→ publicRoutes[] → map to <Route> (10 routes)
  ├─→ authRoutes[] → map to <ProtectedRoute requireAuth> (3 routes)
  ├─→ memberRoutes[] → map to <ProtectedRoute requireApprovedApplication> (2 routes)
  └─→ operatorRoutes[] → map to <ProtectedRoute requiredRole="league_operator"> (4 routes)
NavBar → Conditional links based on auth status
Dashboard ← → Profile (action vs information separation)
```

## Technical Constraints

### **Responsive Design**
- Mobile-first approach with grid layouts
- Breakpoint adaptation for all components
- Consistent spacing and typography scales

### **Type Safety**
- Strict TypeScript configuration
- Interface definitions for all data structures
- Type-safe form validation with Zod integration

### **Business Logic Separation**
- Pure utility functions for calculations
- Testable business logic in dedicated files
- Clear separation from UI components

### **Future Integration Ready**
- BCA API integration structure prepared
- League/tournament feature architecture planned
- Database schema evolution documented

## Development Setup

### **Environment Configuration**
- `.env` file with Supabase credentials
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Vite's `import.meta.env` for variable access

### **Code Organization**
- `src/components/` - React components
- `src/contexts/` - React context providers
- `src/hooks/` - Custom React hooks (useLocalStorage, useUserProfile)
- `src/schemas/` - Zod validation schemas
- `src/utils/` - Pure utility functions (membershipUtils, leagueUtils)
- `src/types/` - **Centralized TypeScript type definitions**
  - `member.ts` - Member and UserRole types
  - `league.ts` - League, TeamFormat, HandicapSystem, GameType types
  - `venue.ts` - Venue and VenueFormData types
  - `tournament.ts` - Tournament, TournamentDateOption types
  - `operator.ts` - LeagueOperator, ContactVisibility types, mock payment generator
  - `index.ts` - Re-exports all types for convenient importing
- `src/constants/` - Static data and content
  - `infoContent/` - Info button content organized by feature area
    - `profileInfoContent.tsx` - Profile and member-related info
    - `leagueWizardInfoContent.tsx` - League creation wizard info
    - `operatorApplicationInfoContent.tsx` - Operator application info
- `src/navigation/` - Routing configuration
  - `NavRoutes.tsx` - Array-based route definitions with protection levels
- `src/operator/` - League operator features
  - `OperatorDashboard.tsx` - Main operator dashboard
  - `OrganizationSettings.tsx` - Operator profile management
  - `LeagueCreationWizard.tsx` - League creation wizard
  - `OperatorWelcome.tsx` - Post-application welcome page
- `src/operator/application/` - Operator onboarding
  - `BecomeLeagueOperator.tsx` - Operator benefits page
  - `LeagueOperatorApplication.tsx` - 6-step application wizard
- `database/` - SQL schema files
  - `members.sql` - Member table schema
  - `league_operators.sql` - League operator table schema
- `memory-bank/` - Project documentation and patterns

### **Custom Hooks Implementation**
- **useLocalStorage**: Production-ready localStorage persistence
  - Mirrors useState API exactly
  - Handles SSR gracefully
  - Automatic JSON serialization
  - Error handling with fallbacks
  - Used for form data and wizard step persistence

### **Tournament Scheduling Architecture**
- **Dynamic URL Generation**: Tournament links adapt to current date context
  - BCA: Uses next year URL after March 15 (fetchBCAChampionshipURL)
  - APA: Static URL structure (fetchAPAChampionshipURL)
  - Generic getChampionshipLink() function for reusability
- **Database Search Integration**: Automatic search triggered by useEffect when reaching tournament steps
- **Community Verification System**: Database stores operator-confirmed dates with vote counts
- **Flexible Choice Architecture**: Radio buttons handle found dates, ignore options, and custom entry

### **React Element Interface Support**
- **Enhanced Component Interfaces**: All wizard components support React.ReactElement in addition to strings
  - RadioChoiceStep: subtitle can be string | React.ReactElement
  - QuestionStep: subtitle supports React elements for rich content
  - SimpleRadioChoice: subtitle and infoContent accept JSX
- **Clickable Link Integration**: Tournament steps include live links to official websites
- **JSX Content Rendering**: Components seamlessly handle both plain text and complex JSX structures

### **Quality Assurance**
- TypeScript strict mode enabled
- Consistent error handling patterns
- Real-time validation feedback
- Comprehensive success state management