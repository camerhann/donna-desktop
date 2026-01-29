const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const pty = require('node-pty');
const { ChatManager } = require('./chat/chatManager');

// Store terminal sessions
const terminals = new Map();
let mainWindow = null;

// Chat manager
let chatManager = null;

// Active streams for chat
const activeStreams = new Map();

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

// === Chat IPC Handlers ===

// Initialize chat manager
function initChatManager() {
  if (!chatManager) {
    chatManager = new ChatManager();
  }
  return chatManager;
}

// Create chat session
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

// Get chat session
ipcMain.handle('chat:getSession', (event, { sessionId }) => {
  const manager = initChatManager();
  const session = manager.getSession(sessionId);
  if (session) {
    return { success: true, session: session.toJSON() };
  }
  return { success: false, error: 'Session not found' };
});

// List chat sessions
ipcMain.handle('chat:listSessions', () => {
  const manager = initChatManager();
  return manager.listSessions();
});

// Delete chat session
ipcMain.handle('chat:deleteSession', (event, { sessionId }) => {
  const manager = initChatManager();
  const success = manager.deleteSession(sessionId);
  return { success };
});

// Rename chat session
ipcMain.handle('chat:renameSession', (event, { sessionId, name }) => {
  const manager = initChatManager();
  const success = manager.renameSession(sessionId, name);
  return { success };
});

// Update chat session
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

// Send message (non-streaming)
ipcMain.handle('chat:sendMessage', async (event, { sessionId, content }) => {
  const manager = initChatManager();
  try {
    const result = await manager.sendMessage(sessionId, content);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stream message
ipcMain.handle('chat:streamMessage', async (event, { sessionId, content, streamId }) => {
  const manager = initChatManager();

  // Store stream info
  activeStreams.set(streamId, { sessionId, aborted: false });

  // Start streaming in background
  (async () => {
    try {
      for await (const chunk of manager.streamMessage(sessionId, content)) {
        // Check if aborted
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

// Abort stream
ipcMain.handle('chat:abortStream', (event, { streamId }) => {
  const stream = activeStreams.get(streamId);
  if (stream) {
    stream.aborted = true;
    return { success: true };
  }
  return { success: false };
});

// List providers
ipcMain.handle('chat:listProviders', () => {
  const manager = initChatManager();
  return manager.listProviders();
});

// Update provider config
ipcMain.handle('chat:updateProviderConfig', (event, { provider, config }) => {
  const manager = initChatManager();
  manager.updateProviderConfig(provider, config);
  return { success: true };
});

// Get config
ipcMain.handle('chat:getConfig', () => {
  const manager = initChatManager();
  return manager.getConfig();
});

// Set default provider
ipcMain.handle('chat:setDefaultProvider', (event, { provider }) => {
  const manager = initChatManager();
  manager.setDefaultProvider(provider);
  return { success: true };
});

// === App Lifecycle ===

app.whenReady().then(() => {
  initChatManager();
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
