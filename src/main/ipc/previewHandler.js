/**
 * Preview IPC Handler
 * Registers handlers for preview window operations
 * Issue #8: Pop-out Preview Viewer
 */

const { registerPreviewHandlers } = require('../preview/previewWindow');

function registerPreviewIpcHandlers() {
  // Register all preview-related IPC handlers
  registerPreviewHandlers();
}

module.exports = { registerPreviewIpcHandlers };
