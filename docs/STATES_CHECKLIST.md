# Feature States Checklist

Use this checklist for every new feature to ensure complete UX coverage. A feature is not complete until all applicable states are handled.

## Quick Reference

Every user-facing feature should handle:
1. **Loading** - What shows while waiting?
2. **Success** - What confirms completion?
3. **Error** - What shows when things fail?
4. **Empty** - What shows when there's no data?
5. **Edge Cases** - What about timeouts, permissions, offline?

---

## Required States

### Loading States
- [ ] Initial loading indicator (spinner, skeleton, or shimmer)
- [ ] Progress indicator for long operations (percentage or steps)
- [ ] Skeleton/placeholder UI that matches final layout
- [ ] Loading state is accessible (aria-busy, screen reader announcement)

### Success States
- [ ] Success feedback visible to user (toast, animation, checkmark)
- [ ] Result displayed clearly
- [ ] Next action affordance (what can user do next?)
- [ ] Success feedback duration appropriate (not too brief, not too long)

### Error States
- [ ] User-friendly error message (not stack traces or codes)
- [ ] Retry mechanism available when appropriate
- [ ] Fallback behavior defined
- [ ] Error logged for debugging
- [ ] Error state is recoverable (user can try again)

### Edge Cases
- [ ] Empty state (no data, first use)
- [ ] Timeout handling (what if operation takes too long?)
- [ ] Permission denied (file access, microphone, etc.)
- [ ] Network offline / disconnected
- [ ] Partial failure (some items succeed, some fail)
- [ ] Concurrent operations (what if user triggers twice?)

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader announces state changes
- [ ] Focus management correct (focus moves appropriately)
- [ ] ARIA labels present on interactive elements
- [ ] Color is not only indicator of state

---

## Template for New Features

Copy and fill out for each feature:

### Feature: [Name]

#### Description
Brief description of what the feature does.

#### Loading State
- **Indicator**: [spinner/skeleton/progress bar/none]
- **Location**: [where it appears]
- **Expected Duration**: [instant/short/long]
- **Cancelable**: [yes/no]

#### Success State
- **Feedback**: [toast/animation/inline/none]
- **Duration**: [ms or "until dismissed"]
- **Next Actions**: [what user can do next]

#### Error States
| Error Type | User Message | Recovery Action |
|------------|--------------|-----------------|
| Network | "Connection failed. Check your internet." | Retry button |
| Timeout | "Taking too long. Try again?" | Retry button |
| Permission | "Access denied. Check permissions." | Settings link |
| Validation | "[Specific issue with input]" | Highlight field |
| Server | "Something went wrong. Try again." | Retry button |

#### Edge Cases
| Condition | Behavior |
|-----------|----------|
| Empty state | [What to show] |
| Already running | [Disable button / queue / error] |
| Rapid clicks | [Debounce / ignore / queue] |
| Mid-operation cancel | [Cleanup / rollback] |

#### Accessibility
- Focus: [Where focus goes on open/close/success/error]
- Announcements: [What screen reader announces]
- Keyboard: [Key bindings for actions]

---

## Example: Chat Message Send

### Feature: Send Chat Message

#### Description
User sends a message in chat, AI responds with streaming text.

#### Loading State
- **Indicator**: Typing indicator + disabled send button
- **Location**: Below user message
- **Expected Duration**: 1-30 seconds (streaming)
- **Cancelable**: Yes (abort stream)

#### Success State
- **Feedback**: Message appears with smooth scroll
- **Duration**: Instant (streaming complete)
- **Next Actions**: Send another message, copy response

#### Error States
| Error Type | User Message | Recovery Action |
|------------|--------------|-----------------|
| Network | "Couldn't send message. Check connection." | Retry button |
| API Error | "AI service unavailable. Try again." | Retry button |
| Rate Limit | "Too many requests. Wait a moment." | Auto-retry countdown |
| Invalid Session | "Session expired. Starting new chat." | Auto-create session |

#### Edge Cases
| Condition | Behavior |
|-----------|----------|
| Empty message | Disable send button |
| Session not found | Create new session, retry |
| Stream timeout | Show partial response + retry option |
| User cancels | Show partial response, enable input |

#### Accessibility
- Focus: Stays on input after send
- Announcements: "Message sent", "Response received"
- Keyboard: Cmd+Enter to send

---

## Anti-Patterns to Avoid

1. **Silent Failures**: Operations that fail with no user feedback
2. **Infinite Spinners**: Loading states with no timeout or cancel option
3. **Generic Errors**: "Something went wrong" without actionable guidance
4. **Unrecoverable States**: Errors that require app restart
5. **Jarring Transitions**: States that pop in/out without animation
6. **Missing Empty States**: Blank screens instead of helpful guidance
7. **Inaccessible Loading**: Spinners without aria-busy or announcements
