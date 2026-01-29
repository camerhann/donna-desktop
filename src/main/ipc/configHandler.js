/**
 * Config IPC Handlers
 */
const { ipcMain } = require('electron');

function registerConfigHandlers(dependencies) {
  const { loadConfig, saveConfig, getModelConfig, setModelConfig, initializeOrchestrator, initializeImageManager } = dependencies;

  ipcMain.handle('config:get', () => loadConfig());

  ipcMain.handle('config:set', (event, config) => {
    const success = saveConfig(config);
    if (success) { initializeOrchestrator(); initializeImageManager(); }
    return { success };
  });

  ipcMain.handle('config:setApiKey', (event, { provider, apiKey }) => {
    loadConfig();
    let modelConfig = getModelConfig();
    if (!modelConfig.models) modelConfig.models = {};
    if (!modelConfig.models[provider]) modelConfig.models[provider] = {};
    modelConfig.models[provider].apiKey = apiKey;
    setModelConfig(modelConfig);
    const success = saveConfig(modelConfig);
    if (success) initializeOrchestrator();
    return { success };
  });
}

module.exports = { registerConfigHandlers };
