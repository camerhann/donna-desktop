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
  }
});

// Platform info
contextBridge.exposeInMainWorld('platform', {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux'
});

// Model providers API
contextBridge.exposeInMainWorld('donnaModels', {
  // List available providers
  listProviders: () => ipcRenderer.invoke('models:listProviders'),

  // Chat with a model (non-streaming)
  chat: (messages, options = {}) => ipcRenderer.invoke('models:chat', { messages, options }),

  // Stream from a model
  stream: (messages, options = {}) => {
    const streamId = Math.random().toString(36).substr(2, 9);
    return {
      streamId,
      start: () => ipcRenderer.invoke('models:streamStart', { streamId, messages, options })
    };
  },

  // Stream event listeners
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
  // Agent management
  spawnAgent: (config = {}) => ipcRenderer.invoke('orchestrator:spawnAgent', config),
  terminateAgent: (agentId) => ipcRenderer.invoke('orchestrator:terminateAgent', { agentId }),

  // Task management
  createTask: (config) => ipcRenderer.invoke('orchestrator:createTask', config),

  // Stream a task
  streamTask: (config) => {
    const streamId = Math.random().toString(36).substr(2, 9);
    return {
      streamId,
      start: () => ipcRenderer.invoke('orchestrator:streamTask', { streamId, config })
    };
  },

  // Execute complex task with automatic planning
  executeComplex: (description, context = []) =>
    ipcRenderer.invoke('orchestrator:executeComplex', { description, context }),

  // Get orchestrator status
  getStatus: () => ipcRenderer.invoke('orchestrator:status'),

  // Task stream event listeners
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
  // Provider management
  listProviders: () => ipcRenderer.invoke('imaging:listProviders'),

  // Image generation
  generate: (prompt, options = {}) => ipcRenderer.invoke('imaging:generate', { prompt, options }),

  // Local SD installation
  checkRequirements: () => ipcRenderer.invoke('imaging:checkRequirements'),
  getInstallStatus: () => ipcRenderer.invoke('imaging:getInstallStatus'),
  installComfyUI: () => ipcRenderer.invoke('imaging:installComfyUI'),
  startComfyUI: () => ipcRenderer.invoke('imaging:startComfyUI'),
  stopComfyUI: () => ipcRenderer.invoke('imaging:stopComfyUI'),
  isComfyUIRunning: () => ipcRenderer.invoke('imaging:isComfyUIRunning'),
  listModels: () => ipcRenderer.invoke('imaging:listModels'),

  // File operations
  openImagesFolder: () => ipcRenderer.invoke('imaging:openImagesFolder'),
  openImage: (imagePath) => ipcRenderer.invoke('imaging:openImage', { imagePath }),

  // Config
  saveConfig: (config) => ipcRenderer.invoke('imaging:saveConfig', config),

  // Event listeners
  onInstallProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('imaging:installProgress', handler);
    return () => ipcRenderer.removeListener('imaging:installProgress', handler);
  }
});

// Config API
contextBridge.exposeInMainWorld('donnaConfig', {
  get: () => ipcRenderer.invoke('config:get'),
  set: (config) => ipcRenderer.invoke('config:set', config),
  setApiKey: (provider, apiKey) => ipcRenderer.invoke('config:setApiKey', { provider, apiKey })
});
