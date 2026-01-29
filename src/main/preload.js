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

// Chat API
contextBridge.exposeInMainWorld('donnaChat', {
  // Session management
  createSession: (config = {}) => ipcRenderer.invoke('chat:createSession', config),
  getSession: (sessionId) => ipcRenderer.invoke('chat:getSession', { sessionId }),
  listSessions: () => ipcRenderer.invoke('chat:listSessions'),
  deleteSession: (sessionId) => ipcRenderer.invoke('chat:deleteSession', { sessionId }),
  renameSession: (sessionId, name) => ipcRenderer.invoke('chat:renameSession', { sessionId, name }),
  updateSession: (sessionId, updates) => ipcRenderer.invoke('chat:updateSession', { sessionId, updates }),

  // Messaging
  sendMessage: (sessionId, content) => ipcRenderer.invoke('chat:sendMessage', { sessionId, content }),
  streamMessage: (sessionId, content) => {
    const streamId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    ipcRenderer.invoke('chat:streamMessage', { sessionId, content, streamId });
    return { streamId };
  },
  abortStream: (streamId) => ipcRenderer.invoke('chat:abortStream', { streamId }),

  // Provider management
  listProviders: () => ipcRenderer.invoke('chat:listProviders'),
  updateProviderConfig: (provider, config) => ipcRenderer.invoke('chat:updateProviderConfig', { provider, config }),
  getConfig: () => ipcRenderer.invoke('chat:getConfig'),
  setDefaultProvider: (provider) => ipcRenderer.invoke('chat:setDefaultProvider', { provider }),

  // Stream event listeners
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
