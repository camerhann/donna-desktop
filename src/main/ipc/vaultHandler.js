/**
 * Vault IPC Handlers
 * Phase 7: Obsidian Vault Integration
 */
const { ipcMain } = require('electron');
const { getVaultManager } = require('../obsidian/vaultManager');

function registerVaultHandlers(dependencies) {
  const { getMainWindow } = dependencies;
  const vaultManager = getVaultManager();

  // Forward vault events to renderer
  vaultManager.on('indexComplete', (data) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('vault:indexComplete', data);
    }
  });

  vaultManager.on('fileAdded', (data) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('vault:fileAdded', data);
    }
  });

  vaultManager.on('fileChanged', (data) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('vault:fileChanged', data);
    }
  });

  vaultManager.on('fileRemoved', (data) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('vault:fileRemoved', data);
    }
  });

  // Set vault path
  ipcMain.handle('vault:setPath', async (event, { vaultPath }) => {
    if (!vaultPath) {
      return { success: false, error: 'Vault path required' };
    }
    return await vaultManager.setPath(vaultPath);
  });

  // Search notes
  ipcMain.handle('vault:search', async (event, { query }) => {
    if (!query) {
      return { success: true, results: [] };
    }
    const results = await vaultManager.search(query);
    return { success: true, results };
  });

  // Read a note
  ipcMain.handle('vault:readNote', async (event, { path }) => {
    if (!path) {
      return { success: false, error: 'Path required' };
    }
    return await vaultManager.readNote(path);
  });

  // Create a note
  ipcMain.handle('vault:createNote', async (event, { path, content }) => {
    if (!path || content === undefined) {
      return { success: false, error: 'Path and content required' };
    }
    return await vaultManager.createNote(path, content);
  });

  // Resolve wikilink
  ipcMain.handle('vault:resolveWikilink', (event, { linkText }) => {
    if (!linkText) {
      return { success: false, error: 'Link text required' };
    }
    const result = vaultManager.resolveWikilink(linkText);
    return { success: true, ...result };
  });

  // Get backlinks for a note
  ipcMain.handle('vault:getBacklinks', (event, { path }) => {
    if (!path) {
      return { success: false, error: 'Path required' };
    }
    const backlinks = vaultManager.getBacklinks(path);
    return { success: true, backlinks };
  });

  // Get folder tree
  ipcMain.handle('vault:getFolderTree', () => {
    const tree = vaultManager.getFolderTree();
    return { success: true, tree };
  });

  // Rebuild index
  ipcMain.handle('vault:rebuildIndex', async () => {
    await vaultManager.buildIndex();
    return { success: true, fileCount: vaultManager.index.files.size };
  });
}

module.exports = { registerVaultHandlers };
