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
      <div class="agent-picker-container">
        <div class="agent-picker-header">
          <h2>Choose Your AI</h2>
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

    if (this.agents.length === 0) {
      grid.innerHTML = `
        <div class="agent-picker-empty">
          <p>No AI CLIs found.</p>
          <p>Install Claude Code (<code>npm install -g @anthropic-ai/claude-code</code>) or Gemini CLI to get started.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.agents.map((agent, index) => `
      <div class="agent-card" data-agent-id="${agent.id}" tabindex="0">
        <div class="agent-icon" style="background: ${agent.color}20; color: ${agent.color}">
          ${agent.icon}
        </div>
        <div class="agent-info">
          <h3 class="agent-name">${agent.name}</h3>
          <p class="agent-description">${agent.description}</p>
          <span class="agent-cli">${agent.cli}</span>
        </div>
        <span class="agent-shortcut">${index + 1}</span>
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
    this.selectedAgent = agent;
    this.close();
    if (this.onSelectCallback) {
      this.onSelectCallback(agent);
    }
  }

  open(onSelect) {
    this.onSelectCallback = onSelect;
    this.selectedAgent = null;
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
  }

  destroy() {
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
    }
  }
}

// Export for use in other modules
window.AgentPicker = AgentPicker;
