/**
 * Donna Desktop - Duel View Component
 * Split-screen view for running Claude and Gemini in parallel
 * "Agent Arena" - compete two AI agents on the same task
 */

class DuelView {
  constructor(sessionId, container, options = {}) {
    this.sessionId = sessionId;
    this.container = container;
    this.options = options;

    // Terminal instances for each agent
    this.claudeTerminal = null;
    this.geminiTerminal = null;

    // Session IDs for PTY processes
    this.claudeSessionId = `${sessionId}-claude`;
    this.geminiSessionId = `${sessionId}-gemini`;

    // State tracking
    this.taskSent = false;
    this.claudeComplete = false;
    this.geminiComplete = false;
    this.claudeOutput = '';
    this.geminiOutput = '';

    // Working directory
    this.workingDir = options.workingDir || null;

    // DOM elements
    this.wrapper = null;
    this.taskInput = null;
    this.summaryPanel = null;
  }

  async init() {
    this.createWrapper();
    await this.initTerminals();
    this.setupEventListeners();
    return this;
  }

  createWrapper() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'duel-view';
    this.wrapper.id = `duel-${this.sessionId}`;

    this.wrapper.innerHTML = `
      <div class="duel-header">
        <div class="duel-warning">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L15 14H1L8 1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M8 6v4M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>Arena Mode: Both agents run with full permissions. Review changes before accepting.</span>
        </div>
        <div class="duel-task-bar">
          <input type="text" class="duel-task-input" placeholder="Enter task for both agents..." />
          <button class="duel-send-btn" title="Send to Both">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 8L2 14V2L14 8Z" fill="currentColor"/>
            </svg>
            <span>Race!</span>
          </button>
        </div>
      </div>

      <div class="duel-terminals">
        <div class="duel-pane duel-claude">
          <div class="duel-pane-header">
            <span class="duel-agent-badge claude-badge">
              <span class="agent-icon">C</span>
              <span class="agent-name">Claude Code</span>
            </span>
            <span class="duel-status" id="claude-status-${this.sessionId}">Ready</span>
          </div>
          <div class="duel-terminal-body" id="claude-terminal-${this.sessionId}"></div>
        </div>

        <div class="duel-divider"></div>

        <div class="duel-pane duel-gemini">
          <div class="duel-pane-header">
            <span class="duel-agent-badge gemini-badge">
              <span class="agent-icon">G</span>
              <span class="agent-name">Gemini CLI</span>
            </span>
            <span class="duel-status" id="gemini-status-${this.sessionId}">Ready</span>
          </div>
          <div class="duel-terminal-body" id="gemini-terminal-${this.sessionId}"></div>
        </div>
      </div>

      <div class="duel-summary" id="duel-summary-${this.sessionId}">
        <div class="duel-summary-header">
          <span>Orchestrator Summary</span>
          <button class="duel-summary-toggle" title="Toggle summary">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="duel-summary-content">
          <p class="duel-summary-waiting">Send a task to begin the race...</p>
        </div>
        <div class="duel-actions" style="display: none;">
          <button class="duel-action-btn" data-action="keep-claude">Keep Claude's</button>
          <button class="duel-action-btn" data-action="keep-gemini">Keep Gemini's</button>
          <button class="duel-action-btn secondary" data-action="view-diff">View Diff</button>
          <button class="duel-action-btn secondary" data-action="discard">Discard Both</button>
        </div>
      </div>
    `;

    this.container.appendChild(this.wrapper);

    // Cache DOM references
    this.taskInput = this.wrapper.querySelector('.duel-task-input');
    this.summaryPanel = this.wrapper.querySelector(`#duel-summary-${this.sessionId}`);
  }

  async initTerminals() {
    const Terminal = window.Terminal;
    const FitAddon = window.FitAddon.FitAddon;
    const WebLinksAddon = window.WebLinksAddon.WebLinksAddon;

    const terminalConfig = {
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 12,
      fontFamily: '"SF Mono", "Fira Code", Menlo, monospace',
      lineHeight: 1.4,
      scrollback: 5000,
      theme: {
        background: '#16161a',
        foreground: '#e4e4e7',
        cursor: '#a78bfa',
        black: '#27272a',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e4e4e7'
      }
    };

    // Initialize Claude terminal
    const claudeContainer = this.wrapper.querySelector(`#claude-terminal-${this.sessionId}`);
    this.claudeTerminal = new Terminal({
      ...terminalConfig,
      theme: { ...terminalConfig.theme, cursor: '#a78bfa' } // Purple for Claude
    });
    this.claudeFitAddon = new FitAddon();
    this.claudeTerminal.loadAddon(this.claudeFitAddon);
    this.claudeTerminal.loadAddon(new WebLinksAddon());
    this.claudeTerminal.open(claudeContainer);
    this.claudeFitAddon.fit();

    // Initialize Gemini terminal
    const geminiContainer = this.wrapper.querySelector(`#gemini-terminal-${this.sessionId}`);
    this.geminiTerminal = new Terminal({
      ...terminalConfig,
      theme: { ...terminalConfig.theme, cursor: '#60a5fa' } // Blue for Gemini
    });
    this.geminiFitAddon = new FitAddon();
    this.geminiTerminal.loadAddon(this.geminiFitAddon);
    this.geminiTerminal.loadAddon(new WebLinksAddon());
    this.geminiTerminal.open(geminiContainer);
    this.geminiFitAddon.fit();

    // Spawn both PTY processes in YOLO mode
    await this.spawnAgents();
  }

  async spawnAgents() {
    const { cols: claudeCols, rows: claudeRows } = this.claudeTerminal;
    const { cols: geminiCols, rows: geminiRows } = this.geminiTerminal;

    // Spawn Claude Code in YOLO mode
    try {
      const claudeResult = await window.donnaAgents.createSession(
        this.claudeSessionId,
        'claude-yolo', // Special agent ID for YOLO mode
        claudeCols,
        claudeRows,
        this.workingDir
      );

      if (!claudeResult.success) {
        this.claudeTerminal.write('\x1b[31mFailed to start Claude Code\x1b[0m\r\n');
        console.error('Claude spawn failed:', claudeResult.error);
      } else {
        this.updateStatus('claude', 'Running');
      }
    } catch (error) {
      this.claudeTerminal.write(`\x1b[31mError: ${error.message}\x1b[0m\r\n`);
    }

    // Spawn Gemini CLI in YOLO mode
    try {
      const geminiResult = await window.donnaAgents.createSession(
        this.geminiSessionId,
        'gemini-yolo', // Special agent ID for YOLO mode
        geminiCols,
        geminiRows,
        this.workingDir
      );

      if (!geminiResult.success) {
        this.geminiTerminal.write('\x1b[31mFailed to start Gemini CLI\x1b[0m\r\n');
        console.error('Gemini spawn failed:', geminiResult.error);
      } else {
        this.updateStatus('gemini', 'Running');
      }
    } catch (error) {
      this.geminiTerminal.write(`\x1b[31mError: ${error.message}\x1b[0m\r\n`);
    }

    // Setup data listeners
    this.setupDataListeners();
  }

  setupDataListeners() {
    // Listen for PTY data from both terminals
    this.dataCleanup = window.donnaTerminal.onData(({ id, data }) => {
      if (id === this.claudeSessionId) {
        this.claudeTerminal.write(data);
        this.claudeOutput += data;
      } else if (id === this.geminiSessionId) {
        this.geminiTerminal.write(data);
        this.geminiOutput += data;
      }
    });

    // Listen for exits
    this.exitCleanup = window.donnaTerminal.onExit(({ id, exitCode }) => {
      if (id === this.claudeSessionId) {
        this.claudeComplete = true;
        this.updateStatus('claude', `Done (${exitCode})`);
        this.checkBothComplete();
      } else if (id === this.geminiSessionId) {
        this.geminiComplete = true;
        this.updateStatus('gemini', `Done (${exitCode})`);
        this.checkBothComplete();
      }
    });

    // Handle terminal input - send to respective PTY
    this.claudeTerminal.onData((data) => {
      window.donnaTerminal.write(this.claudeSessionId, data);
    });

    this.geminiTerminal.onData((data) => {
      window.donnaTerminal.write(this.geminiSessionId, data);
    });
  }

  setupEventListeners() {
    // Send task to both agents
    const sendBtn = this.wrapper.querySelector('.duel-send-btn');
    sendBtn.addEventListener('click', () => this.sendTask());

    this.taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendTask();
      }
    });

    // Summary toggle
    const toggleBtn = this.wrapper.querySelector('.duel-summary-toggle');
    toggleBtn.addEventListener('click', () => {
      this.summaryPanel.classList.toggle('collapsed');
    });

    // Action buttons
    this.wrapper.querySelectorAll('.duel-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.handleAction(action);
      });
    });

    // Handle resize
    window.addEventListener('resize', () => this.fit());
  }

  sendTask() {
    const task = this.taskInput.value.trim();
    if (!task) return;

    this.taskSent = true;
    this.taskInput.disabled = true;

    // Update summary
    const summaryContent = this.summaryPanel.querySelector('.duel-summary-content');
    summaryContent.innerHTML = `<p class="duel-summary-running">Racing on: "${task}"</p>`;

    // Send to both terminals with newline
    const taskWithNewline = task + '\n';
    window.donnaTerminal.write(this.claudeSessionId, taskWithNewline);
    window.donnaTerminal.write(this.geminiSessionId, taskWithNewline);

    this.updateStatus('claude', 'Working...');
    this.updateStatus('gemini', 'Working...');
  }

  updateStatus(agent, status) {
    const statusEl = this.wrapper.querySelector(`#${agent}-status-${this.sessionId}`);
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.className = 'duel-status';
      if (status.includes('Done')) {
        statusEl.classList.add('complete');
      } else if (status.includes('Working')) {
        statusEl.classList.add('working');
      }
    }
  }

  checkBothComplete() {
    if (this.claudeComplete && this.geminiComplete && this.taskSent) {
      this.generateSummary();
    }
  }

  async generateSummary() {
    const summaryContent = this.summaryPanel.querySelector('.duel-summary-content');
    const actionsEl = this.wrapper.querySelector('.duel-actions');

    summaryContent.innerHTML = `<p class="duel-summary-analyzing">Analyzing results...</p>`;

    // Simple analysis - count lines, look for patterns
    const claudeLines = this.claudeOutput.split('\n').length;
    const geminiLines = this.geminiOutput.split('\n').length;

    // Check for file edits (common patterns in CLI output)
    const claudeEdits = (this.claudeOutput.match(/(?:wrote|created|edited|modified|updated)/gi) || []).length;
    const geminiEdits = (this.geminiOutput.match(/(?:wrote|created|edited|modified|updated)/gi) || []).length;

    // Check for errors
    const claudeErrors = (this.claudeOutput.match(/(?:error|failed|exception)/gi) || []).length;
    const geminiErrors = (this.geminiOutput.match(/(?:error|failed|exception)/gi) || []).length;

    // Build summary
    summaryContent.innerHTML = `
      <div class="duel-comparison">
        <div class="duel-agent-summary claude-summary">
          <h4>Claude Code</h4>
          <ul>
            <li>${claudeLines} lines of output</li>
            <li>${claudeEdits} file operations</li>
            <li>${claudeErrors} errors/warnings</li>
          </ul>
        </div>
        <div class="duel-agent-summary gemini-summary">
          <h4>Gemini CLI</h4>
          <ul>
            <li>${geminiLines} lines of output</li>
            <li>${geminiEdits} file operations</li>
            <li>${geminiErrors} errors/warnings</li>
          </ul>
        </div>
      </div>
      <p class="duel-summary-note">Review both outputs above, then choose an action below.</p>
    `;

    // Show action buttons
    actionsEl.style.display = 'flex';
  }

  handleAction(action) {
    switch (action) {
      case 'keep-claude':
        // TODO: Git operations to keep Claude's changes
        console.log('Keeping Claude\'s changes');
        this.showActionResult('Kept Claude\'s changes');
        break;
      case 'keep-gemini':
        // TODO: Git operations to keep Gemini's changes
        console.log('Keeping Gemini\'s changes');
        this.showActionResult('Kept Gemini\'s changes');
        break;
      case 'view-diff':
        // TODO: Show diff view
        console.log('View diff');
        break;
      case 'discard':
        // TODO: Git reset
        console.log('Discarding both');
        this.showActionResult('Discarded both - no changes kept');
        break;
    }
  }

  showActionResult(message) {
    const summaryContent = this.summaryPanel.querySelector('.duel-summary-content');
    summaryContent.innerHTML += `<p class="duel-action-result">${message}</p>`;
  }

  fit() {
    this.claudeFitAddon?.fit();
    this.geminiFitAddon?.fit();
  }

  show() {
    if (this.wrapper) {
      this.wrapper.style.display = 'flex';
      this.fit();
    }
  }

  hide() {
    if (this.wrapper) {
      this.wrapper.style.display = 'none';
    }
  }

  async destroy() {
    // Clean up listeners
    if (this.dataCleanup) this.dataCleanup();
    if (this.exitCleanup) this.exitCleanup();

    // Destroy PTY processes
    await window.donnaTerminal.destroy({ id: this.claudeSessionId });
    await window.donnaTerminal.destroy({ id: this.geminiSessionId });

    // Dispose terminals
    this.claudeTerminal?.dispose();
    this.geminiTerminal?.dispose();

    // Remove DOM
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
  }
}

// Export
window.DuelView = DuelView;
