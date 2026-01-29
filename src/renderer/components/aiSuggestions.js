/**
 * Donna Desktop - AI Command Suggestions
 * Provides intelligent command suggestions as you type
 */

class AISuggestionManager {
  constructor(terminal, options = {}) {
    this.terminal = terminal;
    this.enabled = options.enabled !== false;
    this.options = {
      provider: 'claude',
      triggerDelay: 500,
      showInline: true,
      maxSuggestions: 3,
      contextLines: 10,
      ...options
    };

    this.currentInput = '';
    this.suggestions = [];
    this.selectedIndex = -1;
    this.debounceTimer = null;
    this.suggestionElement = null;
    this.isVisible = false;

    // Inline suggestion renderer reference (set via setInlineRenderer)
    this.inlineRenderer = null;

    // Common command patterns for quick suggestions
    this.quickPatterns = [
      { pattern: /^git\s*$/, suggestions: ['git status', 'git add .', 'git commit -m ""', 'git push', 'git pull'] },
      { pattern: /^git a$/, suggestions: ['git add .', 'git add -A', 'git add -p'] },
      { pattern: /^git c$/, suggestions: ['git commit -m ""', 'git checkout', 'git clone'] },
      { pattern: /^npm\s*$/, suggestions: ['npm install', 'npm run dev', 'npm run build', 'npm test'] },
      { pattern: /^docker\s*$/, suggestions: ['docker ps', 'docker images', 'docker-compose up', 'docker build'] },
      { pattern: /^cd\s*$/, suggestions: ['cd ~', 'cd ..', 'cd -'] },
      { pattern: /^ls\s*$/, suggestions: ['ls -la', 'ls -lh', 'ls -R'] },
    ];

    this.init();
  }

  init() {
    if (!this.enabled) return;

    // Create suggestion dropdown
    this.suggestionElement = document.createElement('div');
    this.suggestionElement.className = 'ai-suggestions';
    this.suggestionElement.style.cssText = `
      position: absolute;
      background: var(--donna-bg-elevated, #27272a);
      border: 1px solid var(--donna-border, #3f3f46);
      border-radius: 8px;
      padding: 4px;
      display: none;
      z-index: 1000;
      min-width: 300px;
      max-width: 500px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;

    // Keyboard handling
    this.handleKeydown = this.handleKeydown.bind(this);
  }

  /**
   * Enable/disable AI suggestions
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.hide();
    }
  }

  /**
   * Attach to a terminal element
   */
  attach(terminalElement) {
    if (!this.enabled) return;

    terminalElement.parentElement?.appendChild(this.suggestionElement);
    document.addEventListener('keydown', this.handleKeydown, true);
  }

  /**
   * Detach from terminal
   */
  detach() {
    this.suggestionElement?.remove();
    document.removeEventListener('keydown', this.handleKeydown, true);
  }

  /**
   * Set the inline suggestion renderer for ghost text display
   * @param {InlineSuggestionRenderer} renderer
   */
  setInlineRenderer(renderer) {
    this.inlineRenderer = renderer;
  }

  /**
   * Handle keyboard input
   */
  handleKeydown(e) {
    if (!this.enabled || !this.isVisible) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectPrevious();
        break;
      case 'Tab':
      case 'Enter':
        if (this.selectedIndex >= 0 && this.suggestions[this.selectedIndex]) {
          e.preventDefault();
          this.acceptSuggestion(this.suggestions[this.selectedIndex]);
        }
        break;
      case 'Escape':
        this.hide();
        break;
    }
  }

  /**
   * Process input and trigger suggestions
   */
  processInput(input, cursorPosition) {
    if (!this.enabled) return;

    this.currentInput = input;

    // Clear previous timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Don't suggest for empty or very short input
    if (input.trim().length < 2) {
      this.hide();
      return;
    }

    // Check quick patterns first
    const quickSuggestions = this.getQuickSuggestions(input);
    if (quickSuggestions.length > 0) {
      this.showSuggestions(quickSuggestions, cursorPosition);
      return;
    }

    // Debounce AI suggestions
    this.debounceTimer = setTimeout(() => {
      this.fetchAISuggestions(input, cursorPosition);
    }, this.options.triggerDelay);
  }

  /**
   * Get quick pattern-based suggestions
   */
  getQuickSuggestions(input) {
    for (const { pattern, suggestions } of this.quickPatterns) {
      if (pattern.test(input)) {
        return suggestions.map(cmd => ({
          command: cmd,
          description: '',
          source: 'pattern'
        }));
      }
    }
    return [];
  }

  /**
   * Fetch AI-powered suggestions
   */
  async fetchAISuggestions(input, cursorPosition) {
    if (!this.enabled) return;

    try {
      // Get terminal history for context
      const history = this.getTerminalHistory();

      // Request suggestions via IPC
      const result = await window.donnaTerminal?.getSuggestions?.({
        input,
        history,
        cwd: this.terminal?.cwd || '~',
        provider: this.options.provider
      });

      if (result?.suggestions && result.suggestions.length > 0) {
        this.showSuggestions(result.suggestions.slice(0, this.options.maxSuggestions), cursorPosition);
      } else {
        this.hide();
      }
    } catch (error) {
      console.error('Failed to fetch AI suggestions:', error);
      this.hide();
    }
  }

  /**
   * Get recent terminal history for context
   */
  getTerminalHistory() {
    // This would be populated by the terminal component
    return window.terminalHistory?.slice(-this.options.contextLines) || [];
  }

  /**
   * Show suggestions dropdown
   */
  showSuggestions(suggestions, cursorPosition) {
    if (!this.enabled || suggestions.length === 0) {
      this.hide();
      return;
    }

    this.suggestions = suggestions;
    this.selectedIndex = 0;
    this.isVisible = true;

    // Update inline ghost text with top suggestion
    if (this.inlineRenderer && suggestions.length > 0) {
      this.inlineRenderer.show(suggestions[0].command, this.currentInput);
    }

    this.suggestionElement.innerHTML = `
      <div class="suggestions-header">
        <span class="suggestions-title">Suggestions</span>
        <span class="suggestions-hint">Tab to accept</span>
      </div>
      <div class="suggestions-list">
        ${suggestions.map((s, i) => `
          <div class="suggestion-item ${i === 0 ? 'selected' : ''}" data-index="${i}">
            <div class="suggestion-command">${this.escapeHtml(s.command)}</div>
            ${s.description ? `<div class="suggestion-desc">${this.escapeHtml(s.description)}</div>` : ''}
            ${s.source === 'ai' ? '<span class="suggestion-ai-badge">AI</span>' : ''}
          </div>
        `).join('')}
      </div>
    `;

    // Add click handlers
    this.suggestionElement.querySelectorAll('.suggestion-item').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index);
        if (this.suggestions[index]) {
          this.acceptSuggestion(this.suggestions[index]);
        }
      });
    });

    // Position near cursor
    this.positionDropdown(cursorPosition);
    this.suggestionElement.style.display = 'block';
  }

  /**
   * Position the dropdown near the cursor
   */
  positionDropdown(cursorPosition) {
    if (!cursorPosition) {
      // Default position at bottom of terminal
      this.suggestionElement.style.bottom = '60px';
      this.suggestionElement.style.left = '20px';
      return;
    }

    this.suggestionElement.style.left = `${cursorPosition.x}px`;
    this.suggestionElement.style.top = `${cursorPosition.y + 20}px`;
  }

  /**
   * Hide suggestions
   */
  hide() {
    this.isVisible = false;
    this.suggestions = [];
    this.selectedIndex = -1;
    if (this.suggestionElement) {
      this.suggestionElement.style.display = 'none';
    }
    // Also hide inline ghost text
    if (this.inlineRenderer) {
      this.inlineRenderer.hide();
    }
  }

  /**
   * Select next suggestion
   */
  selectNext() {
    if (this.suggestions.length === 0) return;

    this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
    this.updateSelection();
  }

  /**
   * Select previous suggestion
   */
  selectPrevious() {
    if (this.suggestions.length === 0) return;

    this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
    this.updateSelection();
  }

  /**
   * Update visual selection
   */
  updateSelection() {
    this.suggestionElement.querySelectorAll('.suggestion-item').forEach((el, i) => {
      el.classList.toggle('selected', i === this.selectedIndex);
    });

    // Update inline ghost text to show currently selected suggestion
    if (this.inlineRenderer && this.selectedIndex >= 0 && this.suggestions[this.selectedIndex]) {
      this.inlineRenderer.show(this.suggestions[this.selectedIndex].command, this.currentInput);
    }
  }

  /**
   * Accept a suggestion
   */
  acceptSuggestion(suggestion) {
    this.hide();

    // Emit event for terminal to insert command
    window.dispatchEvent(new CustomEvent('suggestionAccepted', {
      detail: {
        command: suggestion.command,
        original: this.currentInput
      }
    }));

    // Analytics/learning
    this.recordAcceptedSuggestion(suggestion);
  }

  /**
   * Record accepted suggestion for learning
   */
  recordAcceptedSuggestion(suggestion) {
    // Could be used to improve future suggestions
    const history = JSON.parse(localStorage.getItem('acceptedSuggestions') || '[]');
    history.push({
      command: suggestion.command,
      timestamp: Date.now(),
      context: this.currentInput
    });
    // Keep last 100
    localStorage.setItem('acceptedSuggestions', JSON.stringify(history.slice(-100)));
  }

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use
window.AISuggestionManager = AISuggestionManager;
