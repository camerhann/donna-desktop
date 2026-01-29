/**
 * Preview Window Manager
 * Creates and manages floating BrowserWindows for file previews
 * Issue #8: Pop-out Preview Viewer
 */

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Track active preview windows
const previewWindows = new Map();

/**
 * Create a floating preview window
 * @param {Object} options - Window configuration
 * @param {string} options.filePath - Path to the file to preview
 * @param {string} options.title - Window title
 * @param {number} options.width - Window width (default: 800)
 * @param {number} options.height - Window height (default: 600)
 * @param {Object} options.position - { x, y } position (optional)
 * @returns {BrowserWindow} The created window
 */
function createPreviewWindow(options = {}) {
  const {
    filePath,
    title = 'Preview',
    width = 800,
    height = 600,
    position = null
  } = options;

  // Generate a unique ID for this preview
  const windowId = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Window configuration
  const windowConfig = {
    width,
    height,
    minWidth: 400,
    minHeight: 300,
    title,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'previewPreload.js')
    }
  };

  // Apply position if provided
  if (position && typeof position.x === 'number' && typeof position.y === 'number') {
    windowConfig.x = position.x;
    windowConfig.y = position.y;
  }

  // Create the window
  const previewWindow = new BrowserWindow(windowConfig);

  // Load the preview HTML
  previewWindow.loadFile(path.join(__dirname, '../../renderer/preview/preview.html'));

  // Store window reference
  previewWindows.set(windowId, {
    window: previewWindow,
    filePath,
    title
  });

  // Send file content once the window is ready
  previewWindow.webContents.on('did-finish-load', async () => {
    if (filePath) {
      await sendFileToPreview(windowId, filePath);
    }
  });

  // Cleanup on close
  previewWindow.on('closed', () => {
    previewWindows.delete(windowId);
  });

  return { windowId, window: previewWindow };
}

/**
 * Send file content to a preview window
 * @param {string} windowId - The preview window ID
 * @param {string} filePath - Path to the file
 */
async function sendFileToPreview(windowId, filePath) {
  const entry = previewWindows.get(windowId);
  if (!entry) return;

  try {
    // Resolve path
    let resolvedPath = filePath;
    if (!path.isAbsolute(filePath)) {
      resolvedPath = path.join(process.env.HOME || '', filePath);
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      entry.window.webContents.send('preview:error', {
        error: `File not found: ${resolvedPath}`
      });
      return;
    }

    const stats = fs.statSync(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const fileName = path.basename(resolvedPath);

    // Determine file type
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    const codeExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.go', '.rs', '.java',
                      '.c', '.cpp', '.h', '.hpp', '.cs', '.swift', '.kt', '.scala',
                      '.php', '.sh', '.bash', '.zsh', '.fish', '.ps1',
                      '.css', '.scss', '.less', '.sass', '.html', '.xml', '.vue', '.svelte',
                      '.sql', '.graphql', '.gql', '.prisma'];
    const markdownExts = ['.md', '.markdown', '.mdx'];
    const dataExts = ['.json', '.yaml', '.yml', '.toml', '.ini', '.env', '.conf', '.cfg'];

    let fileType = 'text';
    let language = null;

    if (imageExts.includes(ext)) {
      fileType = 'image';
    } else if (markdownExts.includes(ext)) {
      fileType = 'markdown';
    } else if (codeExts.includes(ext) || dataExts.includes(ext)) {
      fileType = 'code';
      language = getLanguageForExtension(ext);
    }

    // Read content based on type
    let content = null;

    if (fileType === 'image') {
      // For images, send base64 data
      const buffer = fs.readFileSync(resolvedPath);
      const mimeType = getMimeType(ext);
      content = `data:${mimeType};base64,${buffer.toString('base64')}`;
    } else {
      // For text-based files, read as UTF-8
      const maxSize = 5 * 1024 * 1024; // 5MB limit for text
      if (stats.size > maxSize) {
        entry.window.webContents.send('preview:error', {
          error: `File too large to preview (${(stats.size / 1024 / 1024).toFixed(1)}MB)`
        });
        return;
      }
      content = fs.readFileSync(resolvedPath, 'utf-8');
    }

    // Update window title
    entry.window.setTitle(`${fileName} - Preview`);
    entry.filePath = resolvedPath;

    // Send content to renderer
    entry.window.webContents.send('preview:content', {
      filePath: resolvedPath,
      fileName,
      fileType,
      language,
      content,
      size: stats.size,
      modified: stats.mtime
    });

  } catch (error) {
    console.error('Failed to send file to preview:', error);
    entry.window.webContents.send('preview:error', {
      error: error.message
    });
  }
}

/**
 * Get the highlight.js language identifier for a file extension
 */
function getLanguageForExtension(ext) {
  const languageMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.php': 'php',
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'bash',
    '.fish': 'bash',
    '.ps1': 'powershell',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.sass': 'scss',
    '.html': 'html',
    '.xml': 'xml',
    '.vue': 'html',
    '.svelte': 'html',
    '.sql': 'sql',
    '.graphql': 'graphql',
    '.gql': 'graphql',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'ini',
    '.ini': 'ini',
    '.env': 'bash',
    '.conf': 'bash',
    '.cfg': 'ini',
    '.md': 'markdown',
    '.markdown': 'markdown',
    '.prisma': 'graphql'
  };
  return languageMap[ext] || 'plaintext';
}

/**
 * Get MIME type for image extensions
 */
function getMimeType(ext) {
  const mimeMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon'
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * Close a preview window
 * @param {string} windowId - The window ID to close
 */
function closePreviewWindow(windowId) {
  const entry = previewWindows.get(windowId);
  if (entry && !entry.window.isDestroyed()) {
    entry.window.close();
  }
  previewWindows.delete(windowId);
}

/**
 * Close all preview windows
 */
function closeAllPreviewWindows() {
  for (const [windowId, entry] of previewWindows) {
    if (!entry.window.isDestroyed()) {
      entry.window.close();
    }
  }
  previewWindows.clear();
}

/**
 * Get the number of open preview windows
 */
function getPreviewWindowCount() {
  return previewWindows.size;
}

/**
 * Focus a preview window by file path (if it exists)
 * @param {string} filePath - The file path to find
 * @returns {boolean} Whether a window was found and focused
 */
function focusPreviewByPath(filePath) {
  for (const [windowId, entry] of previewWindows) {
    if (entry.filePath === filePath && !entry.window.isDestroyed()) {
      entry.window.focus();
      return true;
    }
  }
  return false;
}

/**
 * Register IPC handlers for preview windows
 */
function registerPreviewHandlers() {
  // Create a new preview window
  ipcMain.handle('preview:create', async (event, options) => {
    try {
      const { windowId } = createPreviewWindow(options);
      return { success: true, windowId };
    } catch (error) {
      console.error('Failed to create preview window:', error);
      return { success: false, error: error.message };
    }
  });

  // Open or focus a preview for a file
  ipcMain.handle('preview:open', async (event, filePath) => {
    try {
      // First check if we already have a preview for this file
      if (focusPreviewByPath(filePath)) {
        return { success: true, reused: true };
      }

      // Create new preview window
      const { windowId } = createPreviewWindow({
        filePath,
        title: path.basename(filePath)
      });

      return { success: true, windowId, reused: false };
    } catch (error) {
      console.error('Failed to open preview:', error);
      return { success: false, error: error.message };
    }
  });

  // Close a preview window
  ipcMain.handle('preview:close', async (event, windowId) => {
    try {
      closePreviewWindow(windowId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Close all preview windows
  ipcMain.handle('preview:closeAll', async () => {
    try {
      closeAllPreviewWindows();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get preview window count
  ipcMain.handle('preview:count', async () => {
    return getPreviewWindowCount();
  });
}

module.exports = {
  createPreviewWindow,
  closePreviewWindow,
  closeAllPreviewWindows,
  focusPreviewByPath,
  getPreviewWindowCount,
  registerPreviewHandlers
};
