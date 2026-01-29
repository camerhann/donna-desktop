/**
 * Donna Desktop - Main Application
 * Wires together all components for a beautiful terminal experience
 */

class DonnaApp {
  constructor() {
    this.sidebar = null;
    this.sessionManager = window.sessionManager;
    // V4: Model settings and image generator
    this.modelSettings = null;
    this.imageGenerator = null;
    // V5: Power features
    this.commandPalette = null;
    this.workflowManager = null;
    this.terminalSettings = null;
    this.helpPanel = null;
    this.config = null;
    // Agent picker for CLI-based AI sessions
    this.agentPicker = null;
    // Context sidebar for files/links from terminal output
    this.contextSidebar = null;
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

    // Initialize model settings (V4)
    this.modelSettings = new ModelSettings();
    await this.modelSettings.init();

    // Initialize image generator (V4)
    this.imageGenerator = window.imageGenerator;
    if (this.imageGenerator) {
      await this.imageGenerator.init();
    }

    // Initialize session manager with references
    const terminalContainer = document.getElementById('terminal-container');
    this.sessionManager.init(this.sidebar, terminalContainer);

    // Initialize power features (V5)
    await this.initPowerFeatures();

    // Initialize agent picker for CLI-based AI sessions
    this.agentPicker = new AgentPicker();

    // Initialize context sidebar for files/links extraction
    this.initContextSidebar();

    // Bind new chat button to open agent picker
    const newChatBtn = document.getElementById('new-chat-btn');
    newChatBtn?.addEventListener('click', () => {
      this.openAgentPicker();
    });

    // Bind welcome screen buttons
    const startBtn = document.getElementById('start-session-btn');
    startBtn?.addEventListener('click', () => {
      this.sessionManager.createSession();
    });

    const startChatBtn = document.getElementById('start-chat-btn');
    startChatBtn?.addEventListener('click', () => {
      this.openAgentPicker();
    });

    // Bind settings button - opens terminal settings (V5)
    const settingsBtn = document.getElementById('settings-btn');
    settingsBtn?.addEventListener('click', () => {
      this.terminalSettings?.toggle();
    });

    // Bind help button - opens help panel
    const helpBtn = document.getElementById('help-btn');
    helpBtn?.addEventListener('click', () => {
      this.helpPanel?.toggle();
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

    // Listen for palette/workflow events (V5)
    this.setupEventListeners();

    console.log('Donna Desktop initialized successfully!');
  }

  /**
   * Load terminal configuration (V5)
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
   * Initialize terminal power features (V5)
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

    // Help Panel
    this.helpPanel = new HelpPanel();

    // Make available globally for other components
    window.commandPalette = this.commandPalette;
    window.workflowManager = this.workflowManager;
    window.terminalSettings = this.terminalSettings;
    window.helpPanel = this.helpPanel;
  }

  /**
   * Setup event listeners for palette/workflow actions (V5)
   */
  setupEventListeners() {
    // Command from palette
    window.addEventListener('paletteCommand', (e) => {
      const command = e.detail?.command;
      if (!command) return;
      this.executeCommand(command);
    });

    // Action from palette
    window.addEventListener('paletteAction', (e) => {
      const actionId = e.detail?.actionId;
      if (!actionId) return;
      this.handlePaletteAction(actionId);
    });

    // Workflow command execution
    window.addEventListener('workflowCommand', async (e) => {
      const command = e.detail?.command;
      if (!command) return;
      const { onComplete, onError } = e.detail;
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
      const feature = e.detail?.feature;
      const enabled = e.detail?.enabled;
      if (!feature) return;
      switch (feature) {
        case 'commandPalette':
          this.commandPalette?.setEnabled(enabled);
          break;
        case 'aiSuggestions':
          // Propagate to all terminal sessions
          this.sessionManager.getAllSessions().forEach(session => {
            if (session.terminal?.aiSuggestions) {
              session.terminal.aiSuggestions.setEnabled(enabled);
            }
          });
          break;
        case 'commandBlocks':
          // Propagate to all terminal sessions
          this.sessionManager.getAllSessions().forEach(session => {
            if (session.terminal?.commandBlocks) {
              session.terminal.commandBlocks.setEnabled(enabled);
            }
          });
          break;
      }
    });
  }

  /**
   * Execute a command in the active terminal
   * Returns a promise that resolves after command is sent
   */
  executeCommand(command) {
    return new Promise((resolve, reject) => {
      const activeSession = this.sessionManager.getActiveSession();
      if (!activeSession?.terminal) {
        reject(new Error('No active terminal'));
        return;
      }
      // Write command + Enter to terminal
      activeSession.terminal.write(command + '\r');
      // Resolve after brief delay (command sent, not necessarily complete)
      setTimeout(() => resolve(), 100);
    });
  }

  /**
   * Handle palette actions (V5)
   */
  handlePaletteAction(actionId) {
    switch (actionId) {
      case 'new-terminal':
        this.sessionManager.createSession();
        break;
      case 'new-agent':
        this.openAgentPicker();
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
      case 'help':
        this.helpPanel?.toggle();
        break;
    }
  }

  /**
   * Open the agent picker to create a new CLI-based AI session
   */
  openAgentPicker() {
    console.log('[App] openAgentPicker called');
    this.agentPicker?.open(async (agent, workingDir) => {
      console.log('[App] Agent selected:', agent, 'workingDir:', workingDir);
      try {
        if (agent.type === 'arena') {
          // Create duel/arena session
          await this.sessionManager.createDuelSession(workingDir);
        } else {
          // Create regular agent session
          await this.sessionManager.createAgentSession(agent, workingDir);
        }
      } catch (error) {
        console.error('[App] Failed to create session:', error);
      }
    });
  }

  /**
   * Initialize the context sidebar for files/links extraction
   */
  initContextSidebar() {
    if (!window.ContextSidebar) {
      console.warn('ContextSidebar not available');
      return;
    }

    const container = document.getElementById('context-sidebar-container');
    if (!container) {
      console.warn('Context sidebar container not found');
      return;
    }

    this.contextSidebar = new window.ContextSidebar(container);
    this.contextSidebar.show(); // Start visible

    // Hook into PTY data stream to extract files/links
    this.setupContextParsing();

    // Make available globally
    window.contextSidebar = this.contextSidebar;
  }

  /**
   * Setup PTY data parsing for context extraction
   */
  setupContextParsing() {
    if (!this.contextSidebar) return;

    // Listen to PTY data from all terminals
    window.donnaTerminal?.onData?.(({ id, data }) => {
      const session = this.sessionManager.sessions.get(id);
      if (!session) return;

      // Parse and extract files/links
      this.contextSidebar.processPtyData(
        data,
        id,
        session.name || 'Session'
      );
    });

    // Update active session in context sidebar when switching
    const originalSwitch = this.sessionManager.switchToSession.bind(this.sessionManager);
    this.sessionManager.switchToSession = async (sessionId) => {
      await originalSwitch(sessionId);
      this.contextSidebar?.setActiveSession(sessionId);
    };
  }

  /**
   * Setup global keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const isMac = window.platform?.isMac;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+T: New terminal session
      if (cmdOrCtrl && e.key === 't') {
        e.preventDefault();
        this.sessionManager.createTerminalSession();
        return;
      }

      // Cmd+N: Open agent picker to create new AI session
      if (cmdOrCtrl && e.key === 'n') {
        e.preventDefault();
        this.openAgentPicker();
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

      // Cmd+.: Toggle context sidebar
      if (cmdOrCtrl && e.key === '.') {
        e.preventDefault();
        this.contextSidebar?.toggle();
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

      // Cmd+,: Open model settings (V4)
      if (cmdOrCtrl && e.key === ',') {
        e.preventDefault();
        this.modelSettings?.open();
        return;
      }

      // Cmd+G: Open image generator (V4)
      if (cmdOrCtrl && e.key === 'g') {
        e.preventDefault();
        if (this.imageGenerator) {
          this.imageGenerator.open();
        }
        return;
      }
    });
  }

  /**
   * Switch to next session
   */
  switchToNextSession() {
    const sessions = this.sessionManager?.getAllSessions();
    if (!sessions || sessions.length <= 1) return;

    const currentIndex = sessions.findIndex(s => s.id === this.sessionManager.activeSessionId);
    const nextIndex = (currentIndex + 1) % sessions.length;
    this.sessionManager.switchToSession(sessions[nextIndex].id);
  }

  /**
   * Switch to previous session
   */
  switchToPreviousSession() {
    const sessions = this.sessionManager?.getAllSessions();
    if (!sessions || sessions.length <= 1) return;

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
