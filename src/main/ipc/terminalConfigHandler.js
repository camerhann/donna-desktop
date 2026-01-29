/**
 * Terminal Config IPC Handlers
 */
const { ipcMain } = require('electron');

function registerTerminalConfigHandlers(dependencies) {
  const { getTerminalConfig } = dependencies;

  ipcMain.handle('terminal:getConfig', () => {
    const config = getTerminalConfig();
    return config.getConfig();
  });

  ipcMain.handle('terminal:isFeatureEnabled', (event, { feature }) => {
    if (!feature || typeof feature !== 'string') return false;
    const config = getTerminalConfig();
    return config.isFeatureEnabled(feature);
  });

  ipcMain.handle('terminal:setFeatureEnabled', (event, { feature, enabled }) => {
    if (!feature || typeof feature !== 'string') {
      return { success: false, error: 'Invalid feature name' };
    }
    const config = getTerminalConfig();
    return config.setFeatureEnabled(feature, Boolean(enabled));
  });

  ipcMain.handle('terminal:updateFeatureSettings', (event, { feature, settings }) => {
    if (!feature || typeof feature !== 'string') {
      return { success: false, error: 'Invalid feature name' };
    }
    const config = getTerminalConfig();
    return config.updateFeatureSettings(feature, settings || {});
  });

  ipcMain.handle('terminal:getWorkflows', () => {
    const config = getTerminalConfig();
    return config.getWorkflows();
  });

  ipcMain.handle('terminal:addWorkflow', (event, { workflow }) => {
    if (!workflow || typeof workflow !== 'object') {
      return { success: false, error: 'Invalid workflow object' };
    }
    const config = getTerminalConfig();
    return config.addWorkflow(workflow);
  });

  ipcMain.handle('terminal:updateWorkflow', (event, { id, updates }) => {
    if (!id) return { success: false, error: 'Missing workflow ID' };
    const config = getTerminalConfig();
    return config.updateWorkflow(id, updates || {});
  });

  ipcMain.handle('terminal:deleteWorkflow', (event, { id }) => {
    if (!id) return { success: false, error: 'Missing workflow ID' };
    const config = getTerminalConfig();
    return config.deleteWorkflow(id);
  });
}

module.exports = { registerTerminalConfigHandlers };
