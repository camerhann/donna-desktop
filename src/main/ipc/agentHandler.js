/**
 * Agent IPC Handlers
 */
const { ipcMain } = require('electron');
const os = require('os');
const fs = require('fs');
const path = require('path');
const pty = require('node-pty');
const { validateTerminalId, validateTerminalDimensions } = require('./terminalHandler');

function registerAgentHandlers(dependencies) {
  const { terminals, getMainWindow, agentDefinitions, getModelManager, initializeOrchestrator } = dependencies;
  const { listAgents, getAvailableAgents, getAgent, getAgentCliCommand, checkCliAvailable } = agentDefinitions;

  ipcMain.handle('agents:list', () => {
    try { return listAgents(); } catch (error) { console.error('Failed to list agents:', error); return []; }
  });

  ipcMain.handle('agents:available', async () => {
    try { return await getAvailableAgents(); } catch (error) { console.error('Failed to get available agents:', error); return []; }
  });

  ipcMain.handle('agents:get', (event, { id }) => {
    try { return getAgent(id); } catch (error) { console.error('Failed to get agent:', error); return null; }
  });

  ipcMain.handle('agents:checkCli', async (event, { cli }) => {
    try { return await checkCliAvailable(cli); } catch (error) { console.error('Failed to check CLI availability:', error); return false; }
  });

  ipcMain.handle('agents:createSession', (event, { id, agentId, cols, rows, workingDir }) => {
    if (!validateTerminalId(id)) return { success: false, error: 'Invalid session ID format' };

    let safeWorkingDir = os.homedir();
    if (workingDir && typeof workingDir === 'string') {
      const resolvedDir = path.resolve(workingDir);
      if (fs.existsSync(resolvedDir) && fs.statSync(resolvedDir).isDirectory()) {
        safeWorkingDir = resolvedDir;
      }
    }

    let commandData;
    try { commandData = getAgentCliCommand(agentId, safeWorkingDir); } catch (error) { return { success: false, error: error.message }; }

    const { command, args, agent } = commandData;
    const { cols: safeCols, rows: safeRows } = validateTerminalDimensions(cols, rows);

    console.log('[Agent] Spawning CLI:', command, 'with args:', args.length > 0 ? `[${args[0]}, <prompt ${args[1]?.length || 0} chars>]` : '[]');

    try {
      const ptyProcess = pty.spawn(command, args, {
        name: 'xterm-256color', cols: safeCols, rows: safeRows, cwd: safeWorkingDir,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' }
      });

      terminals.set(id, ptyProcess);

      ptyProcess.onData((data) => {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('terminal:data', { id, data });
      });

      ptyProcess.onExit(({ exitCode }) => {
        terminals.delete(id);
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('terminal:exit', { id, exitCode });
      });

      return { success: true, id, agent: { id: agent.id, name: agent.name, description: agent.description, icon: agent.icon, color: agent.color, cli: agent.cli } };
    } catch (error) {
      console.error('Failed to spawn agent CLI:', error);
      return { success: false, error: error.message || 'Failed to spawn agent CLI process' };
    }
  });

  ipcMain.handle('terminal:getSuggestions', async (event, { input, history, cwd, provider }) => {
    let modelManager = getModelManager();
    if (!modelManager) { initializeOrchestrator(); modelManager = getModelManager(); }

    try {
      const context = `Current directory: ${cwd}\nRecent commands:\n${(history || []).slice(-5).join('\n')}\n\nCurrent input: ${input}`;
      const prompt = `Suggest 3 shell commands that complete or improve: "${input}"\nConsider the context and provide commands that would be useful.\nReturn ONLY a JSON array: [{"command": "...", "description": "..."}]`;

      const response = await modelManager.chat([
        { role: 'system', content: 'You are a shell command expert. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ], { provider: provider || 'claude' });

      try { const suggestions = JSON.parse(response.content); return { success: true, suggestions }; } catch { return { success: true, suggestions: [] }; }
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      return { success: false, suggestions: [], error: error.message };
    }
  });
}

module.exports = { registerAgentHandlers };
