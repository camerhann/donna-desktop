/**
 * Donna Desktop - Input Detector Utility
 * Detects when terminal is waiting for user input (prompts, passwords, confirmations)
 * Provides visual feedback via sidebar pulse animation
 */

class InputDetector {
  constructor() {
    // Patterns that indicate the terminal is waiting for input
    this.inputPromptPatterns = [
      // Shell prompts
      /\$ $/, // Bash dollar prompt at end
      /> $/,  // Generic prompt arrow
      /# $/,  // Root prompt
      /% $/,  // Zsh percent prompt

      // Password/auth prompts
      /password.*:/i,
      /passphrase.*:/i,
      /enter.*password/i,
      /\[sudo\].*password/i,

      // Confirmations
      /\[y\/n\]/i,
      /\[yes\/no\]/i,
      /\(y\/n\)/i,
      /\(yes\/no\)/i,
      /continue\?/i,
      /proceed\?/i,
      /overwrite\?/i,

      // Generic prompts
      /\? $/,          // Question mark prompt
      /: $/,           // Colon prompt (common for input)
      /input.*:/i,
      /enter.*:/i,
      /type.*:/i,

      // Git prompts
      /pick.*commit/i,
      /please enter.*message/i,
      /what now/i,

      // SSH/connection prompts
      /are you sure.*continue connecting/i,
      /fingerprint/i,

      // Package manager prompts
      /do you want to continue/i,
      /press enter to continue/i,
      /press any key/i
    ];

    // Debounce to avoid flickering
    this.debounceMs = 300;
    this.debounceTimer = null;
    this.buffer = '';
    this.maxBufferSize = 1000; // Keep last N characters for pattern matching

    // Current state
    this.inputRequired = false;
  }

  /**
   * Process incoming PTY data and detect input prompts
   * @param {string} data - Raw data from PTY
   * @param {function} callback - Called with (inputRequired: boolean) when state changes
   */
  processData(data, callback) {
    // Append to buffer, keeping it at max size
    this.buffer += data;
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.maxBufferSize);
    }

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce the check to avoid rapid state changes
    this.debounceTimer = setTimeout(() => {
      this.checkForInputPrompt(callback);
    }, this.debounceMs);
  }

  /**
   * Check buffer for input prompt patterns
   * @param {function} callback - Called with (inputRequired: boolean) when state changes
   */
  checkForInputPrompt(callback) {
    // Strip ANSI escape codes for cleaner matching
    const cleanBuffer = this.stripAnsi(this.buffer);

    // Check last ~100 characters for prompt patterns (prompts are typically at end)
    const tail = cleanBuffer.slice(-100);

    let isInputRequired = false;

    for (const pattern of this.inputPromptPatterns) {
      if (pattern.test(tail)) {
        isInputRequired = true;
        break;
      }
    }

    // Only call callback if state changed
    if (isInputRequired !== this.inputRequired) {
      this.inputRequired = isInputRequired;
      if (callback) {
        callback(isInputRequired);
      }
    }
  }

  /**
   * Strip ANSI escape codes from text
   * @param {string} text - Text with potential ANSI codes
   * @returns {string} Clean text
   */
  stripAnsi(text) {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
               .replace(/\x1b\][^\x07]*\x07/g, '') // OSC sequences
               .replace(/\x1b[PX^_][^\x1b]*\x1b\\/g, ''); // DCS, PM, APC, SOS sequences
  }

  /**
   * Clear input required state (call when user types)
   * @param {function} callback - Called with (inputRequired: false)
   */
  clearInputRequired(callback) {
    if (this.inputRequired) {
      this.inputRequired = false;
      if (callback) {
        callback(false);
      }
    }
  }

  /**
   * Reset the detector state
   */
  reset() {
    this.buffer = '';
    this.inputRequired = false;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Destroy the detector and clean up
   */
  destroy() {
    this.reset();
  }
}

// Export for use in other modules
window.InputDetector = InputDetector;
