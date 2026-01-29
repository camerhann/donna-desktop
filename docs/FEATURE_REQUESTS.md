# Feature Requests & Improvements

## 1. Input Required Indicator (High Priority)

**Problem**: It's not obvious when a terminal session requires user input.

**Solution**: Add bigger, more obvious visual feedback when input is needed:
- Flashing indicator on the chat context panel (left side)
- Make it unmissable - consider pulsing animation, color change, or badge
- Possibly add sound/haptic feedback option

---

## 2. File Deduplication in Long Sessions

**Problem**: In long-running sessions, multiple versions of the same file appear in the context.

**Solution**: Only show the latest version of each file:
- Track file paths and deduplicate by path
- When a new version of a file is added, replace the previous version
- Consider showing a "version count" badge if useful for context

---

## 3. Smart Link Handling

**Problem**: Links are generic and don't provide context about where they lead.

**Solution**: Context-aware hyperlinks with proper naming and icons:
- Use the **file name** as the link text (not raw URLs)
- Make it a **hyperlink** to the actual destination
- Add **context-aware icons** based on destination:
  - Google Drive icon for Drive links
  - GitHub icon for GitHub links
  - Folder icon for local files
  - Generic link icon for other URLs
- Icons to source/implement:
  - [ ] Google Drive icon
  - [ ] GitHub icon
  - [ ] Local file/folder icon
  - [ ] Generic web link icon

---

## 4. AI Autocomplete / Tab Completion

**Problem**: No autocomplete functionality within the terminal.

**Solution**: Implement intelligent autocomplete:
- Tab to complete commands, file paths, arguments
- AI-powered suggestions based on context
- Show ghost text preview of completion

---

## 5. Auto-Scroll Bug Fix

**Problem**: Terminal sometimes doesn't scroll all the way down to show the latest output.

**Likely cause**: Display rendering isn't detecting that the terminal content has moved on. The scroll position update may be firing before the new content is fully rendered, or we're not tracking content height changes properly.

**Investigation areas**:
- Check if scroll-to-bottom fires before DOM update completes
- Look at how we detect new content being added
- May need to use MutationObserver or ResizeObserver to catch content changes
- Consider debouncing/throttling scroll updates
- Check if virtualized rendering (if any) is reporting wrong heights

**Solution**: Ensure scroll position always tracks the latest content:
- Scroll after content is fully rendered (use requestAnimationFrame or nextTick)
- Re-check scroll position after any content resize
- Add a "scroll to bottom" button as fallback UX

---

## 6. Better Inline Command Line Features

**Problem**: Command line input needs richer inline editing capabilities.

**Features to consider**:
- Syntax highlighting in the input field
- Multi-line command editing
- Inline parameter hints/tooltips
- Command validation before execution
- History navigation with preview
- Vim/Emacs keybindings option
- Bracket/quote matching and auto-close

---

## 7. Warp Terminal Features to Steal

Reference: [Warp Terminal](https://www.warp.dev/)

Features to evaluate/implement:
- [ ] **Blocks**: Group command + output as discrete units
- [ ] **Command palette**: Quick access to commands via keyboard
- [ ] **AI command search**: Natural language to command translation
- [ ] **Workflows**: Saved command sequences
- [ ] **Smart completions**: Context-aware suggestions
- [ ] **Command history search**: Fuzzy search through history
- [ ] **Split panes**: Multiple terminal views
- [ ] **Themes/customization**: Visual personalization

---

## Implementation Priority

1. Input Required Indicator (UX critical)
2. Auto-Scroll Bug Fix (UX critical)
3. File Deduplication (session quality)
4. Smart Link Handling (polish)
5. Better Inline Command Line Features (power feature)
6. AI Autocomplete (power feature)
7. Warp features (future roadmap)

---

*Last updated: 2025-01-29*
