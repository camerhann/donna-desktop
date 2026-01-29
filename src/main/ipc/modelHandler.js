/**
 * Model Provider IPC Handlers
 */
const { ipcMain } = require('electron');

function registerModelHandlers(dependencies) {
  const { getModelManager, initializeOrchestrator, getMainWindow } = dependencies;

  ipcMain.handle('models:listProviders', () => {
    let modelManager = getModelManager();
    if (!modelManager) { initializeOrchestrator(); modelManager = getModelManager(); }
    return modelManager.listProviders();
  });

  ipcMain.handle('models:chat', async (event, { messages, options }) => {
    let modelManager = getModelManager();
    if (!modelManager) { initializeOrchestrator(); modelManager = getModelManager(); }
    try {
      const response = await modelManager.chat(messages, options);
      return { success: true, response };
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('models:streamStart', async (event, { streamId, messages, options }) => {
    let modelManager = getModelManager();
    if (!modelManager) { initializeOrchestrator(); modelManager = getModelManager(); }

    (async () => {
      try {
        for await (const chunk of modelManager.stream(messages, options)) {
          const mainWindow = getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('models:streamChunk', { streamId, chunk });
        }
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('models:streamEnd', { streamId });
      } catch (error) {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('models:streamError', { streamId, error: error.message });
      }
    })();

    return { success: true, streamId };
  });
}

module.exports = { registerModelHandlers };
