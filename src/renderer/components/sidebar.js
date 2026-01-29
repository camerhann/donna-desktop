/**
 * Donna Desktop - Sidebar Component
 * Slack-style session management sidebar
 */

class DonnaSidebar {
  constructor() {
    this.sessionList = document.getElementById('session-list');
    this.newSessionBtn = document.getElementById('new-session-btn');
    this.settingsBtn = document.getElementById('settings-btn');

    this.init();
  }

  init() {
    // Bind new session button
    this.newSessionBtn?.addEventListener('click', () => {
      window.sessionManager?.createSession();
    });

    // Keyboard shortcut for new session (Cmd+T)
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        window.sessionManager?.createSession();
      }
    });

    // Show empty state initially
    this.renderEmptyState();
  }

  /**
   * Render the empty state when no sessions exist
   */
  renderEmptyState() {
    this.sessionList.innerHTML = `
      <div class="session-list-empty">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="4" y="8" width="24" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8 14h8M8 18h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <p>No sessions yet.<br/>Press <strong>⌘T</strong> to start.</p>
      </div>
    `;
  }

  /**
   * Add a session to the sidebar
   */
  addSession(session) {
    // Remove empty state if present
    const emptyState = this.sessionList.querySelector('.session-list-empty');
    if (emptyState) {
      emptyState.remove();
    }

    const sessionEl = document.createElement('div');
    sessionEl.className = 'session-item slide-in-left';
    sessionEl.dataset.sessionId = session.id;
    sessionEl.innerHTML = `
      <div class="session-icon">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M5 7l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
        </svg>
      </div>
      <div class="session-info">
        <div class="session-name">${session.name}</div>
        <div class="session-path">${session.path || '~'}</div>
      </div>
      <div class="session-status"></div>
      <button class="session-close" title="Close session">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    // Click to select session
    sessionEl.addEventListener('click', (e) => {
      // Don't trigger if clicking close button
      if (e.target.closest('.session-close')) return;
      window.sessionManager?.switchToSession(session.id);
    });

    // Close button
    const closeBtn = sessionEl.querySelector('.session-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.sessionManager?.closeSession(session.id);
    });

    this.sessionList.appendChild(sessionEl);
  }

  /**
   * Remove a session from the sidebar
   */
  removeSession(sessionId) {
    const sessionEl = this.sessionList.querySelector(`[data-session-id="${sessionId}"]`);
    if (sessionEl) {
      sessionEl.style.opacity = '0';
      sessionEl.style.transform = 'translateX(-10px)';
      setTimeout(() => {
        sessionEl.remove();
        // Show empty state if no sessions left
        if (this.sessionList.children.length === 0) {
          this.renderEmptyState();
        }
      }, 200);
    }
  }

  /**
   * Set the active session in the sidebar
   */
  setActiveSession(sessionId) {
    // Remove active class from all sessions
    this.sessionList.querySelectorAll('.session-item').forEach(el => {
      el.classList.remove('active');
    });

    // Add active class to selected session
    const sessionEl = this.sessionList.querySelector(`[data-session-id="${sessionId}"]`);
    if (sessionEl) {
      sessionEl.classList.add('active');
    }
  }

  /**
   * Update session info (name, path)
   */
  updateSession(sessionId, updates) {
    const sessionEl = this.sessionList.querySelector(`[data-session-id="${sessionId}"]`);
    if (sessionEl) {
      if (updates.name) {
        const nameEl = sessionEl.querySelector('.session-name');
        if (nameEl) nameEl.textContent = updates.name;
      }
      if (updates.path) {
        const pathEl = sessionEl.querySelector('.session-path');
        if (pathEl) pathEl.textContent = updates.path;
      }
      if (updates.status !== undefined) {
        const statusEl = sessionEl.querySelector('.session-status');
        if (statusEl) {
          statusEl.classList.toggle('inactive', !updates.status);
        }
      }
    }
  }

  /**
   * Rename a session (double-click to edit)
   */
  enableRename(sessionId) {
    const sessionEl = this.sessionList.querySelector(`[data-session-id="${sessionId}"]`);
    if (!sessionEl) return;

    const nameEl = sessionEl.querySelector('.session-name');
    const currentName = nameEl.textContent;

    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.style.cssText = `
      width: 100%;
      background: var(--donna-bg-secondary);
      border: 1px solid var(--donna-accent);
      border-radius: 4px;
      padding: 2px 6px;
      color: var(--donna-text-primary);
      font-size: 13px;
      font-weight: 500;
    `;

    nameEl.replaceWith(input);
    input.focus();
    input.select();

    const save = () => {
      const newName = input.value.trim() || currentName;
      const newNameEl = document.createElement('div');
      newNameEl.className = 'session-name';
      newNameEl.textContent = newName;
      input.replaceWith(newNameEl);
      window.sessionManager?.renameSession(sessionId, newName);
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        input.blur();
      } else if (e.key === 'Escape') {
        input.value = currentName;
        input.blur();
      }
    });
  }
}

// Export for use in other modules
window.DonnaSidebar = DonnaSidebar;
