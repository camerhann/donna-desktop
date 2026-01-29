/**
 * Speech IPC Handlers
 * Handles speech pattern management for personal speech learning (Phase 6)
 */
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const { getSpeechPatterns } = require('../voice/speechPatterns');

function registerSpeechHandlers(dependencies) {
  const { getMainWindow } = dependencies;

  // Add a correction pattern
  ipcMain.handle('speech:addCorrection', (event, { original, corrected }) => {
    if (!original || !corrected) {
      return { success: false, error: 'Missing original or corrected text' };
    }
    const patterns = getSpeechPatterns();
    const result = patterns.addCorrection(original, corrected);
    return result
      ? { success: true, pattern: result }
      : { success: false, error: 'Failed to add correction' };
  });

  // Get all patterns
  ipcMain.handle('speech:getPatterns', (event, options = {}) => {
    const patterns = getSpeechPatterns();
    return { success: true, patterns: patterns.getPatterns(options) };
  });

  // Delete a pattern
  ipcMain.handle('speech:deletePattern', (event, { id }) => {
    if (!id) return { success: false, error: 'Missing pattern ID' };
    const patterns = getSpeechPatterns();
    return { success: patterns.deletePattern(id) };
  });

  // Update a pattern
  ipcMain.handle('speech:updatePattern', (event, { id, updates }) => {
    if (!id) return { success: false, error: 'Missing pattern ID' };
    const patterns = getSpeechPatterns();
    const result = patterns.updatePattern(id, updates || {});
    return result
      ? { success: true, pattern: result }
      : { success: false, error: 'Pattern not found' };
  });

  // Apply patterns to text
  ipcMain.handle('speech:applyPatterns', (event, { text }) => {
    if (!text) return { success: true, corrected: text, appliedPatterns: [] };
    const patterns = getSpeechPatterns();
    const result = patterns.applyPatterns(text);
    return { success: true, ...result };
  });

  // Get statistics
  ipcMain.handle('speech:getStats', () => {
    const patterns = getSpeechPatterns();
    return { success: true, stats: patterns.getStats() };
  });

  // Export patterns to file
  ipcMain.handle('speech:exportPatterns', async () => {
    const patterns = getSpeechPatterns();
    const data = patterns.exportPatterns();
    const mainWindow = getMainWindow();

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Speech Patterns',
      defaultPath: 'speech-patterns.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
      return { success: true, path: result.filePath };
    }
    return { success: false, canceled: true };
  });

  // Import patterns from file
  ipcMain.handle('speech:importPatterns', async (event, options = {}) => {
    const mainWindow = getMainWindow();

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Speech Patterns',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      try {
        const data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
        const patterns = getSpeechPatterns();
        const importResult = patterns.importPatterns(data, options);
        return { success: true, ...importResult };
      } catch (e) {
        return { success: false, error: 'Failed to parse import file' };
      }
    }
    return { success: false, canceled: true };
  });

  // Clear all patterns
  ipcMain.handle('speech:clearPatterns', () => {
    const patterns = getSpeechPatterns();
    return { success: patterns.clearAll() };
  });
}

module.exports = { registerSpeechHandlers };
