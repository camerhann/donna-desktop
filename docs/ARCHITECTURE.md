# Donna Desktop Architecture

## Overview

Donna Desktop is an Electron-based AI-powered terminal application that provides intelligent assistance through multiple AI providers and pre-defined agent personalities.

## Process Model

### Main Process (Node.js)
- Handles system operations (file I/O, PTY terminals, shell spawning)
- Manages AI provider connections
- Coordinates agent orchestration
- Persists configuration and chat history

### Renderer Process (Chromium)
- Renders the user interface
- Handles user interactions
- Displays terminal output and chat messages
- No direct access to Node.js APIs

### Preload Script (Bridge)
- Exposes controlled APIs via `contextBridge`
- Provides `window.donna*` namespaced objects
- Ensures security through context isolation

## Directory Structure

```
src/
├── main/                   # Main process code
│   ├── main.js            # Entry point, IPC handlers
│   ├── preload.js         # Bridge API definitions
│   ├── agents/            # Agent personalities
│   │   └── agentDefinitions.js
│   ├── chat/              # Chat session management
│   │   └── chatManager.js
│   ├── config/            # Configuration management
│   │   └── terminalConfig.js
│   ├── imaging/           # Image generation
│   │   ├── imageProvider.js
│   │   └── sdInstaller.js
│   ├── models/            # AI model providers
│   │   ├── modelProvider.js
│   │   └── orchestrator.js
│   ├── security/          # Security utilities (NEW)
│   │   ├── fileSandbox.js
│   │   ├── urlValidator.js
│   │   └── index.js
│   └── utils/             # Shared utilities (NEW)
│       ├── streamManager.js
│       └── index.js
├── renderer/              # Renderer process code
│   ├── index.html         # Main HTML
│   ├── app.js            # Application bootstrap
│   ├── components/        # UI components
│   │   ├── agentPicker.js
│   │   ├── aiSuggestions.js
│   │   ├── chatInterface.js
│   │   ├── commandBlocks.js
│   │   ├── commandPalette.js
│   │   ├── imageGenerator.js
│   │   ├── modelSettings.js
│   │   ├── sidebar.js
│   │   ├── terminal.js
│   │   ├── terminalSettings.js
│   │   └── workflowManager.js
│   ├── styles/            # CSS styles
│   └── utils/             # Renderer utilities
│       └── sessionManager.js
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Terminal │  │   Chat   │  │  Agents  │  │    Imaging   │   │
│  │Component │  │Interface │  │  Picker  │  │  Generator   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│       │             │             │               │            │
│       ▼             ▼             ▼               ▼            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              window.donna* APIs (Preload)               │   │
│  │  donnaTerminal | donnaChat | donnaAgents | donnaImaging │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ IPC (invoke/handle, send/on)
┌────────────────────────────┴────────────────────────────────────┐
│                       MAIN PROCESS                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    IPC Handlers                          │   │
│  │  terminal:* | chat:* | agents:* | imaging:* | models:*  │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │             │             │               │            │
│       ▼             ▼             ▼               ▼            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │   PTY    │  │  Chat    │  │  Agent   │  │    Image     │   │
│  │ Manager  │  │ Manager  │  │  Defs    │  │   Provider   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                      │                                         │
│                      ▼                                         │
│              ┌──────────────┐                                  │
│              │ Orchestrator │ ◄── Multi-agent coordination     │
│              │    + Model   │                                  │
│              │    Manager   │                                  │
│              └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Security Model

### Context Isolation
- `contextIsolation: true` in BrowserWindow
- `nodeIntegration: false`
- All Node APIs accessed only through preload bridge

### Input Validation
- Terminal IDs: `/^[a-zA-Z0-9_-]+$/`, max 64 chars
- Terminal dimensions: Clamped to 1-500 cols, 1-200 rows
- File paths: Resolved and checked against allowed directories
- Agent IDs: Validated against known agent allowlist
- CLI names: Allowlisted to `['claude', 'gemini']`

### Path Security
- Image paths must be within `~/.donna-desktop/images/`
- Working directories are resolved to absolute paths
- Path traversal attempts are blocked
- **NEW**: FileSandbox utility for comprehensive path validation

### URL Security
- **NEW**: URL validator prevents SSRF attacks
- Only http/https protocols allowed
- Private IP ranges blocked (RFC 1918, localhost, link-local)

## Configuration Storage

| File | Location | Purpose |
|------|----------|---------||
| config.json | ~/.donna-desktop/ | API keys, provider settings, imaging config |
| terminal-config.json | ~/.donna-desktop/ | Terminal features, workflows |
| chats/*.json | ~/.donna-desktop/chats/ | Chat session history |
| images/ | ~/.donna-desktop/images/ | Generated images |

## Key Design Patterns

### Streaming Pattern
All streaming operations use a consistent pattern:
1. Generate unique `streamId`
2. Return `{ streamId, start() }` to caller
3. Caller sets up event listeners
4. `start()` initiates the stream
5. Events emitted: `*:streamChunk`, `*:streamEnd`, `*:streamError`
6. Cleanup functions returned from `on*` methods

**NEW**: StreamManager utility centralizes stream lifecycle management.

### StreamingBuffer Pattern (Performance)
Chat streaming uses buffered DOM updates:
1. Chunks accumulated in memory buffer
2. DOM updated every 100ms (not per-chunk)
3. Reduces CPU usage by 70-80%
4. Eliminates frame drops during streaming
