/**
 * Donna Desktop - Command Palette
 * Quick command launcher with fuzzy search (Cmd+Shift+P)
 */

class CommandPalette {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.options = {
      maxRecentCommands: 50,
      showWorkflows: true,
      showGitCommands: true,
      showAliases: true,
      ...options
    };

    this.isOpen = false;
    this.query = '';
    this.results = [];
    this.selectedIndex = 0;
    this.recentCommands = this.loadRecentCommands();
    this.workflows = [];

    this.element = null;
    this.inputElement = null;
    this.resultsElement = null;

    this.init();
  }

  init() {
    if (!this.enabled) return;

    // Create palette element
    this.element = document.createElement('div');
    this.element.className = 'command-palette';
    this.element.innerHTML = `
      <div class="palette-backdrop"></div>
      <div class="palette-container">
        <div class="palette-input-wrapper">
          <svg class="palette-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M12 12l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <input type="text" class="palette-input" placeholder="Type a command or search..." autocomplete="off" spellcheck="false">
          <div class="palette-shortcuts">
            <span class="shortcut-hint">↑↓ navigate</span>
            <span class="shortcut-hint">↵ run</span>
            <span class="shortcut-hint">esc close</span>
          </div>
        </div>
        <div class="palette-results"></div>
      </div>
    `;

    this.element.style.display = 'none';
    document.body.appendChild(this.element);

    this.inputElement = this.element.querySelector('.palette-input');
    this.resultsElement = this.element.querySelector('.palette-results');

    // Event listeners
    this.element.querySelector('.palette-backdrop').addEventListener('click', () => this.close());
    this.inputElement.addEventListener('input', (e) => this.handleInput(e.target.value));
    this.inputElement.addEventListener('keydown', (e) => this.handleKeydown(e));

    // Global shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Enable/disable command palette
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.close();
    }
  }

  /**
   * Set workflows from config
   */
  setWorkflows(workflows) {
    this.workflows = workflows || [];
  }

  /**
   * Toggle palette open/closed
   */
  toggle() {
    if (!this.enabled) return;

    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open the palette
   */
  open() {
    if (!this.enabled) return;

    this.isOpen = true;
    this.query = '';
    this.selectedIndex = 0;
    this.element.style.display = 'flex';
    this.inputElement.value = '';
    this.inputElement.focus();

    // Show default results (recent + workflows)
    this.showDefaultResults();

    // Animate in
    requestAnimationFrame(() => {
      this.element.classList.add('open');
    });
  }

  /**
   * Close the palette
   */
  close() {
    this.isOpen = false;
    this.element.classList.remove('open');

    setTimeout(() => {
      this.element.style.display = 'none';
    }, 200);
  }

  /**
   * Handle input changes
   */
  handleInput(value) {
    this.query = value;
    this.selectedIndex = 0;

    if (!value.trim()) {
      this.showDefaultResults();
      return;
    }

    this.search(value);
  }

  /**
   * Handle keyboard navigation
   */
  handleKeydown(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectPrevious();
        break;
      case 'Enter':
        e.preventDefault();
        this.executeSelected();
        break;
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
      case 'Tab':
        e.preventDefault();
        if (this.results[this.selectedIndex]?.command) {
          this.inputElement.value = this.results[this.selectedIndex].command;
          this.handleInput(this.inputElement.value);
        }
        break;
    }
  }

  /**
   * Show default results (recent commands + workflows)
   */
  showDefaultResults() {
    const results = [];

    // Add workflows section
    if (this.options.showWorkflows && this.workflows.length > 0) {
      results.push({ type: 'header', label: 'Workflows' });
      this.workflows.slice(0, 5).forEach(w => {
        results.push({
          type: 'workflow',
          id: w.id,
          label: w.name,
          description: w.description,
          icon: w.icon || 'workflow',
          commands: w.commands
        });
      });
    }

    // Add recent commands section
    if (this.recentCommands.length > 0) {
      results.push({ type: 'header', label: 'Recent Commands' });
      this.recentCommands.slice(0, 10).forEach(cmd => {
        results.push({
          type: 'command',
          command: cmd,
          label: cmd,
          icon: 'terminal'
        });
      });
    }

    // Add quick actions
    results.push({ type: 'header', label: 'Quick Actions' });
    results.push({
      type: 'action',
      id: 'new-terminal',
      label: 'New Terminal',
      description: 'Open a new terminal session',
      icon: 'plus',
      shortcut: '⌘T'
    });
    results.push({
      type: 'action',
      id: 'clear-terminal',
      label: 'Clear Terminal',
      description: 'Clear the terminal screen',
      icon: 'clear',
      shortcut: '⌘K'
    });
    results.push({
      type: 'action',
      id: 'settings',
      label: 'Settings',
      description: 'Open terminal settings',
      icon: 'settings'
    });

    this.results = results;
    this.renderResults();
  }

  /**
   * Search commands and workflows
   */
  search(query) {
    const lower = query.toLowerCase();
    const results = [];

    // Search workflows
    if (this.options.showWorkflows) {
      const matchingWorkflows = this.workflows.filter(w =>
        w.name.toLowerCase().includes(lower) ||
        w.description?.toLowerCase().includes(lower)
      );

      if (matchingWorkflows.length > 0) {
        results.push({ type: 'header', label: 'Workflows' });
        matchingWorkflows.forEach(w => {
          results.push({
            type: 'workflow',
            id: w.id,
            label: w.name,
            description: w.description,
            icon: w.icon || 'workflow',
            commands: w.commands
          });
        });
      }
    }

    // Search recent commands
    const matchingRecent = this.recentCommands.filter(cmd =>
      cmd.toLowerCase().includes(lower)
    );

    if (matchingRecent.length > 0) {
      results.push({ type: 'header', label: 'Commands' });
      matchingRecent.slice(0, 10).forEach(cmd => {
        results.push({
          type: 'command',
          command: cmd,
          label: this.highlightMatch(cmd, query),
          icon: 'terminal'
        });
      });
    }

    // Add option to run as-is if it looks like a command
    if (query.trim().length > 0) {
      results.push({ type: 'header', label: 'Run' });
      results.push({
        type: 'command',
        command: query,
        label: `Run: ${query}`,
        icon: 'play'
      });
    }

    this.results = results;
    this.renderResults();
  }

  /**
   * Render search results
   */
  renderResults() {
    let html = '';
    let itemIndex = 0;

    this.results.forEach((result, i) => {
      if (result.type === 'header') {
        html += `<div class="palette-section-header">${result.label}</div>`;
      } else {
        const isSelected = itemIndex === this.selectedIndex;
        html += `
          <div class="palette-item ${isSelected ? 'selected' : ''}" data-index="${itemIndex}" data-result-index="${i}">
            <div class="palette-item-icon">${this.getIcon(result.icon)}</div>
            <div class="palette-item-content">
              <div class="palette-item-label">${typeof result.label === 'string' ? this.escapeHtml(result.label) : result.label}</div>
              ${result.description ? `<div class="palette-item-desc">${this.escapeHtml(result.description)}</div>` : ''}
            </div>
            ${result.shortcut ? `<div class="palette-item-shortcut">${result.shortcut}</div>` : ''}
          </div>
        `;
        itemIndex++;
      }
    });

    this.resultsElement.innerHTML = html;

    // Add click handlers
    this.resultsElement.querySelectorAll('.palette-item').forEach(el => {
      el.addEventListener('click', () => {
        this.selectedIndex = parseInt(el.dataset.index);
        this.executeSelected();
      });
    });
  }

  /**
   * Highlight matching text
   */
  highlightMatch(text, query) {
    const lower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    const index = lower.indexOf(queryLower);

    if (index === -1) return this.escapeHtml(text);

    const before = text.slice(0, index);
    const match = text.slice(index, index + query.length);
    const after = text.slice(index + query.length);

    return `${this.escapeHtml(before)}<mark>${this.escapeHtml(match)}</mark>${this.escapeHtml(after)}`;
  }

  /**
   * Select next item
   */
  selectNext() {
    const selectableCount = this.results.filter(r => r.type !== 'header').length;
    if (selectableCount === 0) return;

    this.selectedIndex = (this.selectedIndex + 1) % selectableCount;
    this.updateSelection();
  }

  /**
   * Select previous item
   */
  selectPrevious() {
    const selectableCount = this.results.filter(r => r.type !== 'header').length;
    if (selectableCount === 0) return;

    this.selectedIndex = (this.selectedIndex - 1 + selectableCount) % selectableCount;
    this.updateSelection();
  }

  /**
   * Update visual selection
   */
  updateSelection() {
    this.resultsElement.querySelectorAll('.palette-item').forEach((el, i) => {
      el.classList.toggle('selected', i === this.selectedIndex);
      if (i === this.selectedIndex) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  /**
   * Execute selected item
   */
  executeSelected() {
    // Find the selected result (skip headers)
    let itemIndex = 0;
    let selectedResult = null;

    for (const result of this.results) {
      if (result.type === 'header') continue;
      if (itemIndex === this.selectedIndex) {
        selectedResult = result;
        break;
      }
      itemIndex++;
    }

    if (!selectedResult) return;

    this.close();

    switch (selectedResult.type) {
      case 'command':
        this.executeCommand(selectedResult.command);
        break;
      case 'workflow':
        this.executeWorkflow(selectedResult);
        break;
      case 'action':
        this.executeAction(selectedResult.id);
        break;
    }
  }

  /**
   * Execute a command
   */
  executeCommand(command) {
    // Add to recent
    this.addToRecent(command);

    // Emit event for terminal
    window.dispatchEvent(new CustomEvent('paletteCommand', {
      detail: { command }
    }));
  }

  /**
   * Execute a workflow
   */
  executeWorkflow(workflow) {
    window.dispatchEvent(new CustomEvent('paletteWorkflow', {
      detail: { workflow }
    }));
  }

  /**
   * Execute an action
   */
  executeAction(actionId) {
    window.dispatchEvent(new CustomEvent('paletteAction', {
      detail: { actionId }
    }));
  }

  /**
   * Add command to recent history
   */
  addToRecent(command) {
    // Remove if exists
    const index = this.recentCommands.indexOf(command);
    if (index !== -1) {
      this.recentCommands.splice(index, 1);
    }

    // Add to front
    this.recentCommands.unshift(command);

    // Trim to max
    this.recentCommands = this.recentCommands.slice(0, this.options.maxRecentCommands);

    // Save
    this.saveRecentCommands();
  }

  /**
   * Load recent commands from storage
   */
  loadRecentCommands() {
    try {
      return JSON.parse(localStorage.getItem('recentPaletteCommands') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Save recent commands to storage
   */
  saveRecentCommands() {
    localStorage.setItem('recentPaletteCommands', JSON.stringify(this.recentCommands));
  }

  /**
   * Get icon SVG
   */
  getIcon(type) {
    const icons = {
      terminal: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 7l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 11h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      workflow: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="4" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="4" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 7l4-2M6 9l4 2" stroke="currentColor" stroke-width="1.5"/></svg>',
      git: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="4" cy="4" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 6l-0.5-0.5M10 10l0.5 0.5" stroke="currentColor" stroke-width="1.5"/></svg>',
      plus: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      clear: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      settings: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      play: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 3l9 5-9 5V3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
      package: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4v8l6 3 6-3V4L8 1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M2 4l6 3 6-3M8 7v8" stroke="currentColor" stroke-width="1.5"/></svg>',
      docker: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="6" width="14" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M4 6V4M8 6V3M12 6V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
    };
    return icons[type] || icons.terminal;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use
window.CommandPalette = CommandPalette;
