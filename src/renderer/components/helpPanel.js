/**
 * Donna Desktop - Help Panel
 * Shows keyboard shortcuts and feature documentation
 */

class HelpPanel {
  constructor() {
    this.isOpen = false;
    this.element = null;
    this.isMac = window.platform?.isMac ?? navigator.platform.includes('Mac');

    this.init();
  }

  /**
   * Get the modifier key symbol based on platform
   */
  get modKey() {
    return this.isMac ? '\u2318' : 'Ctrl';
  }

  /**
   * Get the shift symbol based on platform
   */
  get shiftKey() {
    return this.isMac ? '\u21E7' : 'Shift';
  }

  /**
   * Get the option/alt key symbol based on platform
   */
  get altKey() {
    return this.isMac ? '\u2325' : 'Alt';
  }

  /**
   * Initialize the help panel
   */
  init() {
    this.element = document.createElement('div');
    this.element.className = 'help-panel';
    this.element.innerHTML = `
      <div class="help-backdrop"></div>
      <div class="help-panel-content">
        <div class="help-header">
          <h2>Keyboard Shortcuts & Help</h2>
          <button class="help-close" aria-label="Close help panel">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="help-content">
          <!-- Sessions Section -->
          <div class="help-section">
            <h3 class="help-section-title">Sessions</h3>
            <div class="shortcuts-grid">
              ${this.renderShortcut(`${this.modKey}T`, 'New terminal session')}
              ${this.renderShortcut(`${this.modKey}N`, 'New AI conversation')}
              ${this.renderShortcut(`${this.modKey}W`, 'Close current session')}
              ${this.renderShortcut(`${this.modKey}]`, 'Next session')}
              ${this.renderShortcut(`${this.modKey}[`, 'Previous session')}
              ${this.renderShortcut(`${this.modKey}1-9`, 'Switch to session by number')}
            </div>
          </div>

          <!-- Terminal Section -->
          <div class="help-section">
            <h3 class="help-section-title">Terminal</h3>
            <div class="shortcuts-grid">
              ${this.renderShortcut(`${this.modKey}K`, 'Clear terminal')}
              ${this.renderShortcut(`${this.modKey}${this.shiftKey}P`, 'Command palette')}
              ${this.renderShortcut('Ctrl+R', 'Search command history')}
              ${this.renderShortcut(`${this.modKey},`, 'Open settings')}
              ${this.renderShortcut(`${this.modKey}.`, 'Toggle context sidebar')}
            </div>
          </div>

          <!-- Features Section -->
          <div class="help-section">
            <h3 class="help-section-title">Features</h3>
            <div class="shortcuts-grid">
              ${this.renderShortcut(`${this.modKey}G`, 'Open image generator')}
              ${this.renderShortcut(`${this.modKey}?`, 'Show this help panel')}
            </div>
          </div>

          <!-- Feature Documentation -->
          <div class="help-section">
            <h3 class="help-section-title">About Donna Desktop</h3>
            <div class="help-features">
              <div class="help-feature">
                <div class="help-feature-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M6 9l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M10 13h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="help-feature-content">
                  <h4>Terminal Sessions</h4>
                  <p>Create multiple terminal sessions with full PTY support. Each session runs in its own shell with proper environment isolation.</p>
                </div>
              </div>

              <div class="help-feature">
                <div class="help-feature-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M2 4h16a1 1 0 011 1v9a1 1 0 01-1 1H6l-4 4v-4a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                    <circle cx="6" cy="9.5" r="1" fill="currentColor"/>
                    <circle cx="10" cy="9.5" r="1" fill="currentColor"/>
                    <circle cx="14" cy="9.5" r="1" fill="currentColor"/>
                  </svg>
                </div>
                <div class="help-feature-content">
                  <h4>AI Conversations</h4>
                  <p>Chat with Donna, Jarvis, or Claude. Each agent has unique capabilities and personality. Start a conversation with ${this.modKey}N.</p>
                </div>
              </div>

              <div class="help-feature">
                <div class="help-feature-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M10 6v4l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div class="help-feature-content">
                  <h4>Command Blocks</h4>
                  <p>Commands are grouped with their output for easy navigation. View timestamps, duration, and copy any command with one click.</p>
                </div>
              </div>

              <div class="help-feature">
                <div class="help-feature-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 5h14M3 10h14M3 15h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    <circle cx="15" cy="15" r="3" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M17 17l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="help-feature-content">
                  <h4>Command Palette</h4>
                  <p>Quick access to commands, workflows, and actions. Press ${this.modKey}${this.shiftKey}P to open and start typing.</p>
                </div>
              </div>

              <div class="help-feature">
                <div class="help-feature-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M3 7h14" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M7 7v10" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                </div>
                <div class="help-feature-content">
                  <h4>Context Sidebar</h4>
                  <p>Automatically extracts files and links from terminal output. Toggle with ${this.modKey}. to show or hide.</p>
                </div>
              </div>

              <div class="help-feature">
                <div class="help-feature-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="5" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/>
                    <circle cx="15" cy="5" r="2.5" stroke="currentColor" stroke-width="1.5"/>
                    <circle cx="15" cy="15" r="2.5" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M7.5 9l5-3M7.5 11l5 3" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                </div>
                <div class="help-feature-content">
                  <h4>Workflows</h4>
                  <p>Save and run multi-step command sequences. Create custom workflows in Settings or use the built-in ones from the command palette.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Version Info -->
          <div class="help-footer">
            <p class="help-version">Donna Desktop v1.0</p>
            <p class="help-hint">Press <kbd>Esc</kbd> or click outside to close</p>
          </div>
        </div>
      </div>
    `;

    this.element.style.display = 'none';
    document.body.appendChild(this.element);

    // Event listeners
    this.element.querySelector('.help-backdrop').addEventListener('click', () => this.close());
    this.element.querySelector('.help-close').addEventListener('click', () => this.close());

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        this.close();
      }
    });

    // Cmd+? / Ctrl+? to toggle
    document.addEventListener('keydown', (e) => {
      const isMac = window.platform?.isMac ?? navigator.platform.includes('Mac');
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Check for ? key (which is Shift+/ on most keyboards)
      if (cmdOrCtrl && e.shiftKey && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Render a single shortcut item
   */
  renderShortcut(keys, description) {
    const keyParts = keys.split('+').map(k => k.trim());
    const keysHtml = keyParts.map(k => `<kbd>${this.escapeHtml(k)}</kbd>`).join('');

    return `
      <div class="shortcut-item">
        <div class="shortcut-keys">${keysHtml}</div>
        <div class="shortcut-desc">${this.escapeHtml(description)}</div>
      </div>
    `;
  }

  /**
   * Toggle help panel
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open help panel
   */
  open() {
    this.isOpen = true;
    this.element.style.display = 'flex';

    requestAnimationFrame(() => {
      this.element.classList.add('open');
    });
  }

  /**
   * Close help panel
   */
  close() {
    this.isOpen = false;
    this.element.classList.remove('open');

    setTimeout(() => {
      this.element.style.display = 'none';
    }, 200);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export
window.HelpPanel = HelpPanel;
