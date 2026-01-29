/**
 * Voice IPC Handlers
 * Phase 5: Voice Input
 */
const { ipcMain } = require('electron');
const { getVoiceManager } = require('../voice/voiceManager');

function registerVoiceHandlers(dependencies) {
  const { getMainWindow } = dependencies;
  const voiceManager = getVoiceManager();

  // Forward voice manager events to renderer
  voiceManager.on('stateChange', (data) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('voice:stateChange', data);
    }
  });

  voiceManager.on('transcription', (data) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('voice:transcription', data);
    }
  });

  voiceManager.on('transcriptionComplete', (data) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('voice:transcriptionComplete', data);
    }
  });

  // Start listening
  ipcMain.handle('voice:startListening', (event, options = {}) => {
    return voiceManager.start(options);
  });

  // Stop listening
  ipcMain.handle('voice:stopListening', () => {
    return voiceManager.stop();
  });

  // Get current state
  ipcMain.handle('voice:getState', () => {
    return voiceManager.getState();
  });

  // Set voice mode
  ipcMain.handle('voice:setMode', (event, { mode }) => {
    return voiceManager.setMode(mode);
  });

  // Process transcription (from renderer's Web Speech API)
  ipcMain.handle('voice:processTranscription', (event, { text, isFinal }) => {
    voiceManager.processTranscription(text, isFinal);
    return { success: true };
  });

  // Apply speech corrections to text
  ipcMain.handle('voice:applyCorrections', (event, { text }) => {
    const corrected = voiceManager.applyCorrections(text);
    return { success: true, original: text, corrected };
  });
}

module.exports = { registerVoiceHandlers };
