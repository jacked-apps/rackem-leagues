# Screen-audit scan findings

_Generated 2026-05-24 by `scripts/audit-scan.sh`. Regenerate with `pnpm audit:scan`._

**Do not hand-edit this file.** It is regenerated each run from the source tree.
Use it as input to `docs/audits/screen-audit.md` (the per-screen audit checklist).

## Summary

- **Files with unpaired hardcoded colored shades:** 194
- **Files with native HTML form elements:** 24

## Cascade priority — shared components

_Components in `src/components/` (outside `ui/`) ranked by import count from
page-level directories. Fix high-cascade components first; consumers get the
fix for free. Only components with ≥3 importers are listed._

| Component | Imports |
|---|---|
| `PageHeader` | 39 |
| `InfoButton` | 22 |
| `PlayerNameLink` | 5 |
| `StatsNavBar` | 4 |
| `playoff/PlayoffTemplateSelector` | 4 |
| `playoff/PlayoffSettingsCard` | 4 |
| `playoff/PlayoffMatchRulesCard` | 4 |
| `operator/DashboardCard` | 4 |
| `MemberCombobox` | 4 |
| `UnsavedChangesDialog` | 3 |
| `playoff/PlayoffBracketPreviewCard` | 3 |
| `operator/VenueCreationModal` | 3 |

## Hardcoded colored shades (unpaired)

_Lines matching `(bg|text|border)-{color}-{shade}` where the same line has no
`dark:` variant. These are the most broken in dark mode. Replace with theme
tokens (`bg-success/10`, `text-info`, `border-warning/40`, `text-destructive`,
etc.) chosen by semantic meaning, not literal color match._

### `src/about/About.tsx`

- L125: `<Link to="/pricing" className="text-blue-600 hover:text-blue-800 font-medium">`
- L145: `<Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">`

### `src/about/Pricing.tsx`

- L34: `<h3 className="text-lg font-semibold mb-2 text-blue-600">Per Season Setup</h3>`
- L39: `<h3 className="text-lg font-semibold mb-2 text-blue-600">Weekly Platform Fee</h3>`
- L100: `<Card className="mb-8 border-blue-200 bg-blue-50">`
- L128: `<span className="font-mono text-blue-600">$138</span>`
- L143: `<div className="bg-green-100 p-4 rounded border border-green-300">`
- L144: `<p className="font-semibold text-green-800">`

### `src/completeProfile/CompleteProfileForm.tsx`

- L124: `<div className="p-3 bg-red-50 border border-red-200 rounded-md">`
- L125: `<p className="text-sm text-red-600">{state.errors.general}</p>`

### `src/components/AlertDialog.tsx`

- L50: `titleColor: 'text-green-900',`
- L51: `bgColor: 'bg-green-50',`
- L52: `borderColor: 'border-green-200',`
- L56: `titleColor: 'text-yellow-900',`
- L57: `bgColor: 'bg-yellow-50',`
- L58: `borderColor: 'border-yellow-200',`
- L62: `titleColor: 'text-red-900',`
- L63: `bgColor: 'bg-red-50',`
- L64: `borderColor: 'border-red-200',`
- L68: `titleColor: 'text-blue-900',`
- L69: `bgColor: 'bg-blue-50',`
- L70: `borderColor: 'border-blue-200',`

### `src/components/AllPlayersRosterCard.tsx`

- L128: `className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded cursor-help"`
- L137: `className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded cursor-help"`

### `src/components/ErrorFallback.tsx`

- L43: `<div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">`
- L44: `<AlertTriangle className="h-8 w-8 text-red-600" />`
- L59: `<p className="text-sm font-mono text-red-600 break-all">`

### `src/components/forms/ChoiceStep.tsx`

- L106: `? 'bg-blue-600 hover:bg-blue-700 text-white'`
- L126: `<p className="text-red-500 text-sm mt-2">{error}</p>`
- L144: `className="bg-blue-600 hover:bg-blue-700 text-white"`

### `src/components/forms/DateField.tsx`

- L69: `{required && <span className="text-red-500 ml-1">*</span>}`
- L84: `<p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2">`
- L91: `<p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">`

### `src/components/forms/DualDateStep.tsx`

- L136: `<div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">`
- L137: `<p className="text-red-700 text-sm">{displayError}</p>`

### `src/components/forms/QuestionStep.tsx`

- L127: `<p className="text-red-500 text-sm mt-2">{error}</p>`
- L150: `error ? 'border-red-500' : 'border-border'`
- L154: `<p className="text-red-500 text-sm mt-2">{error}</p>`
- L173: `className="text-red-600 border-red-300 hover:bg-red-50"`

### `src/components/forms/SimpleRadioChoice.tsx`

- L94: `className="border-blue-500 bg-blue-50 cursor-pointer transition-all duration-200"`
- L110: `<div className="w-4 h-4 rounded-full border-2 border-blue-500 bg-blue-500 flex items-center justify-center">`
- L124: `<span className="text-sm text-blue-600 font-medium">`
- L133: `<div className="mt-3 pt-3 border-t border-blue-200">`
- L135: `<p className="text-blue-800 text-sm mb-2">`
- L140: `<div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">`
- L141: `<p className="text-yellow-800 text-sm font-medium">`
- L181: `<span className="text-sm text-blue-600 font-medium">`

### `src/components/forms/WizardProgress.tsx`

- L30: `progressBarColor = 'bg-blue-600',`

### `src/components/invite/DeviceHandoffForm.tsx`

- L156: `<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">`
- L157: `<p className="text-sm text-blue-800">`
- L207: `<div className="p-3 bg-red-50 border border-red-200 rounded-lg">`
- L208: `<p className="text-sm text-red-800">{error}</p>`

### `src/components/invite/InviteSuccessView.tsx`

- L44: `<div className="p-4 bg-green-100 rounded-full">`
- L45: `<Mail className="h-8 w-8 text-green-600" />`
- L61: `<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">`
- L62: `<p className="text-xs text-amber-800">`

### `src/components/invite/ShareLinkSection.tsx`

- L77: `<div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">`
- L78: `<AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />`
- L79: `<div className="text-xs text-blue-800">`
- L101: `<Check className="h-4 w-4 text-green-600" />`
- L108: `<p className="text-xs text-green-600">Link copied to clipboard!</p>`

### `src/components/InvitePlayerModal.tsx`

- L407: `<p className="text-xs text-amber-600 flex items-center gap-1">`
- L418: `<p className="text-xs text-green-600 flex items-center gap-1">`
- L500: `<div className={\`p-3 rounded-lg border ${hasExpiredInvite ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}\`}>`
- L503: `<AlertTriangle className="h-4 w-4 text-amber-600" />`
- L505: `<Mail className="h-4 w-4 text-green-600" />`
- L507: `<span className={hasExpiredInvite ? 'text-amber-800' : 'text-green-800'}>`
- L514: `<p className="text-xs text-green-700 mt-1">`
- L572: `<p className="text-xs text-amber-600">Enter and save an email above to enable these options.</p>`

### `src/components/InviteStatusBadge.tsx`

- L55: `className={\`bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 ${className || ''}\`}`
- L67: `className={\`bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0 ${className || ''}\`}`

### `src/components/lineup/DuplicateNicknameWarning.tsx`

- L16: `<div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-md">`
- L17: `<p className="text-sm text-red-800 font-medium">`
- L20: `<p className="text-xs text-red-700 mt-1">`

### `src/components/lineup/FargoStartPointsCard.tsx`

- L92: `<Card className="border-blue-300 bg-blue-50">`
- L139: `<p className="text-xs text-amber-700">`

### `src/components/lineup/HandicapCell.tsx`

- L109: `<div className="text-sm font-semibold text-blue-600">`

### `src/components/lineup/HandicapSummary.tsx`

- L61: `<div className="bg-blue-50 p-2 rounded">`
- L93: `<span className="text-2xl font-bold text-blue-600">`

### `src/components/lineup/LineupActions.tsx`

- L68: `<Users className="h-5 w-5 text-yellow-600" />`
- L69: `<span className="text-sm font-medium text-yellow-600">`
- L76: `<CheckCircle className="h-5 w-5 text-green-600" />`
- L77: `<span className="text-sm font-semibold text-green-600">`
- L91: `<Lock className="h-5 w-5 text-blue-600" />`
- L92: `<span className="text-sm font-semibold text-blue-600">Locked</span>`

### `src/components/lineup/MatchInfoCard.tsx`

- L84: `<span className="font-medium text-blue-700">`
- L89: `<span className="text-xs text-orange-600 font-medium">(overflow)</span>`

### `src/components/lineup/PrepStatusBanner.tsx`

- L34: `<Card className="border-blue-300 bg-blue-50">`
- L36: `<Info className="h-5 w-5 shrink-0 text-blue-700" aria-hidden />`
- L37: `<div className="text-sm text-blue-900">`
- L49: `<Card className="border-amber-300 bg-amber-50">`
- L51: `<Hourglass className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />`
- L52: `<div className="text-sm text-amber-900">`

### `src/components/lineup/SubResolutionBanner.tsx`

- L40: `<Card className="border-blue-300 bg-blue-50">`
- L42: `<Info className="h-5 w-5 shrink-0 text-blue-700" aria-hidden />`
- L43: `<div className="text-sm text-blue-900">`
- L55: `<Card className="border-blue-300 bg-blue-50">`
- L58: `<UserPlus className="h-5 w-5 shrink-0 text-blue-700" aria-hidden />`
- L59: `<div className="text-sm text-blue-900">`

### `src/components/lineup/TestModeToggle.tsx`

- L26: `<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">`
- L35: `<span className="text-sm font-medium text-yellow-800">`
- L39: `<p className="text-xs text-yellow-700 mt-1 ml-6">`

### `src/components/LoadingSpinner.tsx`

- L11: `<div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>`

### `src/components/match/MatchPhaseGuard.tsx`

- L197: `<Loader2 className="h-12 w-12 animate-spin text-blue-600" />`
- L240: `<Loader2 className="h-12 w-12 animate-spin text-blue-600" />`

### `src/components/MatchCard.tsx`

- L54: `in_progress: 'bg-blue-100 text-blue-700',`
- L55: `awaiting_verification: 'bg-purple-100 text-purple-700',`
- L56: `completed: 'bg-green-100 text-green-700',`
- L57: `forfeited: 'bg-red-100 text-red-700',`
- L58: `postponed: 'bg-yellow-100 text-yellow-700',`
- L92: `? 'text-blue-600'`
- L117: `? 'text-blue-600'`
- L133: `<span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">`

### `src/components/MatchDetailCard.tsx`

- L57: `case 'completed': return 'bg-green-500';`
- L58: `case 'in_progress': return 'bg-blue-500';`
- L59: `case 'awaiting_verification': return 'bg-yellow-500';`
- L76: `<div className="p-8 text-center text-red-600">`
- L104: `<Badge className={winner === 'home' ? 'bg-green-600' : winner === 'away' ? 'bg-blue-600' : 'bg-gray-600'}>`
- L122: `<div className={\`space-y-2 ${winner === 'home' ? 'bg-green-50 p-3 rounded-lg border-2 border-green-200' : ''}\`}>`
- L124: `<h3 className={\`font-bold text-lg ${winner === 'home' ? 'text-green-800' : 'text-foreground'}\`}>`
- L128: `<Badge className="bg-green-600">WINNER</Badge>`
- L139: `<div className="font-bold text-xl text-blue-600">`
- L168: `<div className={\`space-y-2 ${winner === 'away' ? 'bg-blue-50 p-3 rounded-lg border-2 border-blue-200' : ''}\`}>`
- L170: `<h3 className={\`font-bold text-lg ${winner === 'away' ? 'text-blue-800' : 'text-foreground'}\`}>`
- L174: `<Badge className="bg-blue-600">WINNER</Badge>`
- L185: `<div className="font-bold text-xl text-blue-600">`

### `src/components/MemberCombobox.tsx`

- L165: `className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"`
- L179: `<button className="px-3 py-1 text-xs font-medium rounded-full bg-orange-500 text-white">`

### `src/components/MemberSearchCombobox.tsx`

- L142: `? 'bg-orange-500 text-white'`

### `src/components/messages/AnnouncementModal.tsx`

- L190: `icon={<Megaphone className="h-5 w-5 text-blue-600" />}`
- L196: `<div className="px-6 pt-4 border-b bg-blue-50">`
- L198: `<span className="text-sm font-medium text-blue-900">`
- L206: `className="bg-card border border-blue-300 rounded-full px-3 py-1 text-sm flex items-center gap-2"`
- L247: `? 'border-blue-600 bg-blue-50'`

### `src/components/messages/announcements/SelectedTargetChips.tsx`

- L27: `<div className="px-6 pt-4 border-b bg-blue-50">`
- L29: `<span className="text-sm font-medium text-blue-900">`
- L37: `className="bg-card border border-blue-300 rounded-full px-3 py-1 text-sm flex items-center gap-2"`

### `src/components/messages/announcements/TargetSelector.tsx`

- L62: `? 'border-blue-600 bg-blue-50'`

### `src/components/messages/ConversationHeader.tsx`

- L60: `<DropdownMenuItem onClick={onBlock} className="text-orange-600 focus:text-orange-600">`
- L68: `<DropdownMenuItem onClick={onLeave} className="text-red-600 focus:text-red-600">`

### `src/components/messages/ConversationList.tsx`

- L103: `className="w-full bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 hover:text-blue-800"`
- L131: `showSearch && 'bg-blue-100 text-blue-600 hover:bg-blue-100'`
- L200: `selectedConversationId === conversation.id && 'bg-blue-50 hover:bg-blue-100',`
- L210: `<span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">`
- L228: `<span className="ml-2 bg-blue-600 text-white text-xs font-medium rounded-full h-6 w-6 md:h-5 md:w-5 flex items-center justify-center flex-sh`

### `src/components/messages/MessageBubble.tsx`

- L129: `isCurrentUser ? 'bg-blue-600 text-white' : 'bg-accent text-foreground'`
- L134: `<PlayerNameLink playerId={senderId} playerName={senderName} className="text-foreground hover:text-blue-600" />`
- L139: `<p className={cn('text-xs', isCurrentUser ? 'text-blue-100' : 'text-muted-foreground')}>`
- L144: `<span className="text-blue-100">`

### `src/components/messages/MessageInput.tsx`

- L76: `className="h-11 w-11 md:h-10 md:w-10 p-0 flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"`

### `src/components/messages/MessagesEmptyState.tsx`

- L14: `<div className="flex-1 flex items-center justify-center text-muted-foreground border-l-[16px] border-r-[16px] border-green-300 overflow-hidd`

### `src/components/messages/MessageSettingsModal.tsx`

- L62: `<div className="p-3 bg-green-50 border border-green-200 rounded-md">`
- L63: `<p className="text-sm text-green-700 font-medium">`
- L70: `<div className="p-3 bg-red-50 border border-red-200 rounded-md">`
- L71: `<p className="text-sm text-red-700">{error}</p>`
- L81: `<Shield className="h-5 w-5 text-purple-600" />`
- L133: `? 'bg-green-100 text-green-800'`
- L144: `<strong className="text-green-700">Enabled:</strong> Profanity in messages you receive will be replaced with asterisks (****). Other users s`
- L156: `<div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">`

### `src/components/messages/NewMessageModal.tsx`

- L127: `<div className="px-6 pt-4 border-b bg-blue-50">`
- L129: `<Users className="h-4 w-4 text-blue-600" />`
- L130: `<span className="text-sm font-medium text-blue-900">`
- L138: `className="bg-card border border-blue-300 rounded-full px-3 py-1 text-sm flex items-center gap-2"`

### `src/components/messages/settings/ProfanityFilterSection.tsx`

- L80: `shouldFilter ? 'bg-green-100 text-green-800' : 'bg-muted text-foreground'`
- L91: `<strong className="text-green-700">Enabled:</strong> Profanity in messages you`
- L107: `<div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">`

### `src/components/messages/settings/StatusAlert.tsx`

- L18: `<div className="p-3 bg-green-50 border border-green-200 rounded-md">`
- L19: `<p className="text-sm text-green-700 font-medium">{message}</p>`
- L25: `<div className="p-3 bg-red-50 border border-red-200 rounded-md">`
- L26: `<p className="text-sm text-red-700">{message}</p>`

### `src/components/messages/UserListItem.tsx`

- L32: `? 'bg-blue-100 border-blue-500 hover:bg-blue-150'`
- L33: `: 'hover:bg-blue-50 hover:border-blue-300'`
- L44: `<Check className="h-5 w-5 text-blue-600" />`

### `src/components/modals/DayOfWeekWarningModal.tsx`

- L47: `<AlertTriangle className="h-6 w-6 text-amber-500" />`
- L74: `<p className="text-amber-700 font-medium">`
- L90: `<p className="text-amber-700 font-medium">`
- L108: `className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"`

### `src/components/modals/DeleteLeagueModal.tsx`

- L209: `<h3 className="text-lg font-semibold text-red-600 mb-4">Error</h3>`
- L227: `<XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />`
- L229: `<h3 className="text-lg font-semibold text-red-600">Cannot Delete League</h3>`
- L233: `<div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">`
- L234: `<p className="text-red-800 font-medium mb-2">`
- L237: `<p className="text-red-700 text-sm mb-3">`
- L240: `<ul className="list-disc list-inside text-red-700 text-sm space-y-1 mb-3">`
- L246: `<p className="text-red-700 text-sm font-medium">`
- L281: `<AlertTriangle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-1" />`
- L283: `<h3 className="text-lg font-semibold text-orange-600">⚠️ Danger: Active League With Played Matches</h3>`
- L287: `<div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">`
- L288: `<p className="text-orange-800 font-medium mb-2">`
- L291: `<p className="text-orange-700 text-sm mb-3">`
- L294: `<ul className="list-disc list-inside text-orange-700 text-sm space-y-1">`
- L327: `<div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">`
- L328: `<p className="text-red-800 text-sm">{error}</p>`
- L341: `className="bg-red-600 hover:bg-red-700 text-white"`
- L357: `<AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />`
- L359: `<h3 className="text-lg font-semibold text-yellow-600">Delete League?</h3>`
- L363: `<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">`
- L364: `<p className="text-yellow-800 text-sm mb-2">`
- L367: `<ul className="list-disc list-inside text-yellow-700 text-sm space-y-1">`
- L381: `<div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">`
- L382: `<p className="text-red-800 text-sm">{error}</p>`
- L395: `className="bg-red-600 hover:bg-red-700 text-white"`
- L410: `<Info className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />`
- L420: `<div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">`
- L421: `<p className="text-blue-800 text-sm">`
- L427: `<div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">`
- L428: `<p className="text-red-800 text-sm">{error}</p>`
- L441: `className="bg-red-600 hover:bg-red-700 text-white"`

### `src/components/modals/DeleteSeasonModal.tsx`

- L49: `<div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">`
- L50: `<AlertTriangle className="w-6 h-6 text-red-600" />`
- L64: `<div className="bg-red-50 border border-red-200 rounded-lg p-4">`
- L65: `<p className="text-red-900 font-semibold mb-2">This action will delete:</p>`
- L66: `<ul className="list-disc list-inside text-red-800 space-y-1 text-sm">`
- L94: `className="flex-1 bg-red-600 hover:bg-red-700 text-white"`

### `src/components/modals/PendingInvitesModal.tsx`

- L168: `className="border rounded-lg p-3 bg-blue-50 border-blue-200"`
- L175: `<p className="font-medium text-blue-900">`
- L182: `<p className="text-sm text-blue-700">`
- L183: `<span className="text-blue-600">Team:</span>{' '}`
- L191: `<p className="text-sm text-blue-700">`
- L192: `<span className="text-blue-600">Organization:</span>{' '}`
- L199: `<p className="text-sm text-blue-700">`
- L200: `<span className="text-blue-600">`
- L210: `<p className="text-xs text-blue-600 pt-0.5">`
- L223: `<span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">`
- L230: `<span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">`
- L240: `<p className="text-xs text-blue-600 pt-0.5 italic">`
- L272: `className="border rounded-lg p-3 bg-amber-50 border-amber-200"`
- L275: `<AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />`
- L277: `<p className="font-medium text-amber-900 truncate">`
- L280: `<p className="text-sm text-amber-700">`
- L283: `<p className="text-xs text-amber-600 mt-1">`

### `src/components/modals/PlaceholderRemovalModal.tsx`

- L70: `<UserX className="h-5 w-5 text-amber-600" />`

### `src/components/modals/SecurityDisclaimerModal.tsx`

- L66: `className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"`

### `src/components/modals/SetupGuideModal.tsx`

- L49: `<div className="mt-2 text-green-600 font-medium">`
- L66: `<div className="mt-2 text-blue-600 font-medium">`
- L79: `<div className="mt-2 text-amber-600 font-medium">`
- L82: `<div className="mt-1 text-amber-700 text-xs">`
- L126: `className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"`

### `src/components/modals/WeekOffReasonModal.tsx`

- L104: `<span className="text-red-600">{error}</span>`

### `src/components/operator/ActiveLeagues.tsx`

- L111: `<p className="text-red-600 mb-4">{error}</p>`
- L179: `className="border-2 border-orange-300 rounded-lg hover:border-orange-400 hover:shadow-md transition-all bg-orange-50/30 overflow-hidden"`
- L183: `<h4 className="font-semibold text-foreground text-lg hover:text-orange-600 transition-colors">`
- L201: `className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"`

### `src/components/operator/AuthorizeNewPlayersCard.tsx`

- L272: `<div className="p-2 bg-amber-100 rounded-lg">`
- L273: `<AlertCircle className="h-5 w-5 text-amber-600" />`
- L318: `<div className="flex items-center justify-center gap-2 py-4 text-green-600">`
- L341: `<div className="flex items-center justify-center gap-2 py-4 text-green-600">`
- L389: `className={\`ml-2 ${player.gameCount >= 15 ? 'text-green-600 font-medium' : ''}\`}`

### `src/components/operator/BlackoutDatesCard.tsx`

- L67: `<CalendarX className="h-6 w-6 text-red-600" />`

### `src/components/operator/ContactInfoCard.tsx`

- L144: `<div className="p-3 bg-red-50 border border-red-200 rounded-md">`
- L145: `<p className="text-sm text-red-700">{error}</p>`

### `src/components/operator/ContentModerationCard.tsx`

- L55: `<Shield className="h-6 w-6 text-purple-600" />`
- L61: `<div className="p-3 bg-green-50 border border-green-200 rounded-md">`
- L62: `<p className="text-sm text-green-700 font-medium">`
- L84: `? 'bg-green-100 text-green-800'`
- L105: `<div className="p-3 bg-blue-50 border border-blue-200 rounded-md">`
- L106: `<p className="text-sm text-blue-700">`

### `src/components/operator/DashboardCard.tsx`

- L13: `/** Icon color class (e.g., 'text-blue-600') */`

### `src/components/operator/LeagueOverviewCard.tsx`

- L210: `bgColor: 'bg-green-100',`
- L211: `textColor: 'text-green-800',`
- L216: `bgColor: 'bg-orange-100',`
- L217: `textColor: 'text-orange-800',`
- L299: `className="text-red-600 hover:text-red-700 hover:bg-red-50"`
- L313: `<div className={\`${isSeasonComplete() ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-4\`}>`
- L315: `<h3 className={\`font-semibold ${isSeasonComplete() ? 'text-green-900' : 'text-orange-900'}\`}>`
- L324: `<span className={isSeasonComplete() ? 'text-green-700' : 'text-orange-700'}>Start Date:</span>{' '}`
- L325: `<span className={\`${isSeasonComplete() ? 'text-green-900' : 'text-orange-900'} font-medium\`}>`
- L330: `<span className={isSeasonComplete() ? 'text-green-700' : 'text-orange-700'}>End Date:</span>{' '}`
- L331: `<span className={\`${isSeasonComplete() ? 'text-green-900' : 'text-orange-900'} font-medium\`}>`
- L336: `<span className={isSeasonComplete() ? 'text-green-700' : 'text-orange-700'}>Format:</span>{' '}`
- L337: `<span className={\`${isSeasonComplete() ? 'text-green-900' : 'text-orange-900'} font-medium\`}>`
- L343: `<span className={isSeasonComplete() ? 'text-green-700' : 'text-orange-700'}>Teams:</span>{' '}`
- L344: `<span className={\`${isSeasonComplete() ? 'text-green-900' : 'text-orange-900'} font-medium\`}>`
- L351: `<span className={isSeasonComplete() ? 'text-green-700' : 'text-orange-700'}>Weeks:</span>{' '}`
- L352: `<span className={\`${isSeasonComplete() ? 'text-green-900' : 'text-orange-900'} font-medium\`}>`
- L360: `<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">`
- L361: `<p className="text-blue-800 text-sm">`

### `src/components/operator/LeagueProgressBar.tsx`

- L43: `barColor: 'bg-orange-500',`
- L44: `textColor: 'text-orange-700',`
- L49: `barColor: 'bg-green-500',`
- L50: `textColor: 'text-green-700',`
- L55: `barColor: 'bg-yellow-500',`
- L56: `textColor: 'text-yellow-700',`
- L61: `barColor: 'bg-orange-500',`
- L62: `textColor: 'text-orange-700',`
- L67: `barColor: 'bg-red-500',`
- L68: `textColor: 'text-red-700',`
- L73: `barColor: 'bg-blue-500',`

### `src/components/operator/LeagueStatusCard.tsx`

- L190: `classes: 'bg-blue-100 text-blue-800'`
- L195: `classes: 'bg-green-100 text-green-800'`
- L200: `classes: 'bg-orange-100 text-orange-800'`
- L277: `<div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">`
- L278: `<h3 className="font-semibold text-blue-900 mb-2">`
- L282: `<ul className="list-disc list-inside text-blue-800 space-y-1">`
- L289: `<ol className="list-decimal list-inside text-blue-800 space-y-1">`

### `src/components/operator/OrganizationBasicInfoCard.tsx`

- L121: `<div className="p-3 bg-red-50 border border-red-200 rounded-md">`
- L122: `<p className="text-sm text-red-700">{error}</p>`

### `src/components/operator/PendingInvitesList.tsx`

- L73: `className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"`

### `src/components/operator/PlayoffsCard.tsx`

- L147: `<AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />`
- L182: `<div className="bg-purple-50 rounded-lg p-3 mb-4">`
- L183: `<div className="text-sm font-medium text-purple-800">`
- L186: `<div className="text-xs text-purple-600">`
- L214: `<Check className="h-4 w-4 text-green-600" />`
- L215: `<span className="text-green-700">Regular season complete</span>`
- L219: `<AlertCircle className="h-4 w-4 text-yellow-600" />`
- L220: `<span className="text-yellow-700">`
- L232: `<Check className="h-4 w-4 text-green-600" />`
- L233: `<span className="text-green-700">Playoff matches created</span>`

### `src/components/operator/PreferencesCard.tsx`

- L371: `<Settings className="h-6 w-6 text-indigo-600" />`
- L387: `<Settings className="h-6 w-6 text-indigo-600" />`
- L392: `<p className="text-sm text-red-600">`
- L404: `<Settings className="h-6 w-6 text-indigo-600" />`
- L413: `<div className="p-3 bg-red-50 border border-red-200 rounded-md">`
- L414: `<p className="text-sm text-red-600">{error}</p>`
- L514: `<div className="p-3 bg-blue-50 border border-blue-200 rounded-md">`
- L515: `<p className="text-sm text-blue-700">`

### `src/components/operator/SeasonsCard.tsx`

- L98: `className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"`
- L113: `<div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">`
- L115: `<h3 className="font-semibold text-green-900">{currentSeason.season_name}</h3>`
- L116: `<span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">`
- L122: `<span className="text-green-700">Start Date:</span>{' '}`
- L123: `<span className="text-green-900 font-medium">`
- L128: `<span className="text-green-700">End Date:</span>{' '}`
- L129: `<span className="text-green-900 font-medium">`
- L135: `<span className="text-green-700">Teams:</span>{' '}`
- L136: `<span className="text-green-900 font-medium">{currentSeason.team_count}</span>`
- L141: `<span className="text-green-700">Weeks:</span>{' '}`
- L142: `<span className="text-green-900 font-medium">{currentSeason.week_count}</span>`
- L148: `<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">`
- L149: `<p className="text-blue-800 text-sm">`

### `src/components/operator/StatsCard.tsx`

- L45: `className="h-auto flex-col items-start p-4 hover:bg-blue-50 hover:border-blue-300"`
- L48: `<Trophy className="h-5 w-5 mb-2 text-blue-600" />`
- L58: `className="h-auto flex-col items-start p-4 hover:bg-orange-50 hover:border-orange-300"`
- L61: `<Database className="h-5 w-5 mb-2 text-orange-600" />`

### `src/components/operator/TableBadgePopover.tsx`

- L134: `? 'text-blue-700 border-blue-300 group-hover:border-blue-500'`
- L135: `: 'text-red-700 border-red-300 group-hover:border-red-500'`
- L143: `isAvailable ? 'text-blue-600' : 'text-red-600'`
- L205: `isAvailable ? 'text-red-600' : 'text-green-600'`
- L223: `<div className="px-4 py-2 bg-amber-50 border-t border-amber-200">`
- L224: `<div className="flex items-center gap-2 text-xs text-amber-700">`

### `src/components/operator/TableConfigureModal.tsx`

- L363: `className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-sm hover:bg-orange-200 transition-colo`
- L393: `className="p-1 -m-1 rounded hover:bg-orange-100 transition-colors"`
- L396: `<SkipForward className="h-4 w-4 text-muted-foreground hover:text-orange-600" />`
- L406: `? 'text-red-700 bg-red-50 border-red-300'`
- L407: `: 'text-blue-700 bg-blue-50 border-blue-200'`
- L464: `<p className="text-sm text-red-600">`

### `src/components/operator/TeamsCard.tsx`

- L167: `<a href={\`tel:${team.captain.phone}\`} className="hover:text-blue-600">`
- L173: `<a href={\`mailto:${team.captain.email}\`} className="hover:text-blue-600">`
- L192: `<a href={\`tel:${team.venue.phone}\`} className="hover:text-blue-600">`

### `src/components/operator/VenueCard.tsx`

- L62: `<span className="font-bold text-blue-600">{venue.total_tables}</span>`

### `src/components/operator/VenueCreationModal.tsx`

- L220: `<div className="bg-red-50 border border-red-200 rounded-lg p-4">`
- L221: `<p className="text-red-800 text-sm">{error}</p>`
- L228: `Venue Name <span className="text-red-500">*</span>`
- L242: `Street Address <span className="text-red-500">*</span>`
- L254: `City <span className="text-red-500">*</span>`
- L267: `State <span className="text-red-500">*</span>`
- L285: `Zip Code <span className="text-red-500">*</span>`
- L300: `Phone Number <span className="text-red-500">*</span>`

### `src/components/operator/VenueTableInputs.tsx`

- L163: `<div className="bg-amber-50 border border-amber-200 rounded-lg p-2 w-[160px] self-start">`
- L164: `<p className="text-xs font-semibold text-amber-900 mb-1">Table Setup</p>`
- L165: `<p className="text-xs text-amber-800">`

### `src/components/operator/VenueTableSummaryCard.tsx`

- L57: `<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">`
- L60: `<p className="text-sm text-blue-800">`
- L68: `className="h-7 px-2 text-blue-700 hover:text-blue-900 hover:bg-blue-100"`
- L81: `<span className="inline-flex items-center justify-center w-8 h-8 text-sm font-medium bg-card text-blue-700 rounded border border-blue-300">`
- L84: `<span className="text-[10px] text-blue-600 mt-0.5">`
- L94: `<p className="text-xs text-blue-600 pt-2 border-t border-blue-200">`

### `src/components/PageHeader.tsx`

- L260: `<Building2 className="h-4 w-4 text-blue-600 lg:h-5 lg:w-5" />`
- L261: `<span className="text-sm font-medium text-blue-600 lg:text-base">`

### `src/components/PaymentCardForm.tsx`

- L154: `<div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-in slide-in-from-top-2 duration-300">`
- L156: `<span className="text-green-600 text-xl">✅</span>`
- L158: `<h4 className="font-semibold text-green-800">Card Verified Successfully!</h4>`
- L159: `<p className="text-green-700 text-sm">`
- L162: `<p className="text-green-600 text-xs mt-1">`
- L174: `<div className="bg-green-50 border border-green-200 rounded-lg p-4">`
- L176: `<span className="text-green-600 text-lg">🔒</span>`
- L178: `<h4 className="font-semibold text-green-800 mb-2">`
- L181: `<p className="text-green-700 text-sm mb-2">`
- L184: `<p className="text-green-700 text-sm font-medium">`
- L264: `className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:c`

### `src/components/player/TeamCard.tsx`

- L137: `<div className={\`mt-4 p-3 rounded-lg border ${isReady ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}\`}>`
- L140: `<CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />`
- L142: `<AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />`
- L145: `<p className={\`text-sm font-semibold ${isReady ? 'text-green-900' : 'text-yellow-900'}\`}>`
- L149: `<ul className="text-sm text-yellow-800 mt-1 space-y-1">`

### `src/components/PlayerCombobox.tsx`

- L217: `? 'bg-orange-500 text-white'`

### `src/components/PlayerNameLink.tsx`

- L326: `'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium transition-colors inline-flex items-center gap-1.5',`
- L354: `<div className="text-xs text-amber-600 mt-1">`
- L399: `className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left text-orange-600"`
- L409: `className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left text-red-600"`
- L423: `className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left text-blue-600"`
- L433: `hasMembershipPaid ? "text-red-600" : "text-green-600"`

### `src/components/PlayerRoster.tsx`

- L145: `{isCaptain && <span className="ml-1 text-blue-600 font-bold">(C)</span>}`

### `src/components/playoff/ExampleTeamCountCard.tsx`

- L56: `<div className="p-4 bg-blue-50 rounded-lg space-y-3">`
- L60: `<div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-lg">`
- L66: `<div className="font-medium text-blue-900">`
- L69: `<div className="text-sm text-blue-700 mt-1">`
- L79: `className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"`
- L91: `<div className="pt-3 border-t border-blue-200 space-y-3">`
- L94: `<Users className="h-4 w-4 text-blue-600" />`
- L95: `<span className="text-sm font-medium text-blue-800">Number of teams</span>`
- L116: `<div className="text-xs text-blue-600 bg-blue-100 p-2 rounded">`

### `src/components/playoff/ParticipationSettingsCard.tsx`

- L106: `<div className="p-4 bg-green-50 rounded-lg space-y-3">`
- L110: `<div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-600 text-white font-bold text-sm">`
- L116: `<div className="font-medium text-green-900">`
- L119: `<div className="text-sm text-green-700 mt-1">`
- L129: `className="text-green-700 hover:text-green-900 hover:bg-green-100"`
- L141: `<div className="pt-3 border-t border-green-200 space-y-3">`
- L144: `<span className="text-sm font-medium text-green-800">Teams qualifying</span>`
- L165: `<span className="text-sm text-green-700">Top</span>`
- L176: `<span className="text-sm text-green-700">teams</span>`
- L185: `<span className="text-sm text-green-700">Top</span>`
- L203: `<span className="text-sm text-green-700">of teams</span>`
- L208: `<span className="text-sm text-green-700">Minimum</span>`
- L219: `<span className="text-sm text-green-700">teams</span>`
- L224: `<span className="text-sm text-green-700">Maximum</span>`
- L237: `<span className="text-sm text-green-700">teams (leave empty for no max)</span>`

### `src/components/playoff/PlayoffBracketCard.tsx`

- L167: `<div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">`
- L169: `<div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">`
- L187: `<div className="text-xs text-blue-600 font-medium">HOME</div>`
- L283: `<Trophy className="h-5 w-5 text-purple-600" />`
- L339: `<p className="text-xs text-amber-600 mt-1">`

### `src/components/playoff/PlayoffBracketPreviewCard.tsx`

- L148: `<Trophy className="h-5 w-5 text-purple-600" />`
- L195: `<div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">`
- L201: `<div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">`

### `src/components/playoff/PlayoffMatchRulesCard.tsx`

- L69: `<div className="w-2 h-2 rounded-full bg-purple-600" />`
- L76: `<div className="w-2 h-2 rounded-full bg-purple-600" />`
- L83: `<div className="w-2 h-2 rounded-full bg-purple-600" />`

### `src/components/playoff/PlayoffMatchupCard.tsx`

- L124: `bgColor: 'bg-purple-50',`
- L125: `circleBg: 'bg-purple-600',`
- L126: `textColor: 'text-purple-700',`
- L127: `badgeColor: isHome ? 'text-purple-600' : 'text-purple-500',`
- L138: `bgColor: 'bg-amber-50',`
- L139: `circleBg: 'bg-amber-600',`
- L140: `textColor: 'text-amber-700',`
- L141: `badgeColor: isHome ? 'text-amber-600' : 'text-amber-500',`
- L163: `bgColor: 'bg-indigo-50',`
- L164: `circleBg: 'bg-indigo-600',`
- L165: `textColor: 'text-indigo-700',`
- L166: `badgeColor: isHome ? 'text-indigo-600' : 'text-indigo-500',`
- L175: `bgColor: 'bg-amber-50',`
- L176: `circleBg: 'bg-amber-600',`
- L177: `textColor: 'text-amber-700',`
- L178: `badgeColor: isHome ? 'text-amber-600' : 'text-amber-500',`
- L186: `bgColor: isHome ? 'bg-blue-50' : 'bg-muted',`
- L187: `circleBg: isHome ? 'bg-blue-600' : 'bg-gray-600',`
- L189: `badgeColor: isHome ? 'text-blue-600' : 'text-muted-foreground',`

### `src/components/playoff/PlayoffSettingsCard.tsx`

- L59: `<Settings className="h-5 w-5 text-purple-600" />`

### `src/components/playoff/PlayoffStandingsTable.tsx`

- L99: `if (team.isWildcardEligible) return 'bg-amber-50';`
- L100: `return 'bg-red-50 opacity-60';`
- L108: `if (team.isWildcardEligible) return 'bg-amber-200 text-amber-700';`
- L109: `return 'bg-red-200 text-red-700';`
- L118: `return <span className="ml-2 text-xs text-amber-600">(Wildcard Eligible)</span>;`
- L120: `return <span className="ml-2 text-xs text-red-600">(Not in playoffs)</span>;`

### `src/components/playoff/PlayoffTemplateSelector.tsx`

- L210: `<Trophy className="h-5 w-5 text-purple-600" />`
- L265: `<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">`
- L279: `className={nameMatchesGlobalTemplate ? 'border-red-500' : ''}`
- L282: `<div className="flex items-center gap-1 text-sm text-red-600">`

### `src/components/playoff/PlayoffWeeksCard.tsx`

- L85: `<div className="p-4 bg-purple-50 rounded-lg space-y-3">`
- L89: `<div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-600 text-white font-bold text-lg">`
- L95: `<div className="font-medium text-purple-900">`
- L98: `<div className="text-sm text-purple-700 mt-1">`
- L111: `className="text-purple-700 hover:text-purple-900 hover:bg-purple-100"`
- L124: `<div className="pt-3 border-t border-purple-200 space-y-3">`
- L127: `<Calendar className="h-4 w-4 text-purple-600" />`
- L128: `<span className="text-sm font-medium text-purple-800">Number of weeks</span>`
- L203: `<span className="font-bold text-purple-600">`
- L252: `className="bg-purple-600 hover:bg-purple-700"`

### `src/components/playoff/WildcardSettingsCard.tsx`

- L68: `<div className="p-4 bg-amber-50 rounded-lg space-y-3">`
- L72: `<div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-600 text-white font-bold text-sm">`
- L78: `<div className="font-medium text-amber-900">`
- L81: `<div className="text-sm text-amber-700 mt-1">`
- L91: `className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"`
- L103: `<div className="pt-3 border-t border-amber-200 space-y-3">`
- L106: `<Shuffle className="h-4 w-4 text-amber-600" />`
- L107: `<span className="text-sm font-medium text-amber-800">Wildcard spots</span>`
- L118: `<span className="text-sm text-amber-700">(0 = disabled)</span>`
- L122: `<div className="text-xs text-amber-600 bg-amber-100 p-2 rounded">`

### `src/components/privacy/ContactInfoExposure.tsx`

- L79: `bg: 'bg-green-50',`
- L80: `border: 'border-green-200',`
- L81: `text: 'text-green-800',`
- L82: `accent: 'text-green-600'`
- L88: `bg: 'bg-yellow-50',`
- L89: `border: 'border-yellow-200',`
- L90: `text: 'text-yellow-800',`
- L91: `accent: 'text-yellow-600'`
- L95: `bg: 'bg-red-50',`
- L96: `border: 'border-red-200',`
- L97: `text: 'text-red-800',`
- L98: `accent: 'text-red-600'`
- L179: `{required && <span className="text-red-500 ml-1">*</span>}`
- L202: `<div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">`
- L208: `<div className="bg-amber-50 border border-amber-200 rounded-lg p-4">`
- L210: `<span className="text-amber-600 text-sm">ℹ️</span>`
- L211: `<div className="text-sm text-amber-800">`

### `src/components/privacy/VisibilityChoiceCard.tsx`

- L87: `? 'border-blue-500 bg-blue-500'`

### `src/components/PWAInstallPrompt.tsx`

- L107: `<Card className="border-blue-200 bg-blue-50">`
- L110: `<div className="p-2 bg-blue-100 rounded-lg shrink-0">`
- L111: `<Smartphone className="h-5 w-5 text-blue-600" />`

### `src/components/RegisterPlayerModal.tsx`

- L305: `<div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">`
- L306: `<AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />`
- L307: `<div className="text-xs text-amber-800">`
- L315: `<div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">`
- L316: `<AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />`
- L317: `<div className="text-xs text-blue-800">`
- L340: `<Check className="h-4 w-4 text-green-600" />`
- L347: `<p className="text-xs text-green-600">Link copied to clipboard!</p>`
- L392: `<p className="text-xs text-amber-600 text-center">`
- L432: `<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">`
- L433: `<p className="text-sm text-blue-800">`
- L483: `<div className="p-3 bg-red-50 border border-red-200 rounded-lg">`
- L484: `<p className="text-sm text-red-800">{error}</p>`
- L523: `<div className="p-4 bg-green-100 rounded-full">`
- L524: `<Mail className="h-8 w-8 text-green-600" />`
- L540: `<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">`
- L541: `<p className="text-xs text-amber-800">`

### `src/components/ReportUserModal.tsx`

- L101: `icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}`
- L106: `<div className="p-3 bg-orange-50 border border-orange-200 rounded-md">`
- L107: `<p className="text-sm text-orange-800">`
- L110: `<p className="text-xs text-orange-700 mt-1">`
- L153: `<div className="p-3 bg-blue-50 border border-blue-200 rounded-md">`
- L154: `<p className="text-xs text-blue-800">`
- L161: `<div className="p-3 bg-red-50 border border-red-200 rounded-md">`
- L162: `<p className="text-sm text-red-700">{error}</p>`
- L181: `className="bg-orange-600 hover:bg-orange-700"`

### `src/components/schedule/MatchEditRow.tsx`

- L162: `className={\`p-2 h-9 w-9 ${venueOverride ? 'text-orange-600' : 'text-blue-600'}\`}`
- L198: `<span className="text-xs text-amber-600">`

### `src/components/schedule/ScheduleErrorState.tsx`

- L32: `<h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>`

### `src/components/schedule/WeekEditorView.tsx`

- L188: `<Card className="border-blue-200 bg-blue-50/30">`
- L189: `<CardHeader className="bg-blue-100/50 rounded-t-xl -my-6 py-3">`
- L195: `<span className="text-xs font-semibold px-2 py-1 rounded bg-blue-600 text-white">`
- L257: `<div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">`
- L258: `<p className="text-red-800 text-sm">{error}</p>`
- L264: `<div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">`
- L265: `<p className="text-amber-800 text-sm">`

### `src/components/scoring/ConfirmationDialog.tsx`

- L95: `<DialogTitle className="text-orange-600">`
- L119: `<div className="text-center text-lg font-semibold text-orange-600">`
- L122: `<div className="bg-orange-50 border border-orange-200 rounded p-3 mt-4">`
- L147: `<div className="text-blue-600 font-semibold">`
- L152: `<div className="text-green-600 font-semibold">`
- L157: `<div className="text-purple-600 font-semibold">`
- L165: `<div className="text-amber-700">`

### `src/components/scoring/ConfirmationModal.tsx`

- L61: `<DialogTitle className="text-orange-600">⚠️ Confirm Vacate Winner</DialogTitle>`
- L83: `<div className="text-center text-lg font-semibold text-orange-600">`
- L86: `<div className="bg-orange-50 border border-orange-200 rounded p-3 mt-4">`
- L101: `<div className="text-blue-600">`
- L105: `<div className="text-green-600">`

### `src/components/scoring/EditGameDialog.tsx`

- L74: `<div className="bg-yellow-50 border border-yellow-200 rounded p-3">`
- L81: `<div className="bg-orange-50 border border-orange-200 rounded p-3">`

### `src/components/scoring/GameButtonRow.tsx`

- L76: `const winnerClass = 'bg-yellow-100 font-semibold';`
- L95: `className="text-xs px-1 bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold"`
- L118: `const winnerClass = 'bg-green-200 font-semibold';`

### `src/components/scoring/GamesList.tsx`

- L176: `const winnerClass = isConfirmed ? 'bg-green-200 font-semibold' : 'bg-yellow-100 font-semibold';`
- L191: `className={\`w-full ${leftWon ? 'bg-red-100 font-semibold' : 'bg-card text-muted-foreground'}\`}`
- L200: `className={\`text-xs px-1 ${iRequestedVacate ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-red-50 border-red-300 text-red-700 hove`
- L213: `className={\`w-full ${rightWon ? 'bg-red-100 font-semibold' : 'bg-card text-muted-foreground'}\`}`
- L283: `className={\`w-full ${leftIsHome ? 'bg-blue-100 hover:bg-blue-200' : 'bg-orange-100 hover:bg-orange-200'}\`}`
- L294: `className={\`w-full ${rightIsHome ? 'bg-blue-100 hover:bg-blue-200' : 'bg-orange-100 hover:bg-orange-200'}\`}`

### `src/components/scoring/LineupChangeModal.tsx`

- L150: `<p className="text-sm text-red-600">`

### `src/components/scoring/LineupChangeRequestModal.tsx`

- L76: `<div className="text-center p-3 bg-red-50 rounded-lg border border-red-200 min-w-[100px]">`
- L77: `<p className="text-xs text-red-600 mb-1">Removing</p>`
- L78: `<p className="font-semibold text-red-900">{oldPlayerName}</p>`
- L85: `<div className="text-center p-3 bg-green-50 rounded-lg border border-green-200 min-w-[100px]">`
- L86: `<p className="text-xs text-green-600 mb-1">Adding</p>`
- L87: `<p className="font-semibold text-green-900">{newPlayerName}</p>`
- L100: `className="flex-1 border-red-300 text-red-600 hover:bg-red-50"`
- L107: `className="flex-1 bg-green-600 hover:bg-green-700"`

### `src/components/scoring/MatchEndVerification.tsx`

- L573: `<div className="text-lg font-bold text-blue-600 mt-1">`
- L578: `<div className="text-lg font-bold text-orange-600 mt-1">`
- L597: `result === 'home_win' ? 'bg-blue-50' : ''`
- L603: `? 'text-lg font-bold text-blue-600'`
- L612: `? 'text-lg font-bold text-blue-600'`
- L621: `? 'text-lg font-bold text-blue-600'`
- L635: `result === 'away_win' ? 'bg-orange-50' : ''`
- L641: `? 'text-lg font-bold text-blue-600'`
- L650: `? 'text-lg font-bold text-blue-600'`
- L659: `? 'text-lg font-bold text-blue-600'`
- L672: `<div className="bg-purple-50 px-3 py-2 text-center">`
- L673: `<span className="text-sm font-bold text-purple-600">`
- L687: `homeVerified ? 'text-green-600' : 'text-muted-foreground'`
- L694: `awayVerified ? 'text-green-600' : 'text-muted-foreground'`
- L723: `<div className="text-center text-sm font-medium text-green-600">`

### `src/components/scoring/TableNumberBar.tsx`

- L114: `<div className="w-full bg-blue-50 border-b border-blue-100 relative">`
- L117: `className="w-full px-4 py-2 text-center hover:bg-blue-100 transition-colors"`
- L119: `<span className="text-sm font-medium text-blue-800">`
- L141: `className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded hover:bg-blue-200 transition-colors text-blue-800"`

### `src/components/scoring/TiebreakerScoreboard.tsx`

- L118: `<div className="text-center bg-blue-100 rounded-lg p-4">`
- L135: `<div className="text-center bg-orange-100 rounded-lg p-4">`

### `src/components/scoring/UnifiedScoreboard.tsx`

- L477: `icon: <UserRoundPen className="h-4 w-4 text-purple-600" />,`
- L480: `'flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left text-purple-600',`

### `src/components/season/ConflictBadge.tsx`

- L22: `critical: 'bg-red-100 text-red-800 border-red-200',`
- L23: `high: 'bg-orange-100 text-orange-800 border-orange-200',`
- L24: `medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',`
- L25: `low: 'bg-blue-100 text-blue-800 border-blue-200',`

### `src/components/season/ScheduleReview.tsx`

- L336: `<div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">`
- L337: `<p className="text-orange-800 font-medium">`
- L341: `<p className="text-orange-700 text-sm mt-1">`

### `src/components/season/ScheduleWeekRow.tsx`

- L73: `? 'bg-orange-50'`
- L99: `<span className="hidden lg:block text-red-600 font-medium">🔴 Critical</span>`
- L100: `<span className="lg:hidden text-red-600 font-medium">🔴</span>`
- L105: `<span className="hidden lg:block text-orange-600 font-medium">🟠 High</span>`
- L106: `<span className="lg:hidden text-orange-600 font-medium">🟠</span>`
- L111: `<span className="hidden lg:block text-yellow-600 font-medium">🟡 Medium</span>`
- L112: `<span className="lg:hidden text-yellow-600 font-medium">🟡</span>`
- L117: `<span className="hidden lg:block text-blue-600 font-medium">🔵 Low</span>`
- L118: `<span className="lg:hidden text-blue-600 font-medium">🔵</span>`
- L124: `<span className="hidden lg:block text-green-600 font-medium">✓ Play</span>`
- L125: `<span className="lg:hidden text-green-600 font-medium">✓</span>`

### `src/components/shared/ConfirmDialog.tsx`

- L70: `? 'bg-red-600 hover:bg-red-700 focus:ring-red-600'`

### `src/components/shared/SelectedUserChips.tsx`

- L26: `<div className="px-6 pt-4 border-b bg-blue-50">`
- L28: `<Users className="h-4 w-4 text-blue-600" />`
- L29: `<span className="text-sm font-medium text-blue-900">`
- L37: `className="bg-card border border-blue-300 rounded-full px-3 py-1 text-sm flex items-center gap-2"`

### `src/components/StatsNavBar.tsx`

- L75: `? 'border-blue-600 text-blue-600 font-semibold'`

### `src/components/TableSizeLabel.tsx`

- L10: `* <TableSizeLabel sizeKey="regulation_tables" className="text-blue-600" />`
- L52: `'text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors',`

### `src/components/TeamNameLink.tsx`

- L95: `'text-blue-600 font-medium',`
- L109: `'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium transition-colors',`
- L144: `<span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">`

### `src/components/TeamRosterList.tsx`

- L57: `<span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">`

### `src/components/UnsavedChangesDialog.tsx`

- L93: `className="bg-red-600 hover:bg-red-700"`

### `src/components/VenueListItem.tsx`

- L77: `<span className={\`text-xs ${isAtCapacity ? 'text-orange-600 font-medium' : 'text-muted-foreground'}\`}>`

### `src/components/VenueWithMaps.tsx`

- L125: `{showIcon && <MapPin className="h-3 w-3 flex-shrink-0 text-blue-600 hover:text-blue-800" />}`
- L126: `<span className="text-blue-600 hover:text-blue-800">`

### `src/components/wizard/SelectableCard.tsx`

- L52: `? 'border-blue-500 bg-blue-50 shadow-sm'`

### `src/components/wizard/WizardFlowShell.tsx`

- L58: `return <div className="p-4 text-sm text-red-600">No stages configured.</div>;`

### `src/components/wizard/WizardShell.tsx`

- L48: `return <div className="p-4 text-sm text-red-600">No steps configured.</div>;`
- L76: `<div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">`

### `src/components/wizard/WizardSummary.tsx`

- L37: `<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">`
- L38: `<h3 className="text-sm font-medium text-blue-900 mb-2">{title}</h3>`
- L41: `<p className="text-lg font-bold text-blue-900 mb-3 capitalize">`
- L49: `<span className="font-medium text-blue-800">{item.label}</span>`

### `src/constants/infoContent/operatorApplicationInfoContent.tsx`

- L25: `<p className="mt-3 text-xs text-blue-600">`
- L74: `<p className="mt-3 text-xs text-blue-600">`
- L100: `<p className="mt-3 text-xs text-blue-600">`

### `src/data/seasonWizardSteps.tsx`

- L156: `className="text-blue-600 hover:text-blue-800 underline"`
- L171: `className="text-blue-600 hover:text-blue-800 underline"`
- L263: `className="text-blue-600 hover:text-blue-800 underline"`

### `src/dev/RLSTestPage.tsx`

- L596: `<Card key={index} className={\`border-2 ${result.testPassed ? 'border-green-500' : 'border-red-500'}\`}>`
- L606: `<span className="text-green-600">✅ Success {result.insertedId && \`(ID: ${result.insertedId.slice(0, 8)}...)\`}</span>`
- L608: `<span className="text-red-600">❌ Failed</span>`
- L612: `<div className="text-sm text-red-600 ml-16">{result.insertError}</div>`
- L621: `<span className="text-green-600">✅ Success</span>`
- L623: `<span className="text-red-600">❌ Failed</span>`
- L627: `<div className="text-sm text-red-600 ml-16">{result.deleteError}</div>`
- L633: `<div className="text-green-600 font-semibold">✅ TEST PASSED</div>`
- L635: `<div className="text-red-600 font-semibold">❌ TEST FAILED</div>`

### `src/info/EightManFormatDetails.tsx`

- L48: `<div className="bg-blue-50 p-4 rounded-md border border-blue-200">`
- L49: `<p className="font-semibold text-blue-900">Key Characteristics:</p>`
- L50: `<ul className="list-disc ml-5 mt-2 text-blue-800">`
- L107: `<div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">`
- L108: `<p className="font-semibold text-yellow-900 mb-2">Traditional Approach:</p>`
- L109: `<p className="text-sm text-yellow-800">`
- L115: `<div className="bg-blue-50 p-4 rounded-md border border-blue-200">`
- L116: `<p className="font-semibold text-blue-900 mb-2">BCA Handicap Tables:</p>`
- L117: `<p className="text-sm text-blue-800">`
- L140: `<div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mt-4">`
- L141: `<h4 className="font-semibold text-yellow-900 mb-2">Considerations:</h4>`
- L142: `<ul className="list-disc ml-5 text-sm text-yellow-800 space-y-1">`

### `src/info/FiveManFormatDetails.tsx`

- L47: `<div className="bg-blue-50 p-4 rounded-md border border-blue-200">`
- L48: `<p className="font-semibold text-blue-900">Key Benefits:</p>`
- L49: `<ul className="list-disc ml-5 mt-2 text-blue-800">`
- L59: `<div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mt-4">`
- L60: `<p className="text-sm text-yellow-900 mb-2">`
- L64: `<p className="text-sm text-yellow-800">`
- L96: `<div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">`
- L97: `<h4 className="font-semibold text-yellow-900 mb-2">Important: All 18 Games Are Played</h4>`
- L98: `<p className="text-sm text-yellow-800">`
- L198: `<div className="bg-blue-50 p-4 rounded-md border border-blue-200">`
- L235: `<div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mt-4">`
- L236: `<p className="font-semibold text-yellow-900 mb-2">Starting Skill Level</p>`
- L237: `<p className="text-sm text-yellow-800">`
- L241: `<p className="text-xs text-yellow-700 mt-2 italic">`
- L255: `<div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">`
- L283: `<div className="bg-blue-50 p-3 rounded-md border border-blue-200">`
- L291: `<div className="bg-blue-50 p-3 rounded-md border border-blue-200">`
- L299: `<div className="bg-blue-50 p-3 rounded-md border border-blue-200">`
- L307: `<div className="bg-blue-50 p-3 rounded-md border border-blue-200">`
- L315: `<div className="bg-green-50 p-3 rounded-md border border-green-200 mt-4">`
- L316: `<p className="font-semibold text-green-900 mb-1">Why This Matters:</p>`
- L317: `<p className="text-sm text-green-800">`
- L335: `<div className="lg:col-span-2 bg-blue-50 p-4 rounded-md border border-blue-200">`
- L357: `<div className="pt-2 border-t border-blue-300">`
- L383: `<p className="text-sm text-blue-800 mt-3 font-medium italic">`
- L399: `<th className="text-center py-2 px-1 bg-green-100">Win</th>`
- L400: `<th className="text-center py-2 px-1 bg-yellow-100">Tie</th>`
- L401: `<th className="text-center py-2 px-1 bg-red-100">Loss</th>`
- L417: `<tr className="bg-blue-50"><td className="py-1 px-1 text-center font-mono font-bold">0</td><td className="py-1 px-1 text-center font-bold">1`
- L451: `<div className="bg-blue-50 p-4 rounded-md border border-blue-200">`
- L452: `<h4 className="font-semibold text-blue-900 mb-3">Playoff Rules:</h4>`
- L453: `<ul className="list-disc ml-5 text-sm text-blue-800 space-y-2">`
- L468: `<div className="bg-green-50 p-4 rounded-md border border-green-200">`
- L469: `<h4 className="font-semibold text-green-900 mb-2">Playoff Handicap Scoring:</h4>`
- L470: `<p className="text-sm text-green-800 mb-2">`
- L473: `<ul className="list-disc ml-5 text-sm text-green-800 space-y-1">`
- L483: `<p className="text-xs text-green-700 mt-3 italic">`
- L501: `<div className="bg-blue-50 p-4 rounded-md border border-blue-200">`
- L502: `<h4 className="font-semibold text-blue-900 mb-2">1. Team Match Wins (Primary)</h4>`
- L503: `<p className="text-sm text-blue-800 mb-2">`
- L507: `<p className="text-xs text-blue-700 italic">`
- L513: `<div className="bg-green-50 p-4 rounded-md border border-green-200">`
- L514: `<h4 className="font-semibold text-green-900 mb-2">2. Team Points (Secondary)</h4>`
- L515: `<p className="text-sm text-green-800 mb-3">`
- L519: `<ul className="list-disc ml-5 text-sm text-green-800 space-y-2">`
- L532: `<p className="text-xs text-green-700 mt-2 italic">`
- L537: `<div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">`
- L538: `<h4 className="font-semibold text-yellow-900 mb-2">3. Total Games Won (Tie-Breaker)</h4>`
- L539: `<p className="text-sm text-yellow-800 mb-2">`
- L543: `<p className="text-xs text-yellow-700 italic">`
- L610: `<div className="bg-green-50 p-4 rounded-md border border-green-200">`
- L611: `<h4 className="font-semibold text-green-900 mb-2">✓ Transparent Calculations</h4>`
- L612: `<p className="text-sm text-green-800">`
- L618: `<div className="bg-green-50 p-4 rounded-md border border-green-200">`
- L619: `<h4 className="font-semibold text-green-900 mb-2">✓ Team Modifier Balancing</h4>`
- L620: `<p className="text-sm text-green-800">`
- L627: `<div className="bg-green-50 p-4 rounded-md border border-green-200">`
- L628: `<h4 className="font-semibold text-green-900 mb-2">✓ Every Single Game Matters</h4>`
- L629: `<p className="text-sm text-green-800">`
- L636: `<div className="bg-green-50 p-4 rounded-md border border-green-200">`
- L637: `<h4 className="font-semibold text-green-900 mb-2">✓ Handicap Responsiveness</h4>`
- L638: `<p className="text-sm text-green-800 mb-2">`
- L642: `<p className="text-sm text-green-800">`
- L649: `<div className="bg-green-50 p-4 rounded-md border border-green-200">`
- L650: `<h4 className="font-semibold text-green-900 mb-2">✓ Hard to Game</h4>`
- L651: `<p className="text-sm text-green-800">`
- L705: `<span className="text-green-600 font-bold mr-2">✓</span>`
- L709: `<span className="text-green-600 font-bold mr-2">✓</span>`
- L713: `<span className="text-green-600 font-bold mr-2">✓</span>`
- L717: `<span className="text-green-600 font-bold mr-2">✓</span>`
- L721: `<span className="text-green-600 font-bold mr-2">✓</span>`

### `src/info/FormatComparison.tsx`

- L49: `<th className="text-left py-3 px-4 bg-green-50">5-Man Format</th>`
- L56: `<td className="py-3 px-4 bg-green-50">5 players</td>`
- L61: `<td className="py-3 px-4 bg-green-50">3 vs 3 (6 total)</td>`
- L66: `<td className="py-3 px-4 bg-green-50">6 games</td>`
- L71: `<td className="py-3 px-4 bg-green-50">18 games</td>`
- L76: `<td className="py-3 px-4 bg-green-50">Double round robin</td>`
- L81: `<td className="py-3 px-4 bg-green-50">2-2.5 hours</td>`
- L86: `<td className="py-3 px-4 bg-green-50">6-10 people around tables</td>`
- L91: `<td className="py-3 px-4 bg-green-50">Dynamic, auto-adjusting</td>`
- L96: `<td className="py-3 px-4 bg-green-50">Minimal</td>`
- L101: `<td className="py-3 px-4 bg-green-50">Easier (5 players)</td>`
- L111: `<Card className="p-6 bg-green-50 border-green-200">`
- L112: `<h3 className="text-xl font-bold text-green-900 mb-3">5-Man Format</h3>`
- L113: `<p className="text-sm text-green-800 mb-3">Best for:</p>`
- L114: `<ul className="list-disc ml-5 text-sm text-green-800 space-y-1">`

### `src/leagueOperator/BecomeLeagueOperator.tsx`

- L41: `<Button loadingText="none" size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8">`
- L57: `<div className="bg-green-50 rounded-lg p-6">`
- L58: `<h3 className="font-semibold text-green-800 mb-4 text-lg">Benefits</h3>`
- L59: `<ul className="space-y-2 text-green-700">`
- L61: `<span className="text-green-600 mr-2">✓</span>`
- L65: `<span className="text-green-600 mr-2">✓</span>`
- L69: `<span className="text-green-600 mr-2">✓</span>`
- L73: `<span className="text-green-600 mr-2">✓</span>`
- L77: `<span className="text-green-600 mr-2">✓</span>`
- L81: `<span className="text-green-600 mr-2">✓</span>`
- L86: `<div className="bg-blue-50 rounded-lg p-6">`
- L87: `<h3 className="font-semibold text-blue-800 mb-4 text-lg">Perfect For</h3>`
- L88: `<ul className="space-y-2 text-blue-700">`
- L107: `<div className="text-sm text-blue-200 mb-1">only</div>`
- L109: `<div className="text-blue-100">per team, per week</div>`
- L110: `<div className="text-xs text-blue-200 mt-2">+ $10 setup per season</div>`
- L139: `<Link to="/pricing" className="text-blue-600 hover:text-blue-800 font-medium text-lg">`
- L176: `<p className="text-blue-100 mb-6 text-lg">`
- L180: `<Button loadingText="none" size="lg" className="bg-card text-blue-600 hover:bg-muted px-8">`

### `src/leagueOperator/ChoiceStep.tsx`

- L94: `? 'bg-blue-600 hover:bg-blue-700 text-white'`
- L113: `<p className="text-red-500 text-sm mt-2">{error}</p>`
- L129: `className="bg-blue-600 hover:bg-blue-700 text-white"`

### `src/leagueOperator/LeagueOperatorApplication.tsx`

- L347: `className="bg-blue-600 hover:bg-blue-700 text-white"`

### `src/leagueOperator/questionDefinitions.tsx`

- L259: `<div className="bg-amber-50 border border-amber-200 rounded-lg p-4">`
- L260: `<h4 className="font-semibold text-amber-800 mb-2">`
- L263: `<p className="text-amber-700 mb-3">`
- L271: `className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded-md transition-colors"`
- L278: `<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">`
- L279: `<h4 className="font-semibold text-blue-800 mb-2">`
- L282: `<p className="text-blue-700 mb-3">`
- L288: `className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded-md transition-colors"`
- L307: `className="w-4 h-4 text-blue-600 bg-muted border-border rounded focus:ring-blue-500 focus:ring-2"`
- L390: `return 'border-red-300 bg-red-50';`
- L402: `<p className="mt-1 text-sm text-red-600">`
- L419: `? 'bg-blue-600 text-white'`
- L429: `? 'bg-blue-600 text-white'`
- L531: `return 'border-red-300 bg-red-50';`
- L543: `<p className="mt-1 text-sm text-red-600">`
- L560: `? 'bg-blue-600 text-white'`
- L570: `? 'bg-blue-600 text-white'`

### `src/leagueOperator/QuestionStep.tsx`

- L115: `error ? 'border-red-500' : 'border-border'`
- L119: `<p className="text-red-500 text-sm mt-2">{error}</p>`
- L130: `className="w-4 h-4 text-blue-600 bg-muted border-border rounded focus:ring-blue-500"`
- L153: `className="bg-blue-600 hover:bg-blue-700 text-white"`

### `src/leagueOperator/VisibilityChoiceCard.tsx`

- L87: `? 'border-blue-500 bg-blue-500'`

### `src/login/ClaimPlayer.tsx`

- L430: `<AlertTriangle className="h-16 w-16 text-amber-500" />`
- L450: `<Clock className="h-16 w-16 text-amber-500" />`
- L478: `<UserCheck className="h-16 w-16 text-green-600" />`
- L504: `<CheckCircle className="h-16 w-16 text-green-600" />`
- L510: `<div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">`
- L511: `<p className="text-sm font-medium text-green-800 mb-2">`
- L514: `<ul className="text-sm text-green-700 space-y-1">`
- L568: `<AlertTriangle className="h-16 w-16 text-red-500" />`
- L596: `<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">`
- L598: `<Users className="h-6 w-6 text-blue-600 mt-0.5" />`
- L600: `<p className="font-medium text-blue-900">`
- L607: `<p className="text-sm text-blue-700 mb-2">`
- L612: `<li key={team.team_id} className="text-base font-semibold text-blue-800">`
- L619: `<p className="text-lg font-semibold text-blue-800 mt-1">`
- L657: `<div className="bg-amber-50 border border-amber-200 rounded-lg p-3">`
- L659: `<AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />`
- L660: `<div className="text-sm text-amber-800">`

### `src/login/EmailConfirmation.tsx`

- L64: `<div className="text-green-600">{message}</div>`
- L67: `<div className="text-red-600">{message}</div>`

### `src/login/ForgotPassword.tsx`

- L69: `<Mail className="h-16 w-16 text-blue-600" />`
- L104: `<p className={\`text-sm mt-2 ${resendMessage.includes('Error') ? 'text-red-500' : 'text-green-600'}\`}>`

### `src/login/Login.tsx`

- L131: `<p className={\`text-sm mt-4 text-center ${message.includes('Error') ? 'text-red-500' : 'text-green-600'}\`}>`

### `src/login/Register.tsx`

- L243: `<AlertTriangle className="h-16 w-16 text-amber-500" />`
- L268: `<UserCheck className="h-16 w-16 text-green-600" />`
- L270: `<Mail className="h-16 w-16 text-green-600" />`
- L311: `<p className={\`text-sm mt-2 ${resendMessage.includes('Error') ? 'text-red-500' : 'text-green-600'}\`}>`
- L334: `<div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">`
- L336: `<UserCheck className="h-5 w-5 text-blue-600 shrink-0" />`
- L338: `<p className="text-sm font-medium text-blue-900">`
- L341: `<p className="text-xs text-blue-700">`
- L443: `<p className="text-sm mt-2 text-red-500">`

### `src/newPlayer/FormField.tsx`

- L49: `{required && <span className="text-red-500 ml-1">*</span>}`
- L66: `<p className="text-sm text-red-500 mt-1">{error}</p>`
- L85: `{required && <span className="text-red-500 ml-1">*</span>}`
- L100: `<p className="text-sm text-red-500 mt-1">{error}</p>`

### `src/newPlayer/NewPlayerForm.tsx`

- L153: `<div className="p-3 bg-red-50 border border-red-200 rounded-md">`
- L154: `<p className="text-sm text-red-600">{state.errors.general}</p>`

### `src/operator/components/AttachPlaceholderDialog.tsx`

- L132: `<div className="rounded-md bg-amber-50 border border-amber-200 p-3">`
- L133: `<p className="text-xs text-amber-700 font-medium">Placeholder</p>`
- L134: `<p className="text-sm font-semibold text-amber-900">`
- L136: `<span className="text-amber-700 font-normal">`
- L158: `<div className="rounded-md bg-green-50 border border-green-200 p-3">`
- L159: `<p className="text-xs text-green-700 font-medium">Will attach to</p>`
- L160: `<p className="text-sm font-semibold text-green-900">`

### `src/operator/components/OrgPlaceholdersCard.tsx`

- L175: `<Users className="h-5 w-5 text-blue-600" />`
- L221: `<span className="ml-auto inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800">`
- L238: `<span className="inline-flex items-center rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">`
- L242: `<span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">`
- L254: `<div className="flex items-start gap-2 text-sm text-red-700">`
- L375: `'border border-red-300 bg-red-50 rounded-md px-3 my-1'`
- L390: `<span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 shrink-0">`
- L394: `<span className="inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white shrink-0">`
- L403: `<span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 shrink-0">`
- L485: `? 'text-red-700 hover:text-red-800 hover:bg-red-50 border-red-200'`

### `src/operator/components/RemovePlaceholderDialog.tsx`

- L195: `<XCircle className="h-5 w-5 text-red-600" />`
- L203: `<XCircle className="h-5 w-5 text-amber-600" />`
- L217: `<AlertTriangle className="h-5 w-5 text-red-600" />`

### `src/operator/components/UnmergePlayerDialog.tsx`

- L161: `<AlertTriangle className="h-5 w-5 text-red-600" />`
- L174: `<div className="rounded-md bg-amber-50 border border-amber-200 p-3">`
- L175: `<p className="text-xs text-amber-700 font-medium">`
- L178: `<p className="font-semibold text-amber-900">`
- L187: `<p className="text-xs text-amber-700 mt-1">`
- L194: `<div className="rounded-md bg-red-50 border border-red-200 p-3">`
- L195: `<p className="text-xs text-red-700 font-medium">`
- L293: `<span className="text-blue-700"> · self-claim</span>`
- L374: `<ul className="list-disc list-inside text-red-900 space-y-0.5 mt-1">`

### `src/operator/LeagueDetail.tsx`

- L139: `<h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>`
- L143: `className="px-4 py-2 bg-blue-600 text-white rounded-lg"`
- L209: `iconColor="text-indigo-600"`

### `src/operator/LeagueSettings.tsx`

- L95: `<h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>`
- L99: `className="px-4 py-2 bg-blue-600 text-white rounded-lg"`
- L126: `iconColor="text-blue-600"`

### `src/operator/OperatorDashboard.tsx`

- L74: `iconColor="text-purple-600"`
- L83: `iconColor="text-green-600"`
- L92: `iconColor="text-red-600"`
- L109: `iconColor="text-indigo-600"`
- L126: `<Card className="bg-blue-50 border-blue-200">`
- L128: `<CardTitle className="text-lg text-blue-900">Need Help?</CardTitle>`
- L132: `<Link to="#" className="flex items-center gap-2 text-blue-700 hover:text-blue-900">`
- L136: `<Link to="#" className="flex items-center gap-2 text-blue-700 hover:text-blue-900">`
- L140: `<Link to="#" className="flex items-center gap-2 text-blue-700 hover:text-blue-900">`
- L144: `<Link to="#" className="flex items-center gap-2 text-blue-700 hover:text-blue-900">`

### `src/operator/OperatorWelcome.tsx`

- L43: `<h2 className="text-2xl text-blue-600 font-semibold mb-4">`
- L58: `<div className="text-center p-6 bg-blue-50 rounded-xl">`
- L65: `<div className="text-center p-6 bg-green-50 rounded-xl">`
- L72: `<div className="text-center p-6 bg-purple-50 rounded-xl">`
- L83: `<div className="mb-10 bg-amber-50 border border-amber-200 rounded-xl p-6">`
- L84: `<h3 className="text-xl font-bold text-amber-800 mb-4">`
- L87: `<div className="space-y-3 text-amber-800">`
- L89: `<span className="font-bold text-amber-600">1.</span>`
- L93: `<span className="font-bold text-amber-600">2.</span>`
- L97: `<span className="font-bold text-amber-600">3.</span>`
- L109: `className="w-full sm:w-auto bg-blue-600 text-white px-8 py-3 text-lg font-semibold"`
- L117: `className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold"`
- L126: `className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold"`
- L148: `<a href="#" className="text-blue-600 hover:text-blue-800 font-medium">`
- L151: `<a href="#" className="text-blue-600 hover:text-blue-800 font-medium">`
- L154: `<a href="#" className="text-blue-600 hover:text-blue-800 font-medium">`

### `src/operator/OrganizationSettings.tsx`

- L61: `<h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>`
- L67: `className="px-4 py-2 bg-blue-600 text-white rounded-lg"`
- L114: `iconColor="text-teal-600"`
- L124: `iconColor="text-blue-600"`
- L140: `iconColor="text-purple-600"`

### `src/operator/PlayerManagement.tsx`

- L212: `<Card className="rounded-none lg:rounded-xl bg-yellow-50 border-yellow-200">`
- L217: `className="text-sm font-semibold text-yellow-900"`
- L259: `<div className="p-3 bg-green-100 rounded-lg">`
- L260: `<Users className="h-8 w-8 text-green-600" />`
- L276: `<p className="text-xl font-bold text-amber-600">{playerStats?.placeholders ?? '-'}</p>`
- L280: `<p className="text-xl font-bold text-blue-600">{playerStats?.identified_placeholders ?? '-'}</p>`
- L328: `? 'text-green-600'`
- L330: `? 'text-amber-600'`
- L429: `<p className="text-xs text-blue-600 hover:text-blue-800 uppercase mb-1">`
- L436: `? 'text-green-600'`
- L437: `: 'text-amber-600'`
- L490: `<Card className="rounded-none lg:rounded-xl border-amber-300 bg-amber-50">`
- L493: `<AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />`
- L495: `<p className="font-medium text-amber-800">`
- L498: `<p className="text-sm text-amber-700 mt-1">`
- L514: `<div className="p-3 bg-blue-50 rounded-md">`
- L516: `<p className="text-2xl font-bold text-blue-600">`
- L610: `? 'text-amber-600'`
- L624: `? 'text-amber-600'`
- L640: `className="text-blue-600 hover:text-blue-800 font-medium"`
- L742: `<div className="p-2 bg-blue-100 rounded-lg">`
- L743: `<Mail className="h-5 w-5 text-blue-600" />`
- L749: `<p className="text-2xl font-bold text-blue-600">{pendingCount}</p>`
- L753: `<p className="text-2xl font-bold text-amber-600">{expiredCount}</p>`
- L757: `<p className="text-2xl font-bold text-green-600">{claimedCount}</p>`

### `src/operator/PlayoffSetup.tsx`

- L89: `<td className="py-2 px-3 text-center text-green-600 font-medium">{team.matchWins}</td>`
- L90: `<td className="py-2 px-3 text-center text-red-600 font-medium">{team.matchLosses}</td>`
- L108: `<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">`
- L110: `<AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />`
- L112: `<div className="font-medium text-yellow-800">Team Not In Playoffs</div>`
- L113: `<div className="text-sm text-yellow-700 mt-1">`
- L407: `<Card className="border-red-200 bg-red-50">`
- L410: `<AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />`
- L412: `<div className="font-medium text-red-800">Error</div>`
- L413: `<div className="text-sm text-red-700 mt-1">{error}</div>`
- L445: `<div className="flex items-center gap-2 text-purple-700">`
- L462: `<div className="flex items-center gap-2 text-green-600">`
- L467: `<div className="flex items-center gap-2 text-yellow-600">`
- L483: `<p className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">`
- L560: `className="bg-purple-600 hover:bg-purple-700"`

### `src/operator/PlayoffsSetupWizard.tsx`

- L342: `<Card className="border-blue-200 bg-blue-50">`
- L345: `<Users className="h-6 w-6 text-blue-600" />`
- L347: `<div className="font-semibold text-blue-900">`
- L350: `<div className="text-sm text-blue-700">`
- L361: `<Card className="border-amber-200 bg-amber-50">`
- L364: `<Trophy className="h-6 w-6 text-amber-600" />`
- L366: `<div className="font-semibold text-amber-900">`
- L369: `<div className="text-sm text-amber-700">`

### `src/operator/ReportsManagement.tsx`

- L443: `<div key={action.id} className="text-sm border-l-2 border-red-500 pl-3 py-1">`
- L453: `<div className="text-xs text-red-600">`

### `src/operator/ScheduleSetup.tsx`

- L320: `<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">`
- L321: `<p className="text-yellow-800 font-medium mb-2">`
- L324: `<p className="text-yellow-700 text-sm">`
- L343: `<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">`
- L344: `<p className="text-yellow-800 text-sm">`
- L437: `<div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">`
- L438: `<p className="text-red-800 text-sm font-medium">{error}</p>`

### `src/operator/ScheduleSetupPage.tsx`

- L102: `<h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>`

### `src/operator/ScheduleView.tsx`

- L133: `<h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>`

### `src/operator/SeasonCreationWizard.tsx`

- L271: `<h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>`
- L538: `className="text-red-600 hover:text-red-800"`
- L689: `<p className="text-red-600 text-sm">{state.validationError}</p>`
- L741: `className="bg-blue-600 hover:bg-blue-700"`

### `src/operator/SeasonScheduleManager.tsx`

- L382: `<h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>`
- L441: `<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">`
- L446: `<span className="font-semibold text-blue-900">Starting Date:</span>`
- L447: `<span className="ml-2 text-blue-800">`
- L452: `<span className="font-semibold text-blue-900">Season Length:</span>`
- L453: `<span className="ml-2 text-blue-800">`
- L462: `<span className="font-semibold text-blue-900">BCA Championship:</span>`
- L463: `<span className="ml-2 text-blue-800">`
- L479: `<span className="font-semibold text-blue-900">APA Championship:</span>`
- L480: `<span className="ml-2 text-blue-800">`
- L500: `<div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">`
- L501: `<p className="text-red-800">{error}</p>`

### `src/operator/SeasonSchedulePage.tsx`

- L71: `bgColor: 'bg-purple-50 rounded-t-xl -my-6 py-3',`
- L73: `badgeColor: 'bg-purple-600 text-white',`
- L83: `bgColor: 'bg-yellow-50 rounded-t-xl -my-6 py-3',`
- L85: `badgeColor: 'bg-yellow-600 text-white',`

### `src/operator/TeamEditorModal.tsx`

- L448: `className={atCapacity && canSelect ? 'text-orange-600' : ''}`
- L451: `<span className={\`ml-2 text-xs ${atCapacity ? 'text-orange-600' : 'text-muted-foreground'}\`}>`
- L455: `<span className="ml-1 text-xs text-red-500">- Full</span>`
- L551: `className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"`
- L588: `<div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">`
- L589: `<p className="text-red-800 text-sm font-medium">{error || rosterError}</p>`

### `src/operator/TeamManagement.tsx`

- L477: `<h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>`
- L596: `<span className={\`font-medium ${isAtMaxTeams ? 'text-orange-600' : 'text-foreground'}\`}>`
- L720: `<div className="text-center py-8 bg-blue-50 border border-blue-200 rounded-lg">`
- L721: `<p className="text-blue-800 mb-2">Assign at least one venue before adding teams</p>`
- L722: `<p className="text-sm text-blue-600">Teams need a venue to call home</p>`

### `src/operator/VenueLimitModal.tsx`

- L358: `<div className="bg-red-50 border border-red-200 rounded-lg p-3">`
- L359: `<p className="text-red-800 text-sm">`
- L444: `<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">`
- L446: `<p className="text-sm text-blue-800">`
- L469: `<p className="text-sm text-blue-600 italic">No tables selected</p>`
- L473: `<div className="pt-2 border-t border-blue-200 space-y-2">`
- L475: `<label htmlFor="capacity" className="text-xs text-blue-700 font-medium whitespace-nowrap">`
- L488: `<p className="text-xs text-blue-600">`
- L502: `<div className="bg-orange-50 border border-orange-200 rounded p-2 mt-2">`
- L503: `<p className="text-xs text-orange-700">`
- L515: `<div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">`
- L516: `<p className="text-sm text-red-800">`

### `src/operator/VenueManagement.tsx`

- L194: `<div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">`
- L196: `<Check className="h-5 w-5 text-blue-600" />`
- L198: `<p className="text-sm font-medium text-blue-900">`
- L201: `<p className="text-xs text-blue-700 mt-1">`
- L234: `<div className={\`absolute top-0 left-0 right-0 z-10 p-3 rounded-t-xl ${assigned ? 'bg-green-50' : 'bg-muted'}\`}>`
- L245: `className={\`text-sm font-medium ${assigned ? 'text-green-700' : 'text-muted-foreground'}\`}`
- L261: `<div className="mt-2 text-xs text-green-700">`

### `src/pages/AdminReports.tsx`

- L514: `<div key={action.id} className="text-sm border-l-2 border-red-500 pl-3 py-1">`
- L524: `<div className="text-xs text-red-600">`

### `src/pages/FeatsOfExcellence.tsx`

- L66: `<div className="text-center text-red-600">`

### `src/pages/MatchDataViewer.tsx`

- L75: `<p className="text-center text-red-600">Error loading matches: {(error as Error).message}</p>`
- L92: `<div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">`

### `src/pages/Messages.tsx`

- L249: `<div className="hidden md:flex border-t bg-green-300 px-4 md:px-6 py-4 justify-end flex-shrink-0">`

### `src/pages/PlayerProfile.tsx`

- L150: `<p className="text-center text-red-600">{error || 'Player not found'}</p>`
- L186: `className="text-blue-600 hover:underline"`
- L218: `<span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">`
- L259: `<span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>`

### `src/pages/Standings.tsx`

- L69: `<p className="text-sm text-red-600">Failed to load standings</p>`
- L72: `<div className="text-center py-8 text-red-500">`

### `src/pages/TeamStats.tsx`

- L109: `<div className="text-center text-red-600">`

### `src/pages/TopShooters.tsx`

- L90: `<p className="text-sm text-red-600">`
- L95: `<div className="text-center py-8 text-red-500">`

### `src/player/MatchLineup.tsx`

- L1054: `<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">`

### `src/player/MyTeams.tsx`

- L219: `<span className="text-xs font-bold px-2 py-0.5 rounded text-yellow-700 bg-yellow-100">`
- L229: `const tagColor = isMakeup ? 'text-orange-700 bg-orange-100' : 'text-blue-700 bg-blue-100';`
- L251: `? 'text-orange-700 hover:text-orange-800 hover:bg-orange-50'`
- L252: `: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'`
- L298: `<div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">`
- L300: `<AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />`
- L302: `<p className="text-sm font-semibold text-yellow-900">`
- L305: `<ul className="text-sm text-yellow-800 mt-1 space-y-1">`
- L352: `? 'font-semibold text-blue-600'`

### `src/player/ScoreMatch.tsx`

- L600: `<div className="text-lg font-semibold text-red-600 mb-2">`
- L625: `<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />`

### `src/player/SpectateLiveMatches.tsx`

- L67: `<span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />`
- L68: `<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />`
- L89: `<div className="text-center text-sm text-red-600 py-8">`

### `src/player/SpectateMyLiveMatches.tsx`

- L76: `<span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />`
- L77: `<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />`
- L100: `<div className="text-center text-sm text-red-600 py-8">`

### `src/profile/AddressSection.tsx`

- L50: `className="text-blue-600 border-blue-600 hover:bg-blue-50"`
- L70: `className={form.errors.address ? 'border-red-500' : ''}`
- L73: `<p className="text-red-500 text-sm mt-1">{form.errors.address}</p>`
- L87: `className={form.errors.city ? 'border-red-500' : ''}`
- L90: `<p className="text-red-500 text-sm mt-1">{form.errors.city}</p>`
- L101: `<SelectTrigger className={form.errors.state ? 'border-red-500' : ''}>`
- L113: `<p className="text-red-500 text-sm mt-1">{form.errors.state}</p>`
- L126: `className={form.errors.zip_code ? 'border-red-500' : ''}`
- L129: `<p className="text-red-500 text-sm mt-1">{form.errors.zip_code}</p>`
- L136: `<Button onClick={handlers.save} className="bg-blue-600 hover:bg-blue-700" loadingText="Saving...">`

### `src/profile/ContactInfoSection.tsx`

- L53: `className="text-blue-600 border-blue-600 hover:bg-blue-50"`
- L73: `className={form.errors.email ? 'border-red-500' : ''}`
- L76: `<p className="text-red-500 text-sm mt-1">{form.errors.email}</p>`
- L89: `className={form.errors.phone ? 'border-red-500' : ''}`
- L92: `<p className="text-red-500 text-sm mt-1">{form.errors.phone}</p>`
- L101: `<Button onClick={handlers.save} className="bg-blue-600 hover:bg-blue-700" loadingText="Saving...">`

### `src/profile/PersonalInfoSection.tsx`

- L50: `className="text-blue-600 border-blue-600 hover:bg-blue-50"`
- L70: `className={form.errors.first_name ? 'border-red-500' : ''}`
- L73: `<p className="text-red-500 text-sm mt-1">{form.errors.first_name}</p>`
- L85: `className={form.errors.last_name ? 'border-red-500' : ''}`
- L88: `<p className="text-red-500 text-sm mt-1">{form.errors.last_name}</p>`
- L108: `className={form.errors.nickname ? 'border-red-500' : ''}`
- L111: `<p className="text-red-500 text-sm mt-1">{form.errors.nickname}</p>`
- L123: `className={form.errors.date_of_birth ? 'border-red-500' : ''}`
- L126: `<p className="text-red-500 text-sm mt-1">{form.errors.date_of_birth}</p>`
- L132: `<Button onClick={handlers.save} className="bg-blue-600 hover:bg-blue-700" loadingText="Saving...">`

### `src/profile/PrivacySettingsSection.tsx`

- L60: `<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">`
- L61: `<p className="text-sm text-red-700">{error}</p>`
- L66: `<div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">`
- L67: `<p className="text-sm text-green-700">Privacy settings updated successfully!</p>`
- L91: `? 'bg-green-100 text-green-800'`
- L113: `<div className="p-3 bg-blue-50 border border-blue-200 rounded-md">`
- L114: `<p className="text-sm text-blue-700">`

### `src/profile/SuccessMessage.tsx`

- L22: `<div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">`
- L26: `className="h-5 w-5 text-green-400"`
- L38: `<h3 className="text-sm font-medium text-green-800">`
- L42: `<div className="mt-2 text-sm text-green-700">`

### `src/rules/SearchSnippet.tsx`

- L91: `<mark key={key++} className="rounded bg-yellow-200 text-foreground px-0.5">`

### `src/wizards/league-v2/steps/ThresholdSourceStep.tsx`

- L90: `badgeClass: 'bg-green-100 text-green-800 border-green-300',`
- L98: `badgeClass: 'bg-green-100 text-green-800 border-green-300',`
- L106: `badgeClass: 'bg-green-100 text-green-800 border-green-300',`
- L114: `badgeClass: 'bg-green-100 text-green-800 border-green-300',`
- L122: `badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',`

### `src/wizards/matchups-v2/steps/PositionsStep.tsx`

- L144: `if (!seasonId) return <p className="text-red-600">Missing season ID from flow context.</p>;`
- L146: `if (teams.length < 2) return <p className="text-red-600">Need at least 2 teams to generate matchups.</p>;`

### `src/wizards/matchups-v2/steps/ReviewStep.tsx`

- L107: `if (!seasonId || !leagueId) return <p className="text-red-600">Missing league/season ID from flow context.</p>;`
- L109: `if (genError) return <p className="text-red-600">Error generating schedule: {genError}</p>;`
- L140: `<div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">`
- L141: `<div className="text-sm text-amber-900">`
- L212: `<div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">`

### `src/wizards/schedule-v2/ScheduleWizardStep.tsx`

- L80: `return <p className="text-red-600">Missing start date from league setup.</p>;`

### `src/wizards/season-v2/steps/SeasonIntroStep.tsx`

- L75: `<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">`
- L87: `className="mt-2 text-sm text-red-600 hover:text-red-800 p-0 h-auto"`

### `src/wizards/teams-v2/steps/CaptainsTeamsStep.tsx`

- L182: `<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">`

## Native HTML form elements

_Should use shadcn primitives (`Button`, `Input`, `Select`, `Label`). Note:
`<button asChild>` patterns from shadcn legitimately wrap native elements —
eyeball each occurrence to confirm it's actually a violation._

### `src/components/forms/DateField.tsx`

- L67: `<label className="block text-sm font-medium text-foreground">`

### `src/components/forms/DualDateStep.tsx`

- L106: `<label className="block text-sm font-medium text-foreground mb-2">`
- L120: `<label className="block text-sm font-medium text-foreground mb-2">`

### `src/components/lineup/OpponentSubstituteModal.tsx`

- L106: `<label className="text-sm font-medium">Select player to play double duty:</label>`

### `src/components/lineup/TestModeToggle.tsx`

- L27: `<label className="flex items-center gap-2 cursor-pointer">`

### `src/components/MemberCombobox.tsx`

- L120: `<label className="block text-sm font-medium text-foreground mb-1">`
- L179: `<button className="px-3 py-1 text-xs font-medium rounded-full bg-orange-500 text-white">`
- L182: `<button className="px-3 py-1 text-xs font-medium rounded-full bg-muted text-foreground hover:bg-accent">`
- L185: `<button className="px-3 py-1 text-xs font-medium rounded-full bg-muted text-foreground hover:bg-accent">`
- L188: `<button className="px-3 py-1 text-xs font-medium rounded-full bg-muted text-foreground hover:bg-accent">`

### `src/components/MemberSearchCombobox.tsx`

- L106: `<label className="block text-sm font-medium text-foreground mb-1">`

### `src/components/messages/MessageSettingsModal.tsx`

- L181: `<button className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-md transition-colors text-left group">`

### `src/components/messages/settings/PrivacySafetyActions.tsx`

- L34: `<button className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-md transition-colors text-left group">`

### `src/components/modals/WeekOffReasonModal.tsx`

- L86: `<label htmlFor="reason" className="block text-sm font-medium text-foreground mb-1">`

### `src/components/operator/BlackoutDatesCard.tsx`

- L110: `<label className="block text-xs text-muted-foreground mb-1">Start Date</label>`
- L118: `<label className="block text-xs text-muted-foreground mb-1">End Date</label>`
- L133: `<label className="flex items-center gap-2 text-sm text-muted-foreground">`
- L191: `<label className="block text-xs text-muted-foreground mb-1">Start Date</label>`
- L199: `<label className="block text-xs text-muted-foreground mb-1">End Date</label>`
- L214: `<label className="flex items-center gap-2 text-sm text-muted-foreground">`

### `src/components/operator/preferences/ContentModerationSection.tsx`

- L92: `<label className="flex items-center gap-2 cursor-pointer">`
- L103: `<label className="flex items-center gap-2 cursor-pointer">`
- L113: `<label className="flex items-center gap-2 cursor-pointer">`

### `src/components/operator/preferences/PlayerAuthorizationSection.tsx`

- L90: `<label className="flex items-center gap-2 cursor-pointer">`
- L101: `<label className="flex items-center gap-2 cursor-pointer">`
- L111: `<label className="flex items-center gap-2 cursor-pointer">`

### `src/components/operator/SeasonsCard.tsx`

- L150: `No active season. <button onClick={onCreateSeason} className="underline font-medium">Create a new season</button> to get started.`

### `src/components/PaymentCardForm.tsx`

- L195: `<label className="block text-sm font-medium text-foreground mb-1">`
- L216: `<label className="block text-sm font-medium text-foreground mb-1">`
- L230: `<label className="block text-sm font-medium text-foreground mb-1">`
- L246: `<label className="block text-sm font-medium text-foreground mb-1">`

### `src/components/PlayerCombobox.tsx`

- L180: `<label className="block text-sm font-medium text-foreground mb-1">`

### `src/hooks/useConfirmDialog.tsx`

- L80: `*       <button onClick={handleDelete}>Delete</button>`

### `src/leagueOperator/questionDefinitions.tsx`

- L297: `<label className="flex items-center space-x-3 cursor-pointer">`
- L356: `<label className="block text-sm font-medium text-foreground mb-1">`
- L497: `<label className="block text-sm font-medium text-foreground mb-1">`

### `src/leagueOperator/QuestionStep.tsx`

- L132: `<label htmlFor="autoCapitalize" className="text-sm text-foreground">`

### `src/operator/components/AttachPlaceholderDialog.tsx`

- L144: `<label className="block text-sm font-medium text-foreground mb-1">`

### `src/operator/components/UnmergePlayerDialog.tsx`

- L242: `<label className="block text-sm font-medium text-foreground mb-1">`

### `src/operator/VenueLimitModal.tsx`

- L416: `<label htmlFor="fill-ascending" className="text-sm text-foreground">`
- L426: `<label htmlFor="fill-descending" className="text-sm text-foreground">`
- L436: `<label htmlFor="fill-custom" className="text-sm text-foreground">`
- L475: `<label htmlFor="capacity" className="text-xs text-blue-700 font-medium whitespace-nowrap">`

### `src/pages/HandicapLookupTest.tsx`

- L32: `<button onClick={() => decrement(setHomeHandicap)}>-</button>`
- L36: `<button onClick={() => increment(setHomeHandicap)}>+</button>`
- L53: `<button onClick={() => decrement(setAwayHandicap)}>-</button>`
- L57: `<button onClick={() => increment(setAwayHandicap)}>+</button>`

### `src/player/ScoreMatch.tsx`

- L717: `<label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">`

### `src/rules/RulesPage.tsx`

- L325: `<label className="flex cursor-pointer items-center gap-2 text-sm">`

