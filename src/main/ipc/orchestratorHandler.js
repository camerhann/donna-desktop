/**
 * Orchestrator IPC Handlers
 */
const { ipcMain } = require('electron');

function registerOrchestratorHandlers(dependencies) {
  const { getOrchestrator, initializeOrchestrator, getMainWindow } = dependencies;

  ipcMain.handle('orchestrator:spawnAgent', (event, config) => {
    let orchestrator = getOrchestrator();
    if (!orchestrator) { initializeOrchestrator(); orchestrator = getOrchestrator(); }
    const agent = orchestrator.spawnAgent(config);
    return { success: true, agent: { id: agent.id, name: agent.name, role: agent.role } };
  });

  ipcMain.handle('orchestrator:terminateAgent', (event, { agentId }) => {
    let orchestrator = getOrchestrator();
    if (!orchestrator) { initializeOrchestrator(); orchestrator = getOrchestrator(); }
    const result = orchestrator.terminateAgent(agentId);
    return { success: result };
  });

  ipcMain.handle('orchestrator:createTask', (event, config) => {
    let orchestrator = getOrchestrator();
    if (!orchestrator) { initializeOrchestrator(); orchestrator = getOrchestrator(); }
    const task = orchestrator.createTask(config);
    return { success: true, task: { id: task.id, type: task.type, status: task.status } };
  });

  ipcMain.handle('orchestrator:streamTask', async (event, { streamId, config }) => {
    let orchestrator = getOrchestrator();
    if (!orchestrator) { initializeOrchestrator(); orchestrator = getOrchestrator(); }

    (async () => {
      try {
        for await (const chunk of orchestrator.streamTask(config)) {
          const mainWindow = getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('orchestrator:taskChunk', { streamId, chunk });
        }
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('orchestrator:taskEnd', { streamId });
      } catch (error) {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('orchestrator:taskError', { streamId, error: error.message });
      }
    })();

    return { success: true, streamId };
  });

  ipcMain.handle('orchestrator:executeComplex', async (event, { description, context }) => {
    let orchestrator = getOrchestrator();
    if (!orchestrator) { initializeOrchestrator(); orchestrator = getOrchestrator(); }
    try {
      const results = await orchestrator.executeComplexTask(description, context || []);
      return { success: true, results };
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('orchestrator:status', () => {
    let orchestrator = getOrchestrator();
    if (!orchestrator) { initializeOrchestrator(); orchestrator = getOrchestrator(); }
    return orchestrator.getStatus();
  });
}

module.exports = { registerOrchestratorHandlers };
