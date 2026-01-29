# Donna Desktop IPC API Reference

This document describes the IPC (Inter-Process Communication) API between the renderer and main processes in Donna Desktop.

## Overview

Donna Desktop uses Electron's IPC mechanism to communicate between the renderer process (UI) and the main process (Node.js). All APIs are exposed through the preload script using `contextBridge.exposeInMainWorld()`.

## Conventions

- **Request-Response Pattern**: All handlers use `ipcRenderer.invoke()` / `ipcMain.handle()` for request-response communication
- **Streaming Pattern**: Real-time updates use `ipcRenderer.send()` / `ipcRenderer.on()` with unique `streamId` identifiers
- **Standard Response Format**: Most handlers return `{ success: boolean, error?: string, data?: any }`
- **Event Cleanup**: All event listeners return cleanup functions that should be called when the listener is no longer needed

## API Namespaces

| Namespace | Global Object | Description |
|-----------|---------------|-------------|
| Terminal | `window.donnaTerminal` | Terminal PTY operations and configuration |
| Platform | `window.platform` | Platform detection utilities |
| Models | `window.donnaModels` | AI model provider interactions |
| Orchestrator | `window.donnaOrchestrator` | Multi-agent AI coordination |
| Imaging | `window.donnaImaging` | Image generation with ComfyUI/SD |
| Chat | `window.donnaChat` | Chat session management |
| Agents | `window.donnaAgents` | Pre-defined AI personality agents |
| Config | `window.donnaConfig` | Application configuration |

## Terminal API (`window.donnaTerminal`)

### terminal:create
Creates a new terminal PTY instance.

**Request:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Unique terminal identifier (alphanumeric, underscore, hyphen; max 64 chars) |
| cols | number | Yes | Terminal width in columns (1-500, defaults to 80) |
| rows | number | Yes | Terminal height in rows (1-200, defaults to 24) |

**Response:**
| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Whether creation succeeded |
| id | string | The terminal ID (on success) |
| error | string? | Error message if failed |

**Security:** Terminal ID is validated against regex `/^[a-zA-Z0-9_-]+$/`. Dimensions are clamped to safe ranges.

### terminal:write
Writes data to a terminal.

### terminal:resize
Resizes a terminal.

### terminal:destroy
Destroys a terminal and cleans up resources.

### terminal:getCwd
Gets the current working directory of a terminal.

### terminal:getConfig
Gets the full terminal configuration.

### terminal:isFeatureEnabled
Checks if a terminal feature is enabled (commandBlocks, aiSuggestions, commandPalette).

### terminal:setFeatureEnabled
Enables or disables a terminal feature.

### terminal:updateFeatureSettings
Updates settings for a specific feature.

### terminal:getWorkflows
Gets all workflows (built-in and custom).

### terminal:addWorkflow
Adds a custom workflow.

### terminal:updateWorkflow
Updates a custom workflow.

### terminal:deleteWorkflow
Deletes a custom workflow.

### terminal:getSuggestions
Gets AI-powered command suggestions.

### Event: onData
Receives data output from a terminal.

### Event: onExit
Receives notification when a terminal exits.

## Models API (`window.donnaModels`)

### models:listProviders
Lists all registered AI providers.

### models:chat
Sends a chat message and gets a complete response.

### models:stream
Streams a chat response with real-time chunks.

### Events: onStreamChunk, onStreamEnd, onStreamError

## Orchestrator API (`window.donnaOrchestrator`)

### orchestrator:spawnAgent
Spawns a new AI agent with role (researcher, coder, analyst, writer, assistant).

### orchestrator:terminateAgent
Terminates an agent.

### orchestrator:createTask
Creates a task for agents to execute.

### orchestrator:streamTask
Creates and streams a task result.

### orchestrator:executeComplex
Executes a complex task with automatic planning and coordination.

### orchestrator:status
Gets the current status of all agents and tasks.

## Imaging API (`window.donnaImaging`)

### imaging:generate
Generates an image from a prompt.

### imaging:installComfyUI, startComfyUI, stopComfyUI, isComfyUIRunning
ComfyUI lifecycle management.

### imaging:openImage
Opens a generated image (path validated to ~/.donna-desktop/images/).

## Chat API (`window.donnaChat`)

### chat:createSession, getSession, listSessions, deleteSession, renameSession, updateSession
Session CRUD operations.

### chat:sendMessage
Sends a message and waits for complete response.

### chat:streamMessage
Sends a message and streams the response.

### chat:abortStream
Aborts an active stream.

### chat:listProviders, updateProviderConfig, getConfig, setDefaultProvider
Provider management.

## Agents API (`window.donnaAgents`)

### agents:list
Lists all defined agents (donna, jarvis, claude, gemini, gemini-donna).

### agents:available
Lists only agents with available CLIs.

### agents:get
Gets a specific agent by ID.

### agents:checkCli
Checks if a CLI is installed (claude or gemini only).

### agents:createSession
Creates an agent session (spawns CLI with personality).

## Config API (`window.donnaConfig`)

### config:get, config:set
Full configuration management.

### config:setApiKey
Sets an API key for a specific provider.

## Security Considerations

1. **Input Validation**: All IDs, paths, and parameters are validated
2. **Path Traversal Prevention**: File paths are resolved and checked
3. **Command Injection Prevention**: CLI commands use allowlists
4. **Resource Limits**: Terminal dimensions are clamped
5. **Context Isolation**: All APIs use contextBridge
