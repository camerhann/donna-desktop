# Donna Terminal - Implementation Audit

**Date:** 2026-01-29
**Auditor:** Claude (via Chris's request)

---

## Executive Summary

This audit identifies features that appear to have been requested or started but are not fully implemented in the Donna Terminal codebase. The most significant finding is that **core text display libraries are installed but never used**, resulting in a degraded chat experience.

---

## CRITICAL ISSUES

### 1. Markdown & Syntax Highlighting Libraries Unused

**Severity:** CRITICAL
**Impact:** Chat messages display with basic formatting instead of proper markdown rendering

| Library | Status | Version Installed |
|---------|--------|-------------------|
| `marked` | ❌ INSTALLED BUT NEVER IMPORTED | ^17.0.1 |
| `highlight.js` | ❌ INSTALLED BUT NEVER IMPORTED | ^11.11.1 |

**Location:** `src/renderer/components/chatInterface.js:592-616`

**Current Implementation (lines 592-616):**
```javascript
formatContent(content) {
  // Basic markdown-like formatting
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Line breaks
    .replace(/\n/g, '<br>');
  ...
}
```

**What's Missing:**
- Proper markdown parsing (lists, headers, tables, blockquotes, links)
- Syntax highlighting for code blocks (language detection, colored tokens)
- The `$1` capture group for language is stored but never used for highlighting

**Expected Implementation:**
```javascript
// Should be using:
const marked = require('marked');
const hljs = require('highlight.js');

marked.setOptions({
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

formatContent(content) {
  return marked.parse(content);
}
```

---

## MAJOR ISSUES

### 2. Code Block Features Missing

**Severity:** MAJOR
**Location:** `src/renderer/components/chatInterface.js`

| Feature | Status |
|---------|--------|
| Copy button on code blocks | ❌ Not implemented |
| Language label display | ❌ Not implemented |
| Line numbers in code | ❌ Not implemented |
| Code block expand/collapse | ❌ Not implemented |

The CSS at lines 320-337 styles code blocks, but there's no UI for copying code or showing the language.

---

### 3. AI Suggestions - "Show Inline" Setting Not Implemented

**Severity:** MAJOR
**Location:** `src/renderer/components/aiSuggestions.js`

The settings panel (`terminalSettings.js:140-149`) exposes a "Show Inline" toggle for AI suggestions, but the `AISuggestionManager` class:
- Stores the `showInline` option (line 13)
- Never references it in the rendering logic
- Always shows suggestions in a dropdown, never inline ghost text

**Expected Behavior:** When enabled, suggestions should appear as ghost text after the cursor (like GitHub Copilot).

---

### 4. Chat Message Metadata Display Incomplete

**Severity:** MAJOR
**Location:** `src/renderer/components/chatInterface.js:580-586`

The message rendering includes:
```javascript
${metadata.model ? `<div class="message-meta">${metadata.model}</div>` : ''}
```

But the following metadata is never displayed:
- Token count (input/output)
- Response time
- Cost estimate (for paid APIs)

The backend appears to have some of this data, but it's not passed through to the UI.

---

## MINOR ISSUES

### 5. Terminal History for AI Context Not Populated

**Severity:** MINOR
**Location:** `src/renderer/components/aiSuggestions.js:199-202`

```javascript
getTerminalHistory() {
  // This would be populated by the terminal component
  return window.terminalHistory?.slice(-this.options.contextLines) || [];
}
```

`window.terminalHistory` is never set by any component, so AI suggestions don't have command history context.

---

### 6. Workflow Variable Substitution Limited

**Severity:** MINOR
**Location:** `src/renderer/components/workflowManager.js`

The workflow system supports `${var:Label}` syntax for user input, but:
- No environment variable expansion (`${env:HOME}`)
- No conditional logic
- No nested variable references

---

### 7. Command Blocks Overlay Never Attached to DOM

**Severity:** MINOR
**Location:** `src/renderer/components/commandBlocks.js:41-51`

The `blocksContainer` element is created but there's no code that actually attaches it to the terminal DOM. The container exists but isn't visible.

```javascript
init() {
  if (!this.enabled) return;

  this.blocksContainer = document.createElement('div');
  this.blocksContainer.className = 'command-blocks-container';
  // ... styles set ...
  // BUT: Never appended to any parent element!
}
```

---

### 8. Image Generation Progress Not Streaming

**Severity:** MINOR
**Location:** `src/renderer/components/imageGenerator.js`

While `onInstallProgress` is wired up for ComfyUI installation, there's no progress streaming during actual image generation. Users see no feedback between "Generating..." and the final result.

The backend providers (`imageProvider.js`) poll for completion but don't emit intermediate progress.

---

### 9. Model Settings - Ollama Model List Not Fetched

**Severity:** MINOR
**Location:** `src/renderer/components/modelSettings.js` (assumed based on UI)

The settings UI shows a dropdown for Ollama models, but there's no IPC handler to fetch the list of available models from a running Ollama instance. Users must manually enter model names.

**Expected:** Query `http://localhost:11434/api/tags` to get available models.

---

## COSMETIC ISSUES

### 10. Chat Session Auto-Naming is Simplistic

**Severity:** COSMETIC
**Location:** `src/main/chat/chatManager.js` (referenced in agent audit)

Sessions are named by truncating the first message to 40 characters. No semantic extraction (e.g., identifying the topic or question).

---

### 11. No Loading States for Provider Availability Checks

**Severity:** COSMETIC
**Location:** Various

When checking if providers (ComfyUI, Ollama, etc.) are available, there's no loading indicator. The UI appears frozen until the check completes.

---

### 12. Terminal Settings Panel Has No Keyboard Focus Trap

**Severity:** COSMETIC
**Location:** `src/renderer/components/terminalSettings.js`

The settings modal doesn't trap keyboard focus, allowing Tab to escape to elements behind the backdrop.

---

## UNUSED CODE

### 13. highlight.js CSS Files Available But Not Loaded

**Location:** `node_modules/highlight.js/styles/`

Over 200 theme CSS files are installed but none are imported. Even if highlighting were implemented, there's no theme selection.

---

## RECOMMENDATIONS BY PRIORITY

### Immediate (Critical)

1. **Wire up `marked` and `highlight.js`** in `chatInterface.js`
   - Import the libraries
   - Configure marked with highlight.js
   - Replace `formatContent()` regex with `marked.parse()`
   - Add a highlight.js theme CSS import

2. **Add code block copy buttons**
   - Post-process rendered markdown to inject copy button into `<pre>` blocks
   - Wire up clipboard API

### Short-term (Major)

3. **Implement inline ghost suggestions**
   - Add a separate rendering path when `showInline` is true
   - Render suggestion as dimmed text after cursor

4. **Attach command blocks container to DOM**
   - In terminal.js, append `commandBlockManager.blocksContainer` to the terminal wrapper

5. **Populate `window.terminalHistory`**
   - In terminal.js, maintain a rolling history array and expose it globally

### Medium-term (Minor)

6. **Add image generation progress**
   - Emit progress events from backend during polling
   - Show percentage or step indicator in UI

7. **Fetch Ollama models dynamically**
   - Add IPC handler to query Ollama API
   - Populate dropdown with available models

---

## FILES REQUIRING CHANGES

| File | Priority | Changes Needed |
|------|----------|----------------|
| `src/renderer/components/chatInterface.js` | CRITICAL | Add marked/hljs, code copy buttons |
| `src/renderer/index.html` | CRITICAL | Import highlight.js theme CSS |
| `src/renderer/components/aiSuggestions.js` | MAJOR | Implement inline mode |
| `src/renderer/components/terminal.js` | MINOR | Expose history, attach command blocks |
| `src/renderer/components/commandBlocks.js` | MINOR | Fix DOM attachment |
| `src/main/imaging/imageProvider.js` | MINOR | Add progress events |

---

## VERIFICATION

To verify these findings, run the app and:

1. Send a message with markdown (headers, lists, code blocks) - observe plain formatting
2. Check browser DevTools for `marked` or `hljs` in window/global scope - they won't exist
3. Toggle "Show Inline" in AI suggestions settings - observe no change in behavior
4. Look for command block overlays - they won't be visible

---

*End of audit*
