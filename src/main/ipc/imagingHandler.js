/**
 * Imaging IPC Handlers
 */
const { ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

function registerImagingHandlers(dependencies) {
  const { getImageManager, initializeImageManager, sdInstaller, getMainWindow, loadConfig, saveConfig } = dependencies;

  ipcMain.handle('imaging:listProviders', async () => {
    let imageManager = getImageManager();
    if (!imageManager) { initializeImageManager(); imageManager = getImageManager(); }
    return await imageManager.listProviders();
  });

  ipcMain.handle('imaging:generate', async (event, { prompt, options }) => {
    let imageManager = getImageManager();
    if (!imageManager) { initializeImageManager(); imageManager = getImageManager(); }
    try {
      const result = await imageManager.generate(prompt, options);
      return { success: true, result };
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('imaging:checkRequirements', async () => await sdInstaller.checkRequirements());
  ipcMain.handle('imaging:getInstallStatus', () => sdInstaller.getInstallationStatus());

  ipcMain.handle('imaging:installComfyUI', async (event) => {
    return await sdInstaller.installComfyUI((progress) => {
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('imaging:installProgress', progress);
    });
  });

  ipcMain.handle('imaging:startComfyUI', async () => {
    try { const result = sdInstaller.startComfyUI(); return { success: true, ...result }; }
    catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('imaging:stopComfyUI', async () => await sdInstaller.stopComfyUI());
  ipcMain.handle('imaging:isComfyUIRunning', async () => await sdInstaller.isComfyUIRunning());
  ipcMain.handle('imaging:listModels', () => sdInstaller.listModels());

  ipcMain.handle('imaging:openImagesFolder', () => {
    const imagesDir = path.join(os.homedir(), '.donna-desktop', 'images');
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    shell.openPath(imagesDir);
    return { success: true };
  });

  ipcMain.handle('imaging:openImage', (event, { imagePath }) => {
    if (!imagePath || typeof imagePath !== 'string') return { success: false, error: 'Invalid image path' };
    const resolvedPath = path.resolve(imagePath);
    const imagesDir = path.join(os.homedir(), '.donna-desktop', 'images');
    if (!resolvedPath.startsWith(imagesDir)) return { success: false, error: 'Access denied: path outside allowed directory' };
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
    const ext = path.extname(resolvedPath).toLowerCase();
    if (!allowedExtensions.includes(ext)) return { success: false, error: 'Invalid file type: only image files allowed' };
    if (fs.existsSync(resolvedPath)) { shell.openPath(resolvedPath); return { success: true }; }
    return { success: false, error: 'Image not found' };
  });

  ipcMain.handle('imaging:saveConfig', (event, config) => {
    const fullConfig = loadConfig();
    fullConfig.imaging = config;
    const success = saveConfig(fullConfig);
    if (success) initializeImageManager();
    return { success };
  });
}

module.exports = { registerImagingHandlers };
