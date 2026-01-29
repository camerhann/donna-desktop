/**
 * Donna Desktop - Command Blocks
 * Groups terminal commands with their output in visual blocks
 */

class CommandBlockManager {
  constructor(terminal, options = {}) {
    this.terminal = terminal;
    this.enabled = options.enabled !== false;
    this.options = {
      showTimestamps: true,
      showDuration: true,
      collapseLongOutput: true,
      collapseThreshold: 50,
      ...options
    };

    this.blocks = [];
    this.currentBlock = null;
    this.commandBuffer = '';
    this.isCapturing = false;
    this.outputBuffer = [];
    this.lastPromptLine = 0;

    // Regex patterns for detecting prompts and commands
    this.promptPatterns = [
      /[$#>]\s*$/,                    // Basic prompts
      /\w+@[\w-]+[:%].*[$#>]\s*$/,    // user@host:path$
      /^\s*\[.*\]\s*[$#>]\s*$/,       // [env] $
      /^\s*\(.*\)\s*[$#>]\s*$/,       // (venv) $
    ];

    this.blocksContainer = null;
    this.init();
  }

  init() {
    if (!this.enabled) return;

    // Create blocks overlay container
    this.blocksContainer = document.createElement('div');
    this.blocksContainer.className = 'command-blocks-container';
    this.blocksContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      pointer-events: none;
      z-index: 10;
    `;
  }

  /**
   * Enable/disable command blocks
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Process incoming terminal data
   */
  processData(data) {
    if (!this.enabled) return;

    // Check if this looks like a prompt (command input)
    const lines = data.split('\n');

    for (const line of lines) {
      if (this.isPrompt(line)) {
        // End current block if exists
        if (this.currentBlock) {
          this.finalizeBlock();
        }

        // Start capturing new command
        this.isCapturing = true;
        this.commandBuffer = '';
      } else if (this.isCapturing) {
        // Check for Enter (command execution)
        if (data.includes('\r') || data.includes('\n')) {
          if (this.commandBuffer.trim()) {
            this.startBlock(this.commandBuffer.trim());
          }
          this.isCapturing = false;
          this.commandBuffer = '';
        } else {
          // Accumulate command text
          this.commandBuffer += data;
        }
      } else if (this.currentBlock) {
        // Accumulate output
        this.outputBuffer.push(line);
      }
    }
  }

  /**
   * Check if a line looks like a shell prompt
   */
  isPrompt(line) {
    return this.promptPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Start a new command block
   */
  startBlock(command) {
    this.currentBlock = {
      id: `block-${Date.now()}`,
      command: command,
      startTime: new Date(),
      endTime: null,
      output: [],
      exitCode: null,
      collapsed: false
    };
    this.outputBuffer = [];
  }

  /**
   * Finalize the current block
   */
  finalizeBlock() {
    if (!this.currentBlock) return;

    this.currentBlock.endTime = new Date();
    this.currentBlock.output = [...this.outputBuffer];
    this.currentBlock.duration = this.currentBlock.endTime - this.currentBlock.startTime;

    // Auto-collapse if output is long
    if (this.options.collapseLongOutput &&
        this.currentBlock.output.length > this.options.collapseThreshold) {
      this.currentBlock.collapsed = true;
    }

    this.blocks.push(this.currentBlock);
    this.renderBlock(this.currentBlock);

    // Keep only last 100 blocks
    if (this.blocks.length > 100) {
      const removed = this.blocks.shift();
      this.removeBlockElement(removed.id);
    }

    this.currentBlock = null;
    this.outputBuffer = [];
  }

  /**
   * Render a command block
   */
  renderBlock(block) {
    const blockEl = document.createElement('div');
    blockEl.className = 'command-block';
    blockEl.id = block.id;
    blockEl.dataset.blockId = block.id;

    const duration = block.duration ? this.formatDuration(block.duration) : '';
    const timestamp = this.options.showTimestamps
      ? block.startTime.toLocaleTimeString()
      : '';

    const outputLines = block.collapsed
      ? block.output.slice(0, 5).join('\n') + `\n... (${block.output.length - 5} more lines)`
      : block.output.join('\n');

    blockEl.innerHTML = `
      <div class="block-header" style="pointer-events: auto;">
        <div class="block-command">
          <span class="block-prompt">$</span>
          <span class="block-cmd-text">${this.escapeHtml(block.command)}</span>
        </div>
        <div class="block-meta">
          ${this.options.showTimestamps ? `<span class="block-time">${timestamp}</span>` : ''}
          ${this.options.showDuration && duration ? `<span class="block-duration">${duration}</span>` : ''}
          <button class="block-copy" title="Copy command">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <path d="M10 4V3a1 1 0 00-1-1H3a1 1 0 00-1 1v6a1 1 0 001 1h1" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
          ${block.output.length > this.options.collapseThreshold ? `
            <button class="block-toggle" title="${block.collapsed ? 'Expand' : 'Collapse'}">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="${block.collapsed ? 'M4 6l3 3 3-3' : 'M4 8l3-3 3 3'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
      ${block.output.length > 0 ? `
        <div class="block-output ${block.collapsed ? 'collapsed' : ''}">
          <pre>${this.escapeHtml(outputLines)}</pre>
        </div>
      ` : ''}
    `;

    // Add event listeners
    const copyBtn = blockEl.querySelector('.block-copy');
    copyBtn?.addEventListener('click', () => {
      navigator.clipboard.writeText(block.command);
      this.showCopiedFeedback(copyBtn);
    });

    const toggleBtn = blockEl.querySelector('.block-toggle');
    toggleBtn?.addEventListener('click', () => {
      this.toggleBlock(block.id);
    });

    this.blocksContainer?.appendChild(blockEl);

    // Emit event for UI updates
    window.dispatchEvent(new CustomEvent('commandBlockCreated', { detail: block }));
  }

  /**
   * Toggle block collapsed state
   */
  toggleBlock(blockId) {
    const block = this.blocks.find(b => b.id === blockId);
    if (!block) return;

    block.collapsed = !block.collapsed;

    const blockEl = document.getElementById(blockId);
    if (blockEl) {
      const outputEl = blockEl.querySelector('.block-output');
      const toggleBtn = blockEl.querySelector('.block-toggle svg path');

      if (outputEl) {
        outputEl.classList.toggle('collapsed', block.collapsed);
        const outputLines = block.collapsed
          ? block.output.slice(0, 5).join('\n') + `\n... (${block.output.length - 5} more lines)`
          : block.output.join('\n');
        outputEl.querySelector('pre').textContent = outputLines;
      }

      if (toggleBtn) {
        toggleBtn.setAttribute('d', block.collapsed ? 'M4 6l3 3 3-3' : 'M4 8l3-3 3 3');
      }
    }
  }

  /**
   * Remove a block element
   */
  removeBlockElement(blockId) {
    const el = document.getElementById(blockId);
    el?.remove();
  }

  /**
   * Clear all blocks
   */
  clear() {
    this.blocks = [];
    this.currentBlock = null;
    this.outputBuffer = [];
    if (this.blocksContainer) {
      this.blocksContainer.innerHTML = '';
    }
  }

  /**
   * Format duration for display
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
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
   * Show copied feedback
   */
  showCopiedFeedback(button) {
    const original = button.innerHTML;
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3 7l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;
    button.classList.add('copied');
    setTimeout(() => {
      button.innerHTML = original;
      button.classList.remove('copied');
    }, 1500);
  }

  /**
   * Get all blocks for export/history
   */
  getBlocks() {
    return this.blocks;
  }

  /**
   * Search blocks by command
   */
  searchBlocks(query) {
    const lower = query.toLowerCase();
    return this.blocks.filter(b =>
      b.command.toLowerCase().includes(lower) ||
      b.output.some(line => line.toLowerCase().includes(lower))
    );
  }
}

// Export for use
window.CommandBlockManager = CommandBlockManager;
