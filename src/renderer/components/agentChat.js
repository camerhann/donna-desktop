/**
 * Donna Desktop - Agent Chat Component
 * Rich chat UI for Claude Code and Gemini CLI sessions
 * Intercepts PTY output, parses it, and renders a beautiful chat interface
 */

/**
 * ClaudeOutputParser - Parses Claude Code CLI output into structured blocks
 * Handles ANSI codes, tool calls, thinking, code, and markdown
 */
class ClaudeOutputParser {
  constructor() {
    this.buffer = '';
    this.blocks = [];
    this.currentBlock = null;
    this.isInCodeBlock = false;
    this.codeBlockLang = '';
    this.codeBlockContent = '';
    this.isInThinking = false;
    this.thinkingContent = '';
    this.isInToolCall = false;
    this.toolCallInfo = null;

    // ANSI escape code patterns
    this.ansiPattern = /\x1b\[[0-9;]*[a-zA-Z]/g;
    this.ansiColorPattern = /\x1b\[(\d+(?:;\d+)*)m/g;
  }

  /**
   * Strip ANSI escape codes from text
   */
  stripAnsi(text) {
    return text.replace(this.ansiPattern, '');
  }

  /**
   * Parse incoming PTY data chunk
   * @param {string} data - Raw PTY data
   * @returns {Array} Array of parsed blocks
   */
  parse(data) {
    this.buffer += data;
    const newBlocks = [];

    // Process complete lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const rawLine of lines) {
      const line = this.stripAnsi(rawLine).trim();
      const block = this.parseLine(line, rawLine);
      if (block) {
        newBlocks.push(block);
      }
    }

    return newBlocks;
  }

  /**
   * Parse a single line and return a block if complete
   */
  parseLine(line, rawLine) {
    // Skip empty lines unless in code block
    if (!line && !this.isInCodeBlock) {
      return null;
    }

    // Detect Claude Code UI elements
    // Thinking indicator: usually styled with dim/italic
    if (line.match(/^(Thinking|\.\.\.)/i) || rawLine.includes('\x1b[2m')) {
      if (line.startsWith('Thinking')) {
        this.isInThinking = true;
        this.thinkingContent = '';
        return null;
      }
    }

    // End of thinking (when normal text resumes)
    if (this.isInThinking && !rawLine.includes('\x1b[2m') && line.length > 0) {
      this.isInThinking = false;
      if (this.thinkingContent) {
        return {
          type: 'thinking',
          content: this.thinkingContent.trim()
        };
      }
    }

    // Accumulate thinking content
    if (this.isInThinking) {
      this.thinkingContent += line + '\n';
      return null;
    }

    // Tool call detection: "Using tool: X" or "Tool: X"
    const toolMatch = line.match(/^(?:Using |Running )?(?:tool|Tool):\s*(.+)/i);
    if (toolMatch) {
      return {
        type: 'tool_call',
        tool: toolMatch[1].trim(),
        status: 'running'
      };
    }

    // Tool result detection
    if (line.match(/^(?:Result|Output|Tool output):/i)) {
      return {
        type: 'tool_result_start'
      };
    }

    // Code block detection (fenced)
    if (line.startsWith('```')) {
      if (!this.isInCodeBlock) {
        // Start code block
        this.isInCodeBlock = true;
        this.codeBlockLang = line.slice(3).trim() || 'text';
        this.codeBlockContent = '';
        return null;
      } else {
        // End code block
        this.isInCodeBlock = false;
        const block = {
          type: 'code',
          language: this.codeBlockLang,
          content: this.codeBlockContent.trim()
        };
        this.codeBlockLang = '';
        this.codeBlockContent = '';
        return block;
      }
    }

    // Accumulate code block content
    if (this.isInCodeBlock) {
      this.codeBlockContent += line + '\n';
      return null;
    }

    // Prompt indicator (user input expected)
    if (line.match(/^[>❯$]\s*$/) || line.match(/claude>|gemini>/i)) {
      return {
        type: 'prompt',
        content: line
      };
    }

    // Cost/token info (Claude Code shows this)
    const costMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:tokens|input|output|cost|\$)/i);
    if (costMatch && line.includes('token')) {
      return {
        type: 'meta',
        content: line
      };
    }

    // Error detection
    if (line.match(/^(?:Error|ERROR|Failed|FAILED):/i) || rawLine.includes('\x1b[31m')) {
      return {
        type: 'error',
        content: line
      };
    }

    // Success/completion messages
    if (rawLine.includes('\x1b[32m') && line.length < 100) {
      return {
        type: 'success',
        content: line
      };
    }

    // File path detection (common in Claude Code output)
    const fileMatch = line.match(/^(?:Reading|Writing|Editing|Created|Modified|Deleted)\s+(.+)/i);
    if (fileMatch) {
      return {
        type: 'file_operation',
        operation: line.split(' ')[0].toLowerCase(),
        path: fileMatch[1].trim()
      };
    }

    // Default: text content (markdown-capable)
    return {
      type: 'text',
      content: line
    };
  }

  /**
   * Flush any remaining buffered content
   */
  flush() {
    const blocks = [];

    if (this.buffer.trim()) {
      const line = this.stripAnsi(this.buffer).trim();
      if (line) {
        blocks.push({
          type: 'text',
          content: line
        });
      }
    }

    if (this.isInCodeBlock && this.codeBlockContent) {
      blocks.push({
        type: 'code',
        language: this.codeBlockLang || 'text',
        content: this.codeBlockContent.trim()
      });
    }

    if (this.isInThinking && this.thinkingContent) {
      blocks.push({
        type: 'thinking',
        content: this.thinkingContent.trim()
      });
    }

    this.reset();
    return blocks;
  }

  /**
   * Reset parser state
   */
  reset() {
    this.buffer = '';
    this.blocks = [];
    this.currentBlock = null;
    this.isInCodeBlock = false;
    this.codeBlockLang = '';
    this.codeBlockContent = '';
    this.isInThinking = false;
    this.thinkingContent = '';
    this.isInToolCall = false;
    this.toolCallInfo = null;
  }
}

/**
 * AgentChatRenderer - Renders parsed blocks into beautiful HTML
 */
class AgentChatRenderer {
  static _blockIdCounter = 0;

  constructor(options = {}) {
    this.agent = options.agent || { name: 'Agent', icon: 'A', color: '#a78bfa' };
  }

  /**
   * Render a single block to HTML
   */
  renderBlock(block) {
    switch (block.type) {
      case 'text':
        return this.renderText(block.content);
      case 'code':
        return this.renderCode(block.content, block.language);
      case 'thinking':
        return this.renderThinking(block.content);
      case 'tool_call':
        return this.renderToolCall(block.tool, block.status);
      case 'tool_result_start':
        return '<div class="agent-tool-result">';
      case 'file_operation':
        return this.renderFileOperation(block.operation, block.path);
      case 'error':
        return this.renderError(block.content);
      case 'success':
        return this.renderSuccess(block.content);
      case 'meta':
        return this.renderMeta(block.content);
      case 'prompt':
        return ''; // Don't render prompt indicators in chat view
      default:
        return this.renderText(block.content || '');
    }
  }

  /**
   * Render text with markdown support
   */
  renderText(content) {
    if (!content) return '';

    // Use marked if available, otherwise basic formatting
    let html = content;
    if (window.marked) {
      try {
        html = window.marked.parse(content, { gfm: true, breaks: true });
      } catch (e) {
        html = this.escapeHtml(content);
      }
    } else {
      html = this.escapeHtml(content);
    }

    return `<div class="agent-text">${html}</div>`;
  }

  /**
   * Render code block with syntax highlighting and copy button
   */
  renderCode(content, language = 'text') {
    const blockId = `agent-code-${++AgentChatRenderer._blockIdCounter}`;
    const escapedContent = this.escapeHtml(content);

    return `
      <div class="agent-code-block" id="${blockId}">
        <div class="agent-code-header">
          <span class="agent-code-lang">${language}</span>
          <button class="agent-code-copy" data-block-id="${blockId}" title="Copy code">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <path d="M2 10V3a1 1 0 011-1h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>Copy</span>
          </button>
        </div>
        <pre class="agent-code-content"><code class="language-${language}">${escapedContent}</code></pre>
      </div>
    `;
  }

  /**
   * Render thinking/reasoning block
   */
  renderThinking(content) {
    return `
      <div class="agent-thinking">
        <div class="agent-thinking-header">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M7 4v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>Thinking...</span>
        </div>
        <div class="agent-thinking-content">${this.escapeHtml(content)}</div>
      </div>
    `;
  }

  /**
   * Render tool call indicator
   */
  renderToolCall(tool, status = 'running') {
    const statusIcon = status === 'running'
      ? '<div class="agent-tool-spinner"></div>'
      : '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="2 7 5 10 12 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    return `
      <div class="agent-tool-call ${status}">
        ${statusIcon}
        <span class="agent-tool-name">${this.escapeHtml(tool)}</span>
      </div>
    `;
  }

  /**
   * Render file operation
   */
  renderFileOperation(operation, path) {
    const icons = {
      reading: '📖',
      writing: '✏️',
      editing: '📝',
      created: '✨',
      modified: '📝',
      deleted: '🗑️'
    };
    const icon = icons[operation] || '📄';

    return `
      <div class="agent-file-op">
        <span class="agent-file-icon">${icon}</span>
        <span class="agent-file-operation">${operation}</span>
        <code class="agent-file-path">${this.escapeHtml(path)}</code>
      </div>
    `;
  }

  /**
   * Render error message
   */
  renderError(content) {
    return `
      <div class="agent-error">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M7 4v3M7 9v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>${this.escapeHtml(content)}</span>
      </div>
    `;
  }

  /**
   * Render success message
   */
  renderSuccess(content) {
    return `
      <div class="agent-success">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/>
          <polyline points="4.5 7 6 8.5 9.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>${this.escapeHtml(content)}</span>
      </div>
    `;
  }

  /**
   * Render meta info (tokens, cost)
   */
  renderMeta(content) {
    return `<div class="agent-meta">${this.escapeHtml(content)}</div>`;
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

/**
 * AgentInputBar - Rich input component for agent chat
 */
class AgentInputBar {
  constructor(options = {}) {
    this.onSubmit = options.onSubmit || (() => {});
    this.onCancel = options.onCancel || (() => {});
    this.agent = options.agent || { name: 'Agent', color: '#a78bfa' };
    this.container = null;
    this.textarea = null;
    this.isDisabled = false;
  }

  /**
   * Create the input bar HTML
   */
  render() {
    const el = document.createElement('div');
    el.className = 'agent-input-bar';
    el.innerHTML = `
      <div class="agent-input-wrapper">
        <textarea
          class="agent-input-textarea"
          placeholder="Message ${this.agent.name}..."
          rows="1"
        ></textarea>
        <div class="agent-input-actions">
          <button class="agent-input-cancel" title="Cancel (Escape)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="agent-input-send" title="Send (Enter)" style="--agent-color: ${this.agent.color}">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h12M8 2l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="agent-input-hints">
        <span>Enter to send</span>
        <span>Shift+Enter for new line</span>
        <span>Escape to cancel</span>
      </div>
    `;

    this.container = el;
    this.textarea = el.querySelector('.agent-input-textarea');

    this.bindEvents();
    return el;
  }

  /**
   * Bind input events
   */
  bindEvents() {
    const sendBtn = this.container.querySelector('.agent-input-send');
    const cancelBtn = this.container.querySelector('.agent-input-cancel');

    // Send button
    sendBtn.addEventListener('click', () => this.submit());

    // Cancel button
    cancelBtn.addEventListener('click', () => this.cancel());

    // Textarea events
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
      }
    });

    // Auto-resize
    this.textarea.addEventListener('input', () => {
      this.textarea.style.height = 'auto';
      this.textarea.style.height = Math.min(this.textarea.scrollHeight, 200) + 'px';
    });
  }

  /**
   * Submit the current input
   */
  submit() {
    if (this.isDisabled) return;

    const value = this.textarea.value.trim();
    if (!value) return;

    this.onSubmit(value);
    this.textarea.value = '';
    this.textarea.style.height = 'auto';
  }

  /**
   * Cancel/interrupt current operation
   */
  cancel() {
    this.onCancel();
  }

  /**
   * Enable/disable the input
   */
  setDisabled(disabled) {
    this.isDisabled = disabled;
    this.textarea.disabled = disabled;
    const sendBtn = this.container.querySelector('.agent-input-send');
    sendBtn.disabled = disabled;
  }

  /**
   * Focus the input
   */
  focus() {
    this.textarea?.focus();
  }

  /**
   * Get current value
   */
  getValue() {
    return this.textarea?.value || '';
  }

  /**
   * Set value
   */
  setValue(value) {
    if (this.textarea) {
      this.textarea.value = value;
    }
  }
}

/**
 * AgentChat - Main orchestrator component
 * Wraps terminal, intercepts PTY, renders rich chat UI
 */
class AgentChat {
  constructor(sessionId, container, options = {}) {
    this.sessionId = sessionId;
    this.container = container;
    this.options = options;

    // Agent info for theming
    this.agent = options.agent || {
      id: 'agent',
      name: 'Agent',
      icon: 'A',
      color: '#a78bfa'
    };

    // PTY write function (injected by SessionManager)
    this.ptyWrite = options.ptyWrite || (() => {});

    // Components
    this.parser = new ClaudeOutputParser();
    this.renderer = new AgentChatRenderer({ agent: this.agent });
    this.inputBar = null;

    // State
    this.viewMode = 'chat'; // 'chat' or 'terminal'
    this.conversationHistory = [];
    this.isStreaming = false;
    this.currentAssistantMessage = null;

    // DOM elements
    this.wrapper = null;
    this.chatContainer = null;
    this.messagesContainer = null;
    this.terminalContainer = null;
    this.terminal = null; // Reference to DonnaTerminal if needed

    // Scroll state
    this.scrollDebounce = null;
  }

  /**
   * Initialize and create the chat UI
   */
  init() {
    this.createUI();
    this.setupEventListeners();
    this.addStyles();
    return this;
  }

  /**
   * Create the chat UI structure
   */
  createUI() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'agent-chat-wrapper';
    this.wrapper.id = `agent-chat-${this.sessionId}`;

    this.wrapper.innerHTML = `
      <div class="agent-chat-header">
        <div class="agent-chat-header-left">
          <span class="agent-chat-badge" style="background: ${this.agent.color}20; color: ${this.agent.color}">
            <span class="agent-chat-icon">${this.agent.icon}</span>
            <span class="agent-chat-name">${this.agent.name}</span>
          </span>
          <span class="agent-chat-status">Ready</span>
        </div>
        <div class="agent-chat-header-right">
          <button class="agent-chat-view-toggle" title="Toggle Terminal (Cmd+Shift+T)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M5 7l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 11h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span class="view-toggle-label">Terminal</span>
          </button>
        </div>
      </div>

      <div class="agent-chat-body">
        <div class="agent-chat-messages" id="agent-messages-${this.sessionId}">
          <div class="agent-chat-welcome">
            <div class="agent-welcome-avatar" style="background: ${this.agent.color}">
              <span>${this.agent.icon}</span>
            </div>
            <h2>Chat with ${this.agent.name}</h2>
            <p>Type a message to start the conversation</p>
          </div>
        </div>
        <div class="agent-chat-terminal" id="agent-terminal-${this.sessionId}" style="display: none;">
          <!-- Terminal will be mounted here -->
        </div>
      </div>
    `;

    // Create input bar
    this.inputBar = new AgentInputBar({
      agent: this.agent,
      onSubmit: (message) => this.sendMessage(message),
      onCancel: () => this.cancelOperation()
    });

    const inputEl = this.inputBar.render();
    this.wrapper.appendChild(inputEl);

    // Store references
    this.chatContainer = this.wrapper.querySelector('.agent-chat-body');
    this.messagesContainer = this.wrapper.querySelector(`#agent-messages-${this.sessionId}`);
    this.terminalContainer = this.wrapper.querySelector(`#agent-terminal-${this.sessionId}`);

    this.container.appendChild(this.wrapper);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // View toggle button
    const toggleBtn = this.wrapper.querySelector('.agent-chat-view-toggle');
    toggleBtn?.addEventListener('click', () => this.toggleView());

    // Keyboard shortcut for view toggle
    document.addEventListener('keydown', this.handleKeydown.bind(this));

    // Code copy buttons (event delegation)
    this.messagesContainer?.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.agent-code-copy');
      if (copyBtn) {
        this.handleCodeCopy(copyBtn);
      }
    });
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeydown(e) {
    // Only handle if this chat is active
    if (!this.wrapper?.classList.contains('active')) return;

    const isMac = window.platform?.isMac;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    // Cmd+Shift+T: Toggle view
    if (cmdOrCtrl && e.shiftKey && e.key === 't') {
      e.preventDefault();
      this.toggleView();
    }
  }

  /**
   * Handle code copy button click
   */
  handleCodeCopy(btn) {
    const blockId = btn.dataset.blockId;
    const block = document.getElementById(blockId);
    if (!block) return;

    const code = block.querySelector('code')?.textContent;
    if (!code) return;

    navigator.clipboard.writeText(code).then(() => {
      const span = btn.querySelector('span');
      const original = span?.textContent;
      if (span) span.textContent = 'Copied!';
      btn.classList.add('copied');

      setTimeout(() => {
        if (span) span.textContent = original;
        btn.classList.remove('copied');
      }, 2000);
    });
  }

  /**
   * Handle incoming PTY data
   * This is the main entry point for terminal output
   */
  handlePtyData(data) {
    // Parse the data into blocks
    const blocks = this.parser.parse(data);

    // If we have blocks and in chat mode, render them
    if (blocks.length > 0) {
      this.hideWelcome();

      // Start or continue assistant message
      if (!this.currentAssistantMessage) {
        this.startAssistantMessage();
      }

      // Render blocks into current message
      for (const block of blocks) {
        this.appendBlock(block);
      }

      this.scrollToBottom();
    }

    // Update streaming state based on content
    this.updateStreamingState(data);
  }

  /**
   * Update streaming state indicator
   */
  updateStreamingState(data) {
    const statusEl = this.wrapper.querySelector('.agent-chat-status');
    if (!statusEl) return;

    // Detect streaming/thinking states
    if (data.includes('Thinking') || data.includes('...')) {
      statusEl.textContent = 'Thinking...';
      statusEl.classList.add('streaming');
      this.isStreaming = true;
    } else if (data.includes('$') || data.includes('>')) {
      // Prompt detected, streaming done
      statusEl.textContent = 'Ready';
      statusEl.classList.remove('streaming');
      this.isStreaming = false;
      this.finalizeAssistantMessage();
    }
  }

  /**
   * Start a new assistant message bubble
   */
  startAssistantMessage() {
    const messageEl = document.createElement('div');
    messageEl.className = 'agent-message assistant';
    messageEl.innerHTML = `
      <div class="agent-message-avatar" style="background: ${this.agent.color}">
        ${this.agent.icon}
      </div>
      <div class="agent-message-content"></div>
    `;

    this.messagesContainer.appendChild(messageEl);
    this.currentAssistantMessage = messageEl.querySelector('.agent-message-content');

    // Add to history
    this.conversationHistory.push({
      role: 'assistant',
      element: messageEl,
      blocks: []
    });
  }

  /**
   * Append a block to the current assistant message
   */
  appendBlock(block) {
    if (!this.currentAssistantMessage) return;

    const html = this.renderer.renderBlock(block);
    if (html) {
      this.currentAssistantMessage.insertAdjacentHTML('beforeend', html);
    }

    // Track in history
    const lastMsg = this.conversationHistory[this.conversationHistory.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      lastMsg.blocks.push(block);
    }
  }

  /**
   * Finalize the current assistant message
   */
  finalizeAssistantMessage() {
    // Flush any remaining parser buffer
    const remaining = this.parser.flush();
    for (const block of remaining) {
      this.appendBlock(block);
    }

    this.currentAssistantMessage = null;
    this.inputBar?.setDisabled(false);
    this.inputBar?.focus();
  }

  /**
   * Send a user message
   */
  sendMessage(message) {
    if (!message || this.isStreaming) return;

    // Hide welcome
    this.hideWelcome();

    // Add user message to UI
    const messageEl = document.createElement('div');
    messageEl.className = 'agent-message user';
    messageEl.innerHTML = `
      <div class="agent-message-avatar user">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="4" r="3" stroke="currentColor" stroke-width="1.5"/>
          <path d="M2 13c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="agent-message-content">
        <p>${this.escapeHtml(message)}</p>
      </div>
    `;
    this.messagesContainer.appendChild(messageEl);

    // Add to history
    this.conversationHistory.push({
      role: 'user',
      content: message,
      element: messageEl
    });

    // Write to PTY (send to Claude Code)
    this.ptyWrite(message + '\n');

    // Update UI state
    this.isStreaming = true;
    this.inputBar?.setDisabled(true);
    const statusEl = this.wrapper.querySelector('.agent-chat-status');
    if (statusEl) {
      statusEl.textContent = 'Processing...';
      statusEl.classList.add('streaming');
    }

    this.scrollToBottom();
  }

  /**
   * Cancel current operation (send Ctrl+C to PTY)
   */
  cancelOperation() {
    this.ptyWrite('\x03'); // Ctrl+C

    const statusEl = this.wrapper.querySelector('.agent-chat-status');
    if (statusEl) {
      statusEl.textContent = 'Cancelled';
      statusEl.classList.remove('streaming');
    }

    setTimeout(() => {
      if (statusEl) statusEl.textContent = 'Ready';
      this.isStreaming = false;
      this.inputBar?.setDisabled(false);
      this.inputBar?.focus();
    }, 500);
  }

  /**
   * Toggle between chat and terminal view
   */
  toggleView() {
    if (this.viewMode === 'chat') {
      this.viewMode = 'terminal';
      this.messagesContainer.style.display = 'none';
      this.terminalContainer.style.display = 'flex';

      const toggleBtn = this.wrapper.querySelector('.view-toggle-label');
      if (toggleBtn) toggleBtn.textContent = 'Chat';

      // Focus terminal if available
      this.terminal?.focus();
    } else {
      this.viewMode = 'chat';
      this.messagesContainer.style.display = 'flex';
      this.terminalContainer.style.display = 'none';

      const toggleBtn = this.wrapper.querySelector('.view-toggle-label');
      if (toggleBtn) toggleBtn.textContent = 'Terminal';

      // Focus input
      this.inputBar?.focus();
      this.scrollToBottom();
    }
  }

  /**
   * Get current view mode
   */
  getViewMode() {
    return this.viewMode;
  }

  /**
   * Set the terminal instance (for view toggle)
   */
  setTerminal(terminal) {
    this.terminal = terminal;
  }

  /**
   * Hide the welcome message
   */
  hideWelcome() {
    const welcome = this.messagesContainer?.querySelector('.agent-chat-welcome');
    if (welcome) {
      welcome.style.display = 'none';
    }
  }

  /**
   * Scroll messages to bottom
   */
  scrollToBottom() {
    if (this.scrollDebounce) return;

    this.scrollDebounce = requestAnimationFrame(() => {
      if (this.messagesContainer) {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }
      this.scrollDebounce = null;
    });
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Show the chat
   */
  show() {
    this.wrapper?.classList.add('active');
    if (this.viewMode === 'chat') {
      this.inputBar?.focus();
    }
  }

  /**
   * Hide the chat
   */
  hide() {
    this.wrapper?.classList.remove('active');
  }

  /**
   * Add component styles
   */
  addStyles() {
    if (document.getElementById('agent-chat-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'agent-chat-styles';
    styles.textContent = `
      .agent-chat-wrapper {
        display: none;
        flex-direction: column;
        height: 100%;
        background: #16161a;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      }

      .agent-chat-wrapper.active {
        display: flex;
      }

      /* Header */
      .agent-chat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        background: #1e1e22;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .agent-chat-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .agent-chat-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 13px;
      }

      .agent-chat-icon {
        font-size: 14px;
      }

      .agent-chat-status {
        font-size: 12px;
        color: #71717a;
        transition: color 0.2s;
      }

      .agent-chat-status.streaming {
        color: #a78bfa;
        animation: statusPulse 1.5s infinite;
      }

      @keyframes statusPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .agent-chat-view-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: #27272a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: #a1a1aa;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .agent-chat-view-toggle:hover {
        background: #3f3f46;
        color: #e4e4e7;
      }

      /* Body */
      .agent-chat-body {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .agent-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .agent-chat-terminal {
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      /* Welcome */
      .agent-chat-welcome {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 40px;
      }

      .agent-welcome-avatar {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        font-weight: 700;
        color: #fff;
        margin-bottom: 20px;
      }

      .agent-chat-welcome h2 {
        margin: 0 0 8px;
        font-size: 20px;
        font-weight: 600;
        color: #e4e4e7;
      }

      .agent-chat-welcome p {
        margin: 0;
        font-size: 14px;
        color: #71717a;
      }

      /* Messages */
      .agent-message {
        display: flex;
        gap: 12px;
        max-width: 90%;
        animation: messageSlide 0.2s ease-out;
      }

      @keyframes messageSlide {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .agent-message.user {
        align-self: flex-end;
        flex-direction: row-reverse;
      }

      .agent-message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 700;
        color: #fff;
        flex-shrink: 0;
      }

      .agent-message-avatar.user {
        background: #3f3f46;
        color: #e4e4e7;
      }

      .agent-message-content {
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.6;
      }

      .agent-message.assistant .agent-message-content {
        background: #27272a;
        color: #e4e4e7;
        border-bottom-left-radius: 4px;
      }

      .agent-message.user .agent-message-content {
        background: var(--agent-color, #a78bfa);
        color: #fff;
        border-bottom-right-radius: 4px;
      }

      .agent-message-content p {
        margin: 0;
      }

      .agent-message-content p + p {
        margin-top: 8px;
      }

      /* Text blocks */
      .agent-text {
        margin: 4px 0;
      }

      .agent-text p {
        margin: 0 0 8px;
      }

      .agent-text p:last-child {
        margin-bottom: 0;
      }

      /* Code blocks */
      .agent-code-block {
        margin: 12px 0;
        border-radius: 8px;
        overflow: hidden;
        background: #1e1e22;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .agent-code-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .agent-code-lang {
        font-size: 11px;
        font-weight: 600;
        color: #71717a;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-family: "SF Mono", "Fira Code", monospace;
      }

      .agent-code-copy {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: #a1a1aa;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .agent-code-copy:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #e4e4e7;
      }

      .agent-code-copy.copied {
        background: rgba(34, 197, 94, 0.15);
        border-color: rgba(34, 197, 94, 0.3);
        color: #22c55e;
      }

      .agent-code-content {
        margin: 0;
        padding: 12px 16px;
        overflow-x: auto;
        background: transparent;
      }

      .agent-code-content code {
        font-family: "SF Mono", "Fira Code", "JetBrains Mono", Menlo, monospace;
        font-size: 13px;
        line-height: 1.5;
        color: #e4e4e7;
      }

      /* Thinking block */
      .agent-thinking {
        margin: 8px 0;
        padding: 12px;
        background: rgba(167, 139, 250, 0.08);
        border-left: 3px solid #a78bfa;
        border-radius: 0 8px 8px 0;
      }

      .agent-thinking-header {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #a78bfa;
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .agent-thinking-content {
        font-size: 13px;
        color: #a1a1aa;
        font-style: italic;
      }

      /* Tool call */
      .agent-tool-call {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 8px 0;
        padding: 8px 12px;
        background: rgba(96, 165, 250, 0.1);
        border-radius: 8px;
        color: #60a5fa;
        font-size: 13px;
      }

      .agent-tool-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(96, 165, 250, 0.3);
        border-top-color: #60a5fa;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .agent-tool-name {
        font-family: "SF Mono", "Fira Code", monospace;
      }

      /* File operation */
      .agent-file-op {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 4px 0;
        padding: 6px 10px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        font-size: 12px;
      }

      .agent-file-operation {
        color: #71717a;
        text-transform: capitalize;
      }

      .agent-file-path {
        color: #e4e4e7;
        font-family: "SF Mono", monospace;
      }

      /* Error */
      .agent-error {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 8px 0;
        padding: 10px 12px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 8px;
        color: #f87171;
        font-size: 13px;
      }

      /* Success */
      .agent-success {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 8px 0;
        padding: 10px 12px;
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.3);
        border-radius: 8px;
        color: #4ade80;
        font-size: 13px;
      }

      /* Meta */
      .agent-meta {
        margin: 8px 0;
        padding: 4px 8px;
        font-size: 11px;
        color: #52525b;
        font-family: "SF Mono", monospace;
      }

      /* Input bar */
      .agent-input-bar {
        padding: 16px 20px;
        background: #1e1e22;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .agent-input-wrapper {
        display: flex;
        align-items: flex-end;
        gap: 12px;
        background: #27272a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 8px 12px;
        transition: border-color 0.15s;
      }

      .agent-input-wrapper:focus-within {
        border-color: var(--agent-color, #a78bfa);
      }

      .agent-input-textarea {
        flex: 1;
        background: none;
        border: none;
        color: #e4e4e7;
        font-size: 14px;
        line-height: 1.5;
        resize: none;
        outline: none;
        max-height: 200px;
        padding: 4px 0;
        font-family: inherit;
      }

      .agent-input-textarea::placeholder {
        color: #52525b;
      }

      .agent-input-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      .agent-input-cancel,
      .agent-input-send {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        transition: all 0.15s;
      }

      .agent-input-cancel {
        background: transparent;
        color: #71717a;
      }

      .agent-input-cancel:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #f87171;
      }

      .agent-input-send {
        background: var(--agent-color, #a78bfa);
        color: #fff;
      }

      .agent-input-send:hover {
        filter: brightness(1.1);
        transform: scale(1.05);
      }

      .agent-input-send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .agent-input-hints {
        display: flex;
        gap: 16px;
        margin-top: 8px;
        padding: 0 4px;
      }

      .agent-input-hints span {
        font-size: 11px;
        color: #3f3f46;
      }

      /* Scrollbar */
      .agent-chat-messages::-webkit-scrollbar {
        width: 6px;
      }

      .agent-chat-messages::-webkit-scrollbar-track {
        background: transparent;
      }

      .agent-chat-messages::-webkit-scrollbar-thumb {
        background: #3f3f46;
        border-radius: 3px;
      }

      .agent-chat-messages::-webkit-scrollbar-thumb:hover {
        background: #52525b;
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    // Remove keyboard listener
    document.removeEventListener('keydown', this.handleKeydown);

    // Clear parser
    this.parser.reset();

    // Remove from DOM
    if (this.wrapper?.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }

    this.wrapper = null;
    this.messagesContainer = null;
    this.terminalContainer = null;
    this.inputBar = null;
    this.terminal = null;
  }
}

// Export components
window.ClaudeOutputParser = ClaudeOutputParser;
window.AgentChatRenderer = AgentChatRenderer;
window.AgentInputBar = AgentInputBar;
window.AgentChat = AgentChat;
