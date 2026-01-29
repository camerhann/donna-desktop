const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('donnaTerminal', {
  // Terminal operations
  create: (id, cols, rows) => ipcRenderer.invoke('terminal:create', { id, cols, rows }),
  write: (id, data) => ipcRenderer.invoke('terminal:write', { id, data }),
  resize: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', { id, cols, rows }),
  destroy: (id) => ipcRenderer.invoke('terminal:destroy', { id }),
  getCwd: (id) => ipcRenderer.invoke('terminal:getCwd', { id }),

  // Event listeners
  onData: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('terminal:data', handler);
    return () => ipcRenderer.removeListener('terminal:data', handler);
  },
  onExit: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('terminal:exit', handler);
    return () => ipcRenderer.removeListener('terminal:exit', handler);
  },

  // Terminal configuration
  getTerminalConfig: () => ipcRenderer.invoke('terminal:getConfig'),
  isFeatureEnabled: (feature) => ipcRenderer.invoke('terminal:isFeatureEnabled', { feature }),
  setFeatureEnabled: (feature, enabled) => ipcRenderer.invoke('terminal:setFeatureEnabled', { feature, enabled }),
  updateFeatureSettings: (feature, settings) => ipcRenderer.invoke('terminal:updateFeatureSettings', { feature, settings }),

  // Workflows
  getWorkflows: () => ipcRenderer.invoke('terminal:getWorkflows'),
  addWorkflow: (workflow) => ipcRenderer.invoke('terminal:addWorkflow', { workflow }),
  updateWorkflow: (id, updates) => ipcRenderer.invoke('terminal:updateWorkflow', { id, updates }),
  deleteWorkflow: (id) => ipcRenderer.invoke('terminal:deleteWorkflow', { id }),

  // AI Suggestions
  getSuggestions: (params) => ipcRenderer.invoke('terminal:getSuggestions', params)
});

// Platform info
contextBridge.exposeInMainWorld('platform', {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux'
});

// Model providers API
contextBridge.exposeInMainWorld('donnaModels', {
  listProviders: () => ipcRenderer.invoke('models:listProviders'),
  chat: (messages, options = {}) => ipcRenderer.invoke('models:chat', { messages, options }),
  stream: (messages, options = {}) => {
    const streamId = Math.random().toString(36).substring(2, 11);
    return {
      streamId,
      start: () => ipcRenderer.invoke('models:streamStart', { streamId, messages, options })
    };
  },
  onStreamChunk: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('models:streamChunk', handler);
    return () => ipcRenderer.removeListener('models:streamChunk', handler);
  },
  onStreamEnd: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('models:streamEnd', handler);
    return () => ipcRenderer.removeListener('models:streamEnd', handler);
  },
  onStreamError: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('models:streamError', handler);
    return () => ipcRenderer.removeListener('models:streamError', handler);
  }
});

// Orchestrator API (Donna's AI coordination)
contextBridge.exposeInMainWorld('donnaOrchestrator', {
  spawnAgent: (config = {}) => ipcRenderer.invoke('orchestrator:spawnAgent', config),
  terminateAgent: (agentId) => ipcRenderer.invoke('orchestrator:terminateAgent', { agentId }),
  createTask: (config) => ipcRenderer.invoke('orchestrator:createTask', config),
  streamTask: (config) => {
    const streamId = Math.random().toString(36).substring(2, 11);
    return {
      streamId,
      start: () => ipcRenderer.invoke('orchestrator:streamTask', { streamId, config })
    };
  },
  executeComplex: (description, context = []) =>
    ipcRenderer.invoke('orchestrator:executeComplex', { description, context }),
  getStatus: () => ipcRenderer.invoke('orchestrator:status'),
  onTaskChunk: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('orchestrator:taskChunk', handler);
    return () => ipcRenderer.removeListener('orchestrator:taskChunk', handler);
  },
  onTaskEnd: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('orchestrator:taskEnd', handler);
    return () => ipcRenderer.removeListener('orchestrator:taskEnd', handler);
  },
  onTaskError: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('orchestrator:taskError', handler);
    return () => ipcRenderer.removeListener('orchestrator:taskError', handler);
  }
});

// Image generation API
contextBridge.exposeInMainWorld('donnaImaging', {
  listProviders: () => ipcRenderer.invoke('imaging:listProviders'),
  generate: (prompt, options = {}) => ipcRenderer.invoke('imaging:generate', { prompt, options }),
  checkRequirements: () => ipcRenderer.invoke('imaging:checkRequirements'),
  getInstallStatus: () => ipcRenderer.invoke('imaging:getInstallStatus'),
  installComfyUI: () => ipcRenderer.invoke('imaging:installComfyUI'),
  startComfyUI: () => ipcRenderer.invoke('imaging:startComfyUI'),
  stopComfyUI: () => ipcRenderer.invoke('imaging:stopComfyUI'),
  isComfyUIRunning: () => ipcRenderer.invoke('imaging:isComfyUIRunning'),
  listModels: () => ipcRenderer.invoke('imaging:listModels'),
  openImagesFolder: () => ipcRenderer.invoke('imaging:openImagesFolder'),
  openImage: (imagePath) => ipcRenderer.invoke('imaging:openImage', { imagePath }),
  saveConfig: (config) => ipcRenderer.invoke('imaging:saveConfig', config),
  onInstallProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('imaging:installProgress', handler);
    return () => ipcRenderer.removeListener('imaging:installProgress', handler);
  }
});

// Chat API
contextBridge.exposeInMainWorld('donnaChat', {
  createSession: (config = {}) => ipcRenderer.invoke('chat:createSession', config),
  getSession: (sessionId) => ipcRenderer.invoke('chat:getSession', { sessionId }),
  listSessions: () => ipcRenderer.invoke('chat:listSessions'),
  deleteSession: (sessionId) => ipcRenderer.invoke('chat:deleteSession', { sessionId }),
  renameSession: (sessionId, name) => ipcRenderer.invoke('chat:renameSession', { sessionId, name }),
  updateSession: (sessionId, updates) => ipcRenderer.invoke('chat:updateSession', { sessionId, updates }),
  sendMessage: (sessionId, content) => ipcRenderer.invoke('chat:sendMessage', { sessionId, content }),
  streamMessage: (sessionId, content) => {
    const streamId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    ipcRenderer.invoke('chat:streamMessage', { sessionId, content, streamId });
    return { streamId };
  },
  abortStream: (streamId) => ipcRenderer.invoke('chat:abortStream', { streamId }),
  listProviders: () => ipcRenderer.invoke('chat:listProviders'),
  updateProviderConfig: (provider, config) => ipcRenderer.invoke('chat:updateProviderConfig', { provider, config }),
  getConfig: () => ipcRenderer.invoke('chat:getConfig'),
  setDefaultProvider: (provider) => ipcRenderer.invoke('chat:setDefaultProvider', { provider }),
  onStreamChunk: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('chat:streamChunk', handler);
    return () => ipcRenderer.removeListener('chat:streamChunk', handler);
  },
  onStreamComplete: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('chat:streamComplete', handler);
    return () => ipcRenderer.removeListener('chat:streamComplete', handler);
  },
  onStreamError: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('chat:streamError', handler);
    return () => ipcRenderer.removeListener('chat:streamError', handler);
  },
  onUserMessage: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('chat:userMessage', handler);
    return () => ipcRenderer.removeListener('chat:userMessage', handler);
  }
});

// Agents API - Pre-defined AI personalities wrapping Claude Code and Gemini CLIs
contextBridge.exposeInMainWorld('donnaAgents', {
  // List all defined agents
  list: () => ipcRenderer.invoke('agents:list'),
  // List only agents with available CLIs
  available: () => ipcRenderer.invoke('agents:available'),
  // Get a specific agent by ID
  get: (id) => ipcRenderer.invoke('agents:get', { id }),
  // Check if a CLI is installed
  checkCli: (cli) => ipcRenderer.invoke('agents:checkCli', { cli }),
  // Create an agent session (spawns the CLI with personality)
  createSession: (id, agentId, cols, rows, workingDir) =>
    ipcRenderer.invoke('agents:createSession', { id, agentId, cols, rows, workingDir }),
  // Check if Arena mode is available (both Claude and Gemini installed)
  isArenaAvailable: () => ipcRenderer.invoke('agents:isArenaAvailable')
});

// Config API
contextBridge.exposeInMainWorld('donnaConfig', {
  get: () => ipcRenderer.invoke('config:get'),
  set: (config) => ipcRenderer.invoke('config:set', config),
  setApiKey: (provider, apiKey) => ipcRenderer.invoke('config:setApiKey', { provider, apiKey })
});

// Speech/Voice API (Phase 6: Personal Speech Learning)
contextBridge.exposeInMainWorld('donnaSpeech', {
  addCorrection: (original, corrected) => ipcRenderer.invoke('speech:addCorrection', { original, corrected }),
  getPatterns: (options = {}) => ipcRenderer.invoke('speech:getPatterns', options),
  deletePattern: (id) => ipcRenderer.invoke('speech:deletePattern', { id }),
  updatePattern: (id, updates) => ipcRenderer.invoke('speech:updatePattern', { id, updates }),
  applyPatterns: (text) => ipcRenderer.invoke('speech:applyPatterns', { text }),
  getStats: () => ipcRenderer.invoke('speech:getStats'),
  exportPatterns: () => ipcRenderer.invoke('speech:exportPatterns'),
  importPatterns: (options = {}) => ipcRenderer.invoke('speech:importPatterns', options),
  clearPatterns: () => ipcRenderer.invoke('speech:clearPatterns')
});

// Link Preview API (Phase 2: Rich Link Previews)
contextBridge.exposeInMainWorld('donnaLinks', {
  getPreview: (url) => ipcRenderer.invoke('links:getPreview', { url }),
  getMultiplePreviews: (urls) => ipcRenderer.invoke('links:getMultiplePreviews', { urls }),
  clearCache: () => ipcRenderer.invoke('links:clearCache'),
  getCacheStats: () => ipcRenderer.invoke('links:getCacheStats')
});

// Files API (Phase 3: File Cards/Attachments)
contextBridge.exposeInMainWorld('donnaFiles', {
  process: (filePath) => ipcRenderer.invoke('files:process', { filePath }),
  processMultiple: (filePaths) => ipcRenderer.invoke('files:processMultiple', { filePaths }),
  encodeForAI: (filePath) => ipcRenderer.invoke('files:encodeForAI', { filePath }),
  readText: (filePath, maxLength) => ipcRenderer.invoke('files:readText', { filePath, maxLength }),
  prepareForChat: (attachments) => ipcRenderer.invoke('files:prepareForChat', { attachments })
});

// Voice API (Phase 5: Voice Input)
contextBridge.exposeInMainWorld('donnaVoice', {
  startListening: (options = {}) => ipcRenderer.invoke('voice:startListening', options),
  stopListening: () => ipcRenderer.invoke('voice:stopListening'),
  getState: () => ipcRenderer.invoke('voice:getState'),
  setMode: (mode) => ipcRenderer.invoke('voice:setMode', { mode }),
  processTranscription: (text, isFinal) => ipcRenderer.invoke('voice:processTranscription', { text, isFinal }),
  applyCorrections: (text) => ipcRenderer.invoke('voice:applyCorrections', { text }),
  onStateChange: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('voice:stateChange', handler);
    return () => ipcRenderer.removeListener('voice:stateChange', handler);
  },
  onTranscription: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('voice:transcription', handler);
    return () => ipcRenderer.removeListener('voice:transcription', handler);
  },
  onTranscriptionComplete: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('voice:transcriptionComplete', handler);
    return () => ipcRenderer.removeListener('voice:transcriptionComplete', handler);
  }
});

// Context Sidebar API - Open files, URLs, and directories
contextBridge.exposeInMainWorld('donnaContext', {
  openPath: (filePath) => ipcRenderer.invoke('context:open-path', filePath),
  openExternal: (url) => ipcRenderer.invoke('context:open-external', url),
  showInFolder: (filePath) => ipcRenderer.invoke('context:show-in-folder', filePath),
  getHome: () => ipcRenderer.invoke('context:get-home'),
  pickFolder: (defaultPath) => ipcRenderer.invoke('context:pick-folder', defaultPath)
});

// Vault API (Phase 7: Obsidian Vault Integration)
contextBridge.exposeInMainWorld('donnaVault', {
  setPath: (vaultPath) => ipcRenderer.invoke('vault:setPath', { vaultPath }),
  search: (query) => ipcRenderer.invoke('vault:search', { query }),
  readNote: (path) => ipcRenderer.invoke('vault:readNote', { path }),
  createNote: (path, content) => ipcRenderer.invoke('vault:createNote', { path, content }),
  resolveWikilink: (linkText) => ipcRenderer.invoke('vault:resolveWikilink', { linkText }),
  getBacklinks: (path) => ipcRenderer.invoke('vault:getBacklinks', { path }),
  getFolderTree: () => ipcRenderer.invoke('vault:getFolderTree'),
  rebuildIndex: () => ipcRenderer.invoke('vault:rebuildIndex'),
  onIndexComplete: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('vault:indexComplete', handler);
    return () => ipcRenderer.removeListener('vault:indexComplete', handler);
  },
  onFileChanged: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('vault:fileChanged', handler);
    return () => ipcRenderer.removeListener('vault:fileChanged', handler);
  }
});
