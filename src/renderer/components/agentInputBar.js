/**
 * Agent Input Bar Component
 * A rich input component for sending messages to Claude Code agents
 * Features: auto-expanding textarea, file attachments, voice input, keyboard shortcuts
 */

class AgentInputBar {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      placeholder: 'Message the agent...',
      maxHistorySize: 50,
      onSend: options.onSend || null,
      onVoiceStart: options.onVoiceStart || null,
      onVoiceEnd: options.onVoiceEnd || null,
      ...options
    };

    // State
    this.isDisabled = false;
    this.isLoading = false;
    this.commandHistory = [];
    this.historyIndex = -1;
    this.currentInput = '';

    // Component references
    this.wrapper = null;
    this.textarea = null;
    this.sendButton = null;
    this.attachmentButton = null;
    this.voiceButton = null;
    this.attachmentsContainer = null;

    // Sub-managers
    this.fileManager = null;
    this.voiceManager = null;

    this.init();
  }

  /**
   * Initialize the input bar
   */
  init() {
    this.createUI();
    this.bindEvents();
    this.addStyles();
    this.initFileManager();
    this.initVoiceManager();
  }

  /**
   * Create the input bar UI
   */
  createUI() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'agent-input-bar';
    this.wrapper.innerHTML = `
      <div class="agent-input-attachments" style="display: none;"></div>
      <div class="agent-input-wrapper">
        <div class="agent-input-actions-left">
          <button class="agent-input-btn agent-attach-btn" title="Attach files (Drag & drop or click)" type="button">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M15.75 8.25l-6.89 6.89a3.75 3.75 0 01-5.3-5.3l6.89-6.89a2.5 2.5 0 013.54 3.54l-6.89 6.89a1.25 1.25 0 01-1.77-1.77l6.19-6.19"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="agent-input-btn agent-voice-btn" title="Voice input (Cmd+Shift+V)" type="button">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 1a3 3 0 00-3 3v5a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" stroke-width="1.5"/>
              <path d="M13 8v1a4 4 0 01-8 0V8M9 13v4M6 17h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="agent-input-textarea-wrapper">
          <textarea
            class="agent-input-textarea"
            placeholder="${this.escapeHtml(this.options.placeholder)}"
            rows="1"
            spellcheck="true"
          ></textarea>
          <div class="agent-input-voice-preview" style="display: none;"></div>
        </div>
        <div class="agent-input-actions-right">
          <button class="agent-input-btn agent-send-btn" title="Send (Enter or Cmd+Enter)" type="button" disabled>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2.25 9h13.5M10.5 3.75L15.75 9l-5.25 5.25" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="agent-input-footer">
        <span class="agent-input-hint">
          <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for newline, <kbd>Esc</kbd> to clear
        </span>
      </div>
      <div class="agent-input-history-preview" style="display: none;">
        <span class="history-preview-label"></span>
        <span class="history-preview-text"></span>
      </div>
    `;

    this.container.appendChild(this.wrapper);

    // Store element references
    this.textarea = this.wrapper.querySelector('.agent-input-textarea');
    this.sendButton = this.wrapper.querySelector('.agent-send-btn');
    this.attachmentButton = this.wrapper.querySelector('.agent-attach-btn');
    this.voiceButton = this.wrapper.querySelector('.agent-voice-btn');
    this.attachmentsContainer = this.wrapper.querySelector('.agent-input-attachments');
    this.voicePreview = this.wrapper.querySelector('.agent-input-voice-preview');
    this.historyPreview = this.wrapper.querySelector('.agent-input-history-preview');
    this.historyPreviewLabel = this.wrapper.querySelector('.history-preview-label');
    this.historyPreviewText = this.wrapper.querySelector('.history-preview-text');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Textarea input handling
    this.textarea.addEventListener('input', () => this.handleInput());
    this.textarea.addEventListener('keydown', (e) => this.handleKeydown(e));

    // Send button
    this.sendButton.addEventListener('click', () => this.send());

    // Attachment button
    this.attachmentButton.addEventListener('click', () => this.openFilePicker());

    // Voice button
    this.voiceButton.addEventListener('click', () => this.toggleVoiceInput());

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));

    // Voice transcription events
    window.addEventListener('voice:transcription', (e) => {
      const { text } = e.detail || {};
      if (text) {
        this.appendValue(text + ' ');
        if (this.options.onVoiceEnd) {
          this.options.onVoiceEnd(text);
        }
      }
    });
  }

  /**
   * Initialize file attachment manager
   */
  initFileManager() {
    if (window.FileAttachmentManager) {
      this.fileManager = new window.FileAttachmentManager({
        maxFiles: 5,
        onAttach: (attachments) => this.handleAttachmentsChange(attachments),
        onRemove: (attachments) => this.handleAttachmentsChange(attachments)
      });

      // Create drop zone in the wrapper
      this.fileManager.createDropZone(this.wrapper);

      // Move the attachments container inside our attachments area
      if (this.fileManager.attachmentContainer) {
        this.attachmentsContainer.appendChild(this.fileManager.attachmentContainer);
      }
    }
  }

  /**
   * Initialize voice input manager
   */
  initVoiceManager() {
    if (window.VoiceInputManager) {
      this.voiceManager = new window.VoiceInputManager({
        pushToTalkKey: 'KeyV'
      });

      // Create button elements but use our own button styling
      // The voice manager's events will still work
    }
  }

  /**
   * Handle textarea input
   */
  handleInput() {
    this.autoExpand();
    this.updateSendButton();
    this.historyIndex = -1; // Reset history navigation on new input
    this.hideHistoryPreview(); // Hide preview when typing
  }

  /**
   * Handle textarea keydown events
   */
  handleKeydown(e) {
    // Bracket/quote auto-close
    const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    if (pairs[e.key]) {
      e.preventDefault();
      const start = this.textarea.selectionStart;
      const end = this.textarea.selectionEnd;
      const before = this.textarea.value.slice(0, start);
      const selected = this.textarea.value.slice(start, end);
      const after = this.textarea.value.slice(end);
      // Wrap selected text or insert empty pair
      this.textarea.value = before + e.key + selected + pairs[e.key] + after;
      if (selected.length > 0) {
        // Keep selection inside brackets
        this.textarea.selectionStart = start + 1;
        this.textarea.selectionEnd = end + 1;
      } else {
        // Position cursor between brackets
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 1;
      }
      this.handleInput();
      return;
    }

    // Enter to send (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
      return;
    }

    // Escape to clear
    if (e.key === 'Escape') {
      e.preventDefault();
      this.clear();
      this.hideHistoryPreview();
      return;
    }

    // Up arrow for command history
    if (e.key === 'ArrowUp' && this.textarea.selectionStart === 0) {
      e.preventDefault();
      this.navigateHistory(-1);
      return;
    }

    // Down arrow for command history
    if (e.key === 'ArrowDown' && this.textarea.selectionEnd === this.textarea.value.length) {
      e.preventDefault();
      this.navigateHistory(1);
      return;
    }
  }

  /**
   * Handle global keyboard shortcuts
   */
  handleGlobalKeydown(e) {
    const isMac = navigator.platform.includes('Mac');
    const cmdKey = isMac ? e.metaKey : e.ctrlKey;

    // Cmd+Enter: Send
    if (cmdKey && e.key === 'Enter') {
      e.preventDefault();
      this.send();
      return;
    }

    // Cmd+Shift+V: Voice input
    if (cmdKey && e.shiftKey && e.code === 'KeyV') {
      e.preventDefault();
      this.toggleVoiceInput();
      return;
    }
  }

  /**
   * Auto-expand textarea to fit content
   */
  autoExpand() {
    this.textarea.style.height = 'auto';
    const maxHeight = 200;
    const scrollHeight = this.textarea.scrollHeight;
    this.textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    this.textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  /**
   * Update send button state
   */
  updateSendButton() {
    const hasText = this.textarea.value.trim().length > 0;
    const hasAttachments = this.getAttachments().length > 0;
    const canSend = (hasText || hasAttachments) && !this.isDisabled && !this.isLoading;

    this.sendButton.disabled = !canSend;
    this.sendButton.classList.toggle('ready', canSend);
  }

  /**
   * Handle attachments change
   */
  handleAttachmentsChange(attachments) {
    this.attachmentsContainer.style.display = attachments.length > 0 ? 'block' : 'none';
    this.updateSendButton();
  }

  /**
   * Open native file picker
   */
  openFilePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '*/*';

    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (this.fileManager && files.length > 0) {
        await this.fileManager.processFiles(files);
      }
    };

    input.click();
  }

  /**
   * Toggle voice input
   */
  toggleVoiceInput() {
    if (!this.voiceManager) {
      console.warn('Voice input not available');
      return;
    }

    if (this.voiceManager.isListening) {
      this.voiceManager.stopListening();
      this.voiceButton.classList.remove('listening');
      this.voicePreview.style.display = 'none';
      if (this.options.onVoiceEnd) {
        this.options.onVoiceEnd(this.voiceManager.getTranscript());
      }
    } else {
      this.voiceManager.mode = 'push-to-talk';
      this.voiceManager.startListening();
      this.voiceButton.classList.add('listening');
      if (this.options.onVoiceStart) {
        this.options.onVoiceStart();
      }
    }
  }

  /**
   * Navigate command history
   */
  navigateHistory(direction) {
    if (this.commandHistory.length === 0) return;

    // Save current input when starting to navigate
    if (this.historyIndex === -1 && direction === -1) {
      this.currentInput = this.textarea.value;
    }

    const newIndex = this.historyIndex + direction;

    if (newIndex < -1) {
      return; // Can't go beyond newest
    }

    if (newIndex >= this.commandHistory.length) {
      return; // Can't go beyond oldest
    }

    this.historyIndex = newIndex;

    if (this.historyIndex === -1) {
      // Back to current input
      this.textarea.value = this.currentInput;
      this.hideHistoryPreview();
    } else {
      // Show history item (newest first)
      const historyItem = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
      this.textarea.value = historyItem || '';
      this.showHistoryPreview(this.historyIndex + 1, this.commandHistory.length, historyItem);
    }

    this.autoExpand();
    this.updateSendButton();

    // Move cursor to end
    this.textarea.selectionStart = this.textarea.value.length;
    this.textarea.selectionEnd = this.textarea.value.length;
  }

  /**
   * Show history preview tooltip
   */
  showHistoryPreview(current, total, text) {
    if (!this.historyPreview) return;
    this.historyPreviewLabel.textContent = `History (${current}/${total}):`;
    // Truncate long text for preview
    const maxLen = 60;
    const truncated = text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
    this.historyPreviewText.textContent = truncated;
    this.historyPreview.style.display = 'flex';

    // Auto-hide after a few seconds of inactivity
    clearTimeout(this._historyPreviewTimeout);
    this._historyPreviewTimeout = setTimeout(() => this.hideHistoryPreview(), 3000);
  }

  /**
   * Hide history preview tooltip
   */
  hideHistoryPreview() {
    if (!this.historyPreview) return;
    this.historyPreview.style.display = 'none';
    clearTimeout(this._historyPreviewTimeout);
  }

  /**
   * Send the message
   */
  send() {
    if (this.isDisabled || this.isLoading) return;

    const text = this.textarea.value.trim();
    const attachments = this.getAttachments();

    if (!text && attachments.length === 0) return;

    // Add to command history
    if (text) {
      this.commandHistory.push(text);
      if (this.commandHistory.length > this.options.maxHistorySize) {
        this.commandHistory.shift();
      }
    }

    // Call the onSend callback
    if (this.options.onSend) {
      this.options.onSend(text, attachments);
    }

    // Clear input
    this.clear();
  }

  /**
   * Get current input value
   */
  getValue() {
    return this.textarea.value;
  }

  /**
   * Set input value
   */
  setValue(text) {
    this.textarea.value = text;
    this.autoExpand();
    this.updateSendButton();
  }

  /**
   * Append text to current value
   */
  appendValue(text) {
    this.textarea.value += text;
    this.autoExpand();
    this.updateSendButton();
    this.focus();
  }

  /**
   * Focus the input
   */
  focus() {
    this.textarea.focus();
  }

  /**
   * Clear input and attachments
   */
  clear() {
    this.textarea.value = '';
    this.textarea.style.height = 'auto';
    this.historyIndex = -1;
    this.currentInput = '';

    if (this.fileManager) {
      this.fileManager.clearAttachments();
    }

    this.updateSendButton();
    this.focus();
  }

  /**
   * Disable/enable the input
   */
  setDisabled(disabled) {
    this.isDisabled = disabled;
    this.textarea.disabled = disabled;
    this.attachmentButton.disabled = disabled;
    this.voiceButton.disabled = disabled;
    this.wrapper.classList.toggle('disabled', disabled);
    this.updateSendButton();
  }

  /**
   * Show/hide loading state
   */
  setLoading(loading) {
    this.isLoading = loading;
    this.wrapper.classList.toggle('loading', loading);
    this.sendButton.classList.toggle('loading', loading);

    if (loading) {
      this.sendButton.innerHTML = `
        <div class="agent-send-spinner"></div>
      `;
    } else {
      this.sendButton.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2.25 9h13.5M10.5 3.75L15.75 9l-5.25 5.25" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    }

    this.updateSendButton();
  }

  /**
   * Get attachments
   */
  getAttachments() {
    return this.fileManager?.getAttachments() || [];
  }

  /**
   * Escape HTML for safe rendering
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
    this.wrapper = null;
    this.textarea = null;
    this.sendButton = null;
    this.attachmentButton = null;
    this.voiceButton = null;
    this.attachmentsContainer = null;
    this.fileManager = null;
    this.voiceManager = null;
  }

  /**
   * Add component styles
   */
  addStyles() {
    if (document.getElementById('agent-input-bar-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'agent-input-bar-styles';
    styles.textContent = `
      .agent-input-bar {
        display: flex;
        flex-direction: column;
        background: var(--donna-bg-secondary, #1c1c21);
        border-top: 1px solid var(--donna-border, rgba(255, 255, 255, 0.06));
        padding: 12px 16px;
        position: relative;
      }

      .agent-input-bar.disabled {
        opacity: 0.6;
        pointer-events: none;
      }

      .agent-input-bar.loading .agent-input-textarea {
        opacity: 0.7;
      }

      /* Attachments area */
      .agent-input-attachments {
        margin-bottom: 8px;
      }

      /* Main input wrapper */
      .agent-input-wrapper {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        background: var(--donna-bg-elevated, #232329);
        border: 1px solid var(--donna-border, rgba(255, 255, 255, 0.06));
        border-radius: 12px;
        padding: 8px 12px;
        transition: border-color var(--transition-fast, 0.1s ease),
                    box-shadow var(--transition-fast, 0.1s ease);
      }

      .agent-input-wrapper:focus-within {
        border-color: var(--donna-accent, #a78bfa);
        box-shadow: 0 0 0 2px var(--donna-accent-glow, rgba(167, 139, 250, 0.15));
      }

      /* Action buttons */
      .agent-input-actions-left,
      .agent-input-actions-right {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }

      .agent-input-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 8px;
        color: var(--donna-text-muted, #71717a);
        cursor: pointer;
        transition: all var(--transition-fast, 0.1s ease);
      }

      .agent-input-btn:hover:not(:disabled) {
        background: var(--donna-bg-hover, #2a2a32);
        color: var(--donna-text-secondary, #a1a1aa);
      }

      .agent-input-btn:active:not(:disabled) {
        background: var(--donna-bg-active, #33333d);
      }

      .agent-input-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      /* Voice button listening state */
      .agent-voice-btn.listening {
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
        animation: voicePulse 1.5s ease-in-out infinite;
      }

      @keyframes voicePulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
      }

      /* Send button */
      .agent-send-btn {
        background: var(--donna-bg-hover, #2a2a32);
      }

      .agent-send-btn.ready {
        background: var(--donna-accent, #a78bfa);
        color: white;
      }

      .agent-send-btn.ready:hover {
        background: var(--donna-accent-bright, #c4b5fd);
        transform: scale(1.05);
      }

      .agent-send-btn.loading {
        pointer-events: none;
      }

      /* Loading spinner */
      .agent-send-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      /* Textarea wrapper */
      .agent-input-textarea-wrapper {
        flex: 1;
        min-width: 0;
        position: relative;
      }

      .agent-input-textarea {
        width: 100%;
        background: transparent;
        border: none;
        color: var(--donna-text-primary, #f4f4f5);
        font-family: inherit;
        font-size: 14px;
        line-height: 1.5;
        resize: none;
        outline: none;
        padding: 4px 0;
        min-height: 24px;
        max-height: 200px;
        overflow-y: hidden;
      }

      .agent-input-textarea::placeholder {
        color: var(--donna-text-dim, #52525b);
      }

      .agent-input-textarea:disabled {
        cursor: not-allowed;
      }

      /* Voice preview */
      .agent-input-voice-preview {
        position: absolute;
        top: -40px;
        left: 0;
        right: 0;
        background: var(--donna-bg-elevated, #232329);
        border: 1px solid var(--donna-border, rgba(255, 255, 255, 0.06));
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 13px;
        color: var(--donna-text-secondary, #a1a1aa);
        font-style: italic;
      }

      /* Footer */
      .agent-input-footer {
        display: flex;
        justify-content: flex-end;
        padding: 8px 4px 0;
      }

      .agent-input-hint {
        font-size: 11px;
        color: var(--donna-text-dim, #52525b);
      }

      .agent-input-hint kbd {
        display: inline-block;
        padding: 2px 5px;
        font-family: inherit;
        font-size: 10px;
        background: var(--donna-bg-elevated, #232329);
        border: 1px solid var(--donna-border, rgba(255, 255, 255, 0.06));
        border-radius: 4px;
        margin: 0 2px;
      }

      /* Drop zone overlay (from FileAttachmentManager) */
      .agent-input-bar .file-drop-zone {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .agent-input-bar .file-drop-zone.active {
        pointer-events: auto;
      }

      .agent-input-bar .file-drop-overlay {
        border-radius: 12px;
      }

      /* File attachment cards in our context */
      .agent-input-attachments .file-attachments {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 0;
      }

      .agent-input-attachments .file-attachment-card {
        background: var(--donna-bg-elevated, #232329);
        border-color: var(--donna-border, rgba(255, 255, 255, 0.06));
      }

      /* History preview tooltip */
      .agent-input-history-preview {
        position: absolute;
        bottom: 100%;
        left: 16px;
        right: 16px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--donna-bg-elevated, #232329);
        border: 1px solid var(--donna-border, rgba(255, 255, 255, 0.06));
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10;
        animation: historyPreviewFadeIn 0.15s ease;
      }

      @keyframes historyPreviewFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .history-preview-label {
        color: var(--donna-accent, #a78bfa);
        font-weight: 500;
        flex-shrink: 0;
      }

      .history-preview-text {
        color: var(--donna-text-secondary, #a1a1aa);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(styles);
  }
}

// Export for use in other modules
window.AgentInputBar = AgentInputBar;
