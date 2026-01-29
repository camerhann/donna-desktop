/**
 * Donna Desktop - Session Manager
 * Manages terminal and chat sessions lifecycle
 */

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.activeSessionId = null;
    this.sessionCounter = 0;
    this.sidebar = null;
    this.terminalContainer = null;

    // Stream listeners for chat (V4)
    this.streamListeners = new Map();
    this.setupChatListeners();
  }

  /**
   * Initialize the session manager
   */
  init(sidebar, terminalContainer) {
    this.sidebar = sidebar;
    this.terminalContainer = terminalContainer;
  }

  /**
   * Setup chat stream listeners (V4)
   */
  setupChatListeners() {
    if (!window.donnaChat) return;

    window.donnaChat.onStreamChunk(({ streamId, content }) => {
      const session = this.findSessionByStreamId(streamId);
      if (session?.chat) {
        session.chat.handleStreamChunk(content);
      }
    });

    window.donnaChat.onStreamComplete(({ streamId, message }) => {
      const session = this.findSessionByStreamId(streamId);
      if (session?.chat) {
        session.chat.handleStreamComplete(message);
      }
      this.streamListeners.delete(streamId);
    });

    window.donnaChat.onStreamError(({ streamId, error }) => {
      const session = this.findSessionByStreamId(streamId);
      if (session?.chat) {
        session.chat.handleStreamError(error);
      }
      this.streamListeners.delete(streamId);
    });
  }

  findSessionByStreamId(streamId) {
    const sessionId = this.streamListeners.get(streamId);
    return sessionId ? this.sessions.get(sessionId) : null;
  }

  registerStream(streamId, sessionId) {
    this.streamListeners.set(streamId, sessionId);
  }

  /**
   * Generate a unique session ID
   */
  generateId() {
    return `session-${Date.now()}-${++this.sessionCounter}`;
  }

  /**
   * Create a new terminal session (default)
   */
  async createSession(name = null) {
    return this.createTerminalSession(name);
  }

  /**
   * Create a terminal session
   */
  async createTerminalSession(name = null) {
    const id = this.generateId();
    const sessionName = name || `Terminal ${this.sessionCounter}`;

    // Create session object
    const session = {
      id,
      name: sessionName,
      type: 'terminal',
      path: '~',
      createdAt: new Date(),
      terminal: null,
      chat: null
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
   * Create a chat session (V4)
   */
  async createChatSession(name = null, config = {}) {
    const id = this.generateId();

    // Create chat session on backend
    const result = await window.donnaChat.createSession({
      name: name || `Chat ${this.sessionCounter}`,
      provider: config.provider || 'claude',
      model: config.model,
      systemPrompt: config.systemPrompt
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create chat session');
    }

    const backendSession = result.session;

    // Create local session object
    const session = {
      id,
      backendId: backendSession.id,
      name: backendSession.name,
      type: 'chat',
      provider: backendSession.provider,
      model: backendSession.model,
      createdAt: new Date(),
      terminal: null,
      chat: null
    };

    // Hide welcome screen
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
      welcomeScreen.style.display = 'none';
    }

    this.terminalContainer?.classList.add('has-terminal');

    // Create chat instance
    const chat = new DonnaChat(backendSession.id, this.terminalContainer, {
      provider: backendSession.provider,
      model: backendSession.model
    });
    session.chat = chat;

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

    // Hide current session
    if (this.activeSessionId && this.activeSessionId !== sessionId) {
      const currentSession = this.sessions.get(this.activeSessionId);
      if (currentSession?.terminal) {
        currentSession.terminal.hide();
      }
      if (currentSession?.chat) {
        currentSession.chat.hide();
      }
    }

    // Show new session
    this.activeSessionId = sessionId;

    // Brief delay to ensure DOM is ready
    await new Promise(resolve => setTimeout(resolve, 50));

    // Show terminal or chat based on session type
    if (session.type === 'terminal' && session.terminal) {
      // Wait for terminal to be ready before showing (V5 improvement)
      if (session.terminal.isReady) {
        session.terminal.show();
      } else {
        // Terminal still initializing, wait briefly
        await new Promise(resolve => setTimeout(resolve, 100));
        if (session.terminal.isReady) {
          session.terminal.show();
        }
      }
    } else if (session.type === 'chat' && session.chat) {
      session.chat.show();
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

    // Destroy terminal or chat
    if (session.terminal) {
      await session.terminal.destroy();
    }
    if (session.chat) {
      await session.chat.destroy();
    }

    // Remove from sessions
    this.sessions.delete(sessionId);

    // Remove from sidebar
    this.sidebar?.removeSession(sessionId);

    // If this was the active session, switch to another
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;

      const remainingSessions = Array.from(this.sessions.keys());
      if (remainingSessions.length > 0) {
        await this.switchToSession(remainingSessions[remainingSessions.length - 1]);
      } else {
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
