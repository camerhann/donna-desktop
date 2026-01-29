# Full Send Implementation V1

**Donna Desktop - Complete Feature Build Plan**

This document defines the implementation plan to complete all missing features from the original vision. Each phase builds on the previous, establishing patterns and infrastructure for subsequent features.

---

## Current State (Baseline on Main)

| Feature | Status |
|---------|--------|
| Terminal (xterm.js) | Working |
| Chat Interface | Working |
| Agent System (Donna/Jarvis/Claude/Gemini) | Working |
| Command Palette | Working |
| Workflows | Working |
| Command Blocks | Fixed |
| AI Suggestions (Dropdown) | Working |
| Model Providers | Working |

---

## Target State (V1 Complete)

| Feature | Priority | Phase |
|---------|----------|-------|
| Code Block Copy Buttons | P0 | 1 |
| Rich Link Previews | P1 | 2 |
| File Cards/Attachments | P1 | 3 |
| Inline AI Suggestions | P1 | 4 |
| Voice Input | P2 | 5 |
| Personal Speech Learning | P2 | 6 |
| Obsidian Vault Integration | P2 | 7 |

---

## Phase 1: Code Block Copy Buttons

**Goal**: Every code block in chat has a visible copy button with language label.

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/chatInterface.js` | Enhance `addCodeBlockFeatures()`, add `copyCode()` static method |
| `src/renderer/styles/chat.css` | Add `.code-block`, `.code-header`, `.code-copy` styles |

### Implementation

```javascript
// chatInterface.js - enhance existing method
addCodeBlockFeatures(html) {
  return html.replace(/<pre><code([^>]*)>/g, (match, attrs) => {
    const langMatch = attrs.match(/class="language-(\w+)"/);
    const lang = langMatch ? langMatch[1] : 'text';
    const blockId = 'code-' + Math.random().toString(36).substr(2, 9);

    return `
      <pre class="code-block" id="${blockId}">
        <div class="code-header">
          <span class="code-lang">${lang}</span>
          <button class="code-copy" onclick="window.DonnaChat.copyCode('${blockId}')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <path d="M2 10V3a1 1 0 011-1h7" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            Copy
          </button>
        </div>
        <code${attrs}>`;
  });
}

static copyCode(blockId) {
  const block = document.getElementById(blockId);
  const code = block.querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = block.querySelector('.code-copy');
    btn.classList.add('copied');
    btn.innerHTML = '<svg>...</svg> Copied!';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = '<svg>...</svg> Copy';
    }, 2000);
  });
}
```

### Test Cases
- [ ] JavaScript code block has copy button
- [ ] Python code block has copy button
- [ ] Plain code block (no language) shows "text"
- [ ] Copy button copies exact code content
- [ ] "Copied!" feedback appears and disappears

### Dependencies
None

---

## Phase 2: Rich Link Previews

**Goal**: URLs in chat messages show preview cards with title, description, and image.

### New Files

| File | Purpose |
|------|---------|
| `src/main/links/linkPreview.js` | Fetch and parse Open Graph metadata |
| `src/main/links/linkCache.js` | Cache metadata (24hr TTL) |
| `src/renderer/components/linkPreview.js` | Render preview cards |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/main.js` | Add `links:getPreview` IPC handler |
| `src/main/preload.js` | Expose `window.donnaLinks` API |
| `src/renderer/components/chatInterface.js` | Detect URLs, render preview cards |
| `src/renderer/index.html` | Add linkPreview.js script |
| `package.json` | Add cheerio dependency |

### IPC Contract

```javascript
// Request
window.donnaLinks.getPreview(url)

// Response
{
  url: string,
  title: string,
  description: string,
  image: string | null,
  siteName: string,
  favicon: string | null,
  cached: boolean
}
```

### Data Flow

```
User sends message with URL
       ↓
Renderer detects URL in message
       ↓
Calls window.donnaLinks.getPreview(url)
       ↓
Main process checks cache
       ↓ (miss)
Fetches URL with net.fetch()
       ↓
Parses HTML with cheerio
       ↓
Extracts og:title, og:description, og:image
       ↓
Caches result (24hr TTL)
       ↓
Returns metadata to renderer
       ↓
Renderer injects preview card below message
```

### Test Cases
- [ ] GitHub URL shows repo name and description
- [ ] Twitter/X URL shows tweet preview
- [ ] 404 URL shows fallback (just the URL)
- [ ] Same URL twice uses cache
- [ ] Timeout (5s) shows fallback

### Dependencies
```bash
npm install cheerio
```

---

## Phase 3: File Cards/Attachments

**Goal**: Drag-drop files into chat, show preview cards, send to AI with vision.

### New Files

| File | Purpose |
|------|---------|
| `src/main/files/fileHandler.js` | Process files, generate thumbnails, encode for AI |
| `src/renderer/components/dragDropZone.js` | Handle drag-drop events |
| `src/renderer/components/fileAttachment.js` | Render file cards |
| `src/renderer/styles/fileAttachment.css` | File card styles |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/main.js` | Add `files:process`, `files:encodeForAI` handlers |
| `src/main/preload.js` | Expose `window.donnaFiles` API |
| `src/main/models/modelProvider.js` | Support multimodal messages (images as base64) |
| `src/renderer/components/chatInterface.js` | Integrate drag-drop, file cards, send with attachments |
| `src/renderer/index.html` | Add file component scripts |
| `package.json` | Add sharp dependency |

### IPC Contract

```javascript
// Process file
window.donnaFiles.process(filePath)
// Returns: { id, name, size, type, thumbnail?, preview? }

// Encode for AI
window.donnaFiles.encodeForAI(filePath)
// Returns: { base64, mimeType }
```

### Supported File Types

| Type | Preview | Vision AI |
|------|---------|-----------|
| Images (png, jpg, gif, webp) | Thumbnail | Yes |
| PDFs | First page | No (text extraction) |
| Text files | First 500 chars | No |
| Code files | Syntax highlighted | No |
| Other | Icon only | No |

### Test Cases
- [ ] Drag image from Finder shows thumbnail
- [ ] Drag PDF shows "PDF" icon
- [ ] File card shows name and size
- [ ] Remove button removes attachment
- [ ] Send with image calls Claude vision API
- [ ] Files > 50MB rejected

### Dependencies
```bash
npm install sharp
```

---

## Phase 4: Inline AI Suggestions

**Goal**: AI suggestions appear as ghost text at cursor position, not dropdown.

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/components/inlineSuggestions.js` | Render ghost text at cursor |

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/aiSuggestions.js` | Add `showInline` mode toggle |
| `src/renderer/components/terminal.js` | Wire keyboard handlers (Tab, Escape) |
| `src/main/config/terminalConfig.js` | Add `showInline` setting |
| `src/renderer/index.html` | Add inlineSuggestions.js script |

### Keyboard Bindings

| Key | Action |
|-----|--------|
| Tab | Accept suggestion, insert into terminal |
| Escape | Dismiss suggestion |
| Any typing | Dismiss and continue typing |
| Right Arrow (at EOL) | Accept suggestion |

### Implementation Detail

```javascript
class InlineSuggestionRenderer {
  showSuggestion(text) {
    // Get cursor position from xterm
    const cursorX = this.terminal.term.buffer.active.cursorX;
    const cursorY = this.terminal.term.buffer.active.cursorY;

    // Calculate pixel position
    const dims = this.terminal.term._core._renderService._dimensions;
    const x = cursorX * dims.actualCellWidth;
    const y = cursorY * dims.actualCellHeight;

    // Position overlay at cursor
    this.overlay.style.left = x + 'px';
    this.overlay.style.top = y + 'px';
    this.overlay.textContent = text;
    this.overlay.style.display = 'block';
  }
}
```

### Test Cases
- [ ] Suggestion appears after 500ms pause
- [ ] Ghost text positioned at cursor
- [ ] Tab inserts suggestion text
- [ ] Escape hides suggestion
- [ ] Typing dismisses and continues
- [ ] Works after terminal scroll

### Dependencies
None

---

## Phase 5: Voice Input

**Goal**: Push-to-talk or continuous voice input for terminal and chat.

### New Files

| File | Purpose |
|------|---------|
| `src/main/voice/voiceManager.js` | Coordinate voice input lifecycle |
| `src/main/voice/webSpeechProvider.js` | Web Speech API wrapper |
| `src/main/voice/speechPatterns.js` | Store learned corrections |
| `src/renderer/components/voiceInput.js` | Microphone button, waveform UI |
| `src/renderer/styles/voiceInput.css` | Voice UI styles |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/main.js` | Add voice IPC handlers |
| `src/main/preload.js` | Expose `window.donnaVoice` API |
| `src/renderer/app.js` | Initialize voice input |
| `src/renderer/components/chatInterface.js` | Add microphone button |
| `src/renderer/index.html` | Add voice scripts |

### IPC Contract

```javascript
// Start listening
window.donnaVoice.startListening({ mode: 'push-to-talk' | 'continuous' })

// Stop listening
window.donnaVoice.stopListening()

// Events
window.addEventListener('voice:transcription', (e) => {
  // e.detail = { text, isFinal }
})
```

### Voice Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| Push-to-talk | Hold Cmd+Shift+V | Records while held, transcribes on release |
| Continuous | Toggle on | Always listening, sends on silence |

### UI Components

1. **Microphone button** in chat input area
2. **Waveform animation** while recording
3. **Transcription preview** below input
4. **Correction button** to fix mistakes

### Test Cases
- [ ] Microphone button appears in chat
- [ ] Cmd+Shift+V activates push-to-talk
- [ ] Waveform animates while speaking
- [ ] Transcription appears in input field
- [ ] "Donna" correctly transcribed as "Donna"
- [ ] Network error shows fallback message

### Dependencies
None (Web Speech API is built-in)

---

## Phase 6: Personal Speech Learning

**Goal**: Learn from user corrections to improve transcription accuracy.

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/components/speechTrainer.js` | Correction UI, pattern management |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/voice/speechPatterns.js` | Enhanced pattern storage and matching |
| `src/main/voice/voiceManager.js` | Apply patterns to transcriptions |
| `src/main/main.js` | Add pattern CRUD handlers |
| `src/renderer/components/voiceInput.js` | Add correction UI |
| `src/renderer/index.html` | Add speechTrainer.js script |

### Pattern Storage

```json
// ~/.donna-desktop/speech-patterns.json
{
  "corrections": [
    {
      "id": "1706540000000",
      "original": "donna open terminal",
      "corrected": "docker open terminal",
      "count": 5,
      "lastUsed": 1706540000000
    }
  ]
}
```

### Correction Flow

```
User speaks → "donna open terminal"
       ↓
User clicks correction icon
       ↓
Modal opens with original text
       ↓
User edits to "docker open terminal"
       ↓
Pattern saved to database
       ↓
Future transcriptions auto-corrected
```

### Test Cases
- [ ] Correction icon appears after transcription
- [ ] Modal pre-fills original text
- [ ] Correction saves to disk
- [ ] Pattern applies to future transcriptions
- [ ] Patterns persist across restarts
- [ ] Export/import patterns works

### Dependencies
None

---

## Phase 7: Obsidian Vault Integration

**Goal**: Browse vault, insert wikilinks, preview notes, create notes from Donna.

### New Files

| File | Purpose |
|------|---------|
| `src/main/obsidian/vaultManager.js` | Vault operations, file watching |
| `src/main/obsidian/wikilinkParser.js` | Parse and resolve `[[wikilinks]]` |
| `src/renderer/components/vaultBrowser.js` | Browse/search vault modal |
| `src/renderer/components/notePreview.js` | Render note content |
| `src/renderer/styles/vault.css` | Vault UI styles |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/main.js` | Add vault IPC handlers |
| `src/main/preload.js` | Expose `window.donnaVault` API |
| `src/main/config/terminalConfig.js` | Add vault path setting |
| `src/renderer/app.js` | Initialize vault browser |
| `src/renderer/index.html` | Add vault scripts |
| `package.json` | Add chokidar dependency |

### IPC Contract

```javascript
// Configure vault
window.donnaVault.setPath('/Users/camerhann/ChrisVault')

// Search notes
window.donnaVault.search('project ideas')
// Returns: [{ path, title, excerpt, modified }]

// Read note
window.donnaVault.readNote('Projects/Donna.md')
// Returns: { content, frontmatter, links }

// Create note
window.donnaVault.createNote('Daily/2024-01-29.md', '# Today\n...')

// Resolve wikilink
window.donnaVault.resolveWikilink('[[Donna]]')
// Returns: { path: 'Projects/Donna.md', exists: true }
```

### Vault Browser UI

```
┌─────────────────────────────────────────┐
│  Vault: ChrisVault          [Search: ] │
├─────────────────────────────────────────┤
│  📁 Daily                               │
│  📁 Projects                            │
│     📄 Donna.md                         │
│     📄 Terminal Ideas.md                │
│  📁 Donna                               │
│     📄 Research/                        │
├─────────────────────────────────────────┤
│  [Insert Link]  [Preview]  [New Note]   │
└─────────────────────────────────────────┘
```

### Features

| Feature | Description |
|---------|-------------|
| Browse | Tree view of vault folders and notes |
| Search | Full-text search across all notes |
| Preview | Rendered markdown with clickable links |
| Insert | Insert `[[Note Title]]` into chat/terminal |
| Create | Create new note from Donna response |
| Backlinks | Show notes that link to current note |
| Watch | Auto-update when files change |

### Test Cases
- [ ] Cmd+Shift+O opens vault browser
- [ ] Folder tree shows all notes
- [ ] Search filters notes
- [ ] Click note shows preview
- [ ] Insert adds wikilink to input
- [ ] Create note saves to vault
- [ ] File changes trigger re-index

### Dependencies
```bash
npm install chokidar
```

---

## Implementation Summary

### New Files (18 total)

```
src/main/
├── links/
│   ├── linkPreview.js
│   └── linkCache.js
├── files/
│   └── fileHandler.js
├── voice/
│   ├── voiceManager.js
│   ├── webSpeechProvider.js
│   └── speechPatterns.js
└── obsidian/
    ├── vaultManager.js
    └── wikilinkParser.js

src/renderer/
├── components/
│   ├── linkPreview.js
│   ├── dragDropZone.js
│   ├── fileAttachment.js
│   ├── inlineSuggestions.js
│   ├── voiceInput.js
│   ├── speechTrainer.js
│   ├── vaultBrowser.js
│   └── notePreview.js
└── styles/
    ├── fileAttachment.css
    ├── voiceInput.css
    └── vault.css
```

### Files to Modify (10 total)

```
src/main/main.js              - IPC handlers for all features
src/main/preload.js           - Expose window.donna* APIs
src/main/config/terminalConfig.js - New settings
src/main/models/modelProvider.js  - Multimodal support

src/renderer/app.js           - Initialize new components
src/renderer/index.html       - Script tags, UI elements
src/renderer/components/chatInterface.js - Code copy, links, files
src/renderer/components/terminal.js      - Inline suggestions
src/renderer/components/aiSuggestions.js - Inline mode
src/renderer/styles/chat.css  - Code block styles
```

### New Dependencies

```json
{
  "cheerio": "^1.0.0",
  "sharp": "^0.33.0",
  "chokidar": "^3.5.3"
}
```

---

## Development Workflow

### Branch Strategy

```
main (stable)
  └── feature/full-send-v1 (development)
        ├── phase-1-code-copy
        ├── phase-2-link-previews
        ├── phase-3-file-attachments
        ├── phase-4-inline-suggestions
        ├── phase-5-voice-input
        ├── phase-6-speech-learning
        └── phase-7-obsidian-vault
```

### Per-Phase Checklist

For each phase:
1. [ ] Create phase branch from `feature/full-send-v1`
2. [ ] Implement feature
3. [ ] Write tests
4. [ ] Manual QA
5. [ ] Code review
6. [ ] Merge to `feature/full-send-v1`
7. [ ] Test integration with previous phases

### Release Criteria

Before merging `feature/full-send-v1` to `main`:
- [ ] All phases complete and tested
- [ ] No console errors
- [ ] Performance acceptable (no UI lag)
- [ ] Error handling graceful
- [ ] Settings persist correctly
- [ ] Works on macOS 12+
- [ ] README updated

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Web Speech API unavailable | Show clear error, suggest alternatives |
| Sharp fails to install | Make thumbnails optional, use file icons |
| Chokidar performance on large vaults | Debounce, limit indexed files |
| Claude vision API costs | Warn before sending images, show estimated cost |
| Obsidian format changes | Use simple parsing, minimal assumptions |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Code copy success rate | 100% |
| Link preview cache hit rate | >80% |
| File upload success rate | >95% |
| Voice transcription accuracy | >90% |
| Vault search latency | <100ms |
| UI responsiveness | No frame drops |

---

*Document Version: 1.0*
*Created: 2024-01-29*
*Status: Ready for Implementation*
