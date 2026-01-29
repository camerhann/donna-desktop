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
