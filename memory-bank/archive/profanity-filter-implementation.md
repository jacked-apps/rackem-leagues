# Profanity Filter Implementation Plan

## Overview
Implementing a two-tiered profanity filtering system:
1. **Validation System** - For team names and organization content (reject entries with profanity)
2. **Display Filtering** - For messaging (filter on read based on viewer's preference)

## Package Choice
**@2toad/profanity** - Full TypeScript support, actively maintained, simple API

## Age-Based Enforcement
- **Under 18**: Profanity filter FORCED ON (cannot be disabled)
- **18 and Over**: Filter is optional (user can toggle on/off)

## Database Changes
- Add `profanity_filter_enabled` BOOLEAN to `members` table (default false)
- Add `profanity_filter_enabled` BOOLEAN to `league_operators` table (default false)

## Implementation Steps

### Phase 1: Setup ✅
- [x] **Step 1**: Install @2toad/profanity package
- [x] **Step 2**: Create database migration to add profanity_filter_enabled columns
  - File: `/database/messaging/add_profanity_filter_columns.sql`
  - **⚠️ ACTION REQUIRED: Run this SQL file on your local Supabase instance**
- [x] **Step 3**: Create utility wrapper in /src/utils/profanityFilter.ts
  - Functions: `containsProfanity()`, `censorProfanity()`

### Phase 2: Core Logic ✅
- [x] **Step 4**: Create hook to calculate user's effective filter setting (age-based enforcement)
  - File: `/src/hooks/useProfanityFilter.ts`
  - Returns: `shouldFilter`, `canToggle`, `isLoading`
  - Function: `updateProfanityFilter()` for toggling user setting

### Phase 3: Message Filtering (Display-time) ✅
- [x] **Step 5**: Update MessageBubble component to apply display-time filtering based on viewer's preference
  - File: `/src/components/messages/MessageBubble.tsx`
  - Messages stored uncensored in database
  - Each viewer sees filtered/unfiltered based on their own setting
  - If user is under 18, always filter for them

### Phase 4: Team Name Validation (Reject Entry) ✅
- [x] **Step 6**: Add profanity validation to team creation/editing
  - File: `/src/operator/TeamEditorModal.tsx`
  - When operator has profanity_filter_enabled = true
  - Reject submission entirely if profanity detected
  - Error: "Team name contains inappropriate language. Please choose a different name."

### Phase 5: Settings UI ✅
- [x] **Step 7**: Add user profanity filter toggle to settings page
  - File: `/src/profile/PrivacySettingsSection.tsx`
  - Added to: `/src/profile/Profile.tsx`
  - If under 18: Locked/disabled with Lock icon and explanation
  - If 18+: Toggleable with Enable/Disable button

- [x] **Step 8**: Add operator profanity filter toggle to operator settings
  - File: `/src/operator/OrganizationSettings.tsx`
  - Content Moderation card with Shield icon
  - Controls organization-wide validation for team names/content

### Phase 6: Testing 🔄
- [ ] **Step 9**: Test all profanity filter scenarios
  - [ ] **Run SQL migration** on local Supabase instance
  - [ ] Under 18 user sees filtered messages
  - [ ] 18+ user with filter ON sees filtered messages
  - [ ] 18+ user with filter OFF sees unfiltered messages
  - [ ] Team name rejection when operator filter enabled
  - [ ] Team name acceptance when operator filter disabled
  - [ ] User toggle works (18+ can toggle, under 18 locked)
  - [ ] Operator toggle works and persists

## Key Implementation Details

### Two Different Systems:

#### 1. Team Names / Organization Content (VALIDATION)
- **Purpose**: Prevent inappropriate content in public/shared spaces
- **Logic**: Block submission entirely if profanity detected
- **Error**: "Team name contains inappropriate language. Please choose a different name."
- **Controlled by**: Operator's `profanity_filter_enabled` setting

#### 2. Messaging (DISPLAY FILTERING)
- **Purpose**: Personal viewing preference (like parental control)
- **Logic**: Filter on render based on viewer's preference
- **Storage**: Messages stored uncensored in database
- **Controlled by**: Individual user's setting (forced ON if under 18)

### Effective Filter Calculation Logic:
```typescript
if (user.age < 18) {
  effectiveFilterEnabled = true; // FORCED
} else {
  effectiveFilterEnabled = user.profanity_filter_enabled; // OPTIONAL
}
```

## Files to Create/Modify

### New Files:
1. `/src/utils/profanityFilter.ts` - Core filtering utilities
2. `/database/messaging/add_profanity_filter_columns.sql` - Migration

### Modified Files:
1. `/src/components/messages/MessageBubble.tsx` - Apply display-time filtering
2. Team creation/editing components - Add validation
3. User settings page - Add filter toggle with age check
4. Operator settings page - Add org-wide filter toggle

## API Usage (@2toad/profanity)

```typescript
import { profanity, CensorType } from '@2toad/profanity';

// Validation (for team names)
profanity.exists('bad word here'); // returns true/false

// Display filtering (for messages)
profanity.censor('bad word here'); // returns censored string with ****
```

## Progress Tracking
- **Started**: 2025-10-23
- **Current Phase**: Phase 6 - Testing
- **Status**: Implementation Complete - Ready for Testing
- **Build Status**: ✅ All TypeScript compilation successful

## Summary of Implementation

### What's Complete:
1. ✅ Installed @2toad/profanity package
2. ✅ Created database migration SQL file
3. ✅ Built profanity filter utility functions
4. ✅ Created age-based enforcement hook
5. ✅ Implemented message display filtering
6. ✅ Added team name validation
7. ✅ Added user privacy settings UI
8. ✅ Added operator content moderation UI

### Next Steps for User:
1. **Run the SQL migration**: Execute `/database/messaging/add_profanity_filter_columns.sql` in your local Supabase SQL editor
2. **Test the features**:
   - Test message filtering with different user ages
   - Test team name validation with operator filter on/off
   - Test user and operator toggles
3. **Commit changes** when satisfied with testing
