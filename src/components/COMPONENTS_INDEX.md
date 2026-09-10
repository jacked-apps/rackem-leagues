# Reusable Components Library

This document catalogs all reusable components in the application for easy discovery and reuse.

## 📋 Form Components (`/src/components/forms/`)

### `QuestionStep.tsx`
**Purpose**: Single question with text input, validation, and navigation
**Use Cases**: Any step-by-step form with text input
**Key Features**:
- Text input with real-time formatting
- Built-in validation with error display
- Navigation buttons (Back/Next/Continue)
- Optional info popup
- Keyboard navigation support
- Auto-formatting on input

**Props**: `title`, `subtitle`, `placeholder`, `value`, `onChange`, `validator`, `formatter`, etc.

### `ChoiceStep.tsx`
**Purpose**: Question with button choices instead of text input
**Use Cases**: Yes/No questions, multiple choice, selection screens
**Key Features**:
- Multiple choice buttons with variants
- Custom content area for additional info
- Navigation buttons
- Optional info popup
- Selection state management

**Props**: `title`, `choices[]`, `selectedValue`, `onSelect`, `content`, etc.

## 🔒 Privacy Components (`/src/components/privacy/`)

### `ContactInfoExposure.tsx`
**Purpose**: Complete contact visibility control system
**Use Cases**: Any contact information with privacy settings
**Key Features**:
- Role-based visibility options (league_operator, member, captain)
- 5 visibility levels (in-app only → anyone)
- Color-coded privacy feedback
- Helper functions for labels/descriptions
- Reusable across contact types

**Props**: `contactType`, `userRole`, `selectedLevel`, `onLevelChange`, `title`, etc.

### `VisibilityChoiceCard.tsx`
**Purpose**: Individual choice card with explanation (used by ContactInfoExposure)
**Use Cases**: Part of privacy selection system
**Key Features**:
- Radio button with icon and label
- Color-coded explanation card on selection
- Keyboard accessible
- Animation support

**Props**: `option`, `isSelected`, `colors`, `onSelect`, `showExplanation`

## 💳 Payment Components (`/src/components/`)

### `PaymentCardForm.tsx`
**Purpose**: Complete credit card form with secure tokenization
**Use Cases**: Any payment collection, card verification
**Key Features**:
- Real-time card formatting
- Card brand detection
- Secure tokenization flow
- $0.00 authorization verification
- Success/error states
- Security messaging

**Props**: `onVerificationSuccess`, `onVerificationError`, `verifyButtonText`, etc.

## 📊 Preview Components (`/src/components/previews/`)

### `ApplicationPreview.tsx`
**Purpose**: Live preview of application data being filled out
**Use Cases**: Multi-step forms that need live preview
**Key Features**:
- Real-time data display
- Organized sections
- Completion status
- Save/exit functionality

**Props**: `applicationData`, `isComplete`

## 🎯 UI Components (`/src/components/ui/`)
*Note: shadcn/ui components - see shadcn documentation*

## 📱 Modal Components (`/src/components/modals/`)

### `SecurityDisclaimerModal.tsx`
**Purpose**: Security warnings and disclaimers
**Use Cases**: Important security/privacy notices

### `SetupGuideModal.tsx`
**Purpose**: Setup guidance and tips
**Use Cases**: Help content, professional recommendations

## 🔧 Utility Components

### `InfoButton.tsx` (`/src/components/`)
**Purpose**: Information popup trigger button
**Use Cases**: Contextual help throughout forms

## 🎨 Component Patterns

### **Multi-Step Forms**
- Use `QuestionStep` for text inputs
- Use `ChoiceStep` for selections
- Combine with progress indicators
- Include preview panels where helpful

### **Privacy Controls**
- Use `ContactInfoExposure` for any contact info
- Customize with `userRole` and `contactType`
- Consistent color-coding across app

### **Payment Collection**
- Use `PaymentCardForm` for all card collection
- Customize button text and callbacks
- Consistent security messaging

## 🪙 Coin Flip (`/src/components/coinflip/`)

### `CoinFlip.tsx`
**Purpose**: Settle a 50/50 decision between two sides — two participants in, one winner out
**Use Cases**: Who breaks first, who wins a tie, or any two-way decision that needs to feel decided rather than argued. Works for players and teams alike, because a participant is only `{ id, name }`
**Key Features**:
- Two modes on one state machine: `call` (a human picks heads or tails) and `quick` (the app assigns the faces, shows the assignment, then flips)
- The call is recorded in state before the coin is tossed, so it cannot be made after the coin is in the air
- Winner announced by NAME, with the face as supporting evidence — readable without color
- CSS-only coin spin, honors `prefers-reduced-motion`
- Injected random source, so tests can pin an outcome without mocking globals
- "Flip again" re-enters the flip at its first real beat — the call buttons in `call` mode, a fresh assignment in `quick` — rather than returning to the idle button, which would be the same intent pressed twice
- Writes nothing and persists nothing — reports through `onResult` and leaves storage to the caller

**Props**: `participantA`, `participantB`, `mode?`, `callerId?`, `onResult?`, `allowReflip?`, `random?`

### `flipCoin.ts`
**Purpose**: The rules of a coin flip, with no React and no ambient randomness
**Use Cases**: Any caller that wants the outcome without the ceremony; also the reason the winner-selection rule is provable without rendering
**Exports**: `tossCoin`, `resolveFlip`, `assignFaces`, `shuffleOrder`, `quickFlip`, `QUICK_CALL`

> **`quickFlip(a, b, random?)` is the coin flip as a plain two-outcome randomizer.**
> No React, no mounting, no animation — hand it two participants, get back a
> `FlipResult` whose `winner.id` is an id you passed in. This is what a settings
> option like "set a random breaker" calls, where the visible `CoinFlip` is what
> "flip for the break" mounts. They are the SAME flip: `quickFlip` still assigns
> faces before tossing even though nothing displays it, and a parity test pins
> that both produce the same winner from the same source. Do not "optimize" the
> assignment out of the silent path — that would quietly make them two different
> flips, and an operator switching between the two options would change the odds
> without anyone noticing.

> **No way to force a result.** There is deliberately no prop that hands the
> component a predetermined face. Such a seam has a legitimate use — a server or
> one device telling another what was decided, so two screens agree — and it will
> need to come back the day a flip has to span two devices. It was removed because
> nothing needed it yet and its only demonstrable use today was rigging the
> outcome. Note this does NOT make the flip tamper-proof: the toss runs on the
> client, so a determined user can still lean on it. Moving the decision to a
> server is the actual fix, and that is when this seam returns.

> **Note on `assignFaces`**: randomizing which side holds heads does **not** make the
> flip fairer — chaining fair 50/50s still yields a fair 50/50. It exists so entry
> order never *appears* to decide the outcome. Don't remove it as redundant, and
> don't add further randomization believing it compounds.

## 📝 Usage Guidelines

1. **Always check this index first** before creating new components
2. **Prefer composition** - combine existing components rather than create new ones
3. **Extend existing components** - add props/features to existing components when possible
4. **Update this index** when creating new reusable components
5. **Test component isolation** - ensure components work independently

## 🔄 Migration Status

- ✅ `QuestionStep` - Moved to `/src/components/forms/`
- ✅ `ChoiceStep` - Moved to `/src/components/forms/`
- ✅ `VisibilityChoiceCard` - Moved to `/src/components/privacy/`
- ✅ `ContactInfoExposure` - Moved to `/src/components/privacy/`
- ✅ `PaymentCardForm` - Already in `/src/components/`
- ✅ `ApplicationPreview` - Moved to `/src/components/previews/`
- ✅ Modal components - Moved to `/src/components/modals/`

---
*Last Updated: Current Date*
*Total Reusable Components: 6+*