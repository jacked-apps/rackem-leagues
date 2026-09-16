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

### `NonProdGate.tsx` (`/src/components/`)
**Purpose**: Route gate for features that ship GATED — live on dev + staging, redirect home in production
**Use Cases**: Wrap the route of anything merged but not yet un-gated (Feature Gating Workflow in CLAUDE.md). Gate every DOOR to it (nav link, button, card) with the same `!isProduction`, and flip route + doors together when un-gating. Users: Handicap Calculator, Game Room (`src/navigation/roomsGate.test.tsx` pins that routes + doors hide together)

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
- TWO ROLES: one player calls, the OTHER throws. A coin flip is fair because the person calling does not control the toss, so calling and throwing are separate acts by separate people — not one tap by whoever holds the phone
- The call is recorded before the coin is tossed, so it cannot be made after the coin is in the air
- `viewerId` names whose device it is: given, each screen offers only its own player's move and says what the other side is doing; omitted, both roles play out on one screen in turn
- Winner announced by NAME, with the face as supporting evidence — readable without color
- CSS-only coin spin, honors `prefers-reduced-motion`
- Injected random source, so tests can pin an outcome without mocking globals
- "Flip again" re-enters the flip at its first real beat — the call buttons in `call` mode, a fresh assignment in `quick` — rather than returning to the idle button, which would be the same intent pressed twice
- Writes nothing and persists nothing — reports through `onResult` and leaves storage to the caller

- CONTROLLED path (`controlled={{ call, face, onCall, onThrow, onFlipAgain? }}`): the record lives elsewhere — a database row — and the component renders it. Phase is derived (no call → calling; call, no face → called; face → flipping, then result); taps are reported up, not stored; `tossCoin` and the random source are never consulted; no display shuffle so two phones show the same order. Mounting with a face on record shows the result at once; a face ARRIVING spins. Without `controlled`, nothing changes. Used by the Game Room's two-phone flip (`src/rooms/games/coinflip/RoomCoinFlip.tsx`)

**Props**: `participantA`, `participantB`, `mode?`, `callerId?`, `flipperId?`, `viewerId?`, `onResult?`, `allowReflip?`, `random?`, `controlled?`

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

> **Keeping two devices in step is NOT this component's job.** It renders one
> device's view of a flip. Two mounted copies share no state; syncing them —
> and deciding the outcome somewhere neither player controls — belongs to
> whatever hosts the flip. The Game Room does exactly that: `RoomCoinFlip`
> feeds each phone the same `room_coin_flips` row through `controlled`, and the
> database picks the face. See `docs/plans/2026-09-16-001-feat-game-room-plan.md`.

> **The seam is back — as `controlled`, and only as a whole.** The 2026-09-09
> cut removed a lone "supplied face" prop because its only demonstrable use was
> rigging the outcome. The Game Room (2026-09-16) is the day a flip spans two
> devices, so the seam returned in the shape that use demands: one `controlled`
> object carrying the record AND the taps, so a caller cannot hand over a face
> without also handing over the calling and throwing. The uncontrolled flip is
> still client-side `Math.random` and still not tamper-proof; the ROOM's flip
> is decided by the database (`throw_room_coin`), which is the actual fix.

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