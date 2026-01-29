const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { createOrchestrator } = require('./models/orchestrator');
const { createImageManager } = require('./imaging/imageProvider');
const sdInstaller = require('./imaging/sdInstaller');
const { ChatManager } = require('./chat/chatManager');
const { TerminalConfig } = require('./config/terminalConfig');
const agentDefinitions = require('./agents/agentDefinitions');
const { registerAllHandlers } = require('./ipc');

// State
const terminals = new Map();
const activeStreams = new Map();
let mainWindow = null;
let orchestrator = null;
let modelManager = null;
let modelConfig = {};
let imageConfig = {};
let imageManager = null;
let chatManager = null;
let terminalConfig = null;

// Config
const configPath = path.join(os.homedir(), '.donna-desktop', 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      modelConfig = config;
      imageConfig = config.imaging || {};
      return config;
    }
  } catch (e) { console.error('Failed to load config:', e); }
  modelConfig = {};
  imageConfig = {};
  return {};
}

function saveConfig(config) {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    modelConfig = config;
    imageConfig = config.imaging || {};
    return true;
  } catch (e) { console.error('Failed to save config:', e); return false; }
}

function initializeOrchestrator() {
  loadConfig();
  orchestrator = createOrchestrator(modelConfig.models || {});
  modelManager = orchestrator.modelManager;
  return orchestrator;
}

function initializeImageManager() {
  loadConfig();
  imageManager = createImageManager(imageConfig);
  return imageManager;
}

function initChatManager() {
  if (!chatManager) chatManager = new ChatManager();
  return chatManager;
}

function initTerminalConfig() {
  if (!terminalConfig) terminalConfig = new TerminalConfig();
  return terminalConfig;
}

function getDefaultShell() {
  return process.platform === 'darwin' ? (process.env.SHELL || '/bin/zsh') : (process.env.SHELL || '/bin/bash');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 800, minHeight: 600,
    titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'under-window', visualEffectState: 'active', backgroundColor: '#00000000',
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
  });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  if (process.argv.includes('--enable-logging')) mainWindow.webContents.openDevTools();
}

// Register all IPC handlers
registerAllHandlers({
  terminals,
  activeStreams,
  getMainWindow: () => mainWindow,
  getDefaultShell,
  getTerminalConfig: initTerminalConfig,
  getOrchestrator: () => orchestrator,
  getModelManager: () => modelManager,
  getImageManager: () => imageManager,
  getChatManager: initChatManager,
  initializeOrchestrator,
  initializeImageManager,
  loadConfig,
  saveConfig,
  getModelConfig: () => modelConfig,
  setModelConfig: (cfg) => { modelConfig = cfg; },
  sdInstaller,
  agentDefinitions
});

// App lifecycle
app.whenReady().then(() => {
  initializeOrchestrator();
  initializeImageManager();
  initChatManager();
  initTerminalConfig();
  createWindow();
});

app.on('window-all-closed', () => {
  for (const [id, term] of terminals) term.kill();
  terminals.clear();
  for (const [streamId, stream] of activeStreams) stream.aborted = true;
  activeStreams.clear();
  if (orchestrator) { orchestrator.cleanup(); orchestrator = null; }
  modelManager = null;
  chatManager = null;
  imageManager = null;
  terminalConfig = null;
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
