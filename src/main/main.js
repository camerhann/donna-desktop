const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const pty = require('node-pty');
const { createOrchestrator } = require('./models/orchestrator');
const { ModelManager, ClaudeProvider, GeminiProvider, OllamaProvider, OpenAICompatibleProvider } = require('./models/modelProvider');

// Store terminal sessions
const terminals = new Map();
let mainWindow = null;

// Model orchestration
let orchestrator = null;
let modelManager = null;
let modelConfig = {};

// Config file path
const configPath = path.join(os.homedir(), '.donna-desktop', 'config.json');

// Load config
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      modelConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load config:', e);
    modelConfig = {};
  }
  return modelConfig;
}

// Save config
function saveConfig(config) {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    modelConfig = config;
    return true;
  } catch (e) {
    console.error('Failed to save config:', e);
    return false;
  }
}

// Initialize orchestrator with config
function initializeOrchestrator() {
  loadConfig();
  orchestrator = createOrchestrator(modelConfig.models || {});
  modelManager = orchestrator.modelManager;
  return orchestrator;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development
  if (process.argv.includes('--enable-logging')) {
    mainWindow.webContents.openDevTools();
  }
}

// Get the default shell
function getDefaultShell() {
  if (process.platform === 'darwin') {
    return process.env.SHELL || '/bin/zsh';
  }
  return process.env.SHELL || '/bin/bash';
}

// Create a new terminal session
ipcMain.handle('terminal:create', (event, { id, cols, rows }) => {
  const shell = getDefaultShell();

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: os.homedir(),
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    }
  });

  terminals.set(id, ptyProcess);

  ptyProcess.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:data', { id, data });
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    terminals.delete(id);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:exit', { id, exitCode });
    }
  });

  return { success: true, id };
});

// Write to terminal
ipcMain.handle('terminal:write', (event, { id, data }) => {
  const term = terminals.get(id);
  if (term) {
    term.write(data);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

// Resize terminal
ipcMain.handle('terminal:resize', (event, { id, cols, rows }) => {
  const term = terminals.get(id);
  if (term) {
    term.resize(cols, rows);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

// Destroy terminal
ipcMain.handle('terminal:destroy', (event, { id }) => {
  const term = terminals.get(id);
  if (term) {
    term.kill();
    terminals.delete(id);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

// Get current working directory
ipcMain.handle('terminal:getCwd', (event, { id }) => {
  const term = terminals.get(id);
  if (term) {
    // On macOS, we can try to get the cwd from the process
    try {
      const pid = term.pid;
      const { execSync } = require('child_process');
      const cwd = execSync(`lsof -p ${pid} | grep cwd | awk '{print $NF}'`, { encoding: 'utf8' }).trim();
      return { success: true, cwd };
    } catch {
      return { success: true, cwd: os.homedir() };
    }
  }
  return { success: false, error: 'Terminal not found' };
});

// === Model Provider IPC Handlers ===

// Get available providers
ipcMain.handle('models:listProviders', () => {
  if (!modelManager) initializeOrchestrator();
  return modelManager.listProviders();
});

// Chat with a model
ipcMain.handle('models:chat', async (event, { messages, options }) => {
  if (!modelManager) initializeOrchestrator();
  try {
    const response = await modelManager.chat(messages, options);
    return { success: true, response };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stream from a model
ipcMain.handle('models:streamStart', async (event, { streamId, messages, options }) => {
  if (!modelManager) initializeOrchestrator();

  // Start streaming in background
  (async () => {
    try {
      for await (const chunk of modelManager.stream(messages, options)) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('models:streamChunk', { streamId, chunk });
        }
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('models:streamEnd', { streamId });
      }
    } catch (error) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('models:streamError', { streamId, error: error.message });
      }
    }
  })();

  return { success: true, streamId };
});

// === Orchestrator IPC Handlers ===

// Spawn an agent
ipcMain.handle('orchestrator:spawnAgent', (event, config) => {
  if (!orchestrator) initializeOrchestrator();
  const agent = orchestrator.spawnAgent(config);
  return { success: true, agent: { id: agent.id, name: agent.name, role: agent.role } };
});

// Terminate an agent
ipcMain.handle('orchestrator:terminateAgent', (event, { agentId }) => {
  if (!orchestrator) initializeOrchestrator();
  const result = orchestrator.terminateAgent(agentId);
  return { success: result };
});

// Create a task
ipcMain.handle('orchestrator:createTask', (event, config) => {
  if (!orchestrator) initializeOrchestrator();
  const task = orchestrator.createTask(config);
  return { success: true, task: { id: task.id, type: task.type, status: task.status } };
});

// Stream a task (returns streamId for tracking)
ipcMain.handle('orchestrator:streamTask', async (event, { streamId, config }) => {
  if (!orchestrator) initializeOrchestrator();

  (async () => {
    try {
      for await (const chunk of orchestrator.streamTask(config)) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('orchestrator:taskChunk', { streamId, chunk });
        }
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('orchestrator:taskEnd', { streamId });
      }
    } catch (error) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('orchestrator:taskError', { streamId, error: error.message });
      }
    }
  })();

  return { success: true, streamId };
});

// Execute a complex task with planning
ipcMain.handle('orchestrator:executeComplex', async (event, { description, context }) => {
  if (!orchestrator) initializeOrchestrator();
  try {
    const results = await orchestrator.executeComplexTask(description, context || []);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get orchestrator status
ipcMain.handle('orchestrator:status', () => {
  if (!orchestrator) initializeOrchestrator();
  return orchestrator.getStatus();
});

// === Config IPC Handlers ===

// Get config
ipcMain.handle('config:get', () => {
  return loadConfig();
});

// Set config
ipcMain.handle('config:set', (event, config) => {
  const success = saveConfig(config);
  if (success) {
    // Reinitialize orchestrator with new config
    initializeOrchestrator();
  }
  return { success };
});

// Set API key for a provider
ipcMain.handle('config:setApiKey', (event, { provider, apiKey }) => {
  loadConfig();
  if (!modelConfig.models) modelConfig.models = {};
  if (!modelConfig.models[provider]) modelConfig.models[provider] = {};
  modelConfig.models[provider].apiKey = apiKey;
  const success = saveConfig(modelConfig);
  if (success) {
    initializeOrchestrator();
  }
  return { success };
});

// === App Lifecycle ===

app.whenReady().then(() => {
  initializeOrchestrator();
  createWindow();
});

app.on('window-all-closed', () => {
  // Clean up all terminals
  for (const [id, term] of terminals) {
    term.kill();
  }
  terminals.clear();

  // Clean up orchestrator
  if (orchestrator) {
    orchestrator.cleanup();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
