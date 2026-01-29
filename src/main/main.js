const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const pty = require('node-pty');
const { TerminalConfig } = require('./config/terminalConfig');

// Store terminal sessions
const terminals = new Map();
let mainWindow = null;

// Terminal configuration
let terminalConfig = null;

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

// === Terminal Config IPC Handlers ===

// Initialize terminal config
function initTerminalConfig() {
  if (!terminalConfig) {
    terminalConfig = new TerminalConfig();
  }
  return terminalConfig;
}

// Get terminal configuration
ipcMain.handle('terminal:getConfig', () => {
  const config = initTerminalConfig();
  return config.getConfig();
});

// Check if feature is enabled
ipcMain.handle('terminal:isFeatureEnabled', (event, { feature }) => {
  const config = initTerminalConfig();
  return config.isFeatureEnabled(feature);
});

// Set feature enabled/disabled
ipcMain.handle('terminal:setFeatureEnabled', (event, { feature, enabled }) => {
  const config = initTerminalConfig();
  return config.setFeatureEnabled(feature, enabled);
});

// Update feature settings
ipcMain.handle('terminal:updateFeatureSettings', (event, { feature, settings }) => {
  const config = initTerminalConfig();
  return config.updateFeatureSettings(feature, settings);
});

// Get all workflows
ipcMain.handle('terminal:getWorkflows', () => {
  const config = initTerminalConfig();
  return config.getWorkflows();
});

// Add custom workflow
ipcMain.handle('terminal:addWorkflow', (event, { workflow }) => {
  const config = initTerminalConfig();
  return config.addWorkflow(workflow);
});

// Update custom workflow
ipcMain.handle('terminal:updateWorkflow', (event, { id, updates }) => {
  const config = initTerminalConfig();
  return config.updateWorkflow(id, updates);
});

// Delete custom workflow
ipcMain.handle('terminal:deleteWorkflow', (event, { id }) => {
  const config = initTerminalConfig();
  return config.deleteWorkflow(id);
});

// === App Lifecycle ===

app.whenReady().then(() => {
  initTerminalConfig();
  createWindow();
});

app.on('window-all-closed', () => {
  // Clean up all terminals
  for (const [id, term] of terminals) {
    term.kill();
  }
  terminals.clear();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
