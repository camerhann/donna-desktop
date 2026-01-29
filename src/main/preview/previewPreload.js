/**
 * Preview Window Preload Script
 * Exposes safe APIs to the preview renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose preview API to the renderer
contextBridge.exposeInMainWorld('previewAPI', {
  // Listen for content updates
  onContent: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('preview:content', handler);
    return () => ipcRenderer.removeListener('preview:content', handler);
  },

  // Listen for errors
  onError: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('preview:error', handler);
    return () => ipcRenderer.removeListener('preview:error', handler);
  },

  // Request close
  close: () => ipcRenderer.invoke('preview:close-self'),

  // Copy content to clipboard
  copyToClipboard: (text) => ipcRenderer.invoke('preview:copy', text)
});

// Platform info for styling
contextBridge.exposeInMainWorld('platform', {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux'
});
