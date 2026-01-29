/**
 * Terminal IPC Handlers
 * Manages terminal creation, I/O, resizing, and destruction
 */
const { ipcMain } = require('electron');
const os = require('os');
const pty = require('node-pty');

// SECURITY: Validate terminal ID format to prevent injection attacks
function validateTerminalId(id) {
  return id && typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 64;
}

// SECURITY: Validate terminal dimensions to prevent resource exhaustion
function validateTerminalDimensions(cols, rows) {
  const safeCols = Number.isInteger(cols) && cols > 0 && cols <= 500 ? cols : 80;
  const safeRows = Number.isInteger(rows) && rows > 0 && rows <= 200 ? rows : 24;
  return { cols: safeCols, rows: safeRows };
}

function registerTerminalHandlers(dependencies) {
  const { terminals, getMainWindow, getDefaultShell } = dependencies;

  ipcMain.handle('terminal:create', (event, { id, cols, rows }) => {
    if (!validateTerminalId(id)) {
      return { success: false, error: 'Invalid terminal ID format' };
    }
    const { cols: safeCols, rows: safeRows } = validateTerminalDimensions(cols, rows);
    const shell = getDefaultShell();

    try {
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: safeCols,
        rows: safeRows,
        cwd: os.homedir(),
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' }
      });

      terminals.set(id, ptyProcess);

      ptyProcess.onData((data) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('terminal:data', { id, data });
        }
      });

      ptyProcess.onExit(({ exitCode }) => {
        terminals.delete(id);
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('terminal:exit', { id, exitCode });
        }
      });

      return { success: true, id };
    } catch (error) {
      console.error('Failed to create terminal PTY:', error);
      return { success: false, error: error.message || 'Failed to spawn shell process' };
    }
  });

  ipcMain.handle('terminal:write', (event, { id, data }) => {
    if (!validateTerminalId(id)) {
      return { success: false, error: 'Invalid terminal ID format' };
    }
    const term = terminals.get(id);
    if (term) {
      if (typeof data !== 'string') {
        return { success: false, error: 'Invalid data format' };
      }
      term.write(data);
      return { success: true };
    }
    return { success: false, error: 'Terminal not found' };
  });

  ipcMain.handle('terminal:resize', (event, { id, cols, rows }) => {
    if (!validateTerminalId(id)) {
      return { success: false, error: 'Invalid terminal ID format' };
    }
    const term = terminals.get(id);
    if (term) {
      const { cols: safeCols, rows: safeRows } = validateTerminalDimensions(cols, rows);
      term.resize(safeCols, safeRows);
      return { success: true };
    }
    return { success: false, error: 'Terminal not found' };
  });

  ipcMain.handle('terminal:destroy', (event, { id }) => {
    if (!validateTerminalId(id)) {
      return { success: false, error: 'Invalid terminal ID format' };
    }
    const term = terminals.get(id);
    if (term) {
      term.kill();
      terminals.delete(id);
      return { success: true };
    }
    return { success: false, error: 'Terminal not found' };
  });

  ipcMain.handle('terminal:getCwd', (event, { id }) => {
    if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return { success: false, error: 'Invalid terminal ID format' };
    }
    const term = terminals.get(id);
    if (term) {
      try {
        const pid = term.pid;
        if (!Number.isInteger(pid) || pid <= 0) {
          return { success: true, cwd: os.homedir() };
        }
        const { execSync } = require('child_process');
        const cwd = execSync(`lsof -p ${pid} | grep cwd | awk '{print $NF}'`, { encoding: 'utf8' }).trim();
        return { success: true, cwd };
      } catch {
        return { success: true, cwd: os.homedir() };
      }
    }
    return { success: false, error: 'Terminal not found' };
  });
}

module.exports = { registerTerminalHandlers, validateTerminalId, validateTerminalDimensions };
