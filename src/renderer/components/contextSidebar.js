/**
 * Donna Desktop - Context Sidebar
 * Displays files, links, and directories extracted from terminal output
 * Supports unified (all sessions) and per-session views
 */

class ContextStore {
  constructor() {
    this.items = [];
    this.listeners = new Set();
    this.maxItems = 100; // Limit to prevent memory bloat
  }

  /**
   * Add an item to the store
   */
  add(item) {
    // Check for duplicates (same path/url in same session)
    const exists = this.items.some(
      i => i.value === item.value && i.sessionId === item.sessionId
    );
    if (exists) return;

    this.items.unshift({
      ...item,
      id: `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    });

    // Trim old items
    if (this.items.length > this.maxItems) {
      this.items = this.items.slice(0, this.maxItems);
    }

    this.notify();
  }

  /**
   * Get items, optionally filtered by session
   */
  getItems(sessionId = null) {
    if (sessionId) {
      return this.items.filter(i => i.sessionId === sessionId);
    }
    return this.items;
  }

  /**
   * Get items grouped by type
   */
  getGrouped(sessionId = null) {
    const items = this.getItems(sessionId);
    return {
      files: items.filter(i => i.type === 'file'),
      links: items.filter(i => i.type === 'link'),
      directories: items.filter(i => i.type === 'directory')
    };
  }

  /**
   * Clear items for a session
   */
  clearSession(sessionId) {
    this.items = this.items.filter(i => i.sessionId !== sessionId);
    this.notify();
  }

  /**
   * Clear all items
   */
  clearAll() {
    this.items = [];
    this.notify();
  }

  /**
   * Subscribe to changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.items));
  }
}

class ContextParser {
  constructor() {
    // Patterns for extracting paths and URLs
    this.patterns = {
      // Absolute paths (Unix-style)
      absolutePath: /(?:^|[\s"'`])(\/((?:Users|home|var|tmp|etc|opt)[^\s"'`\n]*\.[a-zA-Z0-9]+))/g,
      // File operations from Claude Code output
      fileOperation: /(?:Reading|Writing|Editing|Created|Modified|Deleted|Wrote|Updated)\s+[`"]?([^\s`"'\n]+\.[a-zA-Z0-9]+)[`"]?/gi,
      // URLs
      url: /https?:\/\/[^\s"'`<>\n]+/g,
      // Directory paths (ending with /)
      directory: /(?:^|[\s"'`])(\/(?:Users|home)[^\s"'`\n]*\/)/g,
      // Relative paths with extensions
      relativePath: /(?:^|[\s"'`])(\.[\/\\][^\s"'`\n]*\.[a-zA-Z0-9]+)/g,
      // src/components/etc style paths
      srcPath: /(?:^|[\s"'`])((?:src|lib|app|components|pages|utils|test|spec)[\/\\][^\s"'`\n]*\.[a-zA-Z0-9]+)/gi
    };

    // ANSI escape code pattern
    this.ansiPattern = /\x1b\[[0-9;]*[a-zA-Z]/g;
  }

  /**
   * Strip ANSI codes from text
   */
  stripAnsi(text) {
    return text.replace(this.ansiPattern, '');
  }

  /**
   * Parse text and extract context items
   */
  parse(text, sessionId, sessionName = 'Session') {
    const cleanText = this.stripAnsi(text);
    const items = [];
    const seen = new Set();

    // Extract file operations (highest priority - explicit mentions)
    let match;
    while ((match = this.patterns.fileOperation.exec(cleanText)) !== null) {
      const path = match[1];
      if (!seen.has(path) && this.isValidPath(path)) {
        seen.add(path);
        items.push({
          type: 'file',
          value: path,
          displayName: this.getFileName(path),
          sessionId,
          sessionName
        });
      }
    }

    // Extract absolute paths
    this.patterns.absolutePath.lastIndex = 0;
    while ((match = this.patterns.absolutePath.exec(cleanText)) !== null) {
      const path = match[1];
      if (!seen.has(path) && this.isValidPath(path)) {
        seen.add(path);
        items.push({
          type: 'file',
          value: path,
          displayName: this.getFileName(path),
          sessionId,
          sessionName
        });
      }
    }

    // Extract src-style paths
    this.patterns.srcPath.lastIndex = 0;
    while ((match = this.patterns.srcPath.exec(cleanText)) !== null) {
      const path = match[1];
      if (!seen.has(path) && this.isValidPath(path)) {
        seen.add(path);
        items.push({
          type: 'file',
          value: path,
          displayName: this.getFileName(path),
          sessionId,
          sessionName
        });
      }
    }

    // Extract URLs
    this.patterns.url.lastIndex = 0;
    while ((match = this.patterns.url.exec(cleanText)) !== null) {
      const url = match[0].replace(/[.,;:!?)]+$/, ''); // Trim trailing punctuation
      if (!seen.has(url)) {
        seen.add(url);
        items.push({
          type: 'link',
          value: url,
          displayName: this.getUrlDisplayName(url),
          sessionId,
          sessionName
        });
      }
    }

    // Extract directories
    this.patterns.directory.lastIndex = 0;
    while ((match = this.patterns.directory.exec(cleanText)) !== null) {
      const dir = match[1];
      if (!seen.has(dir)) {
        seen.add(dir);
        items.push({
          type: 'directory',
          value: dir,
          displayName: this.getDirName(dir),
          sessionId,
          sessionName
        });
      }
    }

    return items;
  }

  isValidPath(path) {
    // Filter out common false positives
    const blacklist = ['.git', 'node_modules', '.DS_Store', '__pycache__'];
    if (blacklist.some(b => path.includes(b))) return false;
    // Must have a reasonable extension or be clearly a path
    const ext = path.split('.').pop()?.toLowerCase();
    const validExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java',
                       'c', 'cpp', 'h', 'css', 'scss', 'html', 'json', 'yaml', 'yml',
                       'md', 'txt', 'sh', 'bash', 'zsh', 'sql', 'graphql', 'vue', 'svelte'];
    return validExts.includes(ext);
  }

  getFileName(path) {
    return path.split('/').pop() || path;
  }

  getDirName(path) {
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || path;
  }

  getUrlDisplayName(url) {
    try {
      const u = new URL(url);
      return u.hostname + (u.pathname !== '/' ? u.pathname.slice(0, 30) : '');
    } catch {
      return url.slice(0, 40);
    }
  }
}

class ContextSidebar {
  constructor(container) {
    this.container = container;
    this.store = new ContextStore();
    this.parser = new ContextParser();
    this.wrapper = null;
    this.isVisible = true;
    this.viewMode = 'unified'; // 'unified' or 'session'
    this.activeSessionId = null;

    this.init();
  }

  init() {
    this.createUI();
    this.store.subscribe(() => this.render());
    this.addStyles();
  }

  createUI() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'context-sidebar';
    this.wrapper.innerHTML = `
      <div class="context-header">
        <h3>Context</h3>
        <div class="context-controls">
          <button class="context-toggle-btn" title="Toggle view mode">
            <span class="toggle-label">All</span>
          </button>
          <button class="context-clear-btn" title="Clear">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 4h10M4 4V3a1 1 0 011-1h4a1 1 0 011 1v1M5 7v4M9 7v4M3 4l1 8a1 1 0 001 1h4a1 1 0 001-1l1-8"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="context-content">
        <div class="context-empty">
          <p>Files and links from your sessions will appear here</p>
        </div>
        <div class="context-groups"></div>
      </div>
    `;

    this.container.appendChild(this.wrapper);
    this.bindEvents();
  }

  bindEvents() {
    // Toggle view mode
    const toggleBtn = this.wrapper.querySelector('.context-toggle-btn');
    toggleBtn?.addEventListener('click', () => {
      this.viewMode = this.viewMode === 'unified' ? 'session' : 'unified';
      toggleBtn.querySelector('.toggle-label').textContent =
        this.viewMode === 'unified' ? 'All' : 'Session';
      this.render();
    });

    // Clear button
    const clearBtn = this.wrapper.querySelector('.context-clear-btn');
    clearBtn?.addEventListener('click', () => {
      if (this.viewMode === 'session' && this.activeSessionId) {
        this.store.clearSession(this.activeSessionId);
      } else {
        this.store.clearAll();
      }
    });

    // Item clicks (event delegation)
    this.wrapper.querySelector('.context-groups')?.addEventListener('click', (e) => {
      const item = e.target.closest('.context-item');
      if (item) {
        const type = item.dataset.type;
        const value = item.dataset.value;
        this.openItem(type, value);
      }
    });
  }

  /**
   * Process PTY data from a session
   */
  processPtyData(data, sessionId, sessionName) {
    const items = this.parser.parse(data, sessionId, sessionName);
    items.forEach(item => this.store.add(item));
  }

  /**
   * Set the active session (for session view mode)
   */
  setActiveSession(sessionId) {
    this.activeSessionId = sessionId;
    if (this.viewMode === 'session') {
      this.render();
    }
  }

  /**
   * Open a file or link
   */
  async openItem(type, value) {
    try {
      if (type === 'link') {
        await window.donnaContext?.openExternal(value);
      } else if (type === 'file' || type === 'directory') {
        await window.donnaContext?.openPath(value);
      }
    } catch (error) {
      console.error('Failed to open item:', error);
    }
  }

  /**
   * Render the sidebar content
   */
  render() {
    const grouped = this.store.getGrouped(
      this.viewMode === 'session' ? this.activeSessionId : null
    );

    const hasItems = grouped.files.length || grouped.links.length || grouped.directories.length;

    const emptyEl = this.wrapper.querySelector('.context-empty');
    const groupsEl = this.wrapper.querySelector('.context-groups');

    if (!hasItems) {
      emptyEl.style.display = 'block';
      groupsEl.style.display = 'none';
      return;
    }

    emptyEl.style.display = 'none';
    groupsEl.style.display = 'block';

    groupsEl.innerHTML = `
      ${this.renderGroup('Files', 'file', grouped.files)}
      ${this.renderGroup('Links', 'link', grouped.links)}
      ${this.renderGroup('Directories', 'directory', grouped.directories)}
    `;
  }

  renderGroup(title, type, items) {
    if (!items.length) return '';

    const icons = {
      file: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3 1h5l4 4v8a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8 1v4h4" stroke="currentColor" stroke-width="1.5"/>
      </svg>`,
      link: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M6 8l2-2m-1.5-2.5L8 2a2.83 2.83 0 014 4l-1.5 1.5M8 6L6 8m1.5 2.5L6 12a2.83 2.83 0 01-4-4l1.5-1.5"
          stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
      directory: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 3h4l1 1h5a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5"/>
      </svg>`
    };

    return `
      <div class="context-group">
        <div class="context-group-header">
          ${icons[type]}
          <span>${title}</span>
          <span class="context-count">${items.length}</span>
        </div>
        <div class="context-group-items">
          ${items.map(item => `
            <div class="context-item" data-type="${type}" data-value="${this.escapeAttr(item.value)}" title="${this.escapeAttr(item.value)}">
              <span class="context-item-name">${this.escapeHtml(item.displayName)}</span>
              ${this.viewMode === 'unified' ? `<span class="context-item-session">${this.escapeHtml(item.sessionName)}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  escapeAttr(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  show() {
    this.wrapper?.classList.add('visible');
    this.isVisible = true;
  }

  hide() {
    this.wrapper?.classList.remove('visible');
    this.isVisible = false;
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  addStyles() {
    if (document.getElementById('context-sidebar-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'context-sidebar-styles';
    styles.textContent = `
      .context-sidebar {
        width: 240px;
        background: var(--donna-bg-secondary, #1e1e22);
        border-left: 1px solid var(--donna-border, rgba(255,255,255,0.08));
        display: flex;
        flex-direction: column;
        font-size: 13px;
      }

      .context-sidebar:not(.visible) {
        display: none;
      }

      .context-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--donna-border, rgba(255,255,255,0.08));
      }

      .context-header h3 {
        margin: 0;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--donna-text-secondary, #a1a1aa);
      }

      .context-controls {
        display: flex;
        gap: 8px;
      }

      .context-toggle-btn,
      .context-clear-btn {
        background: var(--donna-bg-elevated, #27272a);
        border: 1px solid var(--donna-border, rgba(255,255,255,0.08));
        border-radius: 6px;
        color: var(--donna-text-secondary, #a1a1aa);
        cursor: pointer;
        transition: all 0.15s;
      }

      .context-toggle-btn {
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 500;
      }

      .context-clear-btn {
        padding: 4px 6px;
        display: flex;
        align-items: center;
      }

      .context-toggle-btn:hover,
      .context-clear-btn:hover {
        background: var(--donna-bg-active, #3f3f46);
        color: var(--donna-text-primary, #e4e4e7);
      }

      .context-content {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
      }

      .context-empty {
        text-align: center;
        padding: 20px;
        color: var(--donna-text-muted, #52525b);
        font-size: 12px;
      }

      .context-empty p {
        margin: 0;
      }

      .context-group {
        margin-bottom: 16px;
      }

      .context-group:last-child {
        margin-bottom: 0;
      }

      .context-group-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 0;
        color: var(--donna-text-secondary, #a1a1aa);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .context-group-header svg {
        opacity: 0.7;
      }

      .context-count {
        margin-left: auto;
        background: var(--donna-bg-elevated, #27272a);
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
      }

      .context-group-items {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .context-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        background: var(--donna-bg-elevated, #27272a);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .context-item:hover {
        background: var(--donna-bg-active, #3f3f46);
      }

      .context-item-name {
        color: var(--donna-text-primary, #e4e4e7);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        min-width: 0;
      }

      .context-item-session {
        font-size: 10px;
        color: var(--donna-text-muted, #52525b);
        background: var(--donna-bg-primary, #16161a);
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 8px;
        flex-shrink: 0;
      }

      /* Scrollbar */
      .context-content::-webkit-scrollbar {
        width: 6px;
      }

      .context-content::-webkit-scrollbar-track {
        background: transparent;
      }

      .context-content::-webkit-scrollbar-thumb {
        background: var(--donna-bg-active, #3f3f46);
        border-radius: 3px;
      }
    `;
    document.head.appendChild(styles);
  }
}

// Export
window.ContextSidebar = ContextSidebar;
window.ContextStore = ContextStore;
window.ContextParser = ContextParser;
