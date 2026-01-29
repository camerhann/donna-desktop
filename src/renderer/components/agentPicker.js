/**
 * Donna Desktop - Agent Picker Component
 * Modal for selecting AI personality (Donna, Jarvis, Claude, Gemini)
 * Spawns Claude Code or Gemini CLI with personality prompts
 */

class AgentPicker {
  constructor() {
    this.modal = null;
    this.agents = [];
    this.selectedAgent = null;
    this.onSelectCallback = null;
    this.init();
  }

  init() {
    this.createModal();
    this.setupKeyboardShortcuts();
  }

  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'agent-picker-modal';
    this.modal.innerHTML = `
      <div class="agent-picker-backdrop"></div>
      <div class="agent-picker-container" role="dialog" aria-modal="true" aria-labelledby="agent-picker-title">
        <div class="agent-picker-header">
          <h2 id="agent-picker-title">Choose Your AI</h2>
          <p>Select a personality to start a new session</p>
        </div>
        <div class="agent-picker-grid" id="agent-grid">
          <!-- Agents will be populated here -->
        </div>
        <div class="agent-picker-footer">
          <button class="agent-picker-cancel">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.modal);

    // Close on backdrop click
    this.modal.querySelector('.agent-picker-backdrop').addEventListener('click', () => this.close());
    this.modal.querySelector('.agent-picker-cancel').addEventListener('click', () => this.close());
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!this.modal.classList.contains('active')) return;

      if (e.key === 'Escape') {
        this.close();
      } else if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (this.agents[index]) {
          this.selectAgent(this.agents[index]);
        }
      }
    });
  }

  async loadAgents() {
    try {
      // Get only agents with available CLIs
      this.agents = await window.donnaAgents.available();
      this.renderAgents();
    } catch (error) {
      console.error('Failed to load agents:', error);
      this.renderError('Failed to load agents. Please try again.');
    }
  }

  renderAgents() {
    const grid = this.modal.querySelector('#agent-grid');

    if (!this.agents || this.agents.length === 0) {
      grid.innerHTML = `
        <div class="agent-picker-empty">
          <p>No AI CLIs found.</p>
          <p>Install Claude Code (<code>npm install -g @anthropic-ai/claude-code</code>) or Gemini CLI to get started.</p>
        </div>
      `;
      return;
    }

    // Filter out malformed agent entries to handle loading failures gracefully
    const validAgents = this.agents.filter(agent => agent && agent.id && agent.name);
    if (validAgents.length === 0) {
      grid.innerHTML = `
        <div class="agent-picker-empty">
          <p>No valid AI agents available.</p>
          <p>Agent data may be corrupted. Please restart the application.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = validAgents.map((agent, index) => `
      <div class="agent-card" data-agent-id="${agent.id}" tabindex="0" role="button" aria-label="${agent.name}: ${agent.description || ''}. Press ${index + 1} or Enter to select.">
        <div class="agent-icon" style="background: ${agent.color || '#6366f1'}20; color: ${agent.color || '#6366f1'}" aria-hidden="true">
          ${agent.icon || '?'}
        </div>
        <div class="agent-info">
          <h3 class="agent-name">${agent.name}</h3>
          <p class="agent-description">${agent.description || ''}</p>
          <span class="agent-cli">${agent.cli || 'unknown'}</span>
        </div>
        <span class="agent-shortcut" aria-hidden="true">${index + 1}</span>
      </div>
    `).join('');

    // Add click handlers
    grid.querySelectorAll('.agent-card').forEach((card) => {
      card.addEventListener('click', () => {
        const agentId = card.dataset.agentId;
        const agent = this.agents.find(a => a.id === agentId);
        if (agent) this.selectAgent(agent);
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const agentId = card.dataset.agentId;
          const agent = this.agents.find(a => a.id === agentId);
          if (agent) this.selectAgent(agent);
        }
      });
    });
  }

  renderError(message) {
    const grid = this.modal.querySelector('#agent-grid');
    grid.innerHTML = `
      <div class="agent-picker-error">
        <p>${message}</p>
      </div>
    `;
  }

  selectAgent(agent) {
    console.log('[AgentPicker] selectAgent called with:', agent);
    this.selectedAgent = agent;
    // Save callback before close() nullifies it
    const callback = this.onSelectCallback;
    this.close();
    if (callback) {
      console.log('[AgentPicker] Calling onSelectCallback');
      callback(agent);
    } else {
      console.log('[AgentPicker] No onSelectCallback set!');
    }
  }

  open(onSelect) {
    this.onSelectCallback = onSelect;
    this.selectedAgent = null;
    // Store the currently focused element to restore focus on close
    this.previouslyFocusedElement = document.activeElement;
    this.loadAgents();
    this.modal.classList.add('active');

    // Focus first agent card after render
    setTimeout(() => {
      const firstCard = this.modal.querySelector('.agent-card');
      if (firstCard) firstCard.focus();
    }, 100);
  }

  close() {
    this.modal.classList.remove('active');
    this.onSelectCallback = null;
    // Return focus to the element that opened the modal
    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus();
      this.previouslyFocusedElement = null;
    }
  }

  destroy() {
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
    }
  }
}

// Export for use in other modules
window.AgentPicker = AgentPicker;
