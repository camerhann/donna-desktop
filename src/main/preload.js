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
