/**
 * Vault Browser Component
 * Phase 7: Obsidian Vault Integration
 * Modal with tree view, search, note preview
 */

class VaultBrowser {
  constructor(options = {}) {
    this.options = {
      vaultPath: options.vaultPath || null,
      onInsertLink: options.onInsertLink || null,
      onCreateNote: options.onCreateNote || null,
      ...options
    };

    this.modal = null;
    this.isOpen = false;
    this.currentNote = null;
    this.searchResults = [];
    this.folderTree = null;

    this.init();
  }

  init() {
    this.createModal();
    this.addStyles();
    this.setupKeyboardShortcut();
    this.setupEventListeners();
  }

  /**
   * Create the modal structure
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'vault-browser-modal';
    this.modal.innerHTML = `
      <div class="vault-browser-overlay"></div>
      <div class="vault-browser-content">
        <div class="vault-browser-header">
          <div class="vault-browser-title">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 4a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V16a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 2v4a1 1 0 001 1h4" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <span>Obsidian Vault</span>
          </div>
          <button class="vault-browser-close" title="Close (Esc)">&times;</button>
        </div>

        <div class="vault-browser-search">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <input type="text" class="vault-search-input" placeholder="Search notes..." />
        </div>

        <div class="vault-browser-body">
          <div class="vault-sidebar">
            <div class="vault-tree"></div>
          </div>
          <div class="vault-main">
            <div class="vault-note-preview">
              <p class="vault-empty-state">Select a note to preview</p>
            </div>
          </div>
        </div>

        <div class="vault-browser-footer">
          <button class="vault-btn vault-btn-secondary" id="vault-new-note">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            New Note
          </button>
          <div class="vault-footer-spacer"></div>
          <button class="vault-btn vault-btn-secondary vault-cancel">Cancel</button>
          <button class="vault-btn vault-btn-primary" id="vault-insert-link" disabled>Insert Link</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.bindModalEvents();
  }

  /**
   * Bind modal events
   */
  bindModalEvents() {
    // Close button
    this.modal.querySelector('.vault-browser-close').addEventListener('click', () => this.close());
    this.modal.querySelector('.vault-cancel').addEventListener('click', () => this.close());
    this.modal.querySelector('.vault-browser-overlay').addEventListener('click', () => this.close());

    // Search input
    const searchInput = this.modal.querySelector('.vault-search-input');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => this.search(e.target.value), 200);
    });

    // New note button
    this.modal.querySelector('#vault-new-note').addEventListener('click', () => this.promptNewNote());

    // Insert link button
    this.modal.querySelector('#vault-insert-link').addEventListener('click', () => this.insertCurrentLink());

    // Keyboard navigation
    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  /**
   * Setup Cmd+Shift+O keyboard shortcut
   */
  setupKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      if (e.metaKey && e.shiftKey && e.code === 'KeyO') {
        e.preventDefault();
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      }
    });
  }

  /**
   * Setup vault event listeners
   */
  setupEventListeners() {
    window.donnaVault?.onFileChanged?.((data) => {
      if (this.isOpen) {
        this.refreshTree();
      }
    });
  }

  /**
   * Open the modal
   */
  async open() {
    this.modal.classList.add('open');
    this.isOpen = true;

    // Focus search input
    setTimeout(() => {
      this.modal.querySelector('.vault-search-input').focus();
    }, 100);

    // Load folder tree
    await this.refreshTree();
  }

  /**
   * Close the modal
   */
  close() {
    this.modal.classList.remove('open');
    this.isOpen = false;
    this.currentNote = null;
  }

  /**
   * Refresh folder tree
   */
  async refreshTree() {
    const result = await window.donnaVault?.getFolderTree();
    if (result?.success && result.tree) {
      this.folderTree = result.tree;
      this.renderTree(result.tree);
    }
  }

  /**
   * Render folder tree
   */
  renderTree(tree, depth = 0) {
    const treeContainer = this.modal.querySelector('.vault-tree');
    if (depth === 0) {
      treeContainer.innerHTML = '';
    }

    const renderNode = (node, container, depth) => {
      // Render folders
      for (const child of node.children || []) {
        const folderEl = document.createElement('div');
        folderEl.className = 'vault-folder';
        folderEl.innerHTML = `
          <div class="vault-folder-header" style="padding-left: ${depth * 16}px">
            <svg class="vault-folder-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 3h4l2 2h5a1 1 0 011 1v5a1 1 0 01-1 1H2a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.2"/>
            </svg>
            <span>${child.name}</span>
          </div>
          <div class="vault-folder-content"></div>
        `;

        const header = folderEl.querySelector('.vault-folder-header');
        const content = folderEl.querySelector('.vault-folder-content');

        header.addEventListener('click', () => {
          folderEl.classList.toggle('expanded');
        });

        container.appendChild(folderEl);
        renderNode(child, content, depth + 1);
      }

      // Render files
      for (const file of node.files || []) {
        const fileEl = document.createElement('div');
        fileEl.className = 'vault-file';
        fileEl.style.paddingLeft = `${depth * 16 + 20}px`;
        fileEl.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2h5.586L12 5.414V12a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.2"/>
            <path d="M8 2v4h4" stroke="currentColor" stroke-width="1.2"/>
          </svg>
          <span>${file.title || file.name.replace('.md', '')}</span>
        `;

        fileEl.addEventListener('click', () => this.selectNote(file.path));
        container.appendChild(fileEl);
      }
    };

    renderNode(tree, treeContainer, 0);
  }

  /**
   * Search notes
   */
  async search(query) {
    if (!query || query.length < 2) {
      this.renderTree(this.folderTree);
      return;
    }

    const result = await window.donnaVault?.search(query);
    if (result?.success) {
      this.renderSearchResults(result.results);
    }
  }

  /**
   * Render search results
   */
  renderSearchResults(results) {
    const treeContainer = this.modal.querySelector('.vault-tree');
    treeContainer.innerHTML = '';

    if (results.length === 0) {
      treeContainer.innerHTML = '<p class="vault-no-results">No results found</p>';
      return;
    }

    for (const result of results) {
      const el = document.createElement('div');
      el.className = 'vault-search-result';
      el.innerHTML = `
        <div class="vault-result-title">${result.title}</div>
        ${result.excerpt ? `<div class="vault-result-excerpt">${result.excerpt}</div>` : ''}
        <div class="vault-result-path">${result.path}</div>
      `;
      el.addEventListener('click', () => this.selectNote(result.path));
      treeContainer.appendChild(el);
    }
  }

  /**
   * Select and preview a note
   */
  async selectNote(notePath) {
    this.currentNote = notePath;

    // Update selection in tree
    this.modal.querySelectorAll('.vault-file').forEach(el => {
      el.classList.remove('selected');
    });
    this.modal.querySelectorAll('.vault-search-result').forEach(el => {
      el.classList.remove('selected');
    });

    // Enable insert button
    this.modal.querySelector('#vault-insert-link').disabled = false;

    // Load note preview
    const result = await window.donnaVault?.readNote(notePath);
    if (result?.success) {
      this.renderNotePreview(result);
    }
  }

  /**
   * Render note preview
   */
  renderNotePreview(note) {
    const preview = this.modal.querySelector('.vault-note-preview');

    // Render markdown (simple version)
    let html = note.content
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[\[([^\]]+)\]\]/g, '<span class="wikilink">$1</span>')
      .replace(/\n/g, '<br>');

    preview.innerHTML = `
      <div class="note-preview-header">
        <h2>${note.path.replace(/\.md$/, '').split('/').pop()}</h2>
      </div>
      <div class="note-preview-content">${html}</div>
      ${note.backlinks?.length ? `
        <div class="note-backlinks">
          <h4>Backlinks (${note.backlinks.length})</h4>
          ${note.backlinks.map(bl => `<a href="#" data-path="${bl.path}">${bl.title}</a>`).join('')}
        </div>
      ` : ''}
    `;

    // Backlink clicks
    preview.querySelectorAll('.note-backlinks a').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectNote(el.dataset.path);
      });
    });
  }

  /**
   * Insert wikilink for current note
   */
  insertCurrentLink() {
    if (!this.currentNote) return;

    const title = this.currentNote.replace(/\.md$/, '').split('/').pop();
    const wikilink = `[[${title}]]`;

    if (this.options.onInsertLink) {
      this.options.onInsertLink(wikilink);
    }

    this.close();
  }

  /**
   * Prompt for new note
   */
  async promptNewNote() {
    const name = prompt('Note name:');
    if (!name) return;

    const path = name.endsWith('.md') ? name : `${name}.md`;
    const result = await window.donnaVault?.createNote(path, `# ${name.replace('.md', '')}\n\n`);

    if (result?.success) {
      await this.refreshTree();
      this.selectNote(path);
    } else {
      alert(result?.error || 'Failed to create note');
    }
  }

  /**
   * Add styles
   */
  addStyles() {
    if (document.getElementById('vault-browser-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'vault-browser-styles';
    styles.textContent = `
      .vault-browser-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 10000;
      }

      .vault-browser-modal.open {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .vault-browser-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
      }

      .vault-browser-content {
        position: relative;
        width: 90%;
        max-width: 900px;
        height: 80%;
        max-height: 700px;
        background: #1e1e22;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
      }

      .vault-browser-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .vault-browser-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 16px;
        font-weight: 600;
        color: #e4e4e7;
      }

      .vault-browser-title svg {
        color: var(--donna-accent, #a78bfa);
      }

      .vault-browser-close {
        background: none;
        border: none;
        color: #71717a;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }

      .vault-browser-close:hover {
        color: #e4e4e7;
      }

      .vault-browser-search {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .vault-browser-search svg {
        color: #71717a;
        flex-shrink: 0;
      }

      .vault-search-input {
        flex: 1;
        background: none;
        border: none;
        color: #e4e4e7;
        font-size: 14px;
        outline: none;
      }

      .vault-search-input::placeholder {
        color: #52525b;
      }

      .vault-browser-body {
        flex: 1;
        display: flex;
        overflow: hidden;
      }

      .vault-sidebar {
        width: 280px;
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        overflow-y: auto;
      }

      .vault-tree {
        padding: 8px;
      }

      .vault-main {
        flex: 1;
        overflow-y: auto;
      }

      .vault-folder-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        color: #a1a1aa;
        cursor: pointer;
        border-radius: 4px;
      }

      .vault-folder-header:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .vault-folder-content {
        display: none;
      }

      .vault-folder.expanded .vault-folder-content {
        display: block;
      }

      .vault-file {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        color: #a1a1aa;
        cursor: pointer;
        border-radius: 4px;
      }

      .vault-file:hover, .vault-file.selected {
        background: rgba(167, 139, 250, 0.1);
        color: #e4e4e7;
      }

      .vault-search-result {
        padding: 10px 12px;
        cursor: pointer;
        border-radius: 6px;
      }

      .vault-search-result:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .vault-result-title {
        font-weight: 500;
        color: #e4e4e7;
        margin-bottom: 4px;
      }

      .vault-result-excerpt {
        font-size: 12px;
        color: #71717a;
        margin-bottom: 4px;
      }

      .vault-result-path {
        font-size: 11px;
        color: #52525b;
      }

      .vault-note-preview {
        padding: 20px;
      }

      .vault-empty-state {
        color: #52525b;
        text-align: center;
        padding: 40px;
      }

      .vault-no-results {
        color: #52525b;
        text-align: center;
        padding: 20px;
      }

      .note-preview-header h2 {
        margin: 0 0 16px;
        font-size: 20px;
        color: #e4e4e7;
      }

      .note-preview-content {
        color: #a1a1aa;
        line-height: 1.6;
      }

      .note-preview-content h1, .note-preview-content h2, .note-preview-content h3 {
        color: #e4e4e7;
        margin: 16px 0 8px;
      }

      .note-preview-content .wikilink {
        color: var(--donna-accent, #a78bfa);
        cursor: pointer;
      }

      .note-backlinks {
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .note-backlinks h4 {
        margin: 0 0 12px;
        color: #71717a;
        font-size: 12px;
        text-transform: uppercase;
      }

      .note-backlinks a {
        display: block;
        color: var(--donna-accent, #a78bfa);
        text-decoration: none;
        padding: 4px 0;
      }

      .vault-browser-footer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .vault-footer-spacer {
        flex: 1;
      }

      .vault-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .vault-btn-secondary {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #a1a1aa;
      }

      .vault-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #e4e4e7;
      }

      .vault-btn-primary {
        background: var(--donna-accent, #a78bfa);
        border: none;
        color: #fff;
      }

      .vault-btn-primary:hover {
        background: #8b5cf6;
      }

      .vault-btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(styles);
  }
}

// Export
window.VaultBrowser = VaultBrowser;
