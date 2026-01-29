/**
 * Donna Desktop - Main Application
 * Wires together all components for a beautiful terminal experience
 */

class DonnaApp {
  constructor() {
    this.sidebar = null;
    this.sessionManager = window.sessionManager;
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('Initializing Donna Desktop...');

    // Initialize sidebar
    this.sidebar = new DonnaSidebar();

    // Initialize session manager with references
    const terminalContainer = document.getElementById('terminal-container');
    this.sessionManager.init(this.sidebar, terminalContainer);

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

    console.log('Donna Desktop initialized successfully!');
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
