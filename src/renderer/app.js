/**
 * Donna Desktop - Main Application
 * Wires together all components for a beautiful terminal experience
 */

class DonnaApp {
  constructor() {
    this.sidebar = null;
    this.sessionManager = window.sessionManager;
    this.commandPalette = null;
    this.workflowManager = null;
    this.terminalSettings = null;
    this.config = null;
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('Initializing Donna Desktop...');

    // Load terminal configuration
    await this.loadConfig();

    // Initialize sidebar
    this.sidebar = new DonnaSidebar();

    // Initialize session manager with references
    const terminalContainer = document.getElementById('terminal-container');
    this.sessionManager.init(this.sidebar, terminalContainer);

    // Initialize power features
    await this.initPowerFeatures();

    // Bind welcome screen button
    const startBtn = document.getElementById('start-session-btn');
    startBtn?.addEventListener('click', () => {
      this.sessionManager.createSession();
    });

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.sessionManager.handleResize();
      }, 100);
    });

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Focus management
    this.setupFocusManagement();

    // Listen for palette/workflow events
    this.setupEventListeners();

    console.log('Donna Desktop initialized successfully!');
  }

  /**
   * Load terminal configuration
   */
  async loadConfig() {
    try {
      this.config = await window.donnaTerminal?.getTerminalConfig?.();
    } catch (error) {
      console.error('Failed to load config:', error);
      this.config = {
        features: { commandBlocks: true, aiSuggestions: true, commandPalette: true },
        workflows: { builtIn: [], custom: [] }
      };
    }
  }

  /**
   * Initialize terminal power features
   */
  async initPowerFeatures() {
    // Command Palette (configurable)
    if (this.config?.features?.commandPalette !== false) {
      this.commandPalette = new CommandPalette({
        enabled: this.config.features.commandPalette,
        ...this.config.commandPalette
      });

      // Load workflows into palette
      const workflows = await window.donnaTerminal?.getWorkflows?.() || [];
      this.commandPalette.setWorkflows(workflows);
    }

    // Workflow Manager (always on)
    this.workflowManager = new WorkflowManager({
      workflows: await window.donnaTerminal?.getWorkflows?.() || []
    });

    // Terminal Settings
    this.terminalSettings = new TerminalSettings();

    // Make available globally for other components
    window.commandPalette = this.commandPalette;
    window.workflowManager = this.workflowManager;
    window.terminalSettings = this.terminalSettings;
  }

  /**
   * Setup event listeners for palette/workflow actions
   */
  setupEventListeners() {
    // Command from palette
    window.addEventListener('paletteCommand', (e) => {
      const { command } = e.detail;
      this.executeCommand(command);
    });

    // Action from palette
    window.addEventListener('paletteAction', (e) => {
      const { actionId } = e.detail;
      this.handlePaletteAction(actionId);
    });

    // Workflow command execution
    window.addEventListener('workflowCommand', async (e) => {
      const { command, onComplete, onError } = e.detail;
      try {
        await this.executeCommand(command);
        onComplete?.();
      } catch (error) {
        onError?.(error);
      }
    });

    // Workflow CRUD events
    window.addEventListener('workflowCreate', async (e) => {
      const workflow = await window.donnaTerminal?.addWorkflow?.(e.detail);
      if (workflow) {
        const workflows = await window.donnaTerminal?.getWorkflows?.();
        this.commandPalette?.setWorkflows(workflows);
        this.workflowManager?.setWorkflows(workflows);
      }
    });

    window.addEventListener('workflowUpdate', async (e) => {
      const { id, ...updates } = e.detail;
      await window.donnaTerminal?.updateWorkflow?.(id, updates);
      const workflows = await window.donnaTerminal?.getWorkflows?.();
      this.commandPalette?.setWorkflows(workflows);
      this.workflowManager?.setWorkflows(workflows);
    });

    // Feature toggle events
    window.addEventListener('featureToggled', (e) => {
      const { feature, enabled } = e.detail;
      if (feature === 'commandPalette') {
        this.commandPalette?.setEnabled(enabled);
      }
    });
  }

  /**
   * Execute a command in the active terminal
   */
  executeCommand(command) {
    const activeSession = this.sessionManager.getActiveSession();
    if (activeSession?.terminal) {
      // Write command + Enter to terminal
      activeSession.terminal.write(command + '\r');
    }
  }

  /**
   * Handle palette actions
   */
  handlePaletteAction(actionId) {
    switch (actionId) {
      case 'new-terminal':
        this.sessionManager.createSession();
        break;
      case 'clear-terminal':
        const activeSession = this.sessionManager.getActiveSession();
        if (activeSession?.terminal) {
          activeSession.terminal.clear();
        }
        break;
      case 'settings':
        this.terminalSettings?.toggle();
        break;
    }
  }

  /**
   * Setup global keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const isMac = window.platform?.isMac;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+T: New session
      if (cmdOrCtrl && e.key === 't') {
        e.preventDefault();
        this.sessionManager.createSession();
        return;
      }

      // Cmd+W: Close current session
      if (cmdOrCtrl && e.key === 'w') {
        e.preventDefault();
        const activeSession = this.sessionManager.getActiveSession();
        if (activeSession) {
          this.sessionManager.closeSession(activeSession.id);
        }
        return;
      }

      // Cmd+]: Next session
      if (cmdOrCtrl && e.key === ']') {
        e.preventDefault();
        this.switchToNextSession();
        return;
      }

      // Cmd+[: Previous session
      if (cmdOrCtrl && e.key === '[') {
        e.preventDefault();
        this.switchToPreviousSession();
        return;
      }

      // Cmd+1-9: Switch to session by number
      if (cmdOrCtrl && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const sessions = this.sessionManager.getAllSessions();
        if (sessions[index]) {
          this.sessionManager.switchToSession(sessions[index].id);
        }
        return;
      }

      // Cmd+K: Clear terminal
      if (cmdOrCtrl && e.key === 'k') {
        e.preventDefault();
        const activeSession = this.sessionManager.getActiveSession();
        if (activeSession?.terminal) {
          activeSession.terminal.clear();
        }
        return;
      }
    });
  }

  /**
   * Switch to next session
   */
  switchToNextSession() {
    const sessions = this.sessionManager.getAllSessions();
    if (sessions.length <= 1) return;

    const currentIndex = sessions.findIndex(s => s.id === this.sessionManager.activeSessionId);
    const nextIndex = (currentIndex + 1) % sessions.length;
    this.sessionManager.switchToSession(sessions[nextIndex].id);
  }

  /**
   * Switch to previous session
   */
  switchToPreviousSession() {
    const sessions = this.sessionManager.getAllSessions();
    if (sessions.length <= 1) return;

    const currentIndex = sessions.findIndex(s => s.id === this.sessionManager.activeSessionId);
    const prevIndex = (currentIndex - 1 + sessions.length) % sessions.length;
    this.sessionManager.switchToSession(sessions[prevIndex].id);
  }

  /**
   * Setup focus management
   */
  setupFocusManagement() {
    // Click on terminal container focuses active terminal
    const terminalContainer = document.getElementById('terminal-container');
    terminalContainer?.addEventListener('click', (e) => {
      // Only if clicking on the container itself, not child elements
      const activeSession = this.sessionManager.getActiveSession();
      if (activeSession?.terminal) {
        activeSession.terminal.focus();
      }
    });

    // Focus terminal when window gains focus
    window.addEventListener('focus', () => {
      const activeSession = this.sessionManager.getActiveSession();
      if (activeSession?.terminal) {
        activeSession.terminal.focus();
      }
    });
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new DonnaApp();
  app.init();
});
