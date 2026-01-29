/**
 * Donna Desktop - Terminal Component
 * Manages xterm.js terminal instances with beautiful Donna styling
 */

class DonnaTerminal {
  constructor(sessionId, container) {
    this.sessionId = sessionId;
    this.container = container;
    this.term = null;
    this.fitAddon = null;
    this.webLinksAddon = null;
    this.unicode11Addon = null;
    this.isReady = false;
    this.cleanupDataListener = null;
    this.cleanupExitListener = null;
    this.onDataDisposable = null;
    this.onResizeDisposable = null;
    this.pathInterval = null;

    // Command history for AI context (V5)
    this.commandHistory = [];
    this.currentLine = '';
    this.maxHistorySize = 100;

    // Auto-scroll tracking (Issue #2 fix)
    this.isUserScrolledUp = false;
    this.scrollDebounce = null;
    this.scrollEventHandler = null;
    this.scrollToBottomBtn = null;
    this.scrollBtnHandler = null;

    // Input detection for visual feedback (Issue #1)
    this.inputDetector = null;
    this.inputRequired = false;

    // Inline suggestion renderer for ghost text (Issue #6)
    this.inlineSuggestion = null;

    // Note: init() must be called explicitly and awaited by the caller
    // to avoid race conditions. Don't auto-call here.
  }

  async init() {
    // Create terminal wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'terminal-wrapper';
    this.wrapper.id = `terminal-${this.sessionId}`;
    this.wrapper.innerHTML = `
      <div class="terminal-header">
        <div class="terminal-header-left">
          <span class="terminal-title">Terminal</span>
        </div>
        <div class="terminal-header-center">
          <span class="terminal-path" id="path-${this.sessionId}">~</span>
        </div>
        <div class="terminal-header-right">
          <button class="terminal-action-btn" title="Split Horizontal">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
              <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
          <button class="terminal-action-btn" title="Clear">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 4h10M4 4V3a1 1 0 011-1h4a1 1 0 011 1v1M5 7v4M9 7v4M3 4l1 8a1 1 0 001 1h4a1 1 0 001-1l1-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="terminal-body" id="body-${this.sessionId}"></div>
    `;
    this.container.appendChild(this.wrapper);

    // Get the terminal body element
    const terminalBody = this.wrapper.querySelector(`#body-${this.sessionId}`);

    // Initialize xterm with Donna theme
    // xterm is loaded via script tags in index.html and exposed as window globals
    if (!window.Terminal || !window.FitAddon || !window.WebLinksAddon || !window.Unicode11Addon) {
      throw new Error('xterm.js or addons not loaded. Ensure script tags are present in index.html');
    }
    const Terminal = window.Terminal;
    const FitAddon = window.FitAddon.FitAddon;
    const WebLinksAddon = window.WebLinksAddon.WebLinksAddon;
    const Unicode11Addon = window.Unicode11Addon.Unicode11Addon;

    this.term = new Terminal({
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
        // Donna dark theme - warm and inviting
        background: '#16161a',
        foreground: '#e4e4e7',
        cursor: '#a78bfa',
        cursorAccent: '#16161a',
        selectionBackground: 'rgba(167, 139, 250, 0.3)',
        selectionForeground: '#ffffff',
        selectionInactiveBackground: 'rgba(167, 139, 250, 0.15)',

        // Standard ANSI colors
        black: '#27272a',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e4e4e7',

        // Bright ANSI colors
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

    // Load addons
    this.fitAddon = new FitAddon();
    this.webLinksAddon = new WebLinksAddon();
    this.unicode11Addon = new Unicode11Addon();

    this.term.loadAddon(this.fitAddon);
    this.term.loadAddon(this.webLinksAddon);
    this.term.loadAddon(this.unicode11Addon);

    // Enable unicode 11
    this.term.unicode.activeVersion = '11';

    // Open terminal in container
    this.term.open(terminalBody);
    this.fitAddon.fit();

    // Auto-scroll tracking: detect when user scrolls up (Issue #2 fix)
    this.setupScrollTracking(terminalBody);

    // Create the PTY process with error handling
    const { cols, rows } = this.term;
    const createResult = await window.donnaTerminal.create(this.sessionId, cols, rows);
    if (!createResult || !createResult.success) {
      // Clean up xterm resources on PTY creation failure
      if (this.fitAddon) {
        this.fitAddon.dispose();
        this.fitAddon = null;
      }
      if (this.webLinksAddon) {
        this.webLinksAddon.dispose();
        this.webLinksAddon = null;
      }
      if (this.unicode11Addon) {
        this.unicode11Addon.dispose();
        this.unicode11Addon = null;
      }
      if (this.term) {
        this.term.dispose();
        this.term = null;
      }
      if (this.wrapper && this.wrapper.parentNode) {
        this.wrapper.parentNode.removeChild(this.wrapper);
      }
      throw new Error(createResult?.error || 'Failed to create PTY process');
    }

    // Initialize input detector for visual feedback (Issue #1)
    if (window.InputDetector) {
      this.inputDetector = new window.InputDetector();
    }

    // Handle data from PTY
    this.cleanupDataListener = window.donnaTerminal.onData(({ id, data }) => {
      if (id === this.sessionId && this.term) {
        this.term.write(data);
        // Auto-scroll to bottom if user hasn't scrolled up (Issue #2 fix)
        this.scrollToBottomIfNeeded();
        // Detect input prompts for visual feedback (Issue #1)
        if (this.inputDetector) {
          this.inputDetector.processData(data, (inputRequired) => {
            this.setInputRequired(inputRequired);
          });
        }
      }
    });

    // Handle PTY exit
    this.cleanupExitListener = window.donnaTerminal.onExit(({ id, exitCode }) => {
      if (id === this.sessionId) {
        this.term.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
        // Notify session manager
        if (window.sessionManager) {
          window.sessionManager.handleSessionExit(id);
        }
      }
    });

    // Handle user input - store disposable for cleanup and track history
    this.onDataDisposable = this.term.onData((data) => {
      // Check for Tab key to accept inline suggestion (Issue #6)
      if (data === '\t' && this.inlineSuggestion?.isShowing()) {
        // Accept the inline suggestion
        const completion = this.inlineSuggestion.getCompletion(this.currentLine);
        if (completion) {
          // Write the completion to PTY
          window.donnaTerminal.write(this.sessionId, completion);
          // Update current line tracker
          this.currentLine += completion;
          // Hide the inline suggestion
          this.inlineSuggestion.hide();
          // Also hide AI suggestions dropdown if visible
          if (this.aiSuggestions) {
            this.aiSuggestions.hide();
          }
          return; // Don't send Tab to PTY
        }
      }

      // Clear input required indicator when user types (Issue #1)
      if (this.inputDetector) {
        this.inputDetector.clearInputRequired((inputRequired) => {
          this.setInputRequired(inputRequired);
        });
      }

      // Track command history for AI suggestions
      if (data === '\r' || data === '\n') {
        // Enter pressed - save command to history
        if (this.currentLine.trim()) {
          this.commandHistory.push(this.currentLine.trim());
          if (this.commandHistory.length > this.maxHistorySize) {
            this.commandHistory.shift();
          }
          // Expose history globally for AI suggestions
          window.terminalHistory = this.commandHistory;
        }
        this.currentLine = '';
        // Hide inline suggestion on Enter (Issue #6)
        if (this.inlineSuggestion) {
          this.inlineSuggestion.hide();
        }
      } else if (data === '\x7f') {
        // Backspace
        this.currentLine = this.currentLine.slice(0, -1);
      } else if (data.charCodeAt(0) >= 32) {
        // Printable characters
        this.currentLine += data;
      }
      window.donnaTerminal.write(this.sessionId, data);
    });

    // Handle resize - store disposable for cleanup
    this.onResizeDisposable = this.term.onResize(({ cols, rows }) => {
      window.donnaTerminal.resize(this.sessionId, cols, rows);
    });

    // Bind clear button - store reference for cleanup
    const clearBtn = this.wrapper.querySelector('.terminal-action-btn[title="Clear"]');
    this.clearBtnHandler = () => this.clear();
    clearBtn?.addEventListener('click', this.clearBtnHandler);

    this.isReady = true;

    // Update path periodically
    this.startPathUpdates();

    // Initialize power features (V5)
    await this.initPowerFeatures();

    // Listen for accepted AI suggestions (Issue #9 fix)
    // When user accepts a suggestion, write the remaining command to terminal
    this.suggestionAcceptedHandler = (e) => {
      const { command, original } = e.detail;
      // Calculate what needs to be written (command minus what's already typed)
      const remainingCommand = original && command.startsWith(original)
        ? command.slice(original.length)
        : command;
      // Write to PTY via IPC
      window.donnaTerminal.write(this.sessionId, remainingCommand);
    };
    window.addEventListener('suggestionAccepted', this.suggestionAcceptedHandler);

    return this;
  }

  /**
   * Update the current working directory display
   */
  async updatePath() {
    try {
      const result = await window.donnaTerminal.getCwd(this.sessionId);
      if (result.success && result.cwd) {
        const pathEl = this.wrapper.querySelector(`#path-${this.sessionId}`);
        if (pathEl) {
          // Shorten home directory (cross-platform)
          let displayPath = result.cwd;
          // Try to detect home directory from path structure
          const homeMatch = result.cwd.match(/^(\/Users\/[^/]+|\/home\/[^/]+|[A-Z]:\\Users\\[^\\]+)/);
          if (homeMatch) {
            const home = homeMatch[1];
            if (displayPath.startsWith(home)) {
              displayPath = '~' + displayPath.slice(home.length);
            }
          }
          pathEl.textContent = displayPath;
          pathEl.title = result.cwd;
        }
      }
    } catch (e) {
      // Silently fail - path display is non-critical
    }
  }

  startPathUpdates() {
    if (this._destroyed) return;
    // Update path every 2 seconds when terminal is active
    this.pathInterval = setInterval(() => {
      if (this.wrapper?.classList.contains('active')) {
        this.updatePath();
      }
    }, 2000);
  }

  /**
   * Setup scroll tracking to detect user scroll-up and show "scroll to bottom" button
   * Issue #2 fix: Auto-scroll bug
   */
  setupScrollTracking(terminalBody) {
    // Find the xterm viewport element (contains the scrollbar)
    const viewport = this.term.element?.querySelector('.xterm-viewport');
    if (!viewport) {
      console.warn('Could not find xterm viewport for scroll tracking');
      return;
    }

    // Create "scroll to bottom" button
    this.scrollToBottomBtn = document.createElement('button');
    this.scrollToBottomBtn.className = 'scroll-to-bottom-btn';
    this.scrollToBottomBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    this.scrollToBottomBtn.title = 'Scroll to bottom';
    terminalBody.appendChild(this.scrollToBottomBtn);

    // Button click handler
    this.scrollBtnHandler = () => {
      this.isUserScrolledUp = false;
      this.term.scrollToBottom();
      this.updateScrollButtonVisibility();
    };
    this.scrollToBottomBtn.addEventListener('click', this.scrollBtnHandler);

    // Scroll event handler to detect if user has scrolled up
    this.scrollEventHandler = () => {
      const isAtBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 10;
      this.isUserScrolledUp = !isAtBottom;
      this.updateScrollButtonVisibility();
    };
    viewport.addEventListener('scroll', this.scrollEventHandler);

    // Store viewport reference for cleanup
    this._viewport = viewport;
  }

  /**
   * Update visibility of the "scroll to bottom" button
   */
  updateScrollButtonVisibility() {
    if (this.scrollToBottomBtn) {
      if (this.isUserScrolledUp) {
        this.scrollToBottomBtn.classList.add('visible');
      } else {
        this.scrollToBottomBtn.classList.remove('visible');
      }
    }
  }

  /**
   * Scroll to bottom if user hasn't manually scrolled up
   * Uses requestAnimationFrame for debouncing
   * Issue #2 fix: Auto-scroll bug
   */
  scrollToBottomIfNeeded() {
    if (this.isUserScrolledUp) return;
    if (this.scrollDebounce) return;

    this.scrollDebounce = requestAnimationFrame(() => {
      if (this.term && !this.isUserScrolledUp) {
        this.term.scrollToBottom();
      }
      this.scrollDebounce = null;
    });
  }

  /**
   * Initialize terminal power features (V5)
   */
  async initPowerFeatures() {
    try {
      const config = await window.donnaTerminal?.getTerminalConfig?.();
      if (!config) return;

      const termBody = this.wrapper.querySelector('.terminal-body');

      // Command Blocks - visual grouping of commands
      if (config.features?.commandBlocks !== false && window.CommandBlockManager) {
        this.commandBlocks = new window.CommandBlockManager(this, config.commandBlocks || {});
        // Attach container to terminal wrapper
        if (termBody && this.commandBlocks.blocksContainer) {
          termBody.style.position = 'relative';
          termBody.appendChild(this.commandBlocks.blocksContainer);
        }
      }

      // Inline Suggestions - ghost text at cursor (Issue #6)
      if (config.features?.aiSuggestions !== false && window.InlineSuggestionRenderer) {
        this.inlineSuggestion = new window.InlineSuggestionRenderer(this, config.inlineSuggestions || {});
        if (termBody) {
          this.inlineSuggestion.attach(termBody);
        }
      }

      // AI Suggestions - intelligent command completion
      if (config.features?.aiSuggestions !== false && window.AISuggestionManager) {
        this.aiSuggestions = new window.AISuggestionManager(this, config.aiSuggestions || {});
        if (termBody) {
          this.aiSuggestions.attach(termBody);
        }
        // Connect inline renderer to AI suggestion manager (Issue #6)
        if (this.inlineSuggestion) {
          this.aiSuggestions.setInlineRenderer(this.inlineSuggestion);
        }
      }
    } catch (error) {
      console.warn('Failed to initialize power features:', error);
    }
  }

  /**
   * Show this terminal
   */
  show() {
    if (!this.wrapper || this._destroyed) return;
    this.wrapper.classList.add('active');
    this.focus();
    this.fit();
    this.updatePath();
    // Resume path updates when shown
    if (!this.pathInterval) {
      this.startPathUpdates();
    }
  }

  /**
   * Hide this terminal
   */
  hide() {
    if (!this.wrapper || this._destroyed) return;
    this.wrapper.classList.remove('active');
    // Pause path updates when hidden to reduce unnecessary IPC calls
    if (this.pathInterval) {
      clearInterval(this.pathInterval);
      this.pathInterval = null;
    }
  }

  /**
   * Focus the terminal
   */
  focus() {
    if (this.term) {
      this.term.focus();
    }
  }

  /**
   * Fit terminal to container
   */
  fit() {
    if (this.fitAddon) {
      this.fitAddon.fit();
    }
  }

  /**
   * Clear terminal
   */
  clear() {
    if (this.term) {
      this.term.clear();
    }
  }

  /**
   * Write to terminal
   */
  write(data) {
    if (this.term) {
      this.term.write(data);
    }
  }

  /**
   * Set input required state and update sidebar indicator (Issue #1)
   * @param {boolean} required - Whether terminal is waiting for input
   */
  setInputRequired(required) {
    if (this.inputRequired === required) return;
    this.inputRequired = required;

    // Update sidebar indicator
    if (window.sessionManager?.sidebar) {
      window.sessionManager.sidebar.setInputRequired(this.sessionId, required);
    }
  }

  /**
   * Destroy terminal and clean up
   */
  async destroy() {
    // Guard against double-cleanup
    if (this._destroyed) return;
    this._destroyed = true;

    // Clear interval
    if (this.pathInterval) {
      clearInterval(this.pathInterval);
      this.pathInterval = null;
    }

    // Remove IPC listeners
    if (this.cleanupDataListener) {
      this.cleanupDataListener();
      this.cleanupDataListener = null;
    }
    if (this.cleanupExitListener) {
      this.cleanupExitListener();
      this.cleanupExitListener = null;
    }

    // Dispose xterm event listeners
    if (this.onDataDisposable) {
      this.onDataDisposable.dispose();
      this.onDataDisposable = null;
    }
    if (this.onResizeDisposable) {
      this.onResizeDisposable.dispose();
      this.onResizeDisposable = null;
    }

    // Remove clear button event listener
    if (this.clearBtnHandler && this.wrapper) {
      const clearBtn = this.wrapper.querySelector('.terminal-action-btn[title="Clear"]');
      clearBtn?.removeEventListener('click', this.clearBtnHandler);
      this.clearBtnHandler = null;
    }

    // Remove suggestion accepted event listener (Issue #9 fix)
    if (this.suggestionAcceptedHandler) {
      window.removeEventListener('suggestionAccepted', this.suggestionAcceptedHandler);
      this.suggestionAcceptedHandler = null;
    }

    // Clean up scroll tracking (Issue #2 fix)
    if (this.scrollDebounce) {
      cancelAnimationFrame(this.scrollDebounce);
      this.scrollDebounce = null;
    }
    if (this._viewport && this.scrollEventHandler) {
      this._viewport.removeEventListener('scroll', this.scrollEventHandler);
      this.scrollEventHandler = null;
      this._viewport = null;
    }
    if (this.scrollToBottomBtn) {
      if (this.scrollBtnHandler) {
        this.scrollToBottomBtn.removeEventListener('click', this.scrollBtnHandler);
        this.scrollBtnHandler = null;
      }
      if (this.scrollToBottomBtn.parentNode) {
        this.scrollToBottomBtn.parentNode.removeChild(this.scrollToBottomBtn);
      }
      this.scrollToBottomBtn = null;
    }

    // Clean up input detector (Issue #1)
    if (this.inputDetector) {
      this.inputDetector.destroy();
      this.inputDetector = null;
    }
    // Clear input required indicator in sidebar
    if (window.sessionManager?.sidebar) {
      window.sessionManager.sidebar.setInputRequired(this.sessionId, false);
    }
    this.inputRequired = false;

    // Clean up power features (V5)
    if (this.commandBlocks) {
      if (typeof this.commandBlocks.destroy === 'function') {
        this.commandBlocks.destroy();
      }
      this.commandBlocks = null;
    }
    // Clean up inline suggestion renderer (Issue #6)
    if (this.inlineSuggestion) {
      if (typeof this.inlineSuggestion.destroy === 'function') {
        this.inlineSuggestion.destroy();
      }
      this.inlineSuggestion = null;
    }
    if (this.aiSuggestions) {
      if (typeof this.aiSuggestions.destroy === 'function') {
        this.aiSuggestions.destroy();
      }
      this.aiSuggestions = null;
    }

    // Clear command history reference
    this.commandHistory = [];
    this.currentLine = '';

    // Kill PTY process
    try {
      await window.donnaTerminal.destroy(this.sessionId);
    } catch (e) {
      console.error('Failed to destroy PTY:', e);
    }

    // Dispose xterm addons before terminal
    if (this.fitAddon) {
      this.fitAddon.dispose();
      this.fitAddon = null;
    }
    if (this.webLinksAddon) {
      this.webLinksAddon.dispose();
      this.webLinksAddon = null;
    }
    if (this.unicode11Addon) {
      this.unicode11Addon.dispose();
      this.unicode11Addon = null;
    }

    // Dispose xterm
    if (this.term) {
      this.term.dispose();
      this.term = null;
    }

    // Remove from DOM
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
    this.wrapper = null;

    this.isReady = false;
  }
}

// Export for use in other modules
window.DonnaTerminal = DonnaTerminal;
