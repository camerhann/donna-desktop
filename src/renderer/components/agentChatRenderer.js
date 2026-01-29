/**
 * AgentChatRenderer - Rich Chat UI for Agent Sessions
 *
 * Renders parsed Claude Code output as beautiful chat bubbles with:
 * - User/Assistant message styling
 * - Streaming text animation
 * - Syntax-highlighted code blocks with copy buttons
 * - Collapsible tool call sections
 * - Markdown rendering
 * - Link previews
 * - File attachment cards
 */

class AgentChatRenderer {
  // Static counter for unique IDs
  static _idCounter = 0;

  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      showAvatars: true,
      showTimestamps: false,
      enableLinkPreviews: true,
      enableSyntaxHighlighting: true,
      streamingFlushInterval: 50, // ms
      maxToolPreviewLength: 200,
      ...options
    };

    this.messages = [];
    this.currentStreamingMessage = null;
    this.streamingBuffer = null;
    this.scrollDebounceTimer = null;

    // Create the messages container
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.className = 'agent-chat-messages';
    this.container.appendChild(this.messagesContainer);

    this.addStyles();
    this.setupEventDelegation();
  }

  /**
   * Generate a unique ID
   */
  static generateId(prefix = 'acr') {
    return `${prefix}-${++AgentChatRenderer._idCounter}-${Date.now().toString(36)}`;
  }

  /**
   * Setup event delegation for interactive elements
   */
  setupEventDelegation() {
    // Only add once globally
    if (window._agentChatRendererEventsAdded) return;
    window._agentChatRendererEventsAdded = true;

    document.addEventListener('click', (e) => {
      // Handle code copy buttons
      const copyBtn = e.target.closest('.acr-code-copy-btn');
      if (copyBtn) {
        const blockId = copyBtn.dataset.blockId;
        if (blockId) {
          AgentChatRenderer.copyCode(blockId, copyBtn);
        }
        return;
      }

      // Handle tool call expand/collapse
      const toolHeader = e.target.closest('.acr-tool-header');
      if (toolHeader) {
        const toolCall = toolHeader.closest('.acr-tool-call');
        if (toolCall) {
          toolCall.classList.toggle('expanded');
        }
        return;
      }
    });
  }

  /**
   * Copy code from a code block
   */
  static copyCode(blockId, btn) {
    const block = document.getElementById(blockId);
    if (!block) return;

    const codeEl = block.querySelector('code');
    if (!codeEl) return;

    const code = codeEl.textContent;

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
      console.error('Copy failed:', err);
    });
  }

  /**
   * Add a complete message to the chat
   * @param {Object} message - Message object
   * @param {string} message.role - 'user' or 'assistant'
   * @param {string} message.content - Message content
   * @param {Object} [message.metadata] - Optional metadata (model, timestamp, etc.)
   */
  addMessage(message) {
    const { role, content, metadata = {} } = message;

    const messageEl = this.createMessageElement(role, content, metadata);
    this.messagesContainer.appendChild(messageEl);
    this.messages.push({ role, content, metadata, element: messageEl });

    // Process link previews for assistant messages
    if (role === 'assistant' && this.options.enableLinkPreviews && window.linkPreviewRenderer) {
      const contentEl = messageEl.querySelector('.acr-message-content');
      if (contentEl) {
        window.linkPreviewRenderer.processMessage(contentEl);
      }
    }

    this.scrollToBottom();
    return messageEl;
  }

  /**
   * Create a message element
   */
  createMessageElement(role, content, metadata = {}) {
    const messageEl = document.createElement('div');
    messageEl.className = `acr-message acr-message-${role}`;
    messageEl.dataset.role = role;

    const formattedContent = this.formatContent(content);
    const avatar = this.options.showAvatars ? this.createAvatar(role) : '';
    const timestamp = metadata.timestamp ? this.formatTimestamp(metadata.timestamp) : '';

    messageEl.innerHTML = `
      ${avatar}
      <div class="acr-message-body">
        <div class="acr-message-content">${formattedContent}</div>
        ${metadata.model || timestamp ? `
          <div class="acr-message-meta">
            ${metadata.model ? `<span class="acr-message-model">${this.escapeHtml(metadata.model)}</span>` : ''}
            ${timestamp ? `<span class="acr-message-time">${timestamp}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;

    return messageEl;
  }

  /**
   * Create avatar HTML
   */
  createAvatar(role) {
    const avatarChar = role === 'assistant' ? 'A' : 'U';
    return `<div class="acr-message-avatar acr-avatar-${role}">${avatarChar}</div>`;
  }

  /**
   * Start streaming a new assistant message
   * @returns {Object} Streaming context with appendChunk and end methods
   */
  startStreaming() {
    // Create placeholder message
    const messageEl = document.createElement('div');
    messageEl.className = 'acr-message acr-message-assistant acr-streaming';
    messageEl.dataset.role = 'assistant';

    const avatar = this.options.showAvatars ? this.createAvatar('assistant') : '';

    messageEl.innerHTML = `
      ${avatar}
      <div class="acr-message-body">
        <div class="acr-message-content">
          <div class="acr-streaming-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    `;

    this.messagesContainer.appendChild(messageEl);

    const contentEl = messageEl.querySelector('.acr-message-content');
    this.currentStreamingMessage = {
      element: messageEl,
      contentElement: contentEl,
      fullContent: ''
    };

    // Create streaming buffer for batched DOM updates
    this.streamingBuffer = new StreamingBuffer(
      contentEl,
      (text) => this.formatContent(text),
      this.options.streamingFlushInterval
    );

    this.scrollToBottom();

    return {
      appendChunk: (text) => this.appendChunk(text),
      end: (metadata) => this.endStreaming(metadata)
    };
  }

  /**
   * Append a chunk to the current streaming message
   * @param {string} text - Text chunk to append
   */
  appendChunk(text) {
    if (!this.currentStreamingMessage || !this.streamingBuffer) return;

    // Remove streaming indicator on first chunk
    const indicator = this.currentStreamingMessage.contentElement.querySelector('.acr-streaming-indicator');
    if (indicator) {
      indicator.remove();
    }

    // Buffer the chunk
    this.streamingBuffer.append(text);
    this.scrollToBottom();
  }

  /**
   * End streaming and finalize the message
   * @param {Object} [metadata] - Optional metadata to add to the message
   */
  endStreaming(metadata = {}) {
    if (!this.currentStreamingMessage) return;

    // Finalize buffer
    if (this.streamingBuffer) {
      this.streamingBuffer.finalize();
    }

    const messageEl = this.currentStreamingMessage.element;
    const contentEl = this.currentStreamingMessage.contentElement;
    const finalContent = this.streamingBuffer?.getContent() || '';

    messageEl.classList.remove('acr-streaming');

    // Re-render content with full formatting
    contentEl.innerHTML = this.formatContent(finalContent);

    // Add metadata if provided
    if (metadata.model || metadata.timestamp) {
      const metaEl = document.createElement('div');
      metaEl.className = 'acr-message-meta';
      metaEl.innerHTML = `
        ${metadata.model ? `<span class="acr-message-model">${this.escapeHtml(metadata.model)}</span>` : ''}
        ${metadata.timestamp ? `<span class="acr-message-time">${this.formatTimestamp(metadata.timestamp)}</span>` : ''}
      `;
      messageEl.querySelector('.acr-message-body').appendChild(metaEl);
    }

    // Process link previews
    if (this.options.enableLinkPreviews && window.linkPreviewRenderer) {
      window.linkPreviewRenderer.processMessage(contentEl);
    }

    // Store in messages array
    this.messages.push({
      role: 'assistant',
      content: finalContent,
      metadata,
      element: messageEl
    });

    // Clean up
    this.currentStreamingMessage = null;
    this.streamingBuffer = null;

    this.scrollToBottom(true);
  }

  /**
   * Add a standalone code block
   * @param {string} code - The code content
   * @param {string} [language='text'] - Programming language
   * @param {Object} [options] - Additional options
   */
  addCodeBlock(code, language = 'text', options = {}) {
    const blockEl = document.createElement('div');
    blockEl.className = 'acr-standalone-code-block';

    const codeHtml = this.createCodeBlockHtml(code, language, options);
    blockEl.innerHTML = codeHtml;

    this.messagesContainer.appendChild(blockEl);
    this.scrollToBottom();

    return blockEl;
  }

  /**
   * Add a tool call display
   * @param {Object} tool - Tool call information
   * @param {string} tool.name - Tool name
   * @param {string} tool.status - 'running' | 'complete' | 'error'
   * @param {Object|string} [tool.input] - Tool input
   * @param {Object|string} [tool.output] - Tool output
   * @param {string} [tool.error] - Error message if status is 'error'
   */
  addToolCall(tool) {
    const { name, status = 'running', input, output, error } = tool;

    const toolEl = document.createElement('div');
    const toolId = AgentChatRenderer.generateId('tool');
    toolEl.id = toolId;
    toolEl.className = `acr-tool-call acr-tool-${status}`;
    toolEl.dataset.toolName = name;
    toolEl.dataset.status = status;

    const statusIcon = this.getStatusIcon(status);
    const inputPreview = this.formatToolData(input, this.options.maxToolPreviewLength);
    const outputPreview = this.formatToolData(output, this.options.maxToolPreviewLength);

    toolEl.innerHTML = `
      <div class="acr-tool-header">
        <div class="acr-tool-status">${statusIcon}</div>
        <div class="acr-tool-name">${this.escapeHtml(name)}</div>
        <div class="acr-tool-expand-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
      <div class="acr-tool-body">
        ${input !== undefined ? `
          <div class="acr-tool-section">
            <div class="acr-tool-section-label">Input</div>
            <div class="acr-tool-section-content">${inputPreview}</div>
          </div>
        ` : ''}
        ${output !== undefined ? `
          <div class="acr-tool-section">
            <div class="acr-tool-section-label">Output</div>
            <div class="acr-tool-section-content">${outputPreview}</div>
          </div>
        ` : ''}
        ${error ? `
          <div class="acr-tool-section acr-tool-error">
            <div class="acr-tool-section-label">Error</div>
            <div class="acr-tool-section-content">${this.escapeHtml(error)}</div>
          </div>
        ` : ''}
      </div>
    `;

    this.messagesContainer.appendChild(toolEl);
    this.scrollToBottom();

    return {
      element: toolEl,
      updateStatus: (newStatus) => this.updateToolStatus(toolId, newStatus),
      setOutput: (newOutput) => this.setToolOutput(toolId, newOutput),
      setError: (errorMsg) => this.setToolError(toolId, errorMsg)
    };
  }

  /**
   * Update a tool call's status
   */
  updateToolStatus(toolId, status) {
    const toolEl = document.getElementById(toolId);
    if (!toolEl) return;

    toolEl.className = `acr-tool-call acr-tool-${status}`;
    toolEl.dataset.status = status;

    const statusEl = toolEl.querySelector('.acr-tool-status');
    if (statusEl) {
      statusEl.innerHTML = this.getStatusIcon(status);
    }
  }

  /**
   * Set a tool call's output
   */
  setToolOutput(toolId, output) {
    const toolEl = document.getElementById(toolId);
    if (!toolEl) return;

    let outputSection = toolEl.querySelector('.acr-tool-section:nth-child(2)');
    if (!outputSection) {
      outputSection = document.createElement('div');
      outputSection.className = 'acr-tool-section';
      outputSection.innerHTML = `
        <div class="acr-tool-section-label">Output</div>
        <div class="acr-tool-section-content"></div>
      `;
      toolEl.querySelector('.acr-tool-body').appendChild(outputSection);
    }

    const contentEl = outputSection.querySelector('.acr-tool-section-content');
    if (contentEl) {
      contentEl.innerHTML = this.formatToolData(output, this.options.maxToolPreviewLength);
    }
  }

  /**
   * Set a tool call's error
   */
  setToolError(toolId, error) {
    const toolEl = document.getElementById(toolId);
    if (!toolEl) return;

    this.updateToolStatus(toolId, 'error');

    let errorSection = toolEl.querySelector('.acr-tool-error');
    if (!errorSection) {
      errorSection = document.createElement('div');
      errorSection.className = 'acr-tool-section acr-tool-error';
      errorSection.innerHTML = `
        <div class="acr-tool-section-label">Error</div>
        <div class="acr-tool-section-content"></div>
      `;
      toolEl.querySelector('.acr-tool-body').appendChild(errorSection);
    }

    const contentEl = errorSection.querySelector('.acr-tool-section-content');
    if (contentEl) {
      contentEl.textContent = error;
    }
  }

  /**
   * Get status icon SVG
   */
  getStatusIcon(status) {
    switch (status) {
      case 'running':
        return `<div class="acr-status-spinner"></div>`;
      case 'complete':
        return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
          <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case 'error':
        return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>`;
      default:
        return '';
    }
  }

  /**
   * Format tool input/output data
   */
  formatToolData(data, maxLength) {
    if (data === undefined || data === null) return '';

    let str;
    if (typeof data === 'string') {
      str = data;
    } else {
      try {
        str = JSON.stringify(data, null, 2);
      } catch {
        str = String(data);
      }
    }

    // Truncate if too long
    if (str.length > maxLength) {
      str = str.substring(0, maxLength) + '...';
    }

    return `<pre class="acr-tool-data"><code>${this.escapeHtml(str)}</code></pre>`;
  }

  /**
   * Add a file attachment card
   * @param {Object} file - File information
   */
  addFileAttachment(file) {
    const fileEl = document.createElement('div');
    fileEl.className = 'acr-file-attachment';

    const icon = this.getFileIcon(file.type || file.mimeType);
    const size = this.formatFileSize(file.size);

    fileEl.innerHTML = `
      ${file.thumbnail ? `
        <div class="acr-file-thumbnail">
          <img src="${this.escapeHtml(file.thumbnail)}" alt="${this.escapeHtml(file.name)}"/>
        </div>
      ` : `
        <div class="acr-file-icon">${icon}</div>
      `}
      <div class="acr-file-info">
        <div class="acr-file-name" title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name)}</div>
        <div class="acr-file-size">${size}</div>
      </div>
    `;

    this.messagesContainer.appendChild(fileEl);
    this.scrollToBottom();

    return fileEl;
  }

  /**
   * Clear all messages
   */
  clear() {
    this.messagesContainer.innerHTML = '';
    this.messages = [];
    this.currentStreamingMessage = null;
    this.streamingBuffer = null;
  }

  /**
   * Scroll to the bottom of the messages container
   */
  scrollToBottom(immediate = false) {
    if (immediate) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      return;
    }

    // Debounce scroll during streaming
    if (this.scrollDebounceTimer) return;
    this.scrollDebounceTimer = requestAnimationFrame(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      this.scrollDebounceTimer = null;
    });
  }

  /**
   * Format content with markdown and code highlighting
   */
  formatContent(content) {
    if (!content) return '';

    // Use marked for markdown rendering
    if (window.marked) {
      try {
        let html = window.marked.parse(content, {
          gfm: true,
          breaks: true,
          silent: true
        });

        // Sanitize the output
        html = this.sanitizeHtml(html);

        // Add code block features (copy buttons, language labels)
        html = this.enhanceCodeBlocks(html);

        return html;
      } catch (e) {
        console.warn('Markdown parsing failed:', e);
      }
    }

    // Fallback: basic formatting
    return this.basicFormat(content);
  }

  /**
   * Enhance code blocks with copy buttons and language labels
   */
  enhanceCodeBlocks(html) {
    return html.replace(/<pre><code([^>]*)>/g, (match, attrs) => {
      const langMatch = attrs.match(/class="[^"]*language-(\w+)[^"]*"/);
      const lang = langMatch ? langMatch[1] : 'text';
      const blockId = AgentChatRenderer.generateId('code');

      // Apply syntax highlighting if available
      let highlightedOpen = `<code${attrs}>`;

      return `
        <div class="acr-code-block-wrapper" id="${blockId}">
          <div class="acr-code-block-header">
            <span class="acr-code-lang-label">${lang}</span>
            <button class="acr-code-copy-btn" data-block-id="${blockId}" title="Copy code">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
                <path d="M2 10V3a1 1 0 011-1h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              Copy
            </button>
          </div>
          <pre class="acr-code-block-content">${highlightedOpen}`;
    }).replace(/<\/code><\/pre>/g, '</code></pre></div>');
  }

  /**
   * Create code block HTML for standalone code blocks
   */
  createCodeBlockHtml(code, language, options = {}) {
    const blockId = AgentChatRenderer.generateId('code');
    const escapedCode = this.escapeHtml(code);

    // Apply syntax highlighting if available and enabled
    let highlightedCode = escapedCode;
    if (this.options.enableSyntaxHighlighting && window.hljs && language !== 'text') {
      try {
        const result = window.hljs.highlight(code, { language, ignoreIllegals: true });
        highlightedCode = result.value;
      } catch {
        // Fall back to escaped code
      }
    }

    const showLineNumbers = options.lineNumbers !== false;
    const lineNumbersHtml = showLineNumbers ? this.generateLineNumbers(code) : '';

    return `
      <div class="acr-code-block-wrapper ${showLineNumbers ? 'with-line-numbers' : ''}" id="${blockId}">
        <div class="acr-code-block-header">
          <span class="acr-code-lang-label">${language}</span>
          ${options.filename ? `<span class="acr-code-filename">${this.escapeHtml(options.filename)}</span>` : ''}
          <button class="acr-code-copy-btn" data-block-id="${blockId}" title="Copy code">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <path d="M2 10V3a1 1 0 011-1h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Copy
          </button>
        </div>
        <div class="acr-code-block-body">
          ${lineNumbersHtml}
          <pre class="acr-code-block-content"><code class="language-${language}">${highlightedCode}</code></pre>
        </div>
      </div>
    `;
  }

  /**
   * Generate line numbers HTML
   */
  generateLineNumbers(code) {
    const lines = code.split('\n');
    const numbers = lines.map((_, i) => `<span>${i + 1}</span>`).join('');
    return `<div class="acr-line-numbers">${numbers}</div>`;
  }

  /**
   * Basic formatting fallback
   */
  basicFormat(content) {
    let html = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const blockId = AgentChatRenderer.generateId('code');
        return `
          <div class="acr-code-block-wrapper" id="${blockId}">
            <div class="acr-code-block-header">
              <span class="acr-code-lang-label">${lang || 'text'}</span>
              <button class="acr-code-copy-btn" data-block-id="${blockId}" title="Copy code">Copy</button>
            </div>
            <pre class="acr-code-block-content"><code class="language-${lang || 'text'}">${code}</code></pre>
          </div>
        `;
      })
      .replace(/`([^`]+)`/g, '<code class="acr-inline-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');

    return html;
  }

  /**
   * Sanitize HTML to prevent XSS
   */
  sanitizeHtml(html) {
    const allowedTags = [
      'p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'div', 'span',
      'button', 'svg', 'path', 'polyline', 'rect', 'circle', 'table',
      'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img'
    ];
    const allowedAttrs = [
      'class', 'href', 'title', 'target', 'rel', 'data-block-id', 'id',
      'width', 'height', 'viewBox', 'fill', 'stroke', 'd', 'stroke-width',
      'stroke-linecap', 'stroke-linejoin', 'x', 'y', 'rx', 'ry', 'points',
      'cx', 'cy', 'r', 'src', 'alt', 'loading'
    ];

    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove dangerous elements
    const dangerous = temp.querySelectorAll('script, iframe, object, embed, form, base, meta, link, style');
    dangerous.forEach(el => el.remove());

    // Sanitize all elements
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
      const tagName = el.tagName.toLowerCase();

      if (!allowedTags.includes(tagName)) {
        const text = document.createTextNode(el.textContent);
        el.parentNode.replaceChild(text, el);
        return;
      }

      // Remove dangerous attributes
      Array.from(el.attributes).forEach(attr => {
        const attrName = attr.name.toLowerCase();

        if (attrName.startsWith('on')) {
          el.removeAttribute(attrName);
        } else if (attrName === 'href') {
          const href = attr.value.trim().toLowerCase();
          if (href.startsWith('javascript:') || href.startsWith('data:')) {
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

    return temp.innerHTML;
  }

  /**
   * Escape HTML entities
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format timestamp
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /**
   * Get file icon SVG
   */
  getFileIcon(type) {
    if (type?.includes('pdf')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 4a2 2 0 012-2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="currentColor" stroke-width="1.5"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.5"/></svg>`;
    }
    if (type?.startsWith('text/') || type?.includes('json') || type?.includes('javascript')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 4a2 2 0 012-2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="currentColor" stroke-width="1.5"/><path d="M14 2v6h6M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.5"/></svg>`;
    }
    if (type?.startsWith('image/')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15l-5-5-6 6-2-2-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 4a2 2 0 012-2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="currentColor" stroke-width="1.5"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.5"/></svg>`;
  }

  /**
   * Add component styles
   */
  addStyles() {
    if (document.getElementById('agent-chat-renderer-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'agent-chat-renderer-styles';
    styles.textContent = `
      /* ===============================================
         AgentChatRenderer Styles
         Beautiful chat UI for agent sessions
         =============================================== */

      .agent-chat-messages {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 20px;
        overflow-y: auto;
        height: 100%;
      }

      /* ===============================================
         Message Bubbles
         =============================================== */

      .acr-message {
        display: flex;
        gap: 12px;
        max-width: 85%;
        animation: acrMessageSlide 0.2s ease-out;
      }

      @keyframes acrMessageSlide {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .acr-message-user {
        align-self: flex-end;
        flex-direction: row-reverse;
      }

      .acr-message-assistant {
        align-self: flex-start;
      }

      /* Avatars */
      .acr-message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 13px;
        font-weight: 600;
      }

      .acr-avatar-assistant {
        background: linear-gradient(135deg, var(--donna-accent, #a78bfa) 0%, #8b5cf6 100%);
        color: #fff;
      }

      .acr-avatar-user {
        background: #3f3f46;
        color: #e4e4e7;
      }

      /* Message Body */
      .acr-message-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .acr-message-content {
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.6;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }

      .acr-message-assistant .acr-message-content {
        background: #27272a;
        color: #e4e4e7;
        border-bottom-left-radius: 4px;
      }

      .acr-message-user .acr-message-content {
        background: var(--donna-accent, #a78bfa);
        color: #fff;
        border-bottom-right-radius: 4px;
      }

      .acr-message-meta {
        display: flex;
        gap: 8px;
        font-size: 11px;
        color: #52525b;
        padding: 0 4px;
      }

      .acr-message-model {
        color: #71717a;
      }

      /* Content Typography */
      .acr-message-content p {
        margin: 0;
      }

      .acr-message-content p + p {
        margin-top: 12px;
      }

      .acr-message-content ul,
      .acr-message-content ol {
        margin: 8px 0;
        padding-left: 24px;
      }

      .acr-message-content li {
        margin: 4px 0;
      }

      .acr-message-content a {
        color: var(--donna-accent-bright, #c4b5fd);
        text-decoration: none;
      }

      .acr-message-content a:hover {
        text-decoration: underline;
      }

      .acr-message-user .acr-message-content a {
        color: rgba(255, 255, 255, 0.9);
      }

      .acr-message-content blockquote {
        margin: 12px 0;
        padding: 8px 16px;
        border-left: 3px solid var(--donna-accent, #a78bfa);
        background: rgba(0, 0, 0, 0.2);
        border-radius: 0 8px 8px 0;
      }

      .acr-inline-code {
        background: rgba(0, 0, 0, 0.3);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: "SF Mono", "Fira Code", "JetBrains Mono", monospace;
        font-size: 0.9em;
      }

      .acr-message-user .acr-inline-code {
        background: rgba(0, 0, 0, 0.2);
      }

      /* ===============================================
         Streaming Indicator
         =============================================== */

      .acr-streaming-indicator {
        display: inline-flex;
        gap: 4px;
        padding: 4px 0;
      }

      .acr-streaming-indicator span {
        width: 6px;
        height: 6px;
        background: var(--donna-accent, #a78bfa);
        border-radius: 50%;
        animation: acrStreamingPulse 1.4s ease-in-out infinite;
      }

      .acr-streaming-indicator span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .acr-streaming-indicator span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes acrStreamingPulse {
        0%, 80%, 100% {
          opacity: 0.3;
          transform: scale(0.8);
        }
        40% {
          opacity: 1;
          transform: scale(1);
        }
      }

      /* ===============================================
         Code Blocks
         =============================================== */

      .acr-code-block-wrapper,
      .acr-standalone-code-block .acr-code-block-wrapper {
        margin: 12px 0;
        border-radius: 10px;
        overflow: hidden;
        background: #1a1a1e;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .acr-code-block-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        gap: 12px;
      }

      .acr-code-lang-label {
        font-size: 11px;
        font-weight: 600;
        color: #71717a;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-family: "SF Mono", "Fira Code", monospace;
      }

      .acr-code-filename {
        flex: 1;
        font-size: 12px;
        color: #a1a1aa;
        font-family: "SF Mono", "Fira Code", monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .acr-code-copy-btn {
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
        white-space: nowrap;
      }

      .acr-code-copy-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #e4e4e7;
        border-color: rgba(255, 255, 255, 0.2);
      }

      .acr-code-copy-btn.copied {
        background: rgba(34, 197, 94, 0.15);
        border-color: rgba(34, 197, 94, 0.3);
        color: #22c55e;
      }

      .acr-code-block-body {
        display: flex;
        overflow-x: auto;
      }

      .acr-line-numbers {
        display: flex;
        flex-direction: column;
        padding: 12px 0;
        padding-left: 12px;
        padding-right: 8px;
        background: rgba(0, 0, 0, 0.2);
        border-right: 1px solid rgba(255, 255, 255, 0.05);
        user-select: none;
        text-align: right;
        font-family: "SF Mono", "Fira Code", "JetBrains Mono", monospace;
        font-size: 13px;
        line-height: 1.5;
        color: #52525b;
      }

      .acr-code-block-content {
        flex: 1;
        margin: 0;
        padding: 12px 16px;
        background: transparent;
        overflow-x: auto;
      }

      .acr-code-block-content code {
        font-family: "SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace;
        font-size: 13px;
        line-height: 1.5;
        color: #e4e4e7;
        white-space: pre;
      }

      /* ===============================================
         Tool Calls
         =============================================== */

      .acr-tool-call {
        margin: 8px 0;
        border-radius: 10px;
        background: #1e1e22;
        border: 1px solid rgba(255, 255, 255, 0.08);
        overflow: hidden;
      }

      .acr-tool-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        cursor: pointer;
        transition: background 0.15s;
      }

      .acr-tool-header:hover {
        background: rgba(255, 255, 255, 0.03);
      }

      .acr-tool-status {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .acr-tool-running .acr-tool-status {
        color: var(--donna-accent, #a78bfa);
      }

      .acr-tool-complete .acr-tool-status {
        color: var(--donna-success, #4ade80);
      }

      .acr-tool-error .acr-tool-status {
        color: var(--donna-error, #f87171);
      }

      .acr-status-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(167, 139, 250, 0.2);
        border-top-color: var(--donna-accent, #a78bfa);
        border-radius: 50%;
        animation: acrSpin 0.8s linear infinite;
      }

      @keyframes acrSpin {
        to { transform: rotate(360deg); }
      }

      .acr-tool-name {
        flex: 1;
        font-size: 13px;
        font-weight: 500;
        color: #e4e4e7;
        font-family: "SF Mono", "Fira Code", monospace;
      }

      .acr-tool-expand-icon {
        color: #52525b;
        transition: transform 0.2s;
      }

      .acr-tool-call.expanded .acr-tool-expand-icon {
        transform: rotate(180deg);
      }

      .acr-tool-body {
        display: none;
        padding: 0 14px 14px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
      }

      .acr-tool-call.expanded .acr-tool-body {
        display: block;
      }

      .acr-tool-section {
        margin-top: 12px;
      }

      .acr-tool-section-label {
        font-size: 11px;
        font-weight: 600;
        color: #71717a;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
      }

      .acr-tool-section-content {
        font-size: 13px;
        color: #a1a1aa;
      }

      .acr-tool-data {
        margin: 0;
        padding: 10px 12px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 6px;
        overflow-x: auto;
      }

      .acr-tool-data code {
        font-family: "SF Mono", "Fira Code", monospace;
        font-size: 12px;
        color: #a1a1aa;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .acr-tool-error .acr-tool-section-content {
        color: var(--donna-error, #f87171);
      }

      /* ===============================================
         File Attachments
         =============================================== */

      .acr-file-attachment {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        background: #1e1e22;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        max-width: 280px;
        margin: 8px 0;
      }

      .acr-file-thumbnail {
        width: 48px;
        height: 48px;
        border-radius: 6px;
        overflow: hidden;
        flex-shrink: 0;
        background: rgba(0, 0, 0, 0.3);
      }

      .acr-file-thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .acr-file-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #71717a;
        flex-shrink: 0;
      }

      .acr-file-info {
        flex: 1;
        min-width: 0;
      }

      .acr-file-name {
        font-size: 13px;
        font-weight: 500;
        color: #e4e4e7;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .acr-file-size {
        font-size: 11px;
        color: #71717a;
        margin-top: 2px;
      }

      /* ===============================================
         Standalone Code Block
         =============================================== */

      .acr-standalone-code-block {
        margin: 8px 0;
      }

      /* ===============================================
         Tables
         =============================================== */

      .acr-message-content table {
        border-collapse: collapse;
        margin: 12px 0;
        width: 100%;
        font-size: 13px;
      }

      .acr-message-content th,
      .acr-message-content td {
        padding: 8px 12px;
        text-align: left;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .acr-message-content th {
        background: rgba(0, 0, 0, 0.2);
        font-weight: 600;
        color: #e4e4e7;
      }

      .acr-message-content td {
        color: #a1a1aa;
      }

      /* ===============================================
         Horizontal Rule
         =============================================== */

      .acr-message-content hr {
        border: none;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        margin: 16px 0;
      }

      /* ===============================================
         Images in Messages
         =============================================== */

      .acr-message-content img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        margin: 8px 0;
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Destroy the renderer and clean up
   */
  destroy() {
    if (this.scrollDebounceTimer) {
      cancelAnimationFrame(this.scrollDebounceTimer);
    }

    if (this.streamingBuffer) {
      this.streamingBuffer.finalize();
    }

    if (this.messagesContainer && this.messagesContainer.parentNode) {
      this.messagesContainer.parentNode.removeChild(this.messagesContainer);
    }

    this.messages = [];
    this.currentStreamingMessage = null;
    this.streamingBuffer = null;
  }
}

/**
 * StreamingBuffer - Batched DOM updates for streaming content
 * Buffers chunks and flushes to DOM at a fixed interval to reduce reflows
 */
class StreamingBuffer {
  constructor(element, formatFn, flushInterval = 50) {
    this.element = element;
    this.formatFn = formatFn;
    this.buffer = '';
    this.fullContent = '';
    this.timer = null;
    this.flushInterval = flushInterval;
  }

  append(chunk) {
    this.buffer += chunk;
    this.fullContent += chunk;

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  flush() {
    if (this.buffer) {
      this.element.innerHTML = this.formatFn(this.fullContent);
      this.buffer = '';
    }
    this.timer = null;
  }

  finalize() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.flush();
  }

  getContent() {
    return this.fullContent;
  }

  reset() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.buffer = '';
    this.fullContent = '';
    this.timer = null;
  }
}

// Export for use in other modules
window.AgentChatRenderer = AgentChatRenderer;
