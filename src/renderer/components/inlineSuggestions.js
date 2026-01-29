/**
 * Donna Desktop - Inline AI Suggestions
 * Renders ghost text suggestions at the terminal cursor position
 * Similar to Copilot/GitHub Copilot inline suggestions
 */

class InlineSuggestionRenderer {
  constructor(terminal, options = {}) {
    this.terminal = terminal;
    this.options = {
      ghostTextColor: 'rgba(167, 139, 250, 0.5)', // Donna accent, dimmed
      fontStyle: 'italic',
      animationDuration: 150,
      ...options
    };

    this.overlayElement = null;
    this.currentSuggestion = null;
    this.isVisible = false;
    this.cursorPosition = { x: 0, y: 0 };

    this.init();
  }

  /**
   * Initialize the inline suggestion overlay
   */
  init() {
    // Create the ghost text overlay container
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'inline-suggestion-overlay';
    this.overlayElement.setAttribute('aria-hidden', 'true');
    this.overlayElement.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 100;
      opacity: 0;
      transition: opacity ${this.options.animationDuration}ms ease;
      font-family: "SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace;
      font-size: 13px;
      line-height: 1.4;
      white-space: pre;
      color: ${this.options.ghostTextColor};
      font-style: ${this.options.fontStyle};
      display: flex;
      align-items: center;
      gap: 4px;
    `;
  }

  /**
   * Attach the overlay to a terminal body element
   */
  attach(terminalBody) {
    if (!terminalBody) return;

    // Make sure parent has position relative for absolute positioning
    if (getComputedStyle(terminalBody).position === 'static') {
      terminalBody.style.position = 'relative';
    }

    terminalBody.appendChild(this.overlayElement);
  }

  /**
   * Detach and clean up the overlay
   */
  detach() {
    if (this.overlayElement && this.overlayElement.parentNode) {
      this.overlayElement.parentNode.removeChild(this.overlayElement);
    }
  }

  /**
   * Get the pixel position for the terminal cursor
   * @returns {Object} { x, y, cellWidth, cellHeight }
   */
  getCursorPixelPosition() {
    const term = this.terminal?.term;
    if (!term) return null;

    try {
      // Get cursor position in terminal grid
      const buffer = term.buffer.active;
      const cursorX = buffer.cursorX;
      const cursorY = buffer.cursorY;

      // Get cell dimensions from xterm's render service
      // xterm.js stores dimensions in _core._renderService._dimensions
      let cellWidth = 8;  // Default fallback
      let cellHeight = 18; // Default fallback

      // Try to get actual cell dimensions
      if (term._core && term._core._renderService) {
        const dims = term._core._renderService.dimensions;
        if (dims) {
          cellWidth = dims.css?.cell?.width || dims.actualCellWidth || cellWidth;
          cellHeight = dims.css?.cell?.height || dims.actualCellHeight || cellHeight;
        }
      }

      // Calculate pixel position
      const x = cursorX * cellWidth;
      const y = cursorY * cellHeight;

      return { x, y, cellWidth, cellHeight, cursorX, cursorY };
    } catch (error) {
      console.warn('Failed to get cursor position:', error);
      return null;
    }
  }

  /**
   * Show inline suggestion at current cursor position
   * @param {string} suggestionText - The suggestion to display as ghost text
   * @param {string} currentInput - The current input (to calculate remaining text)
   */
  show(suggestionText, currentInput = '') {
    if (!this.overlayElement || !suggestionText) {
      this.hide();
      return;
    }

    // Calculate what part of the suggestion to show
    // If suggestion starts with current input, show only the remaining part
    let ghostText = suggestionText;
    if (currentInput && suggestionText.toLowerCase().startsWith(currentInput.toLowerCase())) {
      ghostText = suggestionText.slice(currentInput.length);
    }

    if (!ghostText) {
      this.hide();
      return;
    }

    this.currentSuggestion = suggestionText;

    // Get cursor position
    const pos = this.getCursorPixelPosition();
    if (!pos) {
      this.hide();
      return;
    }

    // Position the overlay at cursor
    this.overlayElement.style.left = `${pos.x}px`;
    this.overlayElement.style.top = `${pos.y}px`;

    // Set the ghost text content with hint
    this.overlayElement.innerHTML = `
      <span class="ghost-text">${this.escapeHtml(ghostText)}</span>
      <span class="ghost-hint">Tab</span>
    `;

    // Make visible
    this.overlayElement.style.opacity = '1';
    this.isVisible = true;
  }

  /**
   * Hide the inline suggestion
   */
  hide() {
    if (!this.overlayElement) return;

    this.overlayElement.style.opacity = '0';
    this.isVisible = false;
    this.currentSuggestion = null;
  }

  /**
   * Get the current suggestion text
   * @returns {string|null}
   */
  getCurrentSuggestion() {
    return this.currentSuggestion;
  }

  /**
   * Check if suggestion is currently visible
   * @returns {boolean}
   */
  isShowing() {
    return this.isVisible;
  }

  /**
   * Update suggestion position (call on cursor move)
   */
  updatePosition() {
    if (!this.isVisible) return;

    const pos = this.getCursorPixelPosition();
    if (pos) {
      this.overlayElement.style.left = `${pos.x}px`;
      this.overlayElement.style.top = `${pos.y}px`;
    }
  }

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Clean up and destroy
   */
  destroy() {
    this.hide();
    this.detach();
    this.overlayElement = null;
    this.terminal = null;
  }
}

// Add CSS for inline suggestions
(function addInlineSuggestionStyles() {
  if (document.getElementById('inline-suggestion-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'inline-suggestion-styles';
  styles.textContent = `
    .inline-suggestion-overlay {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .inline-suggestion-overlay .ghost-text {
      color: rgba(167, 139, 250, 0.5);
      font-style: italic;
    }

    .inline-suggestion-overlay .ghost-hint {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 1px 4px;
      margin-left: 8px;
      background: rgba(167, 139, 250, 0.15);
      color: rgba(167, 139, 250, 0.7);
      font-size: 9px;
      font-weight: 600;
      border-radius: 3px;
      font-style: normal;
      text-transform: uppercase;
    }
  `;
  document.head.appendChild(styles);
})();

// Export for use
window.InlineSuggestionRenderer = InlineSuggestionRenderer;
