/**
 * Donna Desktop - Session Manager
 * Manages terminal sessions lifecycle
 */

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.activeSessionId = null;
    this.sessionCounter = 0;
    this.sidebar = null;
    this.terminalContainer = null;
  }

  /**
   * Initialize the session manager
   */
  init(sidebar, terminalContainer) {
    this.sidebar = sidebar;
    this.terminalContainer = terminalContainer;
  }

  /**
   * Generate a unique session ID
   */
  generateId() {
    return `session-${Date.now()}-${++this.sessionCounter}`;
  }

  /**
   * Create a new terminal session
   */
  async createSession(name = null) {
    const id = this.generateId();
    const sessionName = name || `Session ${this.sessionCounter}`;

    // Create session object
    const session = {
      id,
      name: sessionName,
      path: '~',
      createdAt: new Date(),
      terminal: null
    };

    // Hide welcome screen
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
      welcomeScreen.style.display = 'none';
    }

    // Mark container as having terminal
    this.terminalContainer?.classList.add('has-terminal');

    // Create terminal instance and await initialization
    try {
      const terminal = new DonnaTerminal(id, this.terminalContainer);
      await terminal.init();
      session.terminal = terminal;
    } catch (error) {
      console.error('Failed to initialize terminal:', error);
      // Show welcome screen again on failure
      const welcomeScreen = document.getElementById('welcome-screen');
      if (welcomeScreen) {
        welcomeScreen.style.display = 'flex';
      }
      this.terminalContainer?.classList.remove('has-terminal');
      return null;
    }

    // Store session
    this.sessions.set(id, session);

    // Add to sidebar
    this.sidebar?.addSession(session);

    // Switch to this session
    await this.switchToSession(id);

    return session;
  }

  /**
   * Switch to a specific session
   */
  async switchToSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Hide current session's terminal
    if (this.activeSessionId && this.activeSessionId !== sessionId) {
      const currentSession = this.sessions.get(this.activeSessionId);
      if (currentSession?.terminal) {
        currentSession.terminal.hide();
      }
    }

    // Show new session's terminal
    this.activeSessionId = sessionId;

    // Wait for terminal to be ready before showing
    if (session.terminal && session.terminal.isReady) {
      session.terminal.show();
    } else if (session.terminal) {
      // Terminal still initializing, wait briefly
      await new Promise(resolve => setTimeout(resolve, 100));
      if (session.terminal.isReady) {
        session.terminal.show();
      }
    }

    // Update sidebar
    this.sidebar?.setActiveSession(sessionId);
  }

  /**
   * Close a session
   */
  async closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Destroy terminal
    if (session.terminal) {
      await session.terminal.destroy();
    }

    // Remove from sessions
    this.sessions.delete(sessionId);

    // Remove from sidebar
    this.sidebar?.removeSession(sessionId);

    // If this was the active session, switch to another
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;

      // Switch to the most recent session
      const remainingSessions = Array.from(this.sessions.keys());
      if (remainingSessions.length > 0) {
        await this.switchToSession(remainingSessions[remainingSessions.length - 1]);
      } else {
        // No sessions left - show welcome screen
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) {
          welcomeScreen.style.display = 'flex';
        }
        this.terminalContainer?.classList.remove('has-terminal');
      }
    }
  }

  /**
   * Handle when a session's terminal exits
   */
  handleSessionExit(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Update sidebar to show inactive state
      this.sidebar?.updateSession(sessionId, { status: false });
    }
  }

  /**
   * Rename a session
   */
  renameSession(sessionId, newName) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.name = newName;
      this.sidebar?.updateSession(sessionId, { name: newName });
    }
  }

  /**
   * Get the active session
   */
  getActiveSession() {
    return this.activeSessionId ? this.sessions.get(this.activeSessionId) : null;
  }

  /**
   * Get all sessions
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * Handle window resize - fit all terminals
   */
  handleResize() {
    for (const session of this.sessions.values()) {
      if (session.terminal) {
        session.terminal.fit();
      }
    }
  }

  /**
   * Close all sessions
   */
  async closeAllSessions() {
    const sessionIds = Array.from(this.sessions.keys());
    for (const id of sessionIds) {
      await this.closeSession(id);
    }
  }
}

// Create global instance
window.sessionManager = new SessionManager();
