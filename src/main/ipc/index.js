/**
 * IPC Handlers Index - Aggregates all handlers
 */
const { registerTerminalHandlers } = require('./terminalHandler');
const { registerTerminalConfigHandlers } = require('./terminalConfigHandler');
const { registerAgentHandlers } = require('./agentHandler');
const { registerModelHandlers } = require('./modelHandler');
const { registerOrchestratorHandlers } = require('./orchestratorHandler');
const { registerImagingHandlers } = require('./imagingHandler');
const { registerChatHandlers } = require('./chatHandler');
const { registerConfigHandlers } = require('./configHandler');
const { registerSpeechHandlers } = require('./speechHandler');
const { registerLinkHandlers } = require('./linkHandler');
const { registerFilesHandlers } = require('./filesHandler');
const { registerVoiceHandlers } = require('./voiceHandler');
const { registerVaultHandlers } = require('./vaultHandler');
const { registerContextHandlers } = require('./contextHandler');
const { registerPreviewIpcHandlers } = require('./previewHandler');

function registerAllHandlers(dependencies) {
  registerTerminalHandlers({
    terminals: dependencies.terminals,
    getMainWindow: dependencies.getMainWindow,
    getDefaultShell: dependencies.getDefaultShell
  });

  registerTerminalConfigHandlers({
    getTerminalConfig: dependencies.getTerminalConfig
  });

  registerAgentHandlers({
    terminals: dependencies.terminals,
    getMainWindow: dependencies.getMainWindow,
    agentDefinitions: dependencies.agentDefinitions,
    getModelManager: dependencies.getModelManager,
    initializeOrchestrator: dependencies.initializeOrchestrator
  });

  registerModelHandlers({
    getModelManager: dependencies.getModelManager,
    initializeOrchestrator: dependencies.initializeOrchestrator,
    getMainWindow: dependencies.getMainWindow
  });

  registerOrchestratorHandlers({
    getOrchestrator: dependencies.getOrchestrator,
    initializeOrchestrator: dependencies.initializeOrchestrator,
    getMainWindow: dependencies.getMainWindow
  });

  registerImagingHandlers({
    getImageManager: dependencies.getImageManager,
    initializeImageManager: dependencies.initializeImageManager,
    sdInstaller: dependencies.sdInstaller,
    getMainWindow: dependencies.getMainWindow,
    loadConfig: dependencies.loadConfig,
    saveConfig: dependencies.saveConfig
  });

  registerChatHandlers({
    getChatManager: dependencies.getChatManager,
    activeStreams: dependencies.activeStreams,
    getMainWindow: dependencies.getMainWindow
  });

  registerConfigHandlers({
    loadConfig: dependencies.loadConfig,
    saveConfig: dependencies.saveConfig,
    getModelConfig: dependencies.getModelConfig,
    setModelConfig: dependencies.setModelConfig,
    initializeOrchestrator: dependencies.initializeOrchestrator,
    initializeImageManager: dependencies.initializeImageManager
  });

  // Phase 6: Speech pattern handlers for personal speech learning
  registerSpeechHandlers({
    getMainWindow: dependencies.getMainWindow
  });

  // Phase 2: Link preview handlers
  registerLinkHandlers();

  // Phase 3: File handlers for attachments
  registerFilesHandlers();

  // Phase 5: Voice input handlers
  registerVoiceHandlers({
    getMainWindow: dependencies.getMainWindow
  });

  // Phase 7: Obsidian vault handlers
  registerVaultHandlers({
    getMainWindow: dependencies.getMainWindow
  });

  // Context sidebar handlers (open files, URLs)
  registerContextHandlers();

  // Preview window handlers (Issue #8: Pop-out Preview Viewer)
  registerPreviewIpcHandlers();
}

module.exports = { registerAllHandlers };
