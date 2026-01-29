/**
 * Files IPC Handlers
 * Phase 3: File Cards/Attachments
 */
const { ipcMain } = require('electron');
const { getFileHandler } = require('../files/fileHandler');

function registerFilesHandlers() {
  const fileHandler = getFileHandler();

  // Process a file (get metadata, thumbnail)
  ipcMain.handle('files:process', async (event, { filePath }) => {
    if (!filePath) {
      return { success: false, error: 'File path required' };
    }
    return await fileHandler.processFile(filePath);
  });

  // Process multiple files
  ipcMain.handle('files:processMultiple', async (event, { filePaths }) => {
    if (!filePaths || !Array.isArray(filePaths)) {
      return { success: false, error: 'File paths array required' };
    }

    const results = [];
    for (const filePath of filePaths) {
      const result = await fileHandler.processFile(filePath);
      results.push(result);
    }

    return { success: true, files: results.filter(r => r.success).map(r => r.file) };
  });

  // Encode image for AI vision API
  ipcMain.handle('files:encodeForAI', async (event, { filePath }) => {
    if (!filePath) {
      return { success: false, error: 'File path required' };
    }
    return await fileHandler.encodeForAI(filePath);
  });

  // Read text file content
  ipcMain.handle('files:readText', async (event, { filePath, maxLength }) => {
    if (!filePath) {
      return { success: false, error: 'File path required' };
    }
    return await fileHandler.readTextFile(filePath, maxLength);
  });

  // Prepare attachments for chat API
  ipcMain.handle('files:prepareForChat', async (event, { attachments }) => {
    if (!attachments || !Array.isArray(attachments)) {
      return { success: false, error: 'Attachments array required' };
    }

    try {
      const parts = await fileHandler.prepareAttachmentsForChat(attachments);
      return { success: true, parts };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerFilesHandlers };
