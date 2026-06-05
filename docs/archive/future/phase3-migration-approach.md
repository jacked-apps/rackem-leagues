# Phase 3 Migration Approach

## Revised Strategy

After analyzing the components, I recommend we **combine Phase 3 and Phase 4** for efficiency:

### Why?
1. **Breaking down components first creates MORE work** - We'd have to migrate both the parent AND all extracted sub-components
2. **Using new hooks naturally simplifies components** - Real-time hooks remove 40-60 lines of manual subscription code per component
3. **Easier to test** - Migrate complete components, test, then extract if still needed

### New Approach: Migrate THEN Extract

**Step 1: Migrate to new hooks (removes most complexity)**
- ConversationList.tsx: Replace manual real-time with `useConversationsRealtime()` → Removes ~50 lines
- MessageView.tsx: Replace manual real-time with `useConversationMessagesRealtime()` → Removes ~55 lines
- Messages.tsx: Replace old utils with new mutation hooks → Removes ~80 lines

**Step 2: Extract ONLY if still too complex**
- After migration, re-evaluate which components are still over 150 lines
- Extract sub-components only where needed
- Many components will be small enough after migration

### Expected Results

**ConversationList.tsx**: 270 lines → ~220 lines (remove manual subscriptions)
**MessageView.tsx**: 287 lines → ~230 lines (remove manual subscriptions)
**Messages.tsx**: 300+ lines → ~220 lines (replace utils with hooks)

Total reduction: **~217 lines** just from using new hooks!

### Benefits
- ✅ Less refactoring work
- ✅ Fewer files to maintain
- ✅ Test once instead of twice
- ✅ Cleaner git history
- ✅ Faster to complete

## Recommendation

**Start with easiest migration first:**
1. ✅ ConversationList.tsx - Just replace real-time subscriptions
2. ✅ MessageView.tsx - Just replace real-time subscriptions
3. ✅ Messages.tsx - Replace util calls with mutation hooks
4. ✅ NewMessageModal.tsx - Replace utils with mutation hooks
5. ✅ AnnouncementModal.tsx - Replace utils with mutation hooks

Then re-evaluate if component extraction is still needed.

**Proceed with this approach?**
