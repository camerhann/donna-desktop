const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const pty = require('node-pty');
const { createOrchestrator } = require('./models/orchestrator');
const { ModelManager, ClaudeProvider, GeminiProvider, OllamaProvider, OpenAICompatibleProvider } = require('./models/modelProvider');
const { createImageManager } = require('./imaging/imageProvider');
const sdInstaller = require('./imaging/sdInstaller');
const { ChatManager } = require('./chat/chatManager');

// Store terminal sessions
const terminals = new Map();
let mainWindow = null;

// Model orchestration
let orchestrator = null;
let modelManager = null;
let modelConfig = {};

// Image generation
let imageManager = null;
let imageConfig = {};

// Chat manager
let chatManager = null;

// Active streams for chat
const activeStreams = new Map();

// Config file path
const configPath = path.join(os.homedir(), '.donna-desktop', 'config.json');

// Load config
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      modelConfig = config;
      imageConfig = config.imaging || {};
      return config;
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  modelConfig = {};
  imageConfig = {};
  return {};
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
    imageConfig = config.imaging || {};
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

// Initialize image manager
function initializeImageManager() {
  loadConfig();
  imageManager = createImageManager(imageConfig);
  return imageManager;
}

// Initialize chat manager
function initChatManager() {
  if (!chatManager) {
    chatManager = new ChatManager();
  }
  return chatManager;
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

// === Terminal IPC Handlers ===

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

ipcMain.handle('models:listProviders', () => {
  if (!modelManager) initializeOrchestrator();
  return modelManager.listProviders();
});

ipcMain.handle('models:chat', async (event, { messages, options }) => {
  if (!modelManager) initializeOrchestrator();
  try {
    const response = await modelManager.chat(messages, options);
    return { success: true, response };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('models:streamStart', async (event, { streamId, messages, options }) => {
  if (!modelManager) initializeOrchestrator();

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

ipcMain.handle('orchestrator:spawnAgent', (event, config) => {
  if (!orchestrator) initializeOrchestrator();
  const agent = orchestrator.spawnAgent(config);
  return { success: true, agent: { id: agent.id, name: agent.name, role: agent.role } };
});

ipcMain.handle('orchestrator:terminateAgent', (event, { agentId }) => {
  if (!orchestrator) initializeOrchestrator();
  const result = orchestrator.terminateAgent(agentId);
  return { success: result };
});

ipcMain.handle('orchestrator:createTask', (event, config) => {
  if (!orchestrator) initializeOrchestrator();
  const task = orchestrator.createTask(config);
  return { success: true, task: { id: task.id, type: task.type, status: task.status } };
});

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

ipcMain.handle('orchestrator:executeComplex', async (event, { description, context }) => {
  if (!orchestrator) initializeOrchestrator();
  try {
    const results = await orchestrator.executeComplexTask(description, context || []);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('orchestrator:status', () => {
  if (!orchestrator) initializeOrchestrator();
  return orchestrator.getStatus();
});

// === Image Generation IPC Handlers ===

ipcMain.handle('imaging:listProviders', async () => {
  if (!imageManager) initializeImageManager();
  return await imageManager.listProviders();
});

ipcMain.handle('imaging:generate', async (event, { prompt, options }) => {
  if (!imageManager) initializeImageManager();
  try {
    const result = await imageManager.generate(prompt, options);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('imaging:checkRequirements', async () => {
  return await sdInstaller.checkRequirements();
});

ipcMain.handle('imaging:getInstallStatus', () => {
  return sdInstaller.getInstallationStatus();
});

ipcMain.handle('imaging:installComfyUI', async (event) => {
  return await sdInstaller.installComfyUI((progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('imaging:installProgress', progress);
    }
  });
});

ipcMain.handle('imaging:startComfyUI', async () => {
  try {
    const result = sdInstaller.startComfyUI();
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('imaging:stopComfyUI', async () => {
  return await sdInstaller.stopComfyUI();
});

ipcMain.handle('imaging:isComfyUIRunning', async () => {
  return await sdInstaller.isComfyUIRunning();
});

ipcMain.handle('imaging:listModels', () => {
  return sdInstaller.listModels();
});

ipcMain.handle('imaging:openImagesFolder', () => {
  const imagesDir = path.join(os.homedir(), '.donna-desktop', 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  shell.openPath(imagesDir);
  return { success: true };
});

ipcMain.handle('imaging:openImage', (event, { imagePath }) => {
  if (fs.existsSync(imagePath)) {
    shell.openPath(imagePath);
    return { success: true };
  }
  return { success: false, error: 'Image not found' };
});

ipcMain.handle('imaging:saveConfig', (event, config) => {
  const fullConfig = loadConfig();
  fullConfig.imaging = config;
  const success = saveConfig(fullConfig);
  if (success) {
    initializeImageManager();
  }
  return { success };
});

// === Chat IPC Handlers ===

ipcMain.handle('chat:createSession', (event, config) => {
  const manager = initChatManager();
  const session = manager.createSession(config);
  return {
    success: true,
    session: {
      id: session.id,
      name: session.name,
      provider: session.provider,
      model: session.model
    }
  };
});

ipcMain.handle('chat:getSession', (event, { sessionId }) => {
  const manager = initChatManager();
  const session = manager.getSession(sessionId);
  if (session) {
    return { success: true, session: session.toJSON() };
  }
  return { success: false, error: 'Session not found' };
});

ipcMain.handle('chat:listSessions', () => {
  const manager = initChatManager();
  return manager.listSessions();
});

ipcMain.handle('chat:deleteSession', (event, { sessionId }) => {
  const manager = initChatManager();
  const success = manager.deleteSession(sessionId);
  return { success };
});

ipcMain.handle('chat:renameSession', (event, { sessionId, name }) => {
  const manager = initChatManager();
  const success = manager.renameSession(sessionId, name);
  return { success };
});

ipcMain.handle('chat:updateSession', (event, { sessionId, updates }) => {
  const manager = initChatManager();
  const session = manager.getSession(sessionId);
  if (session) {
    if (updates.provider) session.provider = updates.provider;
    if (updates.model) session.model = updates.model;
    if (updates.systemPrompt !== undefined) session.systemPrompt = updates.systemPrompt;
    if (updates.name) session.name = updates.name;
    manager.saveSession(session);
    return { success: true };
  }
  return { success: false, error: 'Session not found' };
});

ipcMain.handle('chat:sendMessage', async (event, { sessionId, content }) => {
  const manager = initChatManager();
  try {
    const result = await manager.sendMessage(sessionId, content);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('chat:streamMessage', async (event, { sessionId, content, streamId }) => {
  const manager = initChatManager();

  activeStreams.set(streamId, { sessionId, aborted: false });

  (async () => {
    try {
      for await (const chunk of manager.streamMessage(sessionId, content)) {
        if (activeStreams.get(streamId)?.aborted) {
          break;
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          if (chunk.type === 'chunk') {
            mainWindow.webContents.send('chat:streamChunk', { streamId, content: chunk.content });
          } else if (chunk.type === 'complete') {
            mainWindow.webContents.send('chat:streamComplete', { streamId, message: chunk.message });
          } else if (chunk.type === 'error') {
            mainWindow.webContents.send('chat:streamError', { streamId, error: chunk.error });
          } else if (chunk.type === 'user_message') {
            mainWindow.webContents.send('chat:userMessage', { streamId, message: chunk.message });
          }
        }
      }
    } catch (error) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chat:streamError', { streamId, error: error.message });
      }
    } finally {
      activeStreams.delete(streamId);
    }
  })();

  return { success: true, streamId };
});

ipcMain.handle('chat:abortStream', (event, { streamId }) => {
  const stream = activeStreams.get(streamId);
  if (stream) {
    stream.aborted = true;
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('chat:listProviders', () => {
  const manager = initChatManager();
  return manager.listProviders();
});

ipcMain.handle('chat:updateProviderConfig', (event, { provider, config }) => {
  const manager = initChatManager();
  manager.updateProviderConfig(provider, config);
  return { success: true };
});

ipcMain.handle('chat:getConfig', () => {
  const manager = initChatManager();
  return manager.getConfig();
});

ipcMain.handle('chat:setDefaultProvider', (event, { provider }) => {
  const manager = initChatManager();
  manager.setDefaultProvider(provider);
  return { success: true };
});

// === Config IPC Handlers ===

ipcMain.handle('config:get', () => {
  return loadConfig();
});

ipcMain.handle('config:set', (event, config) => {
  const success = saveConfig(config);
  if (success) {
    initializeOrchestrator();
    initializeImageManager();
  }
  return { success };
});

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
  initializeImageManager();
  initChatManager();
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
