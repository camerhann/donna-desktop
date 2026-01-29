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
   * Find a session by its backend ID (V4)
   */
  findSessionByBackendId(backendId) {
    for (const session of this.sessions.values()) {
      if (session.backendId === backendId) {
        return session;
      }
    }
    return null;
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
   * Create an agent session (V5) - spawns CLI with personality
   * This is the PRIMARY way to create AI sessions (uses installed CLIs, not API)
   */
  async createAgentSession(agent) {
    const id = this.generateId();
    const sessionName = agent.name || `Agent ${this.sessionCounter}`;

    // Create session object
    const session = {
      id,
      name: sessionName,
      type: 'agent',
      agentId: agent.id,
      agentInfo: agent,
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

    // Create terminal instance with agent spawning
    try {
      const terminal = new DonnaTerminal(id, this.terminalContainer);

      // Override init to use agent CLI instead of default shell
      const originalInit = terminal.init.bind(terminal);
      terminal.init = async () => {
        // Create terminal wrapper (same as original)
        terminal.wrapper = document.createElement('div');
        terminal.wrapper.className = 'terminal-wrapper';
        terminal.wrapper.id = `terminal-${terminal.sessionId}`;
        terminal.wrapper.innerHTML = `
          <div class="terminal-header">
            <div class="terminal-header-left">
              <span class="terminal-agent-badge" style="background: ${agent.color}20; color: ${agent.color}">
                <span class="agent-icon">${agent.icon}</span>
                <span class="agent-name">${agent.name}</span>
              </span>
            </div>
            <div class="terminal-header-center">
              <span class="terminal-path" id="path-${terminal.sessionId}">~</span>
            </div>
            <div class="terminal-header-right">
              <button class="terminal-action-btn" title="Clear">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 4h10M4 4V3a1 1 0 011-1h4a1 1 0 011 1v1M5 7v4M9 7v4M3 4l1 8a1 1 0 001 1h4a1 1 0 001-1l1-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="terminal-body" id="body-${terminal.sessionId}"></div>
        `;
        terminal.container.appendChild(terminal.wrapper);

        const terminalBody = terminal.wrapper.querySelector(`#body-${terminal.sessionId}`);

        // Initialize xterm
        const Terminal = window.Terminal;
        const FitAddon = window.FitAddon.FitAddon;
        const WebLinksAddon = window.WebLinksAddon.WebLinksAddon;
        const Unicode11Addon = window.Unicode11Addon.Unicode11Addon;

        terminal.term = new Terminal({
          cursorBlink: true,
          cursorStyle: 'bar',
          cursorWidth: 2,
          fontFamily: '"SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
          fontSize: 13,
          fontWeight: '400',
          fontWeightBold: '600',
          letterSpacing: 0,
          lineHeight: 1.4,
          scrollback: 10000,
          smoothScrollDuration: 100,
          allowProposedApi: true,
          theme: {
            background: '#16161a',
            foreground: '#e4e4e7',
            cursor: agent.color || '#a78bfa',
            cursorAccent: '#16161a',
            selectionBackground: `${agent.color || '#a78bfa'}4d`,
            selectionForeground: '#ffffff',
            selectionInactiveBackground: `${agent.color || '#a78bfa'}26`,
            black: '#27272a',
            red: '#f87171',
            green: '#4ade80',
            yellow: '#fbbf24',
            blue: '#60a5fa',
            magenta: '#c084fc',
            cyan: '#22d3ee',
            white: '#e4e4e7',
            brightBlack: '#52525b',
            brightRed: '#fca5a5',
            brightGreen: '#86efac',
            brightYellow: '#fcd34d',
            brightBlue: '#93c5fd',
            brightMagenta: '#d8b4fe',
            brightCyan: '#67e8f9',
            brightWhite: '#fafafa'
          }
        });

        terminal.fitAddon = new FitAddon();
        terminal.webLinksAddon = new WebLinksAddon();
        terminal.unicode11Addon = new Unicode11Addon();

        terminal.term.loadAddon(terminal.fitAddon);
        terminal.term.loadAddon(terminal.webLinksAddon);
        terminal.term.loadAddon(terminal.unicode11Addon);
        terminal.term.unicode.activeVersion = '11';

        terminal.term.open(terminalBody);
        terminal.fitAddon.fit();

        // Create the PTY process using agents API (spawns CLI with personality)
        const { cols, rows } = terminal.term;
        const result = await window.donnaAgents.createSession(terminal.sessionId, agent.id, cols, rows);

        if (!result.success) {
          throw new Error('Failed to create agent session');
        }

        // Handle data from PTY
        terminal.cleanupDataListener = window.donnaTerminal.onData(({ id, data }) => {
          if (id === terminal.sessionId && terminal.term) {
            terminal.term.write(data);
          }
        });

        // Handle PTY exit
        terminal.cleanupExitListener = window.donnaTerminal.onExit(({ id, exitCode }) => {
          if (id === terminal.sessionId) {
            terminal.term.write(`\r\n\x1b[90m[${agent.name} exited with code ${exitCode}]\x1b[0m\r\n`);
            if (window.sessionManager) {
              window.sessionManager.handleSessionExit(id);
            }
          }
        });

        // Handle user input
        terminal.onDataDisposable = terminal.term.onData((data) => {
          window.donnaTerminal.write(terminal.sessionId, data);
        });

        // Handle resize
        terminal.onResizeDisposable = terminal.term.onResize(({ cols, rows }) => {
          window.donnaTerminal.resize(terminal.sessionId, cols, rows);
        });

        // Bind clear button
        const clearBtn = terminal.wrapper.querySelector('.terminal-action-btn[title="Clear"]');
        clearBtn?.addEventListener('click', () => terminal.clear());

        terminal.isReady = true;
        terminal.startPathUpdates();

        return terminal;
      };

      await terminal.init();
      session.terminal = terminal;
    } catch (error) {
      console.error('Failed to initialize agent terminal:', error);
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
   * Create a chat session (V4) - uses API-based providers
   * NOTE: For CLI-based AI, use createAgentSession instead
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
