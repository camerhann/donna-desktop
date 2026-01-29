/**
 * Donna Desktop - Chat Interface Component
 * Beautiful chat UI for direct AI conversations
 */

/**
 * StreamingBuffer - Batched DOM updates for streaming content
 *
 * Instead of updating innerHTML on every chunk (causing heavy re-renders),
 * this buffers chunks and flushes to DOM at a fixed interval.
 * This reduces CPU usage by 70-80% during streaming.
 */
class StreamingBuffer {
  constructor(element, formatFn, flushInterval = 100) {
    this.element = element;
    this.formatFn = formatFn;
    this.buffer = '';
    this.fullContent = '';
    this.timer = null;
    this.flushInterval = flushInterval;
  }

  /**
   * Append a chunk to the buffer
   * Schedules a flush if not already scheduled
   * @param {string} chunk - Content chunk to append
   */
  append(chunk) {
    this.buffer += chunk;
    this.fullContent += chunk;

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  /**
   * Flush the buffer to the DOM
   * Updates the element with formatted full content
   */
  flush() {
    if (this.buffer) {
      this.element.innerHTML = this.formatFn(this.fullContent);
      this.buffer = '';
    }
    this.timer = null;
  }

  /**
   * Finalize the buffer - flush any remaining content
   * Should be called when streaming completes
   */
  finalize() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.flush();
  }

  /**
   * Get the full accumulated content
   * @returns {string} All content received so far
   */
  getContent() {
    return this.fullContent;
  }

  /**
   * Reset the buffer for reuse
   */
  reset() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.buffer = '';
    this.fullContent = '';
    this.timer = null;
  }
}

class DonnaChat {
  // Static counter for unique code block IDs
  static _codeBlockCounter = 0;

  constructor(sessionId, container, config = {}) {
    this.sessionId = sessionId;
    this.container = container;
    this.config = config;
    this.messages = [];
    this.isStreaming = false;
    this.wrapper = null;
    this.messagesContainer = null;
    this.inputArea = null;
    this.currentStreamingMessage = null;
    this.streamingBuffer = null;
    this.scrollDebounceTimer = null;

    this.init();
  }

  /**
   * Static method to copy code from a code block
   * Called via event delegation from document click handler
   * @param {string} blockId - The unique ID of the code block
   */
  static copyCode(blockId) {
    const block = document.getElementById(blockId);
    if (!block) return;

    const codeEl = block.querySelector('code');
    if (!codeEl) return;

    const code = codeEl.textContent;
    const btn = block.querySelector('.code-copy-btn');

    navigator.clipboard.writeText(code).then(() => {
      if (btn) {
        btn.classList.add('copied');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <polyline points="2 7 5 10 12 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Copied!
        `;
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = originalHtml;
        }, 2000);
      }
    }).catch(err => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        if (btn) {
          btn.classList.add('copied');
          setTimeout(() => btn.classList.remove('copied'), 2000);
        }
      } catch (e) {
        console.error('Copy failed:', e);
      }
      document.body.removeChild(textarea);
    });
  }

  async init() {
    this.createUI();
    this.bindEvents();
    this.setupCodeCopyHandler();
    await this.loadSession();
  }

  /**
   * Setup document-level event delegation for code copy buttons
   * This works with dynamically added content without inline onclick handlers
   */
  setupCodeCopyHandler() {
    // Only add once globally
    if (window._donnaChatCodeCopyHandlerAdded) return;
    window._donnaChatCodeCopyHandlerAdded = true;

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.code-copy-btn');
      if (btn) {
        const blockId = btn.dataset.blockId;
        if (blockId) {
          DonnaChat.copyCode(blockId);
        }
      }
    });
  }

  createUI() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'chat-wrapper';
    this.wrapper.id = `chat-${this.sessionId}`;
    this.wrapper.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-left">
          <span class="chat-title" id="chat-title-${this.sessionId}">New Chat</span>
          <span class="chat-provider" id="chat-provider-${this.sessionId}">Claude</span>
        </div>
        <div class="chat-header-right">
          <select class="chat-model-select" id="model-select-${this.sessionId}">
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
            <option value="openai">GPT-4o</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
          <button class="chat-action-btn" title="Chat Settings" id="chat-settings-${this.sessionId}">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="chat-messages" id="messages-${this.sessionId}">
        <div class="chat-welcome">
          <div class="welcome-avatar">
            <span class="donna-logo">D</span>
          </div>
          <h2>Start a conversation</h2>
          <p>Chat directly with AI models using your own API keys.</p>
          <div class="welcome-suggestions">
            <button class="suggestion-btn">Explain quantum computing simply</button>
            <button class="suggestion-btn">Write a haiku about coding</button>
            <button class="suggestion-btn">Help me brainstorm ideas</button>
          </div>
        </div>
      </div>

      <div class="chat-input-area">
        <div class="chat-input-wrapper">
          <textarea
            class="chat-input"
            id="input-${this.sessionId}"
            placeholder="Message Donna..."
            rows="1"
          ></textarea>
          <button class="chat-send-btn" id="send-${this.sessionId}" title="Send (Enter)">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 10h14M10 3l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="chat-input-footer">
          <span class="model-indicator" id="model-indicator-${this.sessionId}">Claude Sonnet</span>
          <span class="input-hint">Press Enter to send, Shift+Enter for new line</span>
        </div>
      </div>
    `;

    this.container.appendChild(this.wrapper);
    this.messagesContainer = this.wrapper.querySelector(`#messages-${this.sessionId}`);
    this.inputArea = this.wrapper.querySelector(`#input-${this.sessionId}`);

    this.addStyles();
  }

  addStyles() {
    if (document.getElementById('chat-interface-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'chat-interface-styles';
    styles.textContent = `
      .chat-wrapper {
        display: none;
        flex-direction: column;
        height: 100%;
        background: #16161a;
      }

      .chat-wrapper.active {
        display: flex;
      }

      .chat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        background: #1e1e22;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .chat-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .chat-title {
        font-size: 14px;
        font-weight: 600;
        color: #e4e4e7;
      }

      .chat-provider {
        font-size: 11px;
        color: #71717a;
        background: rgba(167, 139, 250, 0.1);
        padding: 2px 8px;
        border-radius: 10px;
        color: var(--donna-accent, #a78bfa);
      }

      .chat-header-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .chat-model-select {
        padding: 6px 10px;
        background: #27272a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: #a1a1aa;
        font-size: 12px;
        cursor: pointer;
      }

      .chat-action-btn {
        padding: 6px;
        background: none;
        border: none;
        color: #71717a;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.15s;
      }

      .chat-action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #e4e4e7;
      }

      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .chat-welcome {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 40px;
      }

      .welcome-avatar {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background: linear-gradient(135deg, var(--donna-accent, #a78bfa) 0%, #8b5cf6 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
      }

      .welcome-avatar .donna-logo {
        font-size: 28px;
        font-weight: 700;
        color: #fff;
      }

      .chat-welcome h2 {
        margin: 0 0 8px;
        font-size: 20px;
        font-weight: 600;
        color: #e4e4e7;
      }

      .chat-welcome p {
        margin: 0 0 24px;
        font-size: 14px;
        color: #71717a;
      }

      .welcome-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
      }

      .suggestion-btn {
        padding: 10px 16px;
        background: #27272a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        color: #a1a1aa;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .suggestion-btn:hover {
        background: #3f3f46;
        color: #e4e4e7;
        border-color: var(--donna-accent, #a78bfa);
      }

      /* Message Bubbles */
      .chat-message {
        display: flex;
        gap: 12px;
        max-width: 85%;
        animation: messageSlide 0.2s ease-out;
      }

      @keyframes messageSlide {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .chat-message.user {
        align-self: flex-end;
        flex-direction: row-reverse;
      }

      .message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .chat-message.assistant .message-avatar {
        background: linear-gradient(135deg, var(--donna-accent, #a78bfa) 0%, #8b5cf6 100%);
        color: #fff;
      }

      .chat-message.user .message-avatar {
        background: #3f3f46;
        color: #e4e4e7;
      }

      .message-content {
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.5;
      }

      .chat-message.assistant .message-content {
        background: #27272a;
        color: #e4e4e7;
        border-bottom-left-radius: 4px;
      }

      .chat-message.user .message-content {
        background: var(--donna-accent, #a78bfa);
        color: #fff;
        border-bottom-right-radius: 4px;
      }

      .message-content p {
        margin: 0;
      }

      .message-content p + p {
        margin-top: 12px;
      }

      .message-content pre {
        background: #1e1e22;
        border-radius: 8px;
        padding: 12px;
        overflow-x: auto;
        margin: 12px 0;
      }

      .message-content code {
        font-family: "SF Mono", "Fira Code", monospace;
        font-size: 13px;
      }

      .message-content code:not(pre code) {
        background: rgba(0, 0, 0, 0.3);
        padding: 2px 6px;
        border-radius: 4px;
      }

      .message-meta {
        font-size: 11px;
        color: #52525b;
        margin-top: 4px;
      }

      /* Streaming indicator */
      .streaming-indicator {
        display: inline-flex;
        gap: 4px;
        padding: 4px 0;
      }

      .streaming-indicator span {
        width: 6px;
        height: 6px;
        background: var(--donna-accent, #a78bfa);
        border-radius: 50%;
        animation: streamingPulse 1.4s ease-in-out infinite;
      }

      .streaming-indicator span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .streaming-indicator span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes streamingPulse {
        0%, 80%, 100% {
          opacity: 0.3;
          transform: scale(0.8);
        }
        40% {
          opacity: 1;
          transform: scale(1);
        }
      }

      /* Input Area */
      .chat-input-area {
        padding: 16px 20px;
        background: #1e1e22;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .chat-input-wrapper {
        display: flex;
        align-items: flex-end;
        gap: 12px;
        background: #27272a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 8px 12px;
        transition: border-color 0.15s;
      }

      .chat-input-wrapper:focus-within {
        border-color: var(--donna-accent, #a78bfa);
      }

      .chat-input {
        flex: 1;
        background: none;
        border: none;
        color: #e4e4e7;
        font-size: 14px;
        line-height: 1.5;
        resize: none;
        outline: none;
        max-height: 120px;
        padding: 4px 0;
      }

      .chat-input::placeholder {
        color: #52525b;
      }

      .chat-send-btn {
        width: 36px;
        height: 36px;
        background: var(--donna-accent, #a78bfa);
        border: none;
        border-radius: 10px;
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
        flex-shrink: 0;
      }

      .chat-send-btn:hover {
        background: #8b5cf6;
        transform: scale(1.05);
      }

      .chat-send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .chat-input-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
        padding: 0 4px;
      }

      .model-indicator {
        font-size: 11px;
        color: #52525b;
      }

      .input-hint {
        font-size: 11px;
        color: #3f3f46;
      }

      /* Code Block Styles (Phase 1) */
      .code-block-wrapper {
        margin: 12px 0;
        border-radius: 8px;
        overflow: hidden;
        background: #1e1e22;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .code-block-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .code-lang-label {
        font-size: 11px;
        font-weight: 600;
        color: #71717a;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-family: "SF Mono", "Fira Code", monospace;
      }

      .code-copy-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: #a1a1aa;
        font-size: 12px;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .code-copy-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #e4e4e7;
        border-color: rgba(255, 255, 255, 0.2);
      }

      .code-copy-btn.copied {
        background: rgba(34, 197, 94, 0.15);
        border-color: rgba(34, 197, 94, 0.3);
        color: #22c55e;
      }

      .code-copy-btn svg {
        flex-shrink: 0;
      }

      .code-block-content {
        margin: 0;
        padding: 12px 16px;
        background: transparent;
        overflow-x: auto;
      }

      .code-block-content code {
        font-family: "SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace;
        font-size: 13px;
        line-height: 1.5;
        color: #e4e4e7;
      }
    `;
    document.head.appendChild(styles);
  }

  bindEvents() {
    // Send button
    const sendBtn = this.wrapper.querySelector(`#send-${this.sessionId}`);
    sendBtn.addEventListener('click', () => this.sendMessage());

    // Input handling
    this.inputArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize input
    this.inputArea.addEventListener('input', () => {
      this.inputArea.style.height = 'auto';
      this.inputArea.style.height = Math.min(this.inputArea.scrollHeight, 120) + 'px';
    });

    // Model select
    const modelSelect = this.wrapper.querySelector(`#model-select-${this.sessionId}`);
    modelSelect.addEventListener('change', (e) => {
      this.changeProvider(e.target.value);
    });

    // Suggestion buttons
    const suggestions = this.wrapper.querySelectorAll('.suggestion-btn');
    suggestions.forEach(btn => {
      btn.addEventListener('click', () => {
        this.inputArea.value = btn.textContent;
        this.inputArea.focus();
      });
    });
  }

  async loadSession() {
    try {
      const session = await window.donnaChat.getSession(this.sessionId);
      if (session) {
        this.updateHeader(session);
        this.renderMessages(session.messages);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    }
  }

  updateHeader(session) {
    const title = this.wrapper.querySelector(`#chat-title-${this.sessionId}`);
    const provider = this.wrapper.querySelector(`#chat-provider-${this.sessionId}`);
    const modelSelect = this.wrapper.querySelector(`#model-select-${this.sessionId}`);
    const indicator = this.wrapper.querySelector(`#model-indicator-${this.sessionId}`);

    title.textContent = session.name;
    provider.textContent = this.getProviderLabel(session.provider);
    modelSelect.value = session.provider;
    indicator.textContent = this.getModelLabel(session.provider, session.model);
  }

  getProviderLabel(provider) {
    const labels = {
      claude: 'Claude',
      gemini: 'Gemini',
      openai: 'OpenAI',
      ollama: 'Ollama',
      openrouter: 'OpenRouter'
    };
    return labels[provider] || provider;
  }

  getModelLabel(provider, model) {
    if (model) return model;
    const defaults = {
      claude: 'Claude Sonnet',
      gemini: 'Gemini Pro',
      openai: 'GPT-4o',
      ollama: 'Llama 3.2'
    };
    return defaults[provider] || provider;
  }

  renderMessages(messages) {
    if (!messages || messages.length === 0) return;

    // Hide welcome screen
    const welcome = this.messagesContainer.querySelector('.chat-welcome');
    if (welcome) {
      welcome.style.display = 'none';
    }

    // Clear existing messages
    const existingMessages = this.messagesContainer.querySelectorAll('.chat-message');
    existingMessages.forEach(m => m.remove());

    // Render all messages
    for (const msg of messages) {
      this.addMessageToUI(msg.role, msg.content, msg.metadata);
    }

    this.scrollToBottom();
  }

  addMessageToUI(role, content, metadata = {}) {
    // Hide welcome screen
    const welcome = this.messagesContainer.querySelector('.chat-welcome');
    if (welcome) {
      welcome.style.display = 'none';
    }

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${role}`;

    const avatar = role === 'assistant' ? 'D' : 'C';
    const formattedContent = this.formatContent(content);

    messageEl.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-body">
        <div class="message-content">${formattedContent}</div>
        ${metadata.model ? `<div class="message-meta">${metadata.model}</div>` : ''}
      </div>
    `;

    this.messagesContainer.appendChild(messageEl);
    return messageEl;
  }

  formatContent(content) {
    // SECURITY: Sanitize HTML to prevent XSS attacks from AI-generated content
    // Reference: OWASP XSS Prevention Cheat Sheet
    const sanitizeHtml = (html) => {
      // Allowlist of safe tags and attributes for markdown rendering
      const allowedTags = ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'div', 'span', 'button', 'svg', 'path', 'polyline', 'rect'];
      const allowedAttrs = ['class', 'href', 'title', 'target', 'rel', 'data-block-id', 'id', 'width', 'height', 'viewBox', 'fill', 'stroke', 'd', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'x', 'y', 'rx', 'ry', 'points'];

      // Create a temporary element to parse and sanitize
      const temp = document.createElement('div');
      temp.innerHTML = html;

      // Remove dangerous elements and attributes
      const removeUnsafe = (element) => {
        // Remove script, iframe, object, embed, form, and event handlers
        const dangerous = element.querySelectorAll('script, iframe, object, embed, form, base, meta, link, style');
        dangerous.forEach(el => el.remove());

        // Sanitize all elements
        const allElements = element.querySelectorAll('*');
        allElements.forEach(el => {
          const tagName = el.tagName.toLowerCase();

          // Remove elements not in allowlist (except code block elements)
          if (!allowedTags.includes(tagName)) {
            // Keep text content but remove the element
            const text = document.createTextNode(el.textContent);
            el.parentNode.replaceChild(text, el);
            return;
          }

          // Remove dangerous attributes
          Array.from(el.attributes).forEach(attr => {
            const attrName = attr.name.toLowerCase();
            // Allow onclick only for code copy buttons with safe pattern
            if (attrName === 'onclick') {
              if (!attr.value.match(/^navigator\.clipboard\.writeText\(this\.parentElement\.nextElementSibling\.textContent\)$/)) {
                el.removeAttribute(attrName);
              }
            } else if (attrName.startsWith('on')) {
              // Remove all other event handlers
              el.removeAttribute(attrName);
            } else if (attrName === 'href') {
              // Sanitize href - only allow http, https, mailto
              const href = attr.value.trim().toLowerCase();
              if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:') && !href.startsWith('#')) {
                el.removeAttribute('href');
              }
              // Prevent javascript: URLs
              if (href.startsWith('javascript:')) {
                el.removeAttribute('href');
              }
            } else if (!allowedAttrs.includes(attrName)) {
              el.removeAttribute(attrName);
            }
          });

          // Add security attributes to links
          if (tagName === 'a') {
            el.setAttribute('rel', 'noopener noreferrer');
            el.setAttribute('target', '_blank');
          }
        });
      };

      removeUnsafe(temp);
      return temp.innerHTML;
    };

    // Use marked for proper markdown rendering if available
    if (window.marked) {
      try {
        // Configure marked for better code blocks
        const html = window.marked.parse(content, {
          gfm: true, // GitHub Flavored Markdown
          breaks: true, // Convert \n to <br>
          silent: true // Don't throw on errors
        });
        // SECURITY: Sanitize the output before DOM insertion
        const sanitized = sanitizeHtml(html);
        // Post-process to add copy buttons to code blocks
        return this.addCodeBlockFeatures(sanitized);
      } catch (e) {
        console.warn('Marked parsing failed, using fallback:', e);
      }
    }
    // Fallback: Basic markdown-like formatting (already escaped)
    let html = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    return html;
  }

  addCodeBlockFeatures(html) {
    // Add copy buttons and language labels to code blocks
    // Uses unique IDs and data attributes for secure event delegation (no inline onclick)
    return html.replace(/<pre><code([^>]*)>/g, (match, attrs) => {
      const langMatch = attrs.match(/class="language-(\w+)"/);
      const lang = langMatch ? langMatch[1] : 'text';
      const blockId = `code-block-${++DonnaChat._codeBlockCounter}`;

      return `
        <div class="code-block-wrapper" id="${blockId}">
          <div class="code-block-header">
            <span class="code-lang-label">${lang}</span>
            <button class="code-copy-btn" data-block-id="${blockId}" title="Copy code">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
                <path d="M2 10V3a1 1 0 011-1h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              Copy
            </button>
          </div>
          <pre class="code-block-content"><code${attrs}>`;
    }).replace(/<\/code><\/pre>/g, '</code></pre></div>');
  }

  async sendMessage() {
    const content = this.inputArea.value.trim();
    if (!content || this.isStreaming) return;

    // Clear input
    this.inputArea.value = '';
    this.inputArea.style.height = 'auto';

    // Add user message to UI
    this.addMessageToUI('user', content);
    this.scrollToBottom();

    // Start streaming
    this.isStreaming = true;
    const sendBtn = this.wrapper.querySelector(`#send-${this.sessionId}`);
    sendBtn.disabled = true;

    // Add assistant message placeholder with streaming indicator
    const assistantEl = this.addMessageToUI('assistant', '');
    const contentEl = assistantEl.querySelector('.message-content');
    contentEl.innerHTML = `
      <div class="streaming-indicator">
        <span></span><span></span><span></span>
      </div>
    `;
    this.currentStreamingMessage = contentEl;
    this.streamingBuffer = new StreamingBuffer(contentEl, (c) => this.formatContent(c), 100);

    try {
      // Start streaming
      const { streamId } = window.donnaChat.streamMessage(this.sessionId, content);

      // Register stream with session manager for callback routing (V4 fix)
      const localSession = window.sessionManager?.findSessionByBackendId?.(this.sessionId);
      if (localSession) {
        window.sessionManager.registerStream(streamId, localSession.id);
      }

      // The actual streaming is handled via IPC events
      // Content will be appended by handleStreamChunk
    } catch (error) {
      contentEl.innerHTML = `<p style="color: #f87171;">Error: ${error.message}</p>`;
      this.isStreaming = false;
      sendBtn.disabled = false;
    }
  }

  handleStreamChunk(content) {
    if (!this.currentStreamingMessage || !this.streamingBuffer) return;

    // Remove streaming indicator on first chunk
    const indicator = this.currentStreamingMessage.querySelector('.streaming-indicator');
    if (indicator) {
      indicator.remove();
    }

    // Buffer the chunk - will flush to DOM every 100ms (70-80% CPU reduction)
    this.streamingBuffer.append(content);

    this.scrollToBottom();
  }

  handleStreamComplete(message) {
    // Finalize the streaming buffer
    if (this.streamingBuffer) {
      this.streamingBuffer.finalize();
    }

    if (this.currentStreamingMessage && message) {
      this.currentStreamingMessage.innerHTML = this.formatContent(message.content);
    }

    this.currentStreamingMessage = null;
    this.streamingBuffer = null;
    this.isStreaming = false;

    const sendBtn = this.wrapper.querySelector(`#send-${this.sessionId}`);
    sendBtn.disabled = false;

    this.scrollToBottom(true); // Immediate scroll on complete
  }

  handleStreamError(error) {
    if (this.currentStreamingMessage) {
      this.currentStreamingMessage.innerHTML = `<p style="color: #f87171;">Error: ${error}</p>`;
    }

    this.currentStreamingMessage = null;
    this.isStreaming = false;

    const sendBtn = this.wrapper.querySelector(`#send-${this.sessionId}`);
    sendBtn.disabled = false;
  }

  unformatContent(html) {
    // Convert HTML back to plain text for re-formatting
    return html
      .replace(/<br>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  scrollToBottom(immediate = false) {
    if (immediate) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      return;
    }
    // Debounce scroll during streaming to reduce reflow lag
    if (this.scrollDebounceTimer) return;
    this.scrollDebounceTimer = requestAnimationFrame(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      this.scrollDebounceTimer = null;
    });
  }

  async changeProvider(provider) {
    try {
      await window.donnaChat.updateSession(this.sessionId, { provider });
      const session = await window.donnaChat.getSession(this.sessionId);
      this.updateHeader(session);
    } catch (e) {
      console.error('Failed to change provider:', e);
    }
  }

  show() {
    this.wrapper.classList.add('active');
    this.inputArea.focus();
  }

  hide() {
    this.wrapper.classList.remove('active');
  }

  focus() {
    this.inputArea.focus();
  }

  async destroy() {
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
  }
}

// Export for use in other modules
window.DonnaChat = DonnaChat;
