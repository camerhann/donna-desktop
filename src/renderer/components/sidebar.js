/**
 * Donna Desktop - Sidebar Component
 * Slack-style session management sidebar with Terminal and Chat support
 */

class DonnaSidebar {
  constructor() {
    this.sessionList = document.getElementById('session-list');
    this.newSessionBtn = document.getElementById('new-session-btn');
    this.settingsBtn = document.getElementById('settings-btn');
    this.newChatBtn = document.getElementById('new-chat-btn');

    this.init();
  }

  init() {
    // New terminal session button
    this.newSessionBtn?.addEventListener('click', () => {
      window.sessionManager?.createTerminalSession();
    });

    // Note: New chat/agent button is handled by app.js to open agent picker
    // Keyboard shortcuts (Cmd+T, Cmd+N) are also handled globally in app.js

    // Show empty state initially
    this.renderEmptyState();
  }

  /**
   * Render the empty state when no sessions exist
   */
  renderEmptyState() {
    this.sessionList.setAttribute('role', 'list');
    this.sessionList.setAttribute('aria-label', 'Sessions');
    this.sessionList.innerHTML = `
      <div class="session-list-empty" role="listitem">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="4" y="8" width="24" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8 14h8M8 18h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <p>No sessions yet.<br/><strong>⌘T</strong> Terminal · <strong>⌘N</strong> Chat</p>
      </div>
    `;
  }

  /**
   * Get icon for session based on type and agent info
   */
  getSessionIcon(session) {
    if (session.type === 'agent' && session.agentInfo) {
      // Agent icon with custom color
      return `<span class="agent-letter" style="color: ${session.agentInfo.color}">${session.agentInfo.icon}</span>`;
    }
    if (session.type === 'duel') {
      // Arena/duel icon
      return `<span class="arena-letter">VS</span>`;
    }
    if (session.type === 'chat') {
      return `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 3h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3v-3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="5" cy="7.5" r="1" fill="currentColor"/>
          <circle cx="8" cy="7.5" r="1" fill="currentColor"/>
          <circle cx="11" cy="7.5" r="1" fill="currentColor"/>
        </svg>
      `;
    }
    // Terminal icon
    return `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5 7l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 11h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
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

    // Ensure list has proper ARIA attributes
    this.sessionList.setAttribute('role', 'list');
    this.sessionList.setAttribute('aria-label', 'Sessions');

    const sessionEl = document.createElement('div');
    const sessionTypeClass = session.type === 'agent' ? 'agent-session' :
                             session.type === 'chat' ? 'chat-session' : 'terminal-session';
    sessionEl.className = `session-item slide-in-left ${sessionTypeClass}`;
    sessionEl.setAttribute('role', 'listitem');
    sessionEl.setAttribute('tabindex', '0');
    sessionEl.dataset.sessionId = session.id;
    sessionEl.dataset.sessionType = session.type || 'terminal';

    // Determine subtitle based on session type
    let subtitle = session.path || '~';
    if (session.type === 'agent' && session.agentInfo) {
      subtitle = session.agentInfo.cli || 'claude';
    } else if (session.type === 'chat') {
      subtitle = session.provider || 'Claude';
    }

    sessionEl.innerHTML = `
      <div class="session-icon">
        ${this.getSessionIcon(session)}
      </div>
      <div class="session-info">
        <div class="session-name">${session.name}</div>
        <div class="session-path">${subtitle}</div>
      </div>
      <div class="session-status"></div>
      <button class="session-pin" title="Pin session" aria-label="Pin ${session.name} session">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M6 1v4M4 5h4l-1 4H5L4 5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6 9v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="session-close" title="Close session" aria-label="Close ${session.name} session">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    // Click to select session
    sessionEl.addEventListener('click', (e) => {
      if (e.target.closest('.session-close')) return;
      window.sessionManager?.switchToSession(session.id);
    });

    // Keyboard navigation for session items
    sessionEl.addEventListener('keydown', (e) => {
      if (e.target.closest('.session-close')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.sessionManager?.switchToSession(session.id);
      }
    });

    // Double-click to rename
    sessionEl.addEventListener('dblclick', (e) => {
      if (e.target.closest('.session-close')) return;
      this.enableRename(session.id);
    });

    // Pin button
    const pinBtn = sessionEl.querySelector('.session-pin');
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.sessionManager?.togglePin(session.id);
    });

    // Close button
    const closeBtn = sessionEl.querySelector('.session-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.sessionManager?.closeSession(session.id);
    });

    // Check if session is pinned and update UI
    if (session.pinned) {
      sessionEl.classList.add('pinned');
      pinBtn.title = 'Unpin session';
      pinBtn.setAttribute('aria-label', `Unpin ${session.name} session`);
    }

    // Insert in correct position (pinned sessions first)
    this.insertSessionInOrder(sessionEl, session.pinned);
  }

  /**
   * Insert session element in correct order (pinned first)
   */
  insertSessionInOrder(sessionEl, isPinned) {
    if (isPinned) {
      // Insert pinned sessions at the top, but after other pinned sessions
      const firstUnpinned = this.sessionList.querySelector('.session-item:not(.pinned)');
      if (firstUnpinned) {
        this.sessionList.insertBefore(sessionEl, firstUnpinned);
      } else {
        this.sessionList.appendChild(sessionEl);
      }
    } else {
      // Insert unpinned sessions at the end
      this.sessionList.appendChild(sessionEl);
    }
  }

  /**
   * Update pinned state of a session in the UI
   */
  setPinned(sessionId, isPinned) {
    const sessionEl = this.sessionList.querySelector(`[data-session-id="${sessionId}"]`);
    if (!sessionEl) return;

    const pinBtn = sessionEl.querySelector('.session-pin');
    const sessionName = sessionEl.querySelector('.session-name')?.textContent || 'session';

    if (isPinned) {
      sessionEl.classList.add('pinned');
      pinBtn.title = 'Unpin session';
      pinBtn.setAttribute('aria-label', `Unpin ${sessionName} session`);
    } else {
      sessionEl.classList.remove('pinned');
      pinBtn.title = 'Pin session';
      pinBtn.setAttribute('aria-label', `Pin ${sessionName} session`);
    }

    // Re-sort the session list
    this.sortSessions();
  }

  /**
   * Sort sessions with pinned ones at top
   */
  sortSessions() {
    const items = Array.from(this.sessionList.querySelectorAll('.session-item'));
    const pinned = items.filter(el => el.classList.contains('pinned'));
    const unpinned = items.filter(el => !el.classList.contains('pinned'));

    // Re-append in order: pinned first, then unpinned
    [...pinned, ...unpinned].forEach(el => {
      this.sessionList.appendChild(el);
    });
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
    this.sessionList.querySelectorAll('.session-item').forEach(el => {
      el.classList.remove('active');
      el.setAttribute('aria-selected', 'false');
    });

    const sessionEl = this.sessionList.querySelector(`[data-session-id="${sessionId}"]`);
    if (sessionEl) {
      sessionEl.classList.add('active');
      sessionEl.setAttribute('aria-selected', 'true');
    }
  }

  /**
   * Update session info (name, path, provider)
   */
  updateSession(sessionId, updates) {
    const sessionEl = this.sessionList.querySelector(`[data-session-id="${sessionId}"]`);
    if (sessionEl) {
      if (updates.name) {
        const nameEl = sessionEl.querySelector('.session-name');
        if (nameEl) nameEl.textContent = updates.name;
      }
      if (updates.path || updates.provider) {
        const pathEl = sessionEl.querySelector('.session-path');
        if (pathEl) pathEl.textContent = updates.path || updates.provider;
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

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'session-rename-input';
    input.style.cssText = `
      width: 100%;
      background: var(--donna-bg-secondary, #27272a);
      border: 1px solid var(--donna-accent, #a78bfa);
      border-radius: 4px;
      padding: 2px 6px;
      color: var(--donna-text-primary, #e4e4e7);
      font-size: 13px;
      font-weight: 500;
      outline: none;
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
