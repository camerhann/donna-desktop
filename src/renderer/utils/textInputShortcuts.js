/**
 * TextInputShortcuts - macOS-style cursor movement and editing shortcuts
 *
 * Provides standard text editing shortcuts for textarea elements:
 * - Cmd+Left/Right: Jump to beginning/end of line
 * - Option+Left/Right: Jump by word
 * - Cmd+Up/Down: Jump to beginning/end of document
 * - Cmd+Backspace: Delete to beginning of line
 * - Option+Backspace: Delete word backward
 * - Cmd+Delete: Delete to end of line
 * - Option+Delete: Delete word forward
 * - All movements support Shift for selection
 */

class TextInputShortcuts {
  /**
   * Create a TextInputShortcuts handler
   * @param {HTMLTextAreaElement} textarea - The textarea element to enhance
   * @param {Object} options - Configuration options
   * @param {Function} options.onInput - Callback when content changes
   */
  constructor(textarea, options = {}) {
    this.textarea = textarea;
    this.options = {
      onInput: options.onInput || null,
      ...options
    };

    // Bind the handler to preserve context
    this.handleKeydown = this.handleKeydown.bind(this);

    // Attach the event listener
    this.textarea.addEventListener('keydown', this.handleKeydown);
  }

  /**
   * Handle keydown events for shortcuts
   * @param {KeyboardEvent} e - The keyboard event
   * @returns {boolean} - Whether the event was handled
   */
  handleKeydown(e) {
    const isMac = navigator.platform.includes('Mac');
    const cmdKey = isMac ? e.metaKey : e.ctrlKey;
    const optKey = e.altKey;

    // Skip if no modifier keys relevant to our shortcuts
    if (!cmdKey && !optKey) return false;

    let handled = false;

    // Cmd+Left: Beginning of line
    if (cmdKey && !optKey && e.key === 'ArrowLeft') {
      this.moveToLineStart(e.shiftKey);
      handled = true;
    }

    // Cmd+Right: End of line
    else if (cmdKey && !optKey && e.key === 'ArrowRight') {
      this.moveToLineEnd(e.shiftKey);
      handled = true;
    }

    // Option+Left: Word backward
    else if (optKey && !cmdKey && e.key === 'ArrowLeft') {
      this.moveWordBackward(e.shiftKey);
      handled = true;
    }

    // Option+Right: Word forward
    else if (optKey && !cmdKey && e.key === 'ArrowRight') {
      this.moveWordForward(e.shiftKey);
      handled = true;
    }

    // Cmd+Up: Beginning of document
    else if (cmdKey && !optKey && e.key === 'ArrowUp') {
      this.moveToDocumentStart(e.shiftKey);
      handled = true;
    }

    // Cmd+Down: End of document
    else if (cmdKey && !optKey && e.key === 'ArrowDown') {
      this.moveToDocumentEnd(e.shiftKey);
      handled = true;
    }

    // Cmd+Backspace: Delete to beginning of line
    else if (cmdKey && !optKey && e.key === 'Backspace') {
      this.deleteToLineStart();
      handled = true;
    }

    // Option+Backspace: Delete word backward
    else if (optKey && !cmdKey && e.key === 'Backspace') {
      this.deleteWordBackward();
      handled = true;
    }

    // Cmd+Delete: Delete to end of line (macOS uses Fn+Delete for forward delete)
    else if (cmdKey && !optKey && e.key === 'Delete') {
      this.deleteToLineEnd();
      handled = true;
    }

    // Option+Delete: Delete word forward
    else if (optKey && !cmdKey && e.key === 'Delete') {
      this.deleteWordForward();
      handled = true;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }

    return handled;
  }

  /**
   * Find the start position of the current line
   * @returns {number} - The position of the line start
   */
  getLineStartPosition() {
    const text = this.textarea.value;
    const cursorPos = this.textarea.selectionStart;

    // Find the last newline before cursor, or start of text
    const lineStart = text.lastIndexOf('\n', cursorPos - 1);
    return lineStart === -1 ? 0 : lineStart + 1;
  }

  /**
   * Find the end position of the current line
   * @returns {number} - The position of the line end
   */
  getLineEndPosition() {
    const text = this.textarea.value;
    const cursorPos = this.textarea.selectionStart;

    // Find the next newline after cursor, or end of text
    const lineEnd = text.indexOf('\n', cursorPos);
    return lineEnd === -1 ? text.length : lineEnd;
  }

  /**
   * Find the start of the previous word
   * @returns {number} - The position of the word start
   */
  getWordBackwardPosition() {
    const text = this.textarea.value;
    let pos = this.textarea.selectionStart;

    // Skip any whitespace immediately before cursor
    while (pos > 0 && /\s/.test(text[pos - 1])) {
      pos--;
    }

    // Skip the word characters
    while (pos > 0 && /[^\s]/.test(text[pos - 1])) {
      pos--;
    }

    return pos;
  }

  /**
   * Find the end of the next word
   * @returns {number} - The position after the word end
   */
  getWordForwardPosition() {
    const text = this.textarea.value;
    let pos = this.textarea.selectionStart;
    const len = text.length;

    // Skip any whitespace immediately after cursor
    while (pos < len && /\s/.test(text[pos])) {
      pos++;
    }

    // Skip the word characters
    while (pos < len && /[^\s]/.test(text[pos])) {
      pos++;
    }

    return pos;
  }

  /**
   * Move cursor to beginning of current line
   * @param {boolean} extendSelection - Whether to extend the selection
   */
  moveToLineStart(extendSelection = false) {
    const lineStart = this.getLineStartPosition();
    this.setCursorPosition(lineStart, extendSelection);
  }

  /**
   * Move cursor to end of current line
   * @param {boolean} extendSelection - Whether to extend the selection
   */
  moveToLineEnd(extendSelection = false) {
    const lineEnd = this.getLineEndPosition();
    this.setCursorPosition(lineEnd, extendSelection);
  }

  /**
   * Move cursor one word backward
   * @param {boolean} extendSelection - Whether to extend the selection
   */
  moveWordBackward(extendSelection = false) {
    const wordStart = this.getWordBackwardPosition();
    this.setCursorPosition(wordStart, extendSelection);
  }

  /**
   * Move cursor one word forward
   * @param {boolean} extendSelection - Whether to extend the selection
   */
  moveWordForward(extendSelection = false) {
    const wordEnd = this.getWordForwardPosition();
    this.setCursorPosition(wordEnd, extendSelection);
  }

  /**
   * Move cursor to beginning of document
   * @param {boolean} extendSelection - Whether to extend the selection
   */
  moveToDocumentStart(extendSelection = false) {
    this.setCursorPosition(0, extendSelection);
  }

  /**
   * Move cursor to end of document
   * @param {boolean} extendSelection - Whether to extend the selection
   */
  moveToDocumentEnd(extendSelection = false) {
    this.setCursorPosition(this.textarea.value.length, extendSelection);
  }

  /**
   * Set cursor position, optionally extending selection
   * @param {number} newPos - The new cursor position
   * @param {boolean} extendSelection - Whether to extend the selection
   */
  setCursorPosition(newPos, extendSelection = false) {
    if (extendSelection) {
      // Extend selection from current anchor point
      // The anchor is the non-moving end of the selection
      const currentStart = this.textarea.selectionStart;
      const currentEnd = this.textarea.selectionEnd;
      const currentPos = this.textarea.selectionDirection === 'backward' ? currentStart : currentEnd;

      // Determine anchor position (the end that doesn't move)
      let anchor;
      if (currentStart === currentEnd) {
        // No selection yet, anchor is current position
        anchor = currentStart;
      } else {
        // Selection exists, anchor is the opposite end
        anchor = this.textarea.selectionDirection === 'backward' ? currentEnd : currentStart;
      }

      // Set the new selection
      if (newPos < anchor) {
        this.textarea.setSelectionRange(newPos, anchor, 'backward');
      } else {
        this.textarea.setSelectionRange(anchor, newPos, 'forward');
      }
    } else {
      // Just move cursor, collapse any selection
      this.textarea.setSelectionRange(newPos, newPos);
    }
  }

  /**
   * Delete from cursor to beginning of line
   */
  deleteToLineStart() {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const lineStart = this.getLineStartPosition();

    if (start !== end) {
      // If there's a selection, delete it
      this.deleteSelection();
    } else if (start > lineStart) {
      // Delete from cursor to line start
      this.deleteRange(lineStart, start);
    }
  }

  /**
   * Delete from cursor to end of line
   */
  deleteToLineEnd() {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const lineEnd = this.getLineEndPosition();

    if (start !== end) {
      // If there's a selection, delete it
      this.deleteSelection();
    } else if (start < lineEnd) {
      // Delete from cursor to line end
      this.deleteRange(start, lineEnd);
    }
  }

  /**
   * Delete one word backward from cursor
   */
  deleteWordBackward() {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;

    if (start !== end) {
      // If there's a selection, delete it
      this.deleteSelection();
    } else if (start > 0) {
      const wordStart = this.getWordBackwardPosition();
      this.deleteRange(wordStart, start);
    }
  }

  /**
   * Delete one word forward from cursor
   */
  deleteWordForward() {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;

    if (start !== end) {
      // If there's a selection, delete it
      this.deleteSelection();
    } else if (start < this.textarea.value.length) {
      const wordEnd = this.getWordForwardPosition();
      this.deleteRange(start, wordEnd);
    }
  }

  /**
   * Delete the current selection
   */
  deleteSelection() {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    if (start !== end) {
      this.deleteRange(start, end);
    }
  }

  /**
   * Delete a range of text and trigger input callback
   * @param {number} start - Start position of range to delete
   * @param {number} end - End position of range to delete
   */
  deleteRange(start, end) {
    const text = this.textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end);

    this.textarea.value = before + after;
    this.textarea.setSelectionRange(start, start);

    // Trigger input callback for UI updates
    if (this.options.onInput) {
      this.options.onInput();
    }

    // Dispatch input event for other listeners
    this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Detach event listeners and clean up
   */
  destroy() {
    this.textarea.removeEventListener('keydown', this.handleKeydown);
    this.textarea = null;
    this.options = null;
  }
}

// Export for use in other modules
window.TextInputShortcuts = TextInputShortcuts;
