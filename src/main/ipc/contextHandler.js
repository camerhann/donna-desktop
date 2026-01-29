/**
 * Context Sidebar IPC Handler
 * Handles opening files, directories, and URLs from the context sidebar
 * Also handles folder picker dialog
 */

const { ipcMain, shell, dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

function registerContextHandlers() {
  // Open a file or directory with the default application
  ipcMain.handle('context:open-path', async (event, filePath) => {
    try {
      // Resolve relative paths
      let resolvedPath = filePath;
      if (!path.isAbsolute(filePath)) {
        // Try to resolve from home directory or current working directory
        const homeResolved = path.join(process.env.HOME || '', filePath);
        const cwdResolved = path.join(process.cwd(), filePath);

        if (fs.existsSync(homeResolved)) {
          resolvedPath = homeResolved;
        } else if (fs.existsSync(cwdResolved)) {
          resolvedPath = cwdResolved;
        }
      }

      // Check if path exists
      if (!fs.existsSync(resolvedPath)) {
        return { success: false, error: `Path not found: ${resolvedPath}` };
      }

      // Open with default application
      const result = await shell.openPath(resolvedPath);

      if (result) {
        // shell.openPath returns error string if failed, empty string on success
        return { success: false, error: result };
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to open path:', error);
      return { success: false, error: error.message };
    }
  });

  // Open a URL in the default browser
  ipcMain.handle('context:open-external', async (event, url) => {
    try {
      // Validate URL
      new URL(url); // Throws if invalid

      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('Failed to open URL:', error);
      return { success: false, error: error.message };
    }
  });

  // Reveal a file in Finder/Explorer
  ipcMain.handle('context:show-in-folder', async (event, filePath) => {
    try {
      let resolvedPath = filePath;
      if (!path.isAbsolute(filePath)) {
        resolvedPath = path.join(process.cwd(), filePath);
      }

      if (!fs.existsSync(resolvedPath)) {
        return { success: false, error: `Path not found: ${resolvedPath}` };
      }

      shell.showItemInFolder(resolvedPath);
      return { success: true };
    } catch (error) {
      console.error('Failed to show in folder:', error);
      return { success: false, error: error.message };
    }
  });

  // Get home directory
  ipcMain.handle('context:get-home', () => {
    return os.homedir();
  });

  // Pick a folder using native dialog
  ipcMain.handle('context:pick-folder', async (event, defaultPath) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(window, {
        title: 'Choose Working Directory',
        defaultPath: defaultPath || os.homedir(),
        properties: ['openDirectory', 'createDirectory']
      });

      if (result.canceled || !result.filePaths.length) {
        return { success: false, canceled: true };
      }

      return { success: true, path: result.filePaths[0] };
    } catch (error) {
      console.error('Failed to pick folder:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerContextHandlers };
